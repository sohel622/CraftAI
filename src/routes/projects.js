// Projects, files, history and export.
import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import { asyncRoute } from '../middleware/errorHandler.js';
import { toMap, fromMap } from '../services/fileOps.js';
import * as db from '../services/projectService.js';
import { requireUuidParam } from '../middleware/validate.js';

export const projectsRouter = Router();
projectsRouter.use(requireUser);
projectsRouter.param('id', requireUuidParam('id'));

projectsRouter.get('/', asyncRoute(async (req, res) => {
  res.json({ projects: await db.listProjects(req.user.id) });
}));

projectsRouter.post('/', validate(schemas.createProject), asyncRoute(async (req, res) => {
  res.status(201).json({ project: await db.createProject(req.user.id, req.body) });
}));

projectsRouter.get('/:id', asyncRoute(async (req, res) => {
  res.json({ project: await db.getProject(req.user.id, req.params.id) });
}));

projectsRouter.patch('/:id', validate(schemas.updateProject), asyncRoute(async (req, res) => {
  res.json({ project: await db.updateProject(req.user.id, req.params.id, req.body) });
}));

projectsRouter.delete('/:id', asyncRoute(async (req, res) => {
  await db.deleteProject(req.user.id, req.params.id);
  res.status(204).end();
}));

// Files
projectsRouter.get('/:id/files', asyncRoute(async (req, res) => {
  res.json({ files: await db.getFiles(req.user.id, req.params.id) });
}));

// Replace all files (manual save from the editor)
projectsRouter.put('/:id/files', validate(schemas.saveFiles), asyncRoute(async (req, res) => {
  const files = fromMap(toMap(req.body.files));
  await db.replaceFiles(req.user.id, req.params.id, files);
  res.json({ saved: files.length });
}));

// Chat / prompt history and AI generations
projectsRouter.get('/:id/history', asyncRoute(async (req, res) => {
  await db.getProject(req.user.id, req.params.id);
  res.json({ history: await db.getHistory(req.user.id, req.params.id, 100) });
}));

projectsRouter.get('/:id/generations', asyncRoute(async (req, res) => {
  res.json({ generations: await db.listGenerations(req.user.id, req.params.id) });
}));

// Export everything as one JSON file (backup / move to another tool)
projectsRouter.get('/:id/export', asyncRoute(async (req, res) => {
  const project = await db.getProject(req.user.id, req.params.id);
  const files = await db.getFiles(req.user.id, req.params.id);
  res.setHeader('Content-Disposition', `attachment; filename="${project.name.replace(/[^\w.-]/g, '_')}.json"`);
  res.json({ project, files, exportedAt: new Date().toISOString() });
}));
