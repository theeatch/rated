/**
 * Wraps an async route handler so rejected promises reach the error middleware
 * instead of becoming unhandled rejections.
 */
export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export default asyncHandler;
