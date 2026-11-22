// Request validation with zod. Usage: router.post('/x', validate(schema), handler)
import { z } from 'zod';
import { badRequest } from '../lib/errors.js';
import { STACK_IDS } from '../ai/stacks.js';
import { config } from '../config/env.js';

export const validate = (schema, where = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[where]);
  if (!result.success) {
    return next(badRequest('Invalid request', result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))));
  }
  req[where] = result.data;
  next();
};

// Rejects bad ids early (otherwise Postgres throws a confusing 500).
// Works both as router.param(...) handler and as normal middleware.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const requireUuidParam = (name) => (req, _res, next, value) => {
  const v = typeof value === 'string' ? value : req.params[name];
  if (!UUID_RE.test(v || '')) return next(badRequest(`Invalid ${name}`));
  next();
};

// ---- shared pieces
const stackList = z.array(z.enum(STACK_IDS)).max(10).default([]);
const fileItem = z.object({ path: z.string().min(1).max(300), content: z.string().default('') });
const githubTarget = z.object({
  owner: z.string().min(1).max(100).regex(/^[A-Za-z0-9-_.]+$/),
  repo: z.string().min(1).max(100).regex(/^[A-Za-z0-9-_.]+$/),
  branch: z.string().min(1).max(200).default('main'),
});

// ---- route schemas
export const schemas = {
  createProject: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(2000).optional(),
    stacks: stackList,
    github: githubTarget.optional(),
  }),
  updateProject: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(2000).optional(),
    stacks: z.array(z.enum(STACK_IDS)).max(10).optional(),
    github: githubTarget.optional(),
  }),
  saveFiles: z.object({ files: z.array(fileItem).max(config.limits.maxFiles) }),
  generate: z.object({
    prompt: z.string().min(1).max(config.limits.maxPromptChars),
    stacks: stackList,
    projectId: z.string().uuid().optional(),
    // Files sent by the app. If projectId is given and files are omitted,
    // the saved files from Supabase are used.
    files: z.array(fileItem).max(config.limits.maxFiles).optional(),
    // true = only preview the AI changes, do not save them
    dryRun: z.boolean().default(false),
  }),
  githubPush: z.object({
    message: z.string().min(1).max(500).default('Update from CraftAI'),
    target: githubTarget.partial().optional(),
  }),
  githubPull: z.object({ target: githubTarget.partial().optional() }),
};
