import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'not_found', message: `No route matches ${req.method} ${req.originalUrl}` },
  });
};

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity.
export const errorHandler = (error, req, res, next) => {
  const status = error.status || 500;
  const payload = {
    error: {
      code: error.code || 'internal_error',
      message: status >= 500 ? 'Internal server error' : error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  };

  if (status >= 500) {
    logger.error('http.error', { path: req.originalUrl, error: error.message, stack: error.stack });
    if (config.env !== 'production') payload.error.message = error.message;
  }

  res.status(status).json(payload);
};

export default { errorHandler, notFoundHandler };
