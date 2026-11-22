// Turns any thrown error into clean JSON: { error: { code, message, details } }
import { AppError } from '../lib/errors.js';
import { config } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: `No route ${req.method} ${req.path}` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'too_large', message: 'Request body is too large' } });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: { code: 'bad_json', message: 'Request body is not valid JSON' } });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  console.error('[unhandled]', err);
  res.status(500).json({
    error: { code: 'internal', message: config.nodeEnv === 'production' ? 'Something went wrong' : err.message },
  });
}

// Wraps async route handlers so thrown errors reach errorHandler.
export const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
