import { createApp } from './app.js';
import { config } from './config/index.js';
import { connectRedis, disconnectRedis } from './redis/client.js';
import { refreshOverrides } from './services/policy.service.js';
import { logger } from './utils/logger.js';

const start = async () => {
  await connectRedis();
  await refreshOverrides({ force: true });

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info('server.listening', {
      port: config.port,
      env: config.env,
      failureMode: config.rateLimit.failureMode,
    });
  });

  const shutdown = async (signal) => {
    logger.info('server.shutdown', { signal });
    server.close(async () => {
      await disconnectRedis();
      process.exit(0);
    });
    // Don't hang forever on lingering keep-alive connections.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error('process.unhandled_rejection', { reason: String(reason) });
  });
};

start().catch((error) => {
  logger.error('server.start_failed', { error: error.message, stack: error.stack });
  process.exit(1);
});
