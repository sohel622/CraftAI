import { Router } from 'express';
import { readiness, config } from '../config/env.js';
import { STACKS } from '../ai/stacks.js';

export const metaRouter = Router();

// GET /api/health - shows which integrations have keys (never the keys themselves)
metaRouter.get('/health', (_req, res) => {
  res.json({ ok: true, model: config.gemini.model, services: readiness() });
});

// GET /api/stacks - list of supported languages/frameworks for the app's picker
metaRouter.get('/stacks', (_req, res) => {
  res.json({
    stacks: Object.entries(STACKS).map(([id, s]) => ({ id, label: s.label, group: s.group, extensions: s.exts })),
  });
});
