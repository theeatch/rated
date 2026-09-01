/**
 * Rate-limiting policies.
 *
 * A policy is a token bucket definition:
 *   capacity   — burst size; the maximum number of tokens the bucket holds.
 *   refillRate — tokens added per second (fractional values are allowed).
 *   cost       — tokens consumed by a single request.
 *   scope      — how the bucket key is derived: 'ip' | 'apiKey' | 'user' | 'global'.
 *
 * Policies live in code so they are reviewable, but `policyService` allows
 * overriding them at runtime from the dashboard for experimentation.
 */
export const policies = {
  default: {
    name: 'default',
    description: 'Baseline policy for unclassified traffic.',
    capacity: 60,
    refillRate: 10,
    cost: 1,
    scope: 'ip',
  },
  strict: {
    name: 'strict',
    description: 'Tight budget for expensive or abuse-prone endpoints.',
    capacity: 10,
    refillRate: 1,
    cost: 1,
    scope: 'ip',
  },
  burst: {
    name: 'burst',
    description: 'Large burst allowance for read-heavy endpoints.',
    capacity: 200,
    refillRate: 50,
    cost: 1,
    scope: 'ip',
  },
  auth: {
    name: 'auth',
    description: 'Credential endpoints — small bucket, slow refill.',
    capacity: 5,
    refillRate: 0.2,
    cost: 1,
    scope: 'ip',
  },
  partner: {
    name: 'partner',
    description: 'Per-API-key budget for integration partners.',
    capacity: 500,
    refillRate: 100,
    cost: 1,
    scope: 'apiKey',
  },
};

export const policyNames = Object.keys(policies);

export const isPolicy = (name) => Object.hasOwn(policies, name);

export default policies;
