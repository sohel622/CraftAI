// Server-side Supabase client (service role). It bypasses RLS, so every query
// in services/ MUST filter by the signed-in user's id.
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';
import { notConfigured } from './errors.js';

let client = null;

export function supabase() {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) throw notConfigured('Supabase');
  if (!client) {
    client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
