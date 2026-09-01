import { logger } from '../utils/logger.js';

/** Structured access log that also carries the rate-limit decision. */
export const requestLogger = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.info('http.request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ...(req.rateLimit
        ? {
            policy: req.rateLimit.policy,
            allowed: req.rateLimit.allowed,
            remaining: Math.floor(req.rateLimit.remaining),
          }
        : {}),
    });
  });

  next();
};

export default requestLogger;
