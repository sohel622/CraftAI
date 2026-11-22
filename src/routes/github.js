// Sync a project with GitHub: push (export) and pull (import).
import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import { asyncRoute } from '../middleware/errorHandler.js';
import { badRequest } from '../lib/errors.js';
import { config } from '../config/env.js';
import { pushFiles, pullFiles } from '../lib/github.js';
import { safePath } from '../services/fileOps.js';
import * as db from '../services/projectService.js';
import { requireUuidParam } from '../middleware/validate.js';

export const githubRouter = Router({ mergeParams: true });
githubRouter.use(requireUser);
githubRouter.use(requireUuidParam('id'));

// Request target > project settings > .env defaults
function resolveTarget(project, target = {}) {
  const owner = target.owner || project.github_owner || config.github.defaultOwner;
  const repo = target.repo || project.github_repo || config.github.defaultRepo;
  const branch = target.branch || project.github_branch || config.github.defaultBranch;
  if (!owner || !repo) throw badRequest('GitHub owner/repo missing. Set it on the project or in the request.');
  return { owner, repo, branch };
}

// POST /api/projects/:id/github/push  { message?, target? }
githubRouter.post('/push', validate(schemas.githubPush), asyncRoute(async (req, res) => {
  const project = await db.getProject(req.user.id, req.params.id);
  const target = resolveTarget(project, req.body.target);
  const files = (await db.getFiles(req.user.id, project.id)).map(({ path, content }) => ({ path, content }));
  if (!files.length) throw badRequest('Project has no files to push');

  const result = await pushFiles({ ...target, message: req.body.message, files });
  res.json({ pushed: files.length, ...target, commitSha: result.commitSha });
}));

// POST /api/projects/:id/github/pull  { target? }  - replaces project files with the repo's text files
githubRouter.post('/pull', validate(schemas.githubPull), asyncRoute(async (req, res) => {
  const project = await db.getProject(req.user.id, req.params.id);
  const target = resolveTarget(project, req.body.target);
  const { files, skipped, commitSha } = await pullFiles({
    ...target, maxFiles: config.limits.maxFiles, maxBytes: config.limits.maxFileBytes,
  });

  const safe = [];
  for (const f of files) {
    try { safe.push({ path: safePath(f.path), content: f.content }); }
    catch { skipped.push({ path: f.path, reason: 'path not allowed' }); }
  }
  await db.replaceFiles(req.user.id, project.id, safe);
  res.json({ imported: safe.length, skipped, commitSha, ...target });
}));
