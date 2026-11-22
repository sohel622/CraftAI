// Pure helpers for project files. No database, no network -> easy to test.
import { badRequest } from '../lib/errors.js';
import { config } from '../config/env.js';

// Normalises a path and blocks anything unsafe (../, absolute, .env, .git).
export function safePath(input) {
  if (typeof input !== 'string') throw badRequest('File path must be a string');
  const p = input.trim().replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/{2,}/g, '/');
  if (!p || p.startsWith('/') || /^[a-zA-Z]:/.test(p)) throw badRequest(`Invalid path: ${input}`);
  const parts = p.split('/');
  if (parts.some((s) => s === '..' || s === '.' || s === '')) throw badRequest(`Invalid path: ${input}`);
  if (parts[0] === '.git' || parts[0] === 'node_modules') throw badRequest(`Path not allowed: ${input}`);
  const base = parts[parts.length - 1];
  if (base === '.env' || (base.startsWith('.env.') && base !== '.env.example')) {
    throw badRequest(`Secret files are not allowed: ${input}`);
  }
  return p;
}

// files: [{path, content}] -> Map(path -> content)
export function toMap(files = []) {
  const map = new Map();
  for (const f of files) map.set(safePath(f.path), String(f.content ?? ''));
  return map;
}

export const fromMap = (map) =>
  [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([path, content]) => ({ path, content }));

/**
 * Applies AI operations to the current files WITHOUT breaking existing code:
 * - "update" of a missing file becomes "create"; "create" of an existing file becomes "update"
 * - "delete" of a missing file is skipped (reported, not an error)
 * - bad paths / oversized files are rejected and reported, the rest still applies
 * Returns { files, applied, skipped }.
 */
export function applyOperations(currentFiles, operations) {
  const map = toMap(currentFiles);
  const applied = [];
  const skipped = [];

  for (const op of operations) {
    let path;
    try {
      path = safePath(op.path);
    } catch (e) {
      skipped.push({ path: op.path, action: op.action, reason: e.message });
      continue;
    }

    if (op.action === 'delete') {
      if (map.delete(path)) applied.push({ path, action: 'delete' });
      else skipped.push({ path, action: 'delete', reason: 'file did not exist' });
      continue;
    }

    const content = String(op.content ?? '');
    if (Buffer.byteLength(content, 'utf8') > config.limits.maxFileBytes) {
      skipped.push({ path, action: op.action, reason: 'file too large' });
      continue;
    }
    const action = map.has(path) ? 'update' : 'create';
    if (action === 'update' && map.get(path) === content) {
      skipped.push({ path, action, reason: 'no change' });
      continue;
    }
    if (action === 'create' && map.size >= config.limits.maxFiles) {
      skipped.push({ path, action, reason: 'project file limit reached' });
      continue;
    }
    map.set(path, content);
    applied.push({ path, action });
  }

  return { files: fromMap(map), applied, skipped };
}
