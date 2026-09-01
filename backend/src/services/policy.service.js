import { config } from '../config/index.js';
import { policies as basePolicies, isPolicy } from '../config/policies.js';
import { getRedis, isRedisReady } from '../redis/client.js';
import { policyOverrideKey } from '../utils/keys.js';
import { logger } from '../utils/logger.js';
import { badRequest, notFound } from '../utils/errors.js';

/**
 * Policies are defined in code and may be overridden at runtime so the
 * dashboard can tune limits live. Overrides are cached in-process and
 * refreshed from Redis on a short interval to keep the hot path allocation
 * free — the rate-limit middleware must not await an extra round trip.
 */
const OVERRIDE_REFRESH_MS = 2000;

let overrides = {};
let lastRefresh = 0;

const clone = (policy) => ({ ...policy });

const validate = (patch) => {
  const errors = [];
  if (patch.capacity !== undefined && !(Number(patch.capacity) > 0)) {
    errors.push('capacity must be a positive number');
  }
  if (patch.refillRate !== undefined && !(Number(patch.refillRate) >= 0)) {
    errors.push('refillRate must be zero or greater');
  }
  if (patch.cost !== undefined && !(Number(patch.cost) > 0)) {
    errors.push('cost must be a positive number');
  }
  if (patch.scope !== undefined && !['ip', 'apiKey', 'user', 'global'].includes(patch.scope)) {
    errors.push('scope must be one of ip, apiKey, user, global');
  }
  if (errors.length) throw badRequest('Invalid policy definition', errors);
};

export const refreshOverrides = async ({ force = false } = {}) => {
  if (!isRedisReady()) return overrides;
  if (!force && Date.now() - lastRefresh < OVERRIDE_REFRESH_MS) return overrides;

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
