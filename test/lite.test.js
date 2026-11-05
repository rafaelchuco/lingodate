import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../lite-server.js';

async function setup(t, provider = null) {
  const server = await createApp({ databasePath: ':memory:', provider });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  async function request(path, data, cookie = '', client = '', method = data === undefined ? 'GET' : 'POST', extra = {}) {
    const response = await fetch(origin + '/api' + path, {
      method, headers: { Cookie: cookie, 'X-Lingo-Client': client, 'Content-Type': 'application/json', ...extra },
      ...(data === undefined ? {} : { body: JSON.stringify(data) })
    });
    return { code: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const guest = (name, language) => request('/guest', { name, language });
  return { request, guest };
}

test('guest and persistent account flows keep credentials private and revoke the session on logout', async t => {
  const { request, guest } = await setup(t);
  assert.equal((await guest('Mariana', 'ja')).code, 400);
  const credentials = { email: 'daniel@example.test', password: 'ein-sicheres-wort' };
  const registered = await request('/register', { ...credentials, name: 'Daniel', language: 'de' });
  assert.equal(registered.code, 200);
  assert.deepEqual(Object.keys(registered.body.user).sort(), ['guest', 'id', 'language', 'name']);
  assert.equal(registered.body.user.guest, false);
  assert.equal((await request('/register', { ...credentials, name: 'Otro', language: 'es' })).code, 409);
  const loggedIn = await request('/login', credentials);
  assert.equal(loggedIn.body.user.id, registered.body.user.id);
  assert.equal((await request('/login', { ...credentials, password: 'wrong-password' })).code, 401);
  assert.equal((await request('/me', { name: 'Daniel', language: 'es' }, loggedIn.cookie, '', 'PUT')).body.user.language, 'es');
  assert.equal((await request('/logout', {}, loggedIn.cookie)).code, 200);
  assert.equal((await request('/me', undefined, loggedIn.cookie)).code, 401);
});

test('one guest claims a room atomically and only its participants can exchange current-generation signals', async t => {
  const { request, guest } = await setup(t);
  const [mariana, daniel, outsider] = await Promise.all([guest('Mariana', 'es'), guest('Daniel', 'de'), guest('Otra persona', 'es')]);
  const host = '1'.repeat(32), visitor = '2'.repeat(32), intruder = '3'.repeat(32);
  assert.equal((await request('/rooms', {})).code, 401);
  assert.equal((await request('/rooms', {}, mariana.cookie, '', 'POST', { Origin: 'https://other.test' })).code, 403);
  const { body: { id }, code } = await request('/rooms', { title: 'Mariana y Daniel' }, mariana.cookie);
  assert.equal(code, 201);
  const path = '/rooms/' + id;
  assert.equal((await request(path + '/join', {}, mariana.cookie, host)).body.role, 'host');
  assert.equal((await request(path, undefined, outsider.cookie, intruder)).code, 403);
  const candidates = [[daniel.cookie, visitor], [outsider.cookie, intruder]];
  const claims = await Promise.all(candidates.map(([cookie, client]) => request(path + '/join', {}, cookie, client)));
  assert.deepEqual(claims.map(r => r.code).sort(), [200, 409]);
  const [winner, winnerClient] = candidates[claims.findIndex(r => r.code === 200)];
  const [loser, loserClient] = candidates[claims.findIndex(r => r.code === 409)];
  const { body: snapshot } = await request(path, undefined, mariana.cookie, host);
  const epoch = snapshot.epoch;
  assert.ok(snapshot.peer.name);
  const offer = { type: 'offer', sdp: 'v=0\r\ns=offer\r\n', epoch };
  assert.equal((await request(path + '/signal', offer, loser, loserClient)).code, 403);
  assert.equal((await request(path + '/signal', offer, winner, winnerClient)).code, 400);
  assert.equal((await request(path + '/signal', { ...offer, epoch: epoch - 1 }, mariana.cookie, host)).code, 409);
  assert.equal((await request(path + '/signal', offer, mariana.cookie, host)).code, 200);
  assert.equal((await request(path, undefined, winner, winnerClient)).body.offer.sdp, offer.sdp);
  const answer = { ...offer, type: 'answer', sdp: 'v=0\r\ns=answer\r\n' };
  assert.equal((await request(path + '/signal', answer, winner, winnerClient)).code, 200);
  assert.equal((await request(path, undefined, mariana.cookie, host)).body.answer.sdp, answer.sdp);
  const fresh = '4'.repeat(32);
  assert.equal((await request(path + '/join', {}, winner, fresh)).body.offer, null);
  assert.equal((await request(path, undefined, winner, winnerClient)).code, 403);
  assert.equal((await request(path + '/leave', {}, winner, fresh)).code, 200);
  assert.equal((await request(path + '/join', {}, loser, loserClient)).code, 200);
  assert.equal((await request(path + '/leave', {}, mariana.cookie, host)).code, 200);
  assert.equal((await request(path, undefined, loser, loserClient)).code, 404);
});

test('room translation is bilingual, requires mutual consent, and stops when a participant revokes consent', async t => {
  const calls = [];
  const provider = { host: 'test.local', async translate(...args) { calls.push(args); return args[2] === 'de' ? 'Guten Morgen' : 'Buenos días'; } };
  const { request, guest } = await setup(t, provider);
  const [es, de] = await Promise.all([guest('Mariana', 'es'), guest('Daniel', 'de')]);
  const host = 'a'.repeat(32), guestClient = 'b'.repeat(32);
  const { body: { id } } = await request('/rooms', {}, es.cookie);
  const path = '/rooms/' + id;
  await request(path + '/join', {}, es.cookie, host);
  await request(path + '/join', {}, de.cookie, guestClient);
  const german = { text: 'Buenos días', source: 'es', target: 'de' };
  const spanish = { text: 'Guten Morgen', source: 'de', target: 'es' };
  assert.equal((await request(path + '/consent', { allowed: true }, de.cookie, guestClient)).code, 200);
  assert.equal((await request(path + '/translate', german, de.cookie, guestClient)).code, 403);
  assert.equal(calls.length, 0);
  assert.equal((await request(path + '/consent', { allowed: true }, es.cookie, host)).code, 200);
  assert.equal((await request(path + '/translate', german, de.cookie, guestClient)).body.text, 'Guten Morgen');
  assert.equal((await request(path + '/translate', spanish, es.cookie, host)).body.text, 'Buenos días');
  assert.equal((await request(path + '/translate', german, es.cookie, host)).code, 400);
  assert.equal((await request(path + '/consent', { allowed: false }, es.cookie, host)).code, 200);
  assert.equal((await request(path + '/translate', spanish, es.cookie, host)).code, 403);
  assert.deepEqual(calls, [['Buenos días', 'es', 'de'], ['Guten Morgen', 'de', 'es']]);
});
