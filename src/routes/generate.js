// Generate / update code with Gemini.
import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import { asyncRoute } from '../middleware/errorHandler.js';
import { generateCode } from '../ai/gemini.js';
import { applyOperations, toMap, fromMap } from '../services/fileOps.js';
import * as db from '../services/projectService.js';

export const generateRouter = Router();

/**
 * POST /api/generate
 * body: { prompt, stacks?, projectId?, files?, dryRun? }
 * - With projectId: uses saved files + chat history, saves the result (unless dryRun).
 * - Without projectId: stateless - send files, get updated files back.
 */
generateRouter.post('/', requireUser, validate(schemas.generate), asyncRoute(async (req, res) => {
  const { prompt, projectId, dryRun } = req.body;
  let { stacks, files } = req.body;
  let history = [];

  if (projectId) {
    const project = await db.getProject(req.user.id, projectId);
    if (!stacks.length) stacks = project.stacks || [];
    if (!files) files = (await db.getFiles(req.user.id, projectId)).map(({ path, content }) => ({ path, content }));
    history = await db.getHistory(req.user.id, projectId);
  }
  files = fromMap(toMap(files || [])); // normalise + validate paths

  const ai = await generateCode({ prompt, stacks, files, history });
  const { files: newFiles, applied, skipped } = applyOperations(files, ai.operations);

  let saved = null;
  if (projectId && !dryRun) {
    const promptLogId = await db.logMessage(req.user.id, projectId, 'user', prompt);
    await db.saveFileChanges(req.user.id, projectId, newFiles, applied);
    await db.logMessage(req.user.id, projectId, 'assistant', ai.explanation);
    saved = await db.saveGeneration(req.user.id, projectId, promptLogId, { ...ai, applied, skipped });
  }

  // Return only changed files to keep the response small for mobile.
  const changedPaths = new Set(applied.filter((a) => a.action !== 'delete').map((a) => a.path));
  res.json({
    plan: ai.plan,
    explanation: ai.explanation,
    model: ai.model,
    applied,
    skipped,
    changedFiles: newFiles.filter((f) => changedPaths.has(f.path)),
    deletedPaths: applied.filter((a) => a.action === 'delete').map((a) => a.path),
    generationId: saved?.id || null,
    saved: Boolean(saved),
    usage: ai.usage,
  });
}));
