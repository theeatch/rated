import { config } from '../config/index.js';
import { policies as basePolicies, isPolicy } from '../config/policies.js';
import { getRedis, isRedisReady } from '../redis/client.js';
import { policyOverrideKey } from '../utils/keys.js';
import { logger } from '../utils/logger.js';
import { badRequest, notFound } from '../utils/errors.js';

/**
 * Policies are defined in code and may be overridden at runtime so the
 * dashboard can tune limits live. Overrides are cached in-process and
 * refreshed from Redis on an interval (config.rateLimit.overrideRefreshMs) to keep the hot path allocation
 * free — the rate-limit middleware must not await an extra round trip.
 */

let overrides = {};
let lastRefresh = 0;

const clone = (policy) => ({ ...policy });

/**
 * Validates an override patch.
 *
 * The ceilings matter as much as the floors: retuning limits live is the
 * feature, but an unbounded `capacity` is an off switch for the limiter — and
 * on a publicly reachable dashboard that switch is reachable by anyone. Ranges
 * come from config.policyLimits.
 */
const validate = (patch) => {
  const errors = [];
  const { maxCapacity, maxRefillRate, maxCost } = config.policyLimits;

  const check = (field, floorOk, floorLabel, max) => {
    const value = Number(patch[field]);
    if (!floorOk(value)) errors.push(`${field} must be ${floorLabel}`);
    else if (value > max) errors.push(`${field} must not exceed ${max}`);
  };

  const positive = (value) => value > 0;
  const nonNegative = (value) => value >= 0;

  if (patch.capacity !== undefined) check('capacity', positive, 'a positive number', maxCapacity);
  if (patch.refillRate !== undefined) {
    check('refillRate', nonNegative, 'zero or greater', maxRefillRate);
  }
  if (patch.cost !== undefined) check('cost', positive, 'a positive number', maxCost);
  if (patch.scope !== undefined && !['ip', 'apiKey', 'user', 'global'].includes(patch.scope)) {
    errors.push('scope must be one of ip, apiKey, user, global');
  }
  if (errors.length) throw badRequest('Invalid policy definition', errors);
};

export const refreshOverrides = async ({ force = false } = {}) => {
  if (!isRedisReady()) return overrides;
  if (!force && Date.now() - lastRefresh < config.rateLimit.overrideRefreshMs) return overrides;

  try {
    const raw = await getRedis().hgetall(policyOverrideKey());
    const next = {};
    for (const [name, json] of Object.entries(raw)) {
      try {
        next[name] = JSON.parse(json);
      } catch {
        logger.warn('policy.override_parse_failed', { policy: name });
      }
    }
    overrides = next;
    lastRefresh = Date.now();
  } catch (error) {
    logger.warn('policy.override_refresh_failed', { error: error.message });
  }
  return overrides;
};

/** Resolves the effective policy: base definition merged with any override. */
export const getPolicy = (name) => {
  const key = name && isPolicy(name) ? name : config.rateLimit.defaultPolicy;
  const base = basePolicies[key] || basePolicies.default;
  const override = overrides[key];
  return override ? { ...base, ...override, name: key } : clone(base);
};

export const listPolicies = () =>
  Object.keys(basePolicies).map((name) => ({
    ...getPolicy(name),
    overridden: Boolean(overrides[name]),
  }));

export const updatePolicy = async (name, patch) => {
  if (!isPolicy(name)) throw notFound(`Unknown policy "${name}"`);
  validate(patch);

  const next = {
    ...(overrides[name] || {}),
    ...(patch.capacity !== undefined ? { capacity: Number(patch.capacity) } : {}),
    ...(patch.refillRate !== undefined ? { refillRate: Number(patch.refillRate) } : {}),
    ...(patch.cost !== undefined ? { cost: Number(patch.cost) } : {}),
    ...(patch.scope !== undefined ? { scope: patch.scope } : {}),
  };

  overrides[name] = next;
  if (isRedisReady()) {
    await getRedis().hset(policyOverrideKey(), name, JSON.stringify(next));
  }
  logger.info('policy.updated', { policy: name, patch: next });
  return { ...getPolicy(name), overridden: true };
};

export const resetPolicy = async (name) => {
  if (!isPolicy(name)) throw notFound(`Unknown policy "${name}"`);
  delete overrides[name];
  if (isRedisReady()) {
    await getRedis().hdel(policyOverrideKey(), name);
  }
  logger.info('policy.reset', { policy: name });
  return { ...getPolicy(name), overridden: false };
};

export default { getPolicy, listPolicies, updatePolicy, resetPolicy, refreshOverrides };
