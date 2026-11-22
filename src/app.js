// Builds the Express app. Kept separate from server.js so tests can import it.
import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { metaRouter } from './routes/meta.js';
import { projectsRouter } from './routes/projects.js';
import { generateRouter } from './routes/generate.js';
import { githubRouter } from './routes/github.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  const origins = config.corsOrigins;
  app.use(cors({ origin: origins.length === 0 || origins.includes('*') ? true : origins }));
  // Projects can be large (many files) - allow up to 10 MB JSON.
  app.use(express.json({ limit: '10mb' }));

  app.use('/api', metaRouter);
  app.use('/api/generate', generateRouter);
  // github router first so its routes are not handled twice by projectsRouter
  app.use('/api/projects/:id/github', githubRouter);
  app.use('/api/projects', projectsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
