import { config } from '../config/index.js';
import { getRedis, isRedisReady } from '../redis/client.js';
import { policyNames } from '../config/policies.js';
import {
  eventsKey,
  policyTotalsKey,
  timeseriesKey,
  totalsKey,
} from '../utils/keys.js';
import { nowSeconds, recentSeconds } from '../utils/time.js';

const EMPTY_TOTALS = { allowed: 0, blocked: 0, total: 0 };

const toCounts = (hash = {}) => ({
  allowed: Number(hash.allowed || 0),
  blocked: Number(hash.blocked || 0),
  total: Number(hash.total || 0),
});

const withRate = (counts) => ({
  ...counts,
  blockRate: counts.total > 0 ? counts.blocked / counts.total : 0,
});

/** Lifetime counters, globally and per policy. */
export const getTotals = async () => {
  if (!isRedisReady()) {
    return {
      overall: withRate(EMPTY_TOTALS),
      byPolicy: policyNames.map((policy) => ({ policy, ...withRate(EMPTY_TOTALS) })),
    };
  }

  const redis = getRedis();
  const pipeline = redis.pipeline();
  pipeline.hgetall(totalsKey());
  for (const policy of policyNames) pipeline.hgetall(policyTotalsKey(policy));

  const results = await pipeline.exec();
  const [, overallHash] = results[0];

  return {
    overall: withRate(toCounts(overallHash)),
    byPolicy: policyNames.map((policy, index) => {
      const [, hash] = results[index + 1];
      return { policy, ...withRate(toCounts(hash)) };
    }),
  };
};

/**
 * Seconds older than this can no longer be written to, so a point read for one
 * is final and never needs to be fetched again.
 */
const SETTLED_AFTER_SECONDS = 3;
const settledPoints = new Map();

/**
 * Per-second throughput series for the dashboard chart.
 * One hash per wall-clock second is written by the rate-limit script. Settled
 * seconds are immutable, so they are remembered in-process and each poll only
 * reads the few seconds it has not seen yet — not the whole window — which is
 * the difference between ~5 and ~120 Redis commands per refresh.
 */
export const getTimeseries = async (windowSeconds = config.metrics.windowSeconds) => {
  const end = nowSeconds();
  const seconds = recentSeconds(windowSeconds, end);

  if (!isRedisReady()) {
    return seconds.map((second) => ({
      second,
      timestamp: second * 1000,
      allowed: 0,
      blocked: 0,
      total: 0,
    }));
  }

  const missing = seconds.filter((second) => !settledPoints.has(second));
  const fetched = new Map();

  if (missing.length > 0) {
    const pipeline = getRedis().pipeline();
    for (const second of missing) pipeline.hgetall(timeseriesKey(second));
    const results = await pipeline.exec();

    missing.forEach((second, index) => {
      const [error, hash] = results[index];
      const counts = error ? EMPTY_TOTALS : toCounts(hash);
      fetched.set(second, counts);
      if (!error && second <= end - SETTLED_AFTER_SECONDS) settledPoints.set(second, counts);
    });
  }

  // Bound memory to what the longest window can ask for.
  const oldest = end - config.metrics.ttlSeconds;
  for (const second of settledPoints.keys()) {
    if (second < oldest) settledPoints.delete(second);
  }

  return seconds.map((second) => {
    const counts = settledPoints.get(second) ?? fetched.get(second) ?? EMPTY_TOTALS;
    return {
      second,
      timestamp: second * 1000,
      allowed: counts.allowed,
      blocked: counts.blocked,
      total: counts.allowed + counts.blocked,
    };
  });
};

/** Recent decisions, newest first — the dashboard's live request feed. */
export const getRecentEvents = async (limit = 50) => {
  if (!isRedisReady()) return [];
  const raw = await getRedis().lrange(eventsKey(), 0, limit - 1);
  return raw
    .map((entry) => {
      try {
        return JSON.parse(entry);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
};

/** Requests per second averaged over the trailing `sampleSeconds`. */
export const summariseThroughput = (series, sampleSeconds = 10) => {
  const sample = series.slice(-sampleSeconds);
  if (sample.length === 0) return { requestsPerSecond: 0, allowedPerSecond: 0, blockedPerSecond: 0 };

  const sum = sample.reduce(
    (acc, point) => ({
      total: acc.total + point.total,
      allowed: acc.allowed + point.allowed,
      blocked: acc.blocked + point.blocked,
    }),
    { total: 0, allowed: 0, blocked: 0 },
  );

  const round = (value) => Math.round((value / sample.length) * 100) / 100;
  return {
    requestsPerSecond: round(sum.total),
    allowedPerSecond: round(sum.allowed),
    blockedPerSecond: round(sum.blocked),
    windowSeconds: sample.length,
  };
};

/** Clears every metrics key. Used by the dashboard's "reset" control. */
export const resetMetrics = async () => {
  if (!isRedisReady()) return 0;
  const redis = getRedis();
  const keys = [totalsKey(), eventsKey(), ...policyNames.map(policyTotalsKey)];

  let cursor = '0';
  const tsKeys = [];
  do {
    const [next, found] = await redis.scan(
      cursor,
      'MATCH',
      timeseriesKey('*'),
      'COUNT',
      200,
    );
    cursor = next;
    tsKeys.push(...found);
  } while (cursor !== '0');

  settledPoints.clear();
  return redis.del(...keys, ...tsKeys);
};

/**
 * Shares one dashboard summary between every client for `cacheSeconds`.
 * The stored value is the in-flight promise, so concurrent requests during a
 * rebuild also collapse into a single set of Redis reads.
 */
const MAX_CACHED_SUMMARIES = 20;
const summaryCache = new Map();

export const cachedSummary = (key, build) => {
  const ttlMs = config.metrics.cacheSeconds * 1000;
  const hit = summaryCache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.promise;

  if (summaryCache.size >= MAX_CACHED_SUMMARIES) summaryCache.clear();
  const promise = build();
  const entry = { at: Date.now(), promise };
  summaryCache.set(key, entry);
  promise.catch(() => {
    if (summaryCache.get(key) === entry) summaryCache.delete(key);
  });
  return promise;
};

/** Call after anything that changes what the dashboard shows (policy edits, resets). */
export const invalidateSummaryCache = () => summaryCache.clear();

export default { getTotals, getTimeseries, getRecentEvents, summariseThroughput, resetMetrics, cachedSummary, invalidateSummaryCache };
