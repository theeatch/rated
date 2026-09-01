import Redis from 'ioredis';

import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { registerScripts } from './scripts/index.js';

let client = null;
let ready = false;
let lastError = null;

const buildOptions = () => ({
  // Keys are prefixed by hand in utils/keys.js so SCAN patterns and Lua KEYS
  // stay in sync — do NOT set ioredis `keyPrefix` here as well.
  db: config.redis.db,
  username: config.redis.username,
  password: config.redis.password,
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 2,
  connectTimeout: 5000,
  retryStrategy: (attempt) => Math.min(attempt * 200, 5000),
  ...(config.redis.tls ? { tls: {} } : {}),
});

const attachEvents = (instance) => {
  instance.on('connect', () => logger.info('redis.connecting'));
  instance.on('ready', () => {
    ready = true;
    lastError = null;
    logger.info('redis.ready', { host: config.redis.host, port: config.redis.port });
  });
  instance.on('error', (error) => {
    ready = false;
    lastError = error.message;
    logger.error('redis.error', { error: error.message });
  });
  instance.on('close', () => {
    ready = false;
    logger.warn('redis.closed');
  });
  instance.on('reconnecting', (delay) => logger.warn('redis.reconnecting', { delay }));
  return instance;
};

/** Lazily creates the shared connection. Safe to call from anywhere. */
export const getRedis = () => {
  if (client) return client;

  const options = buildOptions();
  client = config.redis.url
    ? new Redis(config.redis.url, options)
    : new Redis({ ...options, host: config.redis.host, port: config.redis.port });

  attachEvents(client);
  registerScripts(client);
  return client;
};

export const connectRedis = async () => {
  const instance = getRedis();
  if (instance.status === 'ready') return instance;
  try {
    await instance.connect();
  } catch (error) {
    // Non-fatal: the failure mode in config decides what happens to traffic.
    logger.error('redis.connect_failed', { error: error.message });
  }
  return instance;
};

export const disconnectRedis = async () => {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  } finally {
    client = null;
    ready = false;
  }
};

export const isRedisReady = () => ready && client?.status === 'ready';

export const getRedisError = () => lastError;

export default getRedis;
