// All Supabase reads/writes for projects, files, prompt history and generations.
// Uses the service-role client, so EVERY query filters by userId.
import { supabase } from '../lib/supabase.js';
import { AppError, notFound } from '../lib/errors.js';

function check(error, what) {
  if (error) throw new AppError(500, 'db_error', `Database error while ${what}: ${error.message}`);
}

export async function listProjects(userId) {
  const { data, error } = await supabase()
    .from('projects')
    .select('id, name, description, stacks, github_owner, github_repo, github_branch, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  check(error, 'listing projects');
  return data;
}

export async function createProject(userId, input) {
  const { data, error } = await supabase()
    .from('projects')
    .insert({
      user_id: userId,
      name: input.name,
      description: input.description || '',
      stacks: input.stacks || [],
      github_owner: input.github?.owner || null,
      github_repo: input.github?.repo || null,
      github_branch: input.github?.branch || 'main',
    })
    .select()
    .single();
  check(error, 'creating project');
  return data;
}

export async function getProject(userId, projectId) {
  const { data, error } = await supabase()
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle();
  check(error, 'reading project');
  if (!data) throw notFound('Project not found');
  return data;
}

export async function updateProject(userId, projectId, patch) {
  await getProject(userId, projectId);
  const row = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.stacks !== undefined) row.stacks = patch.stacks;
  if (patch.github) {
    row.github_owner = patch.github.owner ?? null;
    row.github_repo = patch.github.repo ?? null;
    row.github_branch = patch.github.branch || 'main';
  }
  const { data, error } = await supabase()
    .from('projects').update(row).eq('id', projectId).eq('user_id', userId).select().single();
  check(error, 'updating project');
  return data;
}

export async function deleteProject(userId, projectId) {
  await getProject(userId, projectId);
  const { error } = await supabase().from('projects').delete().eq('id', projectId).eq('user_id', userId);
  check(error, 'deleting project');
}

// ---------- files

export async function getFiles(userId, projectId) {
  await getProject(userId, projectId);
  const { data, error } = await supabase()
    .from('project_files')
    .select('path, content, updated_at')
    .eq('project_id', projectId)
    .order('path');
  check(error, 'reading files');
  return data;
}

// Writes only what changed: upserts created/updated files, deletes removed ones.
export async function saveFileChanges(userId, projectId, files, applied) {
  const byPath = new Map(files.map((f) => [f.path, f.content]));
  const upserts = applied
    .filter((a) => a.action !== 'delete')
    .map((a) => ({ project_id: projectId, user_id: userId, path: a.path, content: byPath.get(a.path) ?? '' }));
  const deletes = applied.filter((a) => a.action === 'delete').map((a) => a.path);

  if (upserts.length) {
    const { error } = await supabase().from('project_files').upsert(upserts, { onConflict: 'project_id,path' });
    check(error, 'saving files');
  }
  if (deletes.length) {
    const { error } = await supabase()
      .from('project_files').delete().eq('project_id', projectId).in('path', deletes);
    check(error, 'deleting files');
  }
  await supabase().from('projects').update({ updated_at: new Date().toISOString() }).eq('id', projectId);
}

// Replaces ALL files of a project (used by manual save and GitHub import).
export async function replaceFiles(userId, projectId, files) {
  await getProject(userId, projectId);
  const db = supabase();
  const { error: delErr } = await db.from('project_files').delete().eq('project_id', projectId);
  check(delErr, 'clearing files');
  if (files.length) {
    const rows = files.map((f) => ({ project_id: projectId, user_id: userId, path: f.path, content: f.content }));
    const { error } = await db.from('project_files').insert(rows);
    check(error, 'writing files');
  }
  await db.from('projects').update({ updated_at: new Date().toISOString() }).eq('id', projectId);
}

// ---------- prompt history + generations

export async function getHistory(userId, projectId, limit = 10) {
  const { data, error } = await supabase()
    .from('prompt_logs')
    .select('role, text, created_at')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  check(error, 'reading history');
  return (data || []).reverse();
}

export async function logMessage(userId, projectId, role, text) {
  const { data, error } = await supabase()
    .from('prompt_logs')
    .insert({ user_id: userId, project_id: projectId, role, text })
    .select('id')
    .single();
  check(error, 'saving chat message');
  return data.id;
}

export async function saveGeneration(userId, projectId, promptLogId, result) {
  const { data, error } = await supabase()
    .from('generations')
    .insert({
      user_id: userId,
      project_id: projectId,
      prompt_log_id: promptLogId,
      model: result.model,
      plan: result.plan,
      explanation: result.explanation,
      operations: result.operations,
      applied: result.applied,
      skipped: result.skipped,
      usage: result.usage,
    })
    .select('id, created_at')
    .single();
  check(error, 'saving generation');
  return data;
}

export async function listGenerations(userId, projectId, limit = 20) {
  await getProject(userId, projectId);
  const { data, error } = await supabase()
    .from('generations')
    .select('id, model, plan, explanation, applied, skipped, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);
  check(error, 'listing generations');
  return data;
}
