import { config } from '../config/index.js';

const prefix = config.redis.keyPrefix;

/** Bucket holding the token state for one identity under one policy. */
export const bucketKey = (policy, identity) => `${prefix}:bucket:${policy}:${identity}`;

/** Pattern used by SCAN when the dashboard inspects live buckets. */
export const bucketPattern = (policy = '*') => `${prefix}:bucket:${policy}:*`;

/** Parses a bucket key back into its parts. Returns null when it does not match. */
export const parseBucketKey = (key) => {
  const parts = key.split(':');
  if (parts.length < 4 || parts[1] !== 'bucket') return null;
  return { policy: parts[2], identity: parts.slice(3).join(':') };
};

/** Rolling counters: total allowed / blocked since process start. */
export const totalsKey = () => `${prefix}:metrics:totals`;

/** Per-policy counters. */
export const policyTotalsKey = (policy) => `${prefix}:metrics:policy:${policy}`;

/** One hash per wall-clock second, used to draw the throughput chart. */
export const timeseriesKey = (epochSecond) => `${prefix}:metrics:ts:${epochSecond}`;

/** Capped list of the most recent decisions, newest first. */
export const eventsKey = () => `${prefix}:metrics:events`;

/** Runtime policy overrides applied from the dashboard. */
export const policyOverrideKey = () => `${prefix}:config:policies`;

export default {
  bucketKey,
  bucketPattern,
  parseBucketKey,
  totalsKey,
  policyTotalsKey,
  timeseriesKey,
  eventsKey,
  policyOverrideKey,
};
