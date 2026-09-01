export class AppError extends Error {
  constructor(message, status = 500, code = 'internal_error', details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) =>
  new AppError(message, 400, 'bad_request', details);

export const unauthorized = (message = 'Missing or invalid credentials') =>
  new AppError(message, 401, 'unauthorized');

export const notFound = (message = 'Resource not found') =>
  new AppError(message, 404, 'not_found');

export const rateLimited = (message = 'Rate limit exceeded', details) =>
  new AppError(message, 429, 'rate_limit_exceeded', details);

export const serviceUnavailable = (message = 'Upstream dependency unavailable') =>
  new AppError(message, 503, 'service_unavailable');

export default AppError;
