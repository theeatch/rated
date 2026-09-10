import 'dotenv/config';

const bool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const int = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const list = (value, fallback = []) =>
  value ? value.split(',').map((entry) => entry.trim()).filter(Boolean) : fallback;

/**
 * Express `trust proxy`, which decides where `req.ip` comes from — and
 * therefore what the rate limiter buckets on.
 *
 * `true` trusts the whole X-Forwarded-For chain, so any client can send
 * `X-Forwarded-For: <anything>` and be handed a fresh bucket on every request.
 * That defeats the limiter entirely, so it is never the default. Set this to
 * the number of proxy hops in front of the API (`1` behind a single nginx or
 * Caddy) or to the proxy's address/CIDR.
 */
export const parseTrustProxy = (value) => {
  if (value === undefined || value === '') return false;
  const raw = String(value).trim().toLowerCase();
  if (['false', 'off', 'no', '0'].includes(raw)) return false;
  if (['true', 'on', 'yes'].includes(raw)) return true;
  // A bare integer is a hop count; anything else (CIDR list, 'loopback', …)
  // is passed through to Express untouched.
  const hops = Number.parseInt(raw, 10);
  return Number.isFinite(hops) && String(hops) === raw ? hops : String(value).trim();
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 4000),
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigins: list(process.env.CORS_ORIGIN, ['http://localhost:3000']),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),

  redis: {
    url: process.env.REDIS_URL || '',
    host: process.env.REDIS_HOST || 'localhost',
    port: int(process.env.REDIS_PORT, 6379),
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    db: int(process.env.REDIS_DB, 0),
    tls: bool(process.env.REDIS_TLS, false),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'rateflow',
  },

  rateLimit: {
    defaultPolicy: process.env.DEFAULT_POLICY || 'default',
    // 'open' keeps serving traffic when Redis is down, 'closed' rejects it.
    failureMode: process.env.FAILURE_MODE === 'closed' ? 'closed' : 'open',
    bucketTtlSeconds: int(process.env.BUCKET_TTL_SECONDS, 3600),
  },

  /**
   * Ceilings on runtime policy overrides.
   *
   * The dashboard can retune limits live, which is the feature — but an
   * unbounded override is an off switch for the limiter. Anyone who can reach
   * the policy API is capped at these values.
   */
  policyLimits: {
    maxCapacity: num(process.env.POLICY_MAX_CAPACITY, 10_000),
    maxRefillRate: num(process.env.POLICY_MAX_REFILL_RATE, 1000),
    maxCost: num(process.env.POLICY_MAX_COST, 100),
  },

  metrics: {
    windowSeconds: int(process.env.METRICS_WINDOW_SECONDS, 120),
    ttlSeconds: int(process.env.METRICS_TTL_SECONDS, 300),
  },

  auth: {
    adminToken: process.env.ADMIN_TOKEN || '',
    dashboardApiKey: process.env.DASHBOARD_API_KEY || '',
    requireApiKey: bool(process.env.REQUIRE_API_KEY, false),
  },
};

export default config;
