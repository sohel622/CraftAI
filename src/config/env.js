// Loads and validates environment variables in ONE place.
// Every other file imports `config` from here - never read process.env elsewhere.
import 'dotenv/config';

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) throw new Error(`Env ${name} must be a number`);
  return n;
}

export const config = {
  port: int('PORT', 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-4-hydrogen',
    timeoutMs: int('GEMINI_TIMEOUT_SECONDS', 120) * 1000,
  },

  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  github: {
    token: process.env.GITHUB_TOKEN || '',
    defaultOwner: process.env.GITHUB_DEFAULT_OWNER || '',
    defaultRepo: process.env.GITHUB_DEFAULT_REPO || '',
    defaultBranch: process.env.GITHUB_DEFAULT_BRANCH || 'main',
  },

  limits: {
    maxFiles: int('MAX_FILES_PER_PROJECT', 500),
    maxFileBytes: int('MAX_FILE_SIZE_KB', 512) * 1024,
    maxPromptChars: int('MAX_PROMPT_CHARS', 20000),
  },
};

// Which integrations are ready. Used by /api/health and by services to
// return a clear error instead of crashing when a key is missing.
export function readiness() {
  return {
    gemini: Boolean(config.gemini.apiKey),
    supabase: Boolean(config.supabase.url && config.supabase.serviceRoleKey),
    github: Boolean(config.github.token),
  };
}
