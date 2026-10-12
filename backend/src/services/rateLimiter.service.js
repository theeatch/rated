import { config } from '../config/index.js';
import { getRedis, isRedisReady } from '../redis/client.js';
import {
  bucketKey,
  eventsKey,
  policyTotalsKey,
  timeseriesKey,
  totalsKey,
} from '../utils/keys.js';
import { logger } from '../utils/logger.js';
import { nowMs, nowSeconds } from '../utils/time.js';
import { getPolicy, refreshOverrides } from './policy.service.js';

const EVENT_LOG_SIZE = 200;

/**
 * Derives the bucket identity from the request according to the policy scope.
 * Everything the limiter partitions on funnels through here so the choice is
 * auditable in one place.
 */
export const resolveIdentity = (req, policy) => {
  switch (policy.scope) {
    case 'apiKey':
      return `key:${req.get('x-api-key') || 'anonymous'}`;
    case 'user':
      return `user:${req.user?.id || req.get('x-user-id') || 'anonymous'}`;
    case 'global':
      return 'global';
    case 'ip':
    default:
      return `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
  }
};

/**
 * Runs one token-bucket decision.
 *
 * The refill, the consume and the counter updates all happen inside a single
 * Lua script, so N API nodes hitting the same bucket concurrently can never
 * double-spend a token.
 */
export const consume = async ({ policyName, identity, cost, route = 'unknown' }) => {
  await refreshOverrides();
  const policy = getPolicy(policyName);
  const tokenCost = Number(cost ?? policy.cost ?? 1);
  const timestamp = nowMs();

  if (!isRedisReady()) {
    const failOpen = config.rateLimit.failureMode === 'open';
    logger.warn('ratelimit.degraded', { policy: policy.name, failOpen });
    return {
      allowed: failOpen,
      degraded: true,
      policy: policy.name,
      identity,
      limit: policy.capacity,
      remaining: failOpen ? policy.capacity : 0,
      retryAfterMs: failOpen ? 0 : 1000,
      resetAfterMs: 0,
      cost: tokenCost,
    };
  }

  const redis = getRedis();
  const second = nowSeconds();

  try {
    const [allowed, tokensRaw, retryAfterMs, resetAfterMs, capacity] = await redis.tokenBucket(
      bucketKey(policy.name, identity),
      totalsKey(),
      policyTotalsKey(policy.name),
      timeseriesKey(second),
      policy.capacity,
      policy.refillRate,
      tokenCost,
      timestamp,
      config.rateLimit.bucketTtlSeconds,
      config.metrics.ttlSeconds,
    );

    const remaining = Number.parseFloat(tokensRaw);
    const decision = {
      allowed: allowed === 1,
      degraded: false,
      policy: policy.name,
      identity,
      limit: Number(capacity),
      remaining,
      retryAfterMs: Number(retryAfterMs),
      resetAfterMs: Number(resetAfterMs),
      cost: tokenCost,
      refillRate: policy.refillRate,
    };

    // Display-only feed for the dashboard; buffered and flushed in batches so it
    // costs a handful of Redis commands per flush, not several per request.
    queueEvent({ ...decision, route, at: timestamp });

    return decision;
  } catch (error) {
    logger.error('ratelimit.script_failed', { error: error.message, policy: policy.name });
    const failOpen = config.rateLimit.failureMode === 'open';
    return {
      allowed: failOpen,
      degraded: true,
      policy: policy.name,
      identity,
      limit: policy.capacity,
      remaining: failOpen ? policy.capacity : 0,
      retryAfterMs: failOpen ? 0 : 1000,
      resetAfterMs: 0,
      cost: tokenCost,
    };
  }
};

const EVENT_FLUSH_MS = 5000;
let eventBuffer = [];
let flushTimer = null;

const flushEvents = async () => {
  flushTimer = null;
  const batch = eventBuffer;
  eventBuffer = [];
  if (batch.length === 0 || !isRedisReady()) return;

  try {
    // The buffer is oldest-first and LPUSH with several values leaves the last
    // one at the head, so the newest event still ends up first in the list.
    await getRedis()
      .pipeline()
      .lpush(eventsKey(), ...batch)
      .ltrim(eventsKey(), 0, EVENT_LOG_SIZE - 1)
      .expire(eventsKey(), config.metrics.ttlSeconds)
      .exec();
  } catch (error) {
    logger.warn('ratelimit.event_flush_failed', { error: error.message });
  }
};

const queueEvent = (event) => {
  eventBuffer.push(
    JSON.stringify({
      at: event.at,
      policy: event.policy,
      identity: event.identity,
      route: event.route,
      allowed: event.allowed,
      remaining: Math.round(event.remaining * 100) / 100,
      limit: event.limit,
    }),
  );
  // Only the newest EVENT_LOG_SIZE can ever be shown, so never hold more.
  if (eventBuffer.length > EVENT_LOG_SIZE) {
    eventBuffer.splice(0, eventBuffer.length - EVENT_LOG_SIZE);
  }
  if (!flushTimer) {
    flushTimer = setTimeout(() => void flushEvents(), EVENT_FLUSH_MS);
    flushTimer.unref?.();
  }
};

/** Drops the bucket for one identity — used by the dashboard's reset action. */
export const resetBucket = async (policyName, identity) => {
  if (!isRedisReady()) return false;
  const removed = await getRedis().del(bucketKey(policyName, identity));
  logger.info('ratelimit.bucket_reset', { policy: policyName, identity });
  return removed > 0;
};

export default { consume, resolveIdentity, resetBucket };
