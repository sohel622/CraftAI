// GitHub sync tests with a fake GitHub API (no real token used).
process.env.GITHUB_TOKEN = 'gh-test';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { pushFiles, pullFiles } = await import('../src/lib/github.js');

function fakeGitHub({ empty = false } = {}) {
  const calls = [];
  let hasCommit = !empty;
  const fetchImpl = async (url, opts = {}) => {
    const u = new URL(url); const m = opts.method || 'GET';
    calls.push(`${m} ${u.pathname}`);
    assert.equal(opts.headers.Authorization, 'Bearer gh-test');
    const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s });
    const p = u.pathname.replace('/repos/me/app', '');
    if (p === '/git/ref/heads/main') return hasCommit ? json({ object: { sha: 'c1' } }) : json({ message: 'Git Repository is empty.' }, 409);
    if (m === 'PUT' && p.startsWith('/contents/')) { hasCommit = true; return json({ commit: { sha: 'c1' } }, 201); }
    if (p === '/git/commits/c1') return json({ tree: { sha: 't1' } });
    if (p === '/git/trees' && m === 'POST') return json({ sha: 't2' });
    if (p === '/git/commits' && m === 'POST') { assert.deepEqual(JSON.parse(opts.body).parents, ['c1']); return json({ sha: 'c2' }); }
    if (p === '/git/refs/heads/main' && m === 'PATCH') return json({ object: { sha: 'c2' } });
    if (p === '/git/trees/c1') return json({ tree: [
      { type: 'blob', path: 'index.html', sha: 'b1', size: 5 },
      { type: 'blob', path: 'logo.png', sha: 'b2', size: 4 },
      { type: 'tree', path: 'src', sha: 'x' },
    ] });
    if (p === '/git/blobs/b1') return json({ content: Buffer.from('hello').toString('base64') });
    if (p === '/git/blobs/b2') return json({ content: Buffer.from([137, 0, 1, 2]).toString('base64') });
    return json({ message: `unexpected ${m} ${p}` }, 500);
  };
  return { fetchImpl, calls };
}

const files = [{ path: 'index.html', content: '<h1>Hi</h1>' }, { path: 'src/app.js', content: 'x' }];

test('push to existing branch makes one commit', async () => {
  const gh = fakeGitHub();
  const r = await pushFiles({ owner: 'me', repo: 'app', branch: 'main', message: 'm', files, fetchImpl: gh.fetchImpl });
  assert.equal(r.commitSha, 'c2');
  assert.equal(gh.calls.filter((c) => c.startsWith('POST /repos/me/app/git/commits')).length, 1);
});

test('push to empty repo creates first commit then the rest', async () => {
  const gh = fakeGitHub({ empty: true });
  const r = await pushFiles({ owner: 'me', repo: 'app', branch: 'main', message: 'm', files, fetchImpl: gh.fetchImpl });
  assert.equal(r.commitSha, 'c2');
  assert.ok(gh.calls.some((c) => c === 'PUT /repos/me/app/contents/index.html'));
});

test('pull imports text files and skips binary', async () => {
  const gh = fakeGitHub();
  const r = await pullFiles({ owner: 'me', repo: 'app', branch: 'main', maxFiles: 100, maxBytes: 1e6, fetchImpl: gh.fetchImpl });
  assert.deepEqual(r.files, [{ path: 'index.html', content: 'hello' }]);
  assert.equal(r.skipped[0].reason, 'binary');
});
