import { config } from '../config/index.js';
import { isRedisReady, getRedisError } from '../redis/client.js';
import { getRedisSnapshot } from '../redis/info.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const startedAt = Date.now();

/** Liveness: the process is up. Used by the Docker healthcheck. */
export const live = (_req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) });
};

/** Readiness: dependencies are usable, or the failure mode tolerates their loss. */
export const ready = (_req, res) => {
  const redisReady = isRedisReady();
  const degradedButServing = !redisReady && config.rateLimit.failureMode === 'open';
  const status = redisReady ? 'ok' : degradedButServing ? 'degraded' : 'unavailable';

  res.status(status === 'unavailable' ? 503 : 200).json({
    status,
    redis: { connected: redisReady, error: redisReady ? null : getRedisError() },
    failureMode: config.rateLimit.failureMode,
  });
};

/** Full Redis snapshot for the dashboard's system-health panel. */
export const redisState = asyncHandler(async (_req, res) => {
  res.json({ redis: await getRedisSnapshot() });
});

export default { live, ready, redisState };
