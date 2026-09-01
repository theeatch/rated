import { consume, resolveIdentity } from '../services/rateLimiter.service.js';
import { getPolicy } from '../services/policy.service.js';
import { msToSeconds } from '../utils/time.js';
import { logger } from '../utils/logger.js';

const setHeaders = (res, decision) => {
  res.set('X-RateLimit-Policy', decision.policy);
  res.set('X-RateLimit-Limit', String(decision.limit));
  res.set('X-RateLimit-Remaining', String(Math.max(0, Math.floor(decision.remaining))));
  res.set('X-RateLimit-Reset', String(msToSeconds(decision.resetAfterMs)));
  if (decision.degraded) res.set('X-RateLimit-Degraded', 'true');
  if (!decision.allowed && decision.retryAfterMs > 0) {
    res.set('Retry-After', String(msToSeconds(decision.retryAfterMs)));
  }
};

/**
 * Configurable rate-limit middleware.
 *
 *   app.use('/api/search', rateLimiter({ policy: 'strict', cost: 5 }))
 *
 * @param {object}   [options]
 * @param {string}   [options.policy]        Policy name from config/policies.js.
 * @param {number}   [options.cost]          Token cost override for this route.
 * @param {Function} [options.keyGenerator]  (req) => identity string.
 * @param {Function} [options.skip]          (req) => true to bypass the limiter.
 * @param {Function} [options.onBlocked]     (req, res, decision) => void.
 */
export const rateLimiter = (options = {}) => {
  const {
    policy: policyName,
    cost,
    keyGenerator,
    skip,
    onBlocked,
    headers = true,
  } = options;

  return async (req, res, next) => {
    try {
      if (typeof skip === 'function' && skip(req)) return next();

      const policy = getPolicy(policyName);
      const identity = keyGenerator ? keyGenerator(req) : resolveIdentity(req, policy);

      const decision = await consume({
        policyName: policy.name,
        identity,
        cost,
        route: `${req.method} ${req.baseUrl || ''}${req.path}`,
      });

      req.rateLimit = decision;
      if (headers) setHeaders(res, decision);

      if (decision.allowed) return next();

      logger.debug('ratelimit.blocked', {
        policy: decision.policy,
        identity: decision.identity,
        path: req.originalUrl,
      });

      if (typeof onBlocked === 'function') onBlocked(req, res, decision);
      if (res.headersSent) return undefined;

      return res.status(429).json({
        error: {
          code: 'rate_limit_exceeded',
          message: 'Too many requests — token bucket exhausted.',
          policy: decision.policy,
          limit: decision.limit,
          remaining: Math.max(0, Math.floor(decision.remaining)),
          retryAfterMs: decision.retryAfterMs,
        },
      });
    } catch (error) {
      // A limiter fault must never take the API down with it.
      logger.error('ratelimit.middleware_error', { error: error.message });
      return next();
    }
  };
};

export default rateLimiter;
