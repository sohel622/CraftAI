// GitHub REST helper. Pushes many files as ONE commit (Git Data API),
// and can import a repo's text files into a project.
import { config } from '../config/env.js';
import { notConfigured, upstream, AppError } from './errors.js';

const API = 'https://api.github.com';

async function gh(path, { method = 'GET', body, fetchImpl = fetch } = {}) {
  if (!config.github.token) throw notConfigured('GitHub (GITHUB_TOKEN)');
  const res = await fetchImpl(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.github.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'craftai-backend',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = upstream('GitHub', data.message || `HTTP ${res.status}`, res.status === 404 ? 404 : 502);
    err.githubStatus = res.status;
    throw err;
  }
  return data;
}

const repoPath = (owner, repo) => `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

// Returns head commit sha of a branch, or null if the branch / repo is empty.
async function headSha(owner, repo, branch, fetchImpl) {
  try {
    const ref = await gh(`${repoPath(owner, repo)}/git/ref/heads/${encodeURIComponent(branch)}`, { fetchImpl });
    return ref.object.sha;
  } catch (e) {
    if (e.githubStatus === 404 || e.githubStatus === 409) return null;
    throw e;
  }
}

/**
 * Push files as a single commit.
 * files: [{path, content}]  deletes: [path]
 * Works on an existing branch. For a completely empty repo it creates the first commit.
 */
export async function pushFiles({ owner, repo, branch, message, files, deletes = [], fetchImpl }) {
  if (!files.length && !deletes.length) throw new AppError(400, 'bad_request', 'Nothing to push');
  const base = repoPath(owner, repo);
  const parentSha = await headSha(owner, repo, branch, fetchImpl);

  if (!parentSha) {
    // Empty repo: the Git Data API cannot create blobs until the repo has one commit,
    // so create the first file with the Contents API, then continue normally.
    const first = files[0];
    await gh(`${base}/contents/${first.path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'PUT',
      body: { message, branch, content: Buffer.from(first.content, 'utf8').toString('base64') },
      fetchImpl,
    });
    if (files.length === 1 && !deletes.length) return { commitSha: await headSha(owner, repo, branch, fetchImpl), branch };
    return pushFiles({ owner, repo, branch, message, files: files.slice(1), deletes, fetchImpl });
  }

  const parent = await gh(`${base}/git/commits/${parentSha}`, { fetchImpl });
  const tree = [
    ...files.map((f) => ({ path: f.path, mode: '100644', type: 'blob', content: f.content })),
    ...deletes.map((p) => ({ path: p, mode: '100644', type: 'blob', sha: null })),
  ];
  const newTree = await gh(`${base}/git/trees`, {
    method: 'POST', body: { base_tree: parent.tree.sha, tree }, fetchImpl,
  });
  const commit = await gh(`${base}/git/commits`, {
    method: 'POST', body: { message, tree: newTree.sha, parents: [parentSha] }, fetchImpl,
  });
  await gh(`${base}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH', body: { sha: commit.sha, force: false }, fetchImpl,
  });
  return { commitSha: commit.sha, branch };
}

// Reads all text files of a branch (skips binaries and big files).
export async function pullFiles({ owner, repo, branch, maxFiles, maxBytes, fetchImpl }) {
  const base = repoPath(owner, repo);
  const sha = await headSha(owner, repo, branch, fetchImpl);
  if (!sha) return { files: [], skipped: [], commitSha: null };

  const tree = await gh(`${base}/git/trees/${sha}?recursive=1`, { fetchImpl });
  const blobs = tree.tree.filter((t) => t.type === 'blob');
  const files = [];
  const skipped = [];

  for (const b of blobs) {
    if (files.length >= maxFiles) { skipped.push({ path: b.path, reason: 'file limit' }); continue; }
    if (b.size > maxBytes) { skipped.push({ path: b.path, reason: 'too large' }); continue; }
    const blob = await gh(`${base}/git/blobs/${b.sha}`, { fetchImpl });
    const buf = Buffer.from(blob.content, 'base64');
    if (buf.includes(0)) { skipped.push({ path: b.path, reason: 'binary' }); continue; }
    files.push({ path: b.path, content: buf.toString('utf8') });
  }
  return { files, skipped, commitSha: sha };
}
