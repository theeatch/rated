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
 * Per-second throughput series for the dashboard chart.
 * One hash per wall-clock second is written by the rate-limit script; we read
 * the trailing window in a single pipeline and zero-fill any quiet seconds.
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

  const pipeline = getRedis().pipeline();
  for (const second of seconds) pipeline.hgetall(timeseriesKey(second));
  const results = await pipeline.exec();

  return seconds.map((second, index) => {
    const [error, hash] = results[index];
    const counts = error ? EMPTY_TOTALS : toCounts(hash);
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

  return redis.del(...keys, ...tsKeys);
};

export default { getTotals, getTimeseries, getRecentEvents, summariseThroughput, resetMetrics };
