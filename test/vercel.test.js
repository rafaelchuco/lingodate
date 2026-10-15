import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createApp } from '../server.js';
import { createHandler } from '../api/index.js';
import { openDatabase } from '../database.js';

async function listen(t, handler) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('Vercel adapter accepts an already-parsed body, reuses the app and preserves secure sessions', async t => {
  let starts = 0;
  const application = await createApp({ databasePath: ':memory:', secureCookie: true });
  t.after(() => application.emit('close'));
  const handler = createHandler(async () => { starts++; return application; });
  const base = await listen(t, async (req, res) => {
    if (req.method === 'POST') {
      let data = ''; for await (const chunk of req) data += chunk;
      req.body = JSON.parse(data);
    }
    await handler(req, res);
  });
  const first = await fetch(base + '/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(first.status, 200); assert.match(first.headers.get('set-cookie'), /Secure/);
  const cookie = first.headers.get('set-cookie').split(';')[0];
  const response = await fetch(base + '/api/discover?gender=woman', { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).profiles.length, 4);
  assert.equal(starts, 1);
});

test('a failed cold start returns a useful 503 and can recover after configuration is fixed', async t => {
  let starts = 0;
  const application = await createApp({ databasePath: ':memory:' });
  t.after(() => application.emit('close'));
  const handler = createHandler(async () => {
    if (++starts === 1) { const error = new Error('Falta configurar la base persistente.'); error.status = 503; throw error; }
    return application;
  });
  const base = await listen(t, handler);
  const failed = await fetch(base + '/api/config');
  assert.equal(failed.status, 503); assert.equal((await failed.json()).error, 'Falta configurar la base persistente.');
  assert.equal((await fetch(base + '/api/config')).status, 200);
});

test('serverless deployments never silently create an ephemeral database', async () => {
  await assert.rejects(() => openDatabase({ path: '/unwritable/lingodate.sqlite', url: null, serverless: true }), error => error.status === 503);
});

test('the Vercel output contains the entry page and assets, excluding source, secrets and databases', () => {
  execFileSync(process.execPath, ['scripts/build.mjs']);
  assert.match(readFileSync('dist/index.html', 'utf8'), /LingōDate/);
  for (const file of ['app.js', 'styles.css', 'demo-profiles.js', 'language-kit.js', 'portraits/sofia.jpg', 'portraits/lisa.jpg']) assert.ok(existsSync('dist/' + file));
  for (const file of ['server.js', 'database.js', '.env', 'data/lingodate.sqlite', 'package.json']) assert.equal(existsSync('dist/' + file), false);
});
