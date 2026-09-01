import { config } from '../config/index.js';
import { getRedisSnapshot } from '../redis/info.js';
import { getUtilization } from '../services/bucket.service.js';
import {
  getRecentEvents,
  getTimeseries,
  getTotals,
  resetMetrics,
  summariseThroughput,
} from '../services/metrics.service.js';
import { listPolicies, refreshOverrides } from '../services/policy.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const clampWindow = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return config.metrics.windowSeconds;
  return Math.min(Math.max(parsed, 10), config.metrics.ttlSeconds);
};

/**
 * One call that backs the whole dashboard — throughput, token utilisation,
 * blocked requests and Redis state — so every panel renders the same instant.
 */
export const summary = asyncHandler(async (req, res) => {
  const windowSeconds = clampWindow(req.query.window);
  await refreshOverrides();

  const [totals, series, utilization, redis, events] = await Promise.all([
    getTotals(),
    getTimeseries(windowSeconds),
    getUtilization(),
    getRedisSnapshot(),
    getRecentEvents(Number.parseInt(req.query.events, 10) || 25),
  ]);

  res.json({
    generatedAt: Date.now(),
    windowSeconds,
    throughput: summariseThroughput(series),
    totals: totals.overall,
    byPolicy: totals.byPolicy,
    utilization,
    series,
    events,
    redis,
    policies: listPolicies(),
    config: {
      failureMode: config.rateLimit.failureMode,
      defaultPolicy: config.rateLimit.defaultPolicy,
      bucketTtlSeconds: config.rateLimit.bucketTtlSeconds,
    },
  });
});

export const timeseries = asyncHandler(async (req, res) => {
  const windowSeconds = clampWindow(req.query.window);
  const series = await getTimeseries(windowSeconds);
  res.json({ windowSeconds, series, throughput: summariseThroughput(series) });
});

export const totals = asyncHandler(async (_req, res) => {
  res.json(await getTotals());
});

export const utilization = asyncHandler(async (req, res) => {
  res.json(await getUtilization({ policy: req.query.policy || '*' }));
});

export const events = asyncHandler(async (req, res) => {
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 50, 200);
  res.json({ events: await getRecentEvents(limit) });
});

export const reset = asyncHandler(async (_req, res) => {
  const removed = await resetMetrics();
  res.json({ status: 'ok', keysRemoved: removed });
});

export default { summary, timeseries, totals, utilization, events, reset };
