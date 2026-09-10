import { createHash, timingSafeEqual } from 'node:crypto';

import { config } from '../config/index.js';
import { unauthorized } from '../utils/errors.js';

const bearer = (req) => {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
};

/**
 * Constant-time secret comparison.
 *
 * Hashing first gives both sides a fixed 32-byte length, so the comparison
 * neither short-circuits on the first differing byte nor leaks the secret's
 * length by taking a different code path — which a plain `!==` does on both
 * counts.
 */
const secretsMatch = (provided, expected) => {
  const digest = (value) => createHash('sha256').update(String(value ?? '')).digest();
  return timingSafeEqual(digest(provided), digest(expected));
};

/**
 * Guards the read-only dashboard API.
 * Disabled by default in development — flip REQUIRE_API_KEY=true to enforce.
 */
export const requireApiKey = (req, _res, next) => {
  if (!config.auth.requireApiKey) return next();

  const provided = req.get('x-api-key') || bearer(req);
  if (!config.auth.dashboardApiKey || !secretsMatch(provided, config.auth.dashboardApiKey)) {
    return next(unauthorized('A valid dashboard API key is required'));
  }
  return next();
};

/** Guards destructive maintenance endpoints (bucket/metric resets). */
export const requireAdmin = (req, _res, next) => {
  const provided = bearer(req) || req.get('x-admin-token');
  if (!config.auth.adminToken) {
    return next(unauthorized('ADMIN_TOKEN is not configured on the server'));
  }
  if (!secretsMatch(provided, config.auth.adminToken)) {
    return next(unauthorized('A valid admin token is required'));
  }
  return next();
};

export default { requireApiKey, requireAdmin };
