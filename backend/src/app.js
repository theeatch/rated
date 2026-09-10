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

  // Decides where req.ip comes from, and therefore what the limiter buckets
  // on. Defaults to `false` (use the socket address): trusting the whole
  // X-Forwarded-For chain would let any caller mint a fresh bucket per request
  // just by varying the header. Set TRUST_PROXY to the hop count in front of
  // the API — see config/index.js.
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
      // The API authenticates with headers, never cookies, so credentialed
      // CORS buys nothing — and combining it with a reflected origin (the '*'
      // case above) would let any site call this API as the visitor.
      credentials: false,
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
