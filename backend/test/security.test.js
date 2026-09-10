import assert from 'node:assert/strict';
import { test } from 'node:test';

import { config, parseTrustProxy } from '../src/config/index.js';
import { requireAdmin, requireApiKey } from '../src/middleware/auth.middleware.js';
import { updatePolicy } from '../src/services/policy.service.js';

/**
 * Guards for the three ways this service can be talked out of rate limiting:
 * a spoofed client identity, a guessed credential, and an override that lifts
 * the limit past the point of doing anything.
 */

// --- Client identity -------------------------------------------------------

test('trust proxy defaults to off, so req.ip is the socket address', () => {
  assert.equal(parseTrustProxy(undefined), false);
  assert.equal(parseTrustProxy(''), false);
});

test('trust proxy accepts a hop count', () => {
  assert.equal(parseTrustProxy('1'), 1);
  assert.equal(parseTrustProxy('2'), 2);
});

test('trust proxy treats every spelling of off as off', () => {
  for (const value of ['false', 'FALSE', 'off', 'no', '0']) {
    assert.equal(parseTrustProxy(value), false, `${value} should disable trust proxy`);
  }
});

test('trust proxy passes an address or CIDR through to Express', () => {
  assert.equal(parseTrustProxy('10.0.0.0/8'), '10.0.0.0/8');
  assert.equal(parseTrustProxy('loopback'), 'loopback');
});

test('trust proxy still honours an explicit true, which the audit warns about', () => {
  // Opt-in only: trusting the whole X-Forwarded-For chain lets any caller mint
  // a fresh bucket per request. config/audit.js flags this at startup.
  assert.equal(parseTrustProxy('true'), true);
});

// --- Credentials -----------------------------------------------------------

const fakeReq = (headers = {}) => ({
  get: (name) => headers[name.toLowerCase()] ?? undefined,
});

const runGuard = (guard, req) => {
  let outcome = 'passed';
  guard(req, {}, (error) => {
    if (error) outcome = error.status;
  });
  return outcome;
};

test('the admin guard rejects a wrong token and accepts the right one', () => {
  const original = config.auth.adminToken;
  config.auth.adminToken = 'correct-horse-battery-staple';
  try {
    assert.equal(runGuard(requireAdmin, fakeReq({ authorization: 'Bearer wrong' })), 401);
    // A prefix of the real token must not pass — the comparison is on digests,
    // not a byte-by-byte walk that stops early.
    assert.equal(runGuard(requireAdmin, fakeReq({ authorization: 'Bearer correct-horse' })), 401);
    assert.equal(runGuard(requireAdmin, fakeReq({})), 401);
    assert.equal(
      runGuard(requireAdmin, fakeReq({ authorization: 'Bearer correct-horse-battery-staple' })),
      'passed',
    );
  } finally {
    config.auth.adminToken = original;
  }
});

test('the admin guard refuses everything when no token is configured', () => {
  const original = config.auth.adminToken;
  config.auth.adminToken = '';
  try {
    assert.equal(runGuard(requireAdmin, fakeReq({ authorization: 'Bearer anything' })), 401);
  } finally {
    config.auth.adminToken = original;
  }
});

test('the dashboard guard enforces the key only when REQUIRE_API_KEY is on', () => {
  const originalKey = config.auth.dashboardApiKey;
  const originalFlag = config.auth.requireApiKey;
  config.auth.dashboardApiKey = 'dashboard-secret';
  try {
    config.auth.requireApiKey = false;
    assert.equal(runGuard(requireApiKey, fakeReq({})), 'passed');

    config.auth.requireApiKey = true;
    assert.equal(runGuard(requireApiKey, fakeReq({})), 401);
    assert.equal(runGuard(requireApiKey, fakeReq({ 'x-api-key': 'nope' })), 401);
    assert.equal(runGuard(requireApiKey, fakeReq({ 'x-api-key': 'dashboard-secret' })), 'passed');
  } finally {
    config.auth.dashboardApiKey = originalKey;
    config.auth.requireApiKey = originalFlag;
  }
});

// --- Override ceilings -----------------------------------------------------

const rejects = async (patch, expected) => {
  await assert.rejects(
    () => updatePolicy('default', patch),
    (error) => {
      assert.equal(error.status, 400);
      assert.ok(
        error.details.some((detail) => detail.includes(expected)),
        `expected a "${expected}" complaint, got ${JSON.stringify(error.details)}`,
      );
      return true;
    },
  );
};

test('an override cannot lift capacity past the configured ceiling', async () => {
  await rejects({ capacity: config.policyLimits.maxCapacity + 1 }, 'must not exceed');
});

test('an override cannot lift the refill rate past the ceiling', async () => {
  await rejects({ refillRate: config.policyLimits.maxRefillRate + 1 }, 'must not exceed');
});

test('an override cannot lift cost past the ceiling', async () => {
  await rejects({ cost: config.policyLimits.maxCost + 1 }, 'must not exceed');
});

test('the existing floors still hold', async () => {
  await rejects({ capacity: 0 }, 'positive');
  await rejects({ capacity: -5 }, 'positive');
  await rejects({ refillRate: -1 }, 'zero or greater');
  await rejects({ scope: 'nonsense' }, 'scope must be one of');
});

test('an in-range override is accepted', async () => {
  // No Redis in the unit suite; updatePolicy applies to the in-process cache
  // and skips the write, which is the path we want to exercise here.
  const updated = await updatePolicy('default', { capacity: 120, refillRate: 20 });
  assert.equal(updated.capacity, 120);
  assert.equal(updated.refillRate, 20);
  assert.equal(updated.overridden, true);
});
