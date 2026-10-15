import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.js';

const profile = (name = 'Rafael') => ({ name, age: 26, city: 'Lima', country: 'Perú', language: 'Español', intention: 'Relación', bio: 'Me encanta viajar y conocer culturas diferentes.', interests: ['Café', 'Viajes'] });
async function start(t, options = {}) {
  const server = createApp({ databasePath: ':memory:', ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, method = 'GET', data, cookie, headers = {}) {
    const response = await fetch(base + path, { method, headers: { ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
    const payload = response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text();
    return { status: response.status, body: payload, cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
  }
  const register = async (name, extra = {}) => {
    const result = await request('/api/register', 'POST', { ...profile(name), email: `${name.toLowerCase()}@example.com`, password: 'StrongPassword123!', adult: true, ...extra });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return { ...result.body.user, cookie: result.cookie };
  };
  return { request, register, server };
}

test('serves only public assets, with security headers', async t => {
  const { request } = await start(t);
  const page = await request('/');
  assert.equal(page.status, 200); assert.match(page.body, /LingōDate/);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal((await request('/server.js')).status, 404);
  assert.equal((await request('/.env')).status, 404);
  assert.equal((await request('/data/lingodate.sqlite')).status, 404);
  assert.equal((await request('/app.js')).status, 200);
});

test('validates adults and profile fields, never exposes credentials', async t => {
  const { request, register } = await start(t);
  const invalid = await request('/api/register', 'POST', { ...profile(), age: 17, email: 'minor@example.com', password: 'StrongPassword123!', adult: true });
  assert.equal(invalid.status, 400);
  const missingConsent = await request('/api/register', 'POST', { ...profile(), email: 'no@example.com', password: 'StrongPassword123!' });
  assert.equal(missingConsent.status, 400);
  const user = await register('Rafael');
  assert.equal(user.password, undefined); assert.equal(user.email, undefined);
  const me = await request('/api/me', 'GET', undefined, user.cookie);
  assert.equal(me.body.user.name, 'Rafael');
  const invalidProfile = await request('/api/profile', 'PUT', { ...profile(), language: 'Fake' }, user.cookie);
  assert.equal(invalidProfile.status, 400);
});

test('login, duplicate email, wrong password, session revocation', async t => {
  const { request, register } = await start(t);
  const user = await register('Rafael');
  const duplicate = await request('/api/register', 'POST', { ...profile(), email: 'RAFAEL@example.com', password: 'StrongPassword123!', adult: true });
  assert.equal(duplicate.status, 409);
  assert.equal((await request('/api/login', 'POST', { email: 'rafael@example.com', password: 'WrongPassword123!' })).status, 401);
  const login = await request('/api/login', 'POST', { email: 'rafael@example.com', password: 'StrongPassword123!' });
  assert.equal(login.status, 200); assert.match(login.headers.get('set-cookie'), /HttpOnly/);
  assert.equal((await request('/api/logout', 'POST', {}, login.cookie)).status, 200);
  assert.equal((await request('/api/me', 'GET', undefined, login.cookie)).status, 401);
  assert.equal((await request('/api/me', 'GET', undefined, user.cookie)).status, 200);
});

test('real people discover each other; demo actors stay isolated', async t => {
  const { request, register } = await start(t);
  const a = await register('Rafael');
  const b = await register('Maria', { country: 'Brasil', language: 'Portugués' });
  const found = await request('/api/discover', 'GET', undefined, a.cookie);
  assert.deepEqual(found.body.profiles.map(p => p.id), [b.id]);
  assert.equal((await request('/api/discover?country=Polonia', 'GET', undefined, a.cookie)).body.profiles.length, 0);
  assert.equal((await request('/api/discover?language=Portugu%C3%A9s', 'GET', undefined, a.cookie)).body.profiles.length, 1);
  const demo = await request('/api/demo', 'POST', {});
  const fictional = await request('/api/discover', 'GET', undefined, demo.cookie);
  assert.equal(fictional.body.profiles.length, 6); assert.ok(fictional.body.profiles.every(p => p.fictional));
  assert.equal((await request('/api/decisions', 'POST', { targetId: b.id, like: true }, demo.cookie)).status, 404);
  assert.equal((await request('/api/decisions', 'POST', { targetId: 'demo-kasia', like: true }, a.cookie)).status, 404);
});

test('mutual likes open a private chat; third parties and unmatched users have no access', async t => {
  const { request, register } = await start(t);
  const a = await register('Rafael'), b = await register('Maria'), c = await register('Carlos');
  const first = await request('/api/decisions', 'POST', { targetId: b.id, like: true }, a.cookie);
  assert.equal(first.body.match, null);
  assert.equal((await request('/api/matches', 'GET', undefined, a.cookie)).body.matches.length, 0);
  const second = await request('/api/decisions', 'POST', { targetId: a.id, like: true }, b.cookie);
  const id = second.body.match.id;
  assert.equal((await request(`/api/matches/${id}/messages`, 'GET', undefined, c.cookie)).status, 404);
  assert.equal((await request(`/api/matches/${id}/messages`, 'POST', { text: 'Intruder' }, c.cookie)).status, 404);
  assert.equal((await request(`/api/matches/${id}/messages`, 'GET')).status, 401);
  const sent = await request(`/api/matches/${id}/messages`, 'POST', { text: '<script>alert("x")</script>' }, a.cookie);
  assert.equal(sent.body.messages.length, 1); assert.equal(sent.body.messages[0].senderId, a.id);
  const received = await request(`/api/matches/${id}/messages`, 'GET', undefined, b.cookie);
  assert.equal(received.body.messages[0].text, '<script>alert("x")</script>');
  assert.equal((await request(`/api/matches/${id}/messages`, 'POST', { text: ' ' }, a.cookie)).status, 400);
  assert.equal((await request(`/api/matches/${id}/messages`, 'POST', { text: 'a'.repeat(2001) }, a.cookie)).status, 400);
  await request('/api/decisions', 'POST', { targetId: b.id, like: true }, a.cookie);
  assert.equal((await request('/api/matches', 'GET', undefined, a.cookie)).body.matches.length, 1);
});

test('blocking removes discovery and disables chat in both directions', async t => {
  const { request, register } = await start(t);
  const a = await register('Rafael'), b = await register('Maria');
  await request('/api/decisions', 'POST', { targetId: b.id, like: true }, a.cookie);
  const match = (await request('/api/decisions', 'POST', { targetId: a.id, like: true }, b.cookie)).body.match;
  assert.equal((await request('/api/blocks', 'POST', { targetId: b.id }, a.cookie)).status, 200);
  for (const user of [a, b]) {
    assert.equal((await request('/api/matches', 'GET', undefined, user.cookie)).body.matches.length, 0);
    assert.equal((await request(`/api/matches/${match.id}/messages`, 'POST', { text: 'hello' }, user.cookie)).status, 404);
    assert.equal((await request('/api/discover', 'GET', undefined, user.cookie)).body.profiles.length, 0);
  }
});

test('account deletion cascades to sessions, matches and messages', async t => {
  const { request, register } = await start(t);
  const a = await register('Rafael'), b = await register('Maria');
  await request('/api/decisions', 'POST', { targetId: b.id, like: true }, a.cookie);
  const match = (await request('/api/decisions', 'POST', { targetId: a.id, like: true }, b.cookie)).body.match;
  await request(`/api/matches/${match.id}/messages`, 'POST', { text: 'Hola' }, a.cookie);
  assert.equal((await request('/api/account', 'DELETE', {}, a.cookie)).status, 200);
  assert.equal((await request('/api/me', 'GET', undefined, a.cookie)).status, 401);
  assert.equal((await request('/api/matches', 'GET', undefined, b.cookie)).body.matches.length, 0);
  assert.equal((await request(`/api/matches/${match.id}/messages`, 'GET', undefined, b.cookie)).status, 404);
  assert.equal((await request('/api/discover', 'GET', undefined, b.cookie)).body.profiles.length, 0);
});

test('demo matches and messages are simulated and isolated for each visitor', async t => {
  const { request } = await start(t);
  const a = await request('/api/demo', 'POST', {}), b = await request('/api/demo', 'POST', {});
  const match = (await request('/api/decisions', 'POST', { targetId: 'demo-kasia', like: true }, a.cookie)).body.match;
  const sent = await request(`/api/matches/${match.id}/messages`, 'POST', { text: 'Hola' }, a.cookie);
  assert.equal(sent.body.messages.length, 3);
  assert.equal((await request(`/api/matches/${match.id}/messages`, 'GET', undefined, b.cookie)).status, 404);
  assert.equal((await request('/api/matches', 'GET', undefined, b.cookie)).body.matches.length, 0);
  await request('/api/decisions', 'POST', { targetId: 'demo-yuki', like: false }, a.cookie);
  assert.equal((await request('/api/discover', 'GET', undefined, a.cookie)).body.profiles.length, 4);
  await request('/api/discover/reset', 'POST', {}, a.cookie);
  assert.equal((await request('/api/discover', 'GET', undefined, a.cookie)).body.profiles.length, 5);
});

test('profile edits persist and credentials are hashed in the database', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'lingodate-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const databasePath = join(dir, 'test.sqlite');
  const first = await start(t, { databasePath });
  const user = await first.register('Rafael');
  assert.equal((await first.request('/api/profile', 'PUT', { ...profile('Rafa'), city: 'Cusco' }, user.cookie)).status, 200);
  const second = await start(t, { databasePath });
  const restored = await second.request('/api/me', 'GET', undefined, user.cookie);
  assert.equal(restored.body.user.name, 'Rafa'); assert.equal(restored.body.user.city, 'Cusco');
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(databasePath);
  const record = db.prepare('SELECT password FROM users WHERE id=?').get(user.id);
  assert.notEqual(record.password, 'StrongPassword123!'); assert.equal(record.password.length, 128);
  db.close();
});

test('rejects cross-site writes, unsupported content types and large payloads', async t => {
  const { request } = await start(t);
  assert.equal((await request('/api/demo', 'POST', {}, null, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await request('/api/demo', 'POST', {}, null, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await request('/api/demo', 'POST', {}, null, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await request('/api/demo', 'POST', { text: 'x'.repeat(17000) })).status, 413);
});

test('auth endpoints rate-limit attempts', async t => {
  const { request } = await start(t);
  for (let i = 0; i < 15; i++) assert.equal((await request('/api/demo', 'POST', {})).status, 200);
  assert.equal((await request('/api/demo', 'POST', {})).status, 429);
});

test('configured translator stores a bilingual message and exposes no API key', async t => {
  const calls = [];
  const translator = { enabled: true, host: 'translation.example', translate: async (...args) => { calls.push(args); return 'Olá, Maria!'; } };
  const { request, register } = await start(t, { translator });
  const a = await register('Rafael'), b = await register('Maria', { language: 'Portugués' });
  await request('/api/decisions', 'POST', { targetId: b.id, like: true }, a.cookie);
  const match = (await request('/api/decisions', 'POST', { targetId: a.id, like: true }, b.cookie)).body.match;
  const sent = await request(`/api/matches/${match.id}/messages`, 'POST', { text: '¡Hola, María!' }, a.cookie);
  assert.deepEqual(calls, [['¡Hola, María!', 'Español', 'Portugués']]);
  assert.equal(sent.body.messages[0].translatedText, 'Olá, Maria!');
  assert.equal(sent.body.messages[0].text, '¡Hola, María!');
  assert.equal(sent.body.messages[0].translationStatus, 'translated');
  const received = await request(`/api/matches/${match.id}/messages`, 'GET', undefined, b.cookie);
  assert.equal(received.body.messages[0].translatedText, 'Olá, Maria!');
  assert.deepEqual((await request('/api/config')).body, { translation: { enabled: true, host: 'translation.example' } });
  const demo = await request('/api/demo', 'POST', {});
  const demoMatch = (await request('/api/decisions', 'POST', { targetId: 'demo-kasia', like: true }, demo.cookie)).body.match;
  await request(`/api/matches/${demoMatch.id}/messages`, 'POST', { text: 'Hola' }, demo.cookie);
  assert.equal(calls.length, 1, 'Demo messages must never leave the server');
});

test('provider failures keep the original message deliverable', async t => {
  const translator = { enabled: true, host: 'translation.example', translate: async () => { throw new Error('Unavailable'); } };
  const { request, register } = await start(t, { translator });
  const a = await register('Rafael'), b = await register('Maria', { language: 'Portugués' });
  await request('/api/decisions', 'POST', { targetId: b.id, like: true }, a.cookie);
  const match = (await request('/api/decisions', 'POST', { targetId: a.id, like: true }, b.cookie)).body.match;
  const sent = await request(`/api/matches/${match.id}/messages`, 'POST', { text: 'Hola' }, a.cookie);
  assert.equal(sent.status, 200);
  assert.equal(sent.body.messages[0].text, 'Hola');
  assert.equal(sent.body.messages[0].translatedText, null);
  assert.equal(sent.body.messages[0].translationStatus, 'unavailable');
});

test('fictional portraits and the frontend data module are available without external requests', async t => {
  const { request } = await start(t);
  for (const person of ['sofia', 'lucas', 'yuki', 'emma']) {
    const image = await request(`/portraits/${person}.jpg`);
    assert.equal(image.status, 200);
    assert.match(image.headers.get('content-type'), /image\/jpeg/);
  }
  const module = await request('/demo-profiles.js');
  assert.equal(module.status, 200);
  assert.match(module.body, /export const demoProfiles/);
  assert.equal((await request('/portraits/unknown.jpg')).status, 404);
});
