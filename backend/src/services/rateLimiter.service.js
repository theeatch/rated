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

    // Display-only feed for the dashboard; deliberately outside the atomic
    // section so a slow trim can never delay a rate-limit decision.
    recordEvent({ ...decision, route, at: timestamp }).catch(() => {});

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

const recordEvent = async (event) => {
  if (!isRedisReady()) return;
  const redis = getRedis();
  await redis
    .multi()
    .lpush(
      eventsKey(),
      JSON.stringify({
        at: event.at,
        policy: event.policy,
        identity: event.identity,
        route: event.route,
        allowed: event.allowed,
        remaining: Math.round(event.remaining * 100) / 100,
        limit: event.limit,
      }),
    )
    .ltrim(eventsKey(), 0, EVENT_LOG_SIZE - 1)
    .expire(eventsKey(), config.metrics.ttlSeconds)
    .exec();
};

/** Drops the bucket for one identity — used by the dashboard's reset action. */
export const resetBucket = async (policyName, identity) => {
  if (!isRedisReady()) return false;
  const removed = await getRedis().del(bucketKey(policyName, identity));
  logger.info('ratelimit.bucket_reset', { policy: policyName, identity });
  return removed > 0;
};

export default { consume, resolveIdentity, resetBucket };
