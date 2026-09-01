import { isPolicy } from '../config/policies.js';
import { getPolicy, listPolicies, refreshOverrides, resetPolicy, updatePolicy } from '../services/policy.service.js';
import { listBuckets } from '../services/bucket.service.js';
import { resetBucket } from '../services/rateLimiter.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound } from '../utils/errors.js';

export const list = asyncHandler(async (_req, res) => {
  await refreshOverrides({ force: true });
  res.json({ policies: listPolicies() });
});

export const detail = asyncHandler(async (req, res) => {
  // getPolicy() falls back to the default policy by design — the middleware
  // must never fail on a typo'd name — but the HTTP endpoint should 404.
  if (!isPolicy(req.params.name)) throw notFound(`Unknown policy "${req.params.name}"`);

  await refreshOverrides({ force: true });
  const policy = getPolicy(req.params.name);
  const { buckets } = await listBuckets({ policy: req.params.name, limit: 50 });
  res.json({ policy, buckets });
});

export const update = asyncHandler(async (req, res) => {
  res.json({ policy: await updatePolicy(req.params.name, req.body || {}) });
});

export const reset = asyncHandler(async (req, res) => {
  res.json({ policy: await resetPolicy(req.params.name) });
});

/** Drops one identity's bucket so it starts full again. */
export const clearBucket = asyncHandler(async (req, res) => {
  const { identity } = req.body || {};
  if (!identity) throw badRequest('An "identity" is required');
  const removed = await resetBucket(req.params.name, identity);
  res.json({ status: 'ok', removed });
});

export default { list, detail, update, reset, clearBucket };
