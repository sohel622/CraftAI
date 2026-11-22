// GET /  - a simple status page so you can open the backend in a browser
// and see that it is running and which services have keys.
import { Router } from 'express';
import { readiness, config } from '../config/env.js';
import { STACKS } from '../ai/stacks.js';

export const homeRouter = Router();

const ROUTES = [
  ['GET', '/api/health', 'Service status'],
  ['GET', '/api/stacks', 'Supported languages & frameworks'],
  ['POST', '/api/generate', 'Prompt → Gemini → file changes'],
  ['GET / POST', '/api/projects', 'List / create projects'],
  ['GET / PATCH / DELETE', '/api/projects/:id', 'One project'],
  ['GET / PUT', '/api/projects/:id/files', 'Project files'],
  ['GET', '/api/projects/:id/history', 'Prompt history'],
  ['GET', '/api/projects/:id/generations', 'AI generations'],
  ['GET', '/api/projects/:id/export', 'Export as JSON'],
  ['POST', '/api/projects/:id/github/push', 'Push to GitHub'],
  ['POST', '/api/projects/:id/github/pull', 'Import from GitHub'],
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

homeRouter.get('/', (_req, res) => {
  const r = readiness();
  const badge = (ok, name, env) =>
    `<div class="svc ${ok ? 'ok' : 'no'}"><b>${name}</b><span>${ok ? 'Ready' : 'Key missing'}</span><small>${env}</small></div>`;
  const stacks = Object.values(STACKS).map((s) => `<span class="chip">${esc(s.label)}</span>`).join('');
  const rows = ROUTES.map(([m, p, d]) => `<tr><td class="m">${m}</td><td><code>${p}</code></td><td>${d}</td></tr>`).join('');

  res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>CraftAI Backend</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0d12;color:#e7e9ee;padding:20px}
.wrap{max-width:860px;margin:0 auto}h1{margin:0;font-size:28px}h1 em{font-style:normal;color:#a78bfa}
.sub{color:#9aa3b2;margin:6px 0 20px}.live{display:inline-block;background:#14532d;color:#86efac;border-radius:99px;padding:4px 12px;font-size:13px;margin-bottom:14px}
h2{font-size:16px;color:#c4b5fd;margin:26px 0 10px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.svc{background:#151923;border:1px solid #232a38;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:4px}
.svc span{font-size:13px}.svc.ok span{color:#4ade80}.svc.no span{color:#fbbf24}.svc small{color:#6b7385;font-size:11px}
.chip{display:inline-block;background:#1c2130;border:1px solid #2a3245;border-radius:99px;padding:4px 10px;margin:3px;font-size:12px}
.tbl{overflow-x:auto;background:#151923;border:1px solid #232a38;border-radius:12px}table{width:100%;border-collapse:collapse;font-size:13px}
td{padding:9px 10px;border-top:1px solid #232a38;vertical-align:top}tr:first-child td{border-top:0}.m{color:#a78bfa;white-space:nowrap;font-weight:600}
code{color:#e7e9ee;word-break:break-all}.foot{color:#6b7385;font-size:12px;margin-top:22px}
</style></head><body><div class="wrap">
<div class="live">● Backend is running</div>
<h1>Craft<em>AI</em> Backend</h1>
<p class="sub">AI full-stack app builder · Gemini model: <code>${esc(config.gemini.model)}</code></p>
<h2>Services</h2><div class="grid">
${badge(r.gemini, 'Gemini AI', 'GEMINI_API_KEY')}
${badge(r.supabase, 'Supabase', 'SUPABASE_URL + SERVICE_ROLE_KEY')}
${badge(r.github, 'GitHub', 'GITHUB_TOKEN')}
</div>
<h2>Supported stacks (${Object.keys(STACKS).length})</h2><div>${stacks}</div>
<h2>API routes</h2><div class="tbl"><table>${rows}</table></div>
<p class="foot">Keys are read from environment variables only and are never shown here.</p>
</div></body></html>`);
});
