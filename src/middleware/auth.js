// Checks the Supabase access token sent by the app: `Authorization: Bearer <token>`.
// Sets req.user = { id, email }.
import { supabase } from '../lib/supabase.js';
import { config, readiness } from '../config/env.js';
import { unauthorized } from '../lib/errors.js';

export async function requireUser(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    // Local testing only: without Supabase configured, allow a fake dev user.
    if (!readiness().supabase && config.nodeEnv === 'development') {
      req.user = { id: 'dev-user', email: 'dev@localhost', dev: true };
      return next();
    }
    if (!token) throw unauthorized();

    const { data, error } = await supabase().auth.getUser(token);
    if (error || !data?.user) throw unauthorized('Session expired or invalid. Sign in again.');
    req.user = { id: data.user.id, email: data.user.email };
    next();
  } catch (err) {
    next(err);
  }
}
