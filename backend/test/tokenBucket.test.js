import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * Reference implementation of the refill/consume maths in
 * src/redis/scripts/token_bucket.lua. Keeping a JS twin under test documents
 * the intended behaviour and catches regressions without needing a live Redis.
 *
 * TODO: add an integration suite that runs the real Lua against a disposable
 * Redis (testcontainers or a compose service) and asserts the two agree.
 */
const step = ({ tokens, updatedAt, now, capacity, refillRate, cost }) => {
  const elapsed = Math.max(0, now - updatedAt);
  const refilled = Math.min(capacity, tokens + (elapsed * refillRate) / 1000);

  if (refilled >= cost) {
    return { allowed: true, tokens: refilled - cost, retryAfterMs: 0 };
  }
  return {
    allowed: false,
    tokens: refilled,
    retryAfterMs: Math.ceil(((cost - refilled) / refillRate) * 1000),
  };
};

test('a cold bucket starts full and serves the first request', () => {
  const result = step({ tokens: 10, updatedAt: 0, now: 0, capacity: 10, refillRate: 1, cost: 1 });
  assert.equal(result.allowed, true);
  assert.equal(result.tokens, 9);
});

test('an exhausted bucket blocks and reports when to retry', () => {
  const result = step({ tokens: 0, updatedAt: 0, now: 0, capacity: 10, refillRate: 2, cost: 1 });
  assert.equal(result.allowed, false);
  assert.equal(result.retryAfterMs, 500);
});

test('tokens refill at the configured rate', () => {
  const result = step({ tokens: 0, updatedAt: 0, now: 2000, capacity: 10, refillRate: 2, cost: 1 });
  assert.equal(result.allowed, true);
  assert.equal(result.tokens, 3);
});

test('refill never exceeds capacity', () => {
  const result = step({
    tokens: 0,
    updatedAt: 0,
    now: 60_000,
    capacity: 10,
    refillRate: 5,
    cost: 1,
  });
  assert.equal(result.tokens, 9);
});

test('a costly request spends more than one token', () => {
  const result = step({ tokens: 10, updatedAt: 0, now: 0, capacity: 10, refillRate: 1, cost: 5 });
  assert.equal(result.allowed, true);
  assert.equal(result.tokens, 5);
});

test('a burst of capacity+1 requests blocks exactly once', () => {
  const capacity = 5;
  let state = { tokens: capacity, updatedAt: 0 };
  let blocked = 0;

  for (let i = 0; i <= capacity; i += 1) {
    const result = step({ ...state, now: 0, capacity, refillRate: 1, cost: 1 });
    if (!result.allowed) blocked += 1;
    state = { tokens: result.tokens, updatedAt: 0 };
  }

  assert.equal(blocked, 1);
});
