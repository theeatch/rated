import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { config } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import routes from './routes/index.js';

export const createApp = () => {
  const app = express();

  // Behind Docker/nginx the client IP arrives in X-Forwarded-For; without this
  // every request would share one bucket keyed on the proxy address.
  app.set('trust proxy', true);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
      credentials: true,
      // The dashboard reads the limiter's decision straight off the response.
      exposedHeaders: [
        'X-RateLimit-Policy',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'X-RateLimit-Degraded',
        'Retry-After',
      ],
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '128kb' }));
  app.use(requestLogger);

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;
