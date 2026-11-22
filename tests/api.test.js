// Run: npm test   (no real keys needed - Gemini is faked)
process.env.NODE_ENV = 'development';
process.env.GEMINI_API_KEY = 'test-key';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { safePath, applyOperations } = await import('../src/services/fileOps.js');
const { parseAiResult, generateCode } = await import('../src/ai/gemini.js');
const { createApp } = await import('../src/app.js');

const fakeGemini = (obj, status = 200) => async (url, opts) => {
  assert.ok(!url.includes('test-key'), 'API key must not be in the URL');
  assert.equal(opts.headers['x-goog-api-key'], 'test-key');
  const body = JSON.parse(opts.body);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  return new Response(JSON.stringify(status === 200
    ? { candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }
    : { error: { message: 'quota' } }), { status });
};

test('safePath blocks unsafe paths', () => {
  assert.equal(safePath('./src//App.jsx'), 'src/App.jsx');
  for (const bad of ['../x', '/etc/passwd', 'a/../b', '.env', 'config/.env.local', '.git/config', 'C:/x']) {
    assert.throws(() => safePath(bad), bad);
  }
  assert.equal(safePath('.env.example'), '.env.example');
});

test('applyOperations creates, updates, deletes and skips safely', () => {
  const current = [{ path: 'a.js', content: '1' }, { path: 'b.js', content: '2' }];
  const r = applyOperations(current, [
    { action: 'update', path: 'a.js', content: 'new' },
    { action: 'create', path: 'b.js', content: '2' },      // exists + same -> no change
    { action: 'update', path: 'c.js', content: 'c' },       // missing -> create
    { action: 'delete', path: 'zzz.js' },                   // missing -> skipped
    { action: 'create', path: '../evil.js', content: 'x' }, // bad path -> skipped
  ]);
  assert.deepEqual(r.files.map((f) => f.path), ['a.js', 'b.js', 'c.js']);
  assert.equal(r.files[0].content, 'new');
  assert.deepEqual(r.applied, [{ path: 'a.js', action: 'update' }, { path: 'c.js', action: 'create' }]);
  assert.equal(r.skipped.length, 3);
  const d = applyOperations(r.files, [{ action: 'delete', path: 'b.js' }]);
  assert.deepEqual(d.files.map((f) => f.path), ['a.js', 'c.js']);
});

test('parseAiResult accepts fenced JSON, rejects bad shape', () => {
  const ok = parseAiResult('```json\n{"explanation":"x","operations":[]}\n```');
  assert.equal(ok.explanation, 'x');
  assert.throws(() => parseAiResult('not json'));
  assert.throws(() => parseAiResult('{"operations":[{"action":"rename","path":"a"}]}'));
});

test('generateCode calls Gemini with structured output', async () => {
  const r = await generateCode({
    prompt: 'add a button', stacks: ['react'], files: [],
    fetchImpl: fakeGemini({ plan: 'p', explanation: 'done', operations: [{ action: 'create', path: 'src/App.jsx', content: 'x' }] }),
  });
  assert.equal(r.operations.length, 1);
  assert.equal(r.model, 'gemini-4-hydrogen');
});

test('generateCode passes 429 through', async () => {
  await assert.rejects(
    generateCode({ prompt: 'x', stacks: [], files: [], fetchImpl: fakeGemini(null, 429) }),
    (e) => e.status === 429,
  );
});

test('HTTP: health, stacks, validation, stateless generate', async () => {
  const realFetch = globalThis.fetch;
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const health = await (await realFetch(`${base}/health`)).json();
    assert.equal(health.services.gemini, true);
    assert.equal(health.services.supabase, false);
    assert.ok(!JSON.stringify(health).includes('test-key'));

    const stacks = await (await realFetch(`${base}/stacks`)).json();
    assert.equal(stacks.stacks.length, 20);

    const bad = await realFetch(`${base}/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: '', stacks: ['cobol'] }),
    });
    assert.equal(bad.status, 400);

    const badId = await realFetch(`${base}/projects/not-a-uuid`);
    assert.equal(badId.status, 400);

    const gem = fakeGemini({ explanation: 'বাটন যোগ করা হয়েছে', operations: [
      { action: 'update', path: 'index.html', content: '<button>Hi</button>' },
      { action: 'create', path: 'style.css', content: 'button{color:red}' },
    ] });
    globalThis.fetch = async (url, opts) => (String(url).includes('generativelanguage') ? gem(url, opts) : realFetch(url, opts));
    const res = await realFetch(`${base}/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'একটা বাটন দাও', stacks: ['html'], files: [{ path: 'index.html', content: '<p>old</p>' }, { path: 'app.js', content: 'keep' }] }),
    });
    const out = await res.json();
    assert.equal(res.status, 200, JSON.stringify(out));
    assert.equal(out.changedFiles.length, 2);                 // app.js untouched, not returned
    assert.ok(!out.changedFiles.some((f) => f.path === 'app.js'));
    assert.equal(out.saved, false);
  } finally {
    globalThis.fetch = realFetch;
    server.close();
  }
});
