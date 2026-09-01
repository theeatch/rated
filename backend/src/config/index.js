import 'dotenv/config';

const bool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const int = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const list = (value, fallback = []) =>
  value ? value.split(',').map((entry) => entry.trim()).filter(Boolean) : fallback;

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 4000),
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigins: list(process.env.CORS_ORIGIN, ['http://localhost:3000']),

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

  metrics: {
    windowSeconds: int(process.env.METRICS_WINDOW_SECONDS, 120),
    ttlSeconds: int(process.env.METRICS_TTL_SECONDS, 300),
  },

  // Placeholder credentials — replace via environment before deploying.
  auth: {
    adminToken: process.env.ADMIN_TOKEN || '',
    dashboardApiKey: process.env.DASHBOARD_API_KEY || '',
    requireApiKey: bool(process.env.REQUIRE_API_KEY, false),
  },
};

export default config;
