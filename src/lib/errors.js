// One error type for the whole app. Routes throw it; errorHandler turns it into JSON.
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new AppError(400, 'bad_request', msg, details);
export const unauthorized = (msg = 'Sign in required') => new AppError(401, 'unauthorized', msg);
export const notFound = (msg = 'Not found') => new AppError(404, 'not_found', msg);
export const notConfigured = (what) =>
  new AppError(503, 'not_configured', `${what} is not configured on the server. Check your .env file.`);
export const upstream = (service, msg, status = 502) =>
  new AppError(status, 'upstream_error', `${service}: ${msg}`);
