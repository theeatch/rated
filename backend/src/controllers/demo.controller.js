/**
 * Stand-in "protected" endpoints.
 *
 * These exist so the dashboard's traffic generator has something realistic to
 * hammer: each one is mounted behind a different policy in routes/demo.routes.js.
 * Swap them for your real handlers — the middleware wiring stays the same.
 */
import { asyncHandler } from '../utils/asyncHandler.js';

const envelope = (req, payload) => ({
  ...payload,
  rateLimit: req.rateLimit
    ? {
        policy: req.rateLimit.policy,
        limit: req.rateLimit.limit,
        remaining: Math.max(0, Math.floor(req.rateLimit.remaining)),
        degraded: req.rateLimit.degraded,
      }
    : null,
});

export const ping = (req, res) => {
  res.json(envelope(req, { message: 'pong', at: Date.now() }));
};

export const search = asyncHandler(async (req, res) => {
  const query = String(req.query.q || '');
  res.json(
    envelope(req, {
      query,
      results: Array.from({ length: 3 }, (_, i) => ({
        id: `result-${i + 1}`,
        title: query ? `${query} — match ${i + 1}` : `sample result ${i + 1}`,
      })),
    }),
  );
});

export const report = asyncHandler(async (req, res) => {
  // Deliberately "expensive": mounted with a higher token cost.
  res.json(envelope(req, { report: { rows: 128, generatedAt: Date.now() } }));
});

export const login = asyncHandler(async (req, res) => {
  // Never authenticates anything — it only demonstrates the `auth` policy.
  const { username } = req.body || {};
  res.json(envelope(req, { authenticated: false, username: username || null, note: 'demo endpoint' }));
});

export default { ping, search, report, login };
