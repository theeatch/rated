import { getRedis, isRedisReady } from '../redis/client.js';
import { bucketPattern, parseBucketKey } from '../utils/keys.js';
import { nowMs } from '../utils/time.js';
import { getPolicy } from './policy.service.js';

const SCAN_COUNT = 200;
const MAX_KEYS = 500;

/** Non-blocking SCAN over live bucket keys, capped so the dashboard stays cheap. */
const scanBuckets = async (pattern, limit) => {
  const redis = getRedis();
  const found = [];
  let cursor = '0';

  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', SCAN_COUNT);
    cursor = next;
    found.push(...keys);
  } while (cursor !== '0' && found.length < limit);

  return found.slice(0, limit);
};

/**
 * Current state of every active bucket, with the same lazy refill the limiter
 * applies — so "remaining" matches what the next request would actually see.
 */
export const listBuckets = async ({ policy = '*', limit = MAX_KEYS } = {}) => {
  if (!isRedisReady()) return { buckets: [], scanned: 0, truncated: false };

  const redis = getRedis();
  const keys = await scanBuckets(bucketPattern(policy), limit);
  if (keys.length === 0) return { buckets: [], scanned: 0, truncated: false };

  const timestamp = nowMs();
  const pipeline = redis.pipeline();
  const meta = [];

  for (const key of keys) {
    const parsed = parseBucketKey(key);
    if (!parsed) continue;
    const definition = getPolicy(parsed.policy);
    meta.push({ ...parsed, definition });
    pipeline.peekBucket(key, definition.capacity, definition.refillRate, timestamp);
  }

  const results = await pipeline.exec();

  const buckets = results
    .map(([error, value], index) => {
      if (error || !value) return null;
      const [tokensRaw, updatedAtRaw, ttl] = value;
      const { policy: policyName, identity, definition } = meta[index];
      const remaining = Number.parseFloat(tokensRaw);
      const used = Math.max(0, definition.capacity - remaining);

      return {
        policy: policyName,
        identity,
        capacity: definition.capacity,
        refillRate: definition.refillRate,
        remaining: Math.round(remaining * 100) / 100,
        used: Math.round(used * 100) / 100,
        // Utilisation = share of the burst budget currently spent.
        utilization: definition.capacity > 0 ? used / definition.capacity : 0,
        updatedAt: Number(updatedAtRaw) || null,
        ttlSeconds: Number(ttl),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.utilization - a.utilization);

  return { buckets, scanned: keys.length, truncated: keys.length >= limit };
};

/** Aggregate token utilisation, overall and per policy. */
export const getUtilization = async (options) => {
  const { buckets, truncated } = await listBuckets(options);

  const totals = { capacity: 0, used: 0 };
  const byPolicy = new Map();

  for (const bucket of buckets) {
    totals.capacity += bucket.capacity;
    totals.used += bucket.used;

    const entry = byPolicy.get(bucket.policy) || {
      policy: bucket.policy,
      buckets: 0,
      capacity: 0,
      used: 0,
    };
    entry.buckets += 1;
    entry.capacity += bucket.capacity;
    entry.used += bucket.used;
    byPolicy.set(bucket.policy, entry);
  }

  const ratio = (used, capacity) => (capacity > 0 ? Math.min(1, used / capacity) : 0);

  return {
    activeBuckets: buckets.length,
    truncated,
    overall: {
      capacity: Math.round(totals.capacity),
      used: Math.round(totals.used * 100) / 100,
      utilization: ratio(totals.used, totals.capacity),
    },
    byPolicy: [...byPolicy.values()].map((entry) => ({
      ...entry,
      used: Math.round(entry.used * 100) / 100,
      utilization: ratio(entry.used, entry.capacity),
    })),
    topBuckets: buckets.slice(0, 10),
  };
};

export default { listBuckets, getUtilization };
