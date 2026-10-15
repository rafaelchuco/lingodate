import { createServer } from 'node:http';
import { openDatabase } from './database.js';
import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTranslator } from './translation.js';
import { demoPhrase, findDemoPhrase } from './public/language-kit.js';

const hashPassword = promisify(scrypt);
const root = dirname(fileURLToPath(import.meta.url));
const languages = ['Español', 'Inglés', 'Polaco', 'Portugués', 'Francés', 'Japonés'];
const intentions = ['Relación', 'Amistad', 'Intercambio cultural'];
const countries = ['Perú', 'Polonia', 'Brasil', 'Japón', 'Francia', 'Estados Unidos', 'España', 'México', 'Argentina', 'Colombia', 'Otro'];
const MAX_BODY = 16_384;
const DAY = 86_400_000;
const digest = value => createHash('sha256').update(value).digest('hex');
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const assert = (condition, status, message) => { if (!condition) throw new HttpError(status, message); };
async function body(req) {
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? String(req.body) : JSON.stringify(req.body);
    assert(Buffer.byteLength(raw) <= MAX_BODY, 413, 'La solicitud es demasiado grande.');
    let value;
    try { value = JSON.parse(raw); } catch { throw new HttpError(400, 'JSON no válido.'); }
    assert(value && typeof value === 'object' && !Array.isArray(value), 400, 'Se espera un objeto JSON.');
    return value;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    assert(size <= MAX_BODY, 413, 'La solicitud es demasiado grande.');
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks).toString('utf8');
  let value;
  try { value = JSON.parse(buffer || '{}'); } catch { throw new HttpError(400, 'JSON no válido.'); }
  assert(value && typeof value === 'object' && !Array.isArray(value), 400, 'Se espera un objeto JSON.');
  return value;
}
function validateProfile(input) {
  const name = clean(input.name, 40), city = clean(input.city, 60), bio = clean(input.bio, 400);
  const age = Number(input.age);
  assert(name.length >= 2 && city.length >= 2, 400, 'Completa tu nombre y ciudad (mínimo 2 caracteres).');
  assert(Number.isInteger(age) && age >= 18 && age <= 100, 400, 'LingōDate es solo para adultos de 18 a 100 años.');
  assert(countries.includes(input.country), 400, 'Selecciona un país válido.');
  assert(languages.includes(input.language), 400, 'Selecciona un idioma válido.');
  assert(intentions.includes(input.intention), 400, 'Selecciona qué buscas.');
  assert(bio.length >= 10, 400, 'Cuéntanos un poco más sobre ti (mínimo 10 caracteres).');
  const interests = Array.isArray(input.interests) ? [...new Set(input.interests.map(x => clean(x, 25)).filter(Boolean))].slice(0, 5) : [];
  const gender = input.gender || 'unspecified';
  assert(['woman', 'man', 'unspecified'].includes(gender), 400, 'Selecciona una opción de género válida.');
  return { name, age, city, bio, gender, country: input.country, language: input.language, intention: input.intention, interests };
}

export async function createApp({ databasePath = process.env.DATABASE_PATH || resolve(root, 'data/lingodate.sqlite'), secureCookie = process.env.COOKIE_SECURE === 'true' || Boolean(process.env.VERCEL), translator = createTranslator(), database } = {}) {
  const db = database || await openDatabase({ path: databasePath });
  await db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE, password TEXT, salt TEXT,
      name TEXT NOT NULL, age INTEGER NOT NULL, city TEXT NOT NULL, country TEXT NOT NULL,
      language TEXT NOT NULL, intention TEXT NOT NULL, bio TEXT NOT NULL, interests TEXT NOT NULL,
      demo INTEGER NOT NULL DEFAULT 0, actor INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS preferences (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, explorer TEXT NOT NULL DEFAULT 'viajero');
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS decisions (user_id TEXT REFERENCES users(id) ON DELETE CASCADE, target_id TEXT REFERENCES users(id) ON DELETE CASCADE, liked INTEGER NOT NULL, PRIMARY KEY(user_id,target_id));
    CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY, a TEXT REFERENCES users(id) ON DELETE CASCADE, b TEXT REFERENCES users(id) ON DELETE CASCADE, created INTEGER NOT NULL, UNIQUE(a,b));
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, match_id TEXT REFERENCES matches(id) ON DELETE CASCADE, sender_id TEXT REFERENCES users(id) ON DELETE CASCADE, text TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS translations (message_id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE, text TEXT, language TEXT NOT NULL, status TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS blocks (user_id TEXT REFERENCES users(id) ON DELETE CASCADE, target_id TEXT REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(user_id,target_id));
    CREATE INDEX IF NOT EXISTS message_match ON messages(match_id,created);
  `);
  // Concurrent cold starts may attempt the same additive migration.
  async function ensureColumn(table, column, definition) {
    if ((await db.all(`PRAGMA table_info(${table})`)).some(c => c.name === column)) return;
    try { await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`); }
    catch (error) { if (!(await db.all(`PRAGMA table_info(${table})`)).some(c => c.name === column)) throw error; }
  }
  await ensureColumn('users', 'gender', "TEXT NOT NULL DEFAULT 'unspecified'");
  await ensureColumn('translations', 'pronunciation', 'TEXT');
  await ensureColumn('translations', 'source_language', 'TEXT');
  const run = (sql, ...args) => db.run(sql, ...args);
  const get = (sql, ...args) => db.get(sql, ...args);
  const all = (sql, ...args) => db.all(sql, ...args);
  const publicUser = u => ({ id: u.id, name: u.name, age: u.age, city: u.city, country: u.country, language: u.language, intention: u.intention, bio: u.bio, interests: JSON.parse(u.interests), demo: Boolean(u.demo), fictional: Boolean(u.actor), gender: u.gender });
  const insertUser = async (id, p, email = null, password = null, salt = null, demo = 0, actor = 0) => {
    (await run(`INSERT ${actor ? 'OR IGNORE ' : ''}INTO users (id,email,password,salt,name,age,city,country,language,intention,bio,interests,demo,actor,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, email, password, salt, p.name, p.age, p.city, p.country, p.language, p.intention, p.bio, JSON.stringify(p.interests), demo, actor, Date.now()));
    if (p.gender) (await run('UPDATE users SET gender=? WHERE id=?', p.gender, id));
    return (await get('SELECT * FROM users WHERE id=?', id));
  };
  const actors = [
    ['kasia', 'Kasia', 25, 'Varsovia', 'Polonia', 'Polaco', 'Relación', 'Colecciono libros, rincones con buen café y planes espontáneos. ¿Me enseñas tu ciudad?', ['Café', 'Viajes', 'Fotografía']],
    ['lucas', 'Lucas', 28, 'São Paulo', 'Brasil', 'Portugués', 'Amistad', 'Música en vivo, una buena caminata y aprender algo nuevo cada día. Con ganas de conocer Perú.', ['Música', 'Naturaleza', 'Viajes']],
    ['yuki', 'Lisa', 26, 'Kioto', 'Japón', 'Japonés', 'Intercambio cultural', 'Diseñadora y fan de las pequeñas cosas. Estoy aprendiendo español y amo cocinar para mis amigos.', ['Arte', 'Cocina', 'Idiomas']],
    ['emma', 'Emma', 27, 'París', 'Francia', 'Francés', 'Relación', 'Siempre buscando una exposición, una nueva receta o una historia que me haga sonreír.', ['Arte', 'Cocina', 'Café']],
    ['alex', 'Alex', 29, 'Nueva York', 'Estados Unidos', 'Inglés', 'Intercambio cultural', 'Mi plan perfecto empieza con una caminata y termina con una conversación sin mirar el reloj.', ['Naturaleza', 'Libros', 'Idiomas']],
    ['sofia', 'Sofía', 24, 'Lima', 'Perú', 'Español', 'Amistad', 'Amante del mar, los atardeceres y la comida peruana. Mi siguiente aventura: aprender portugués.', ['Playa', 'Cocina', 'Viajes']]
  ];
  for (const [id, name, age, city, country, language, intention, bio, interests] of actors) {
    if (!(await get('SELECT id FROM users WHERE id=?', `demo-${id}`))) (await insertUser(`demo-${id}`, { name, age, city, country, language, intention, bio, interests }, null, null, null, 1, 1));
  }
  const actorGenders = { kasia: 'woman', sofia: 'woman', yuki: 'woman', emma: 'woman', lucas: 'man', alex: 'man' };
  for (const [id, gender] of Object.entries(actorGenders)) (await run('UPDATE users SET gender=? WHERE id=?', gender, 'demo-' + id));
  (await run('UPDATE users SET name=? WHERE id=?', 'Álex', 'demo-alex'));
  // Keep the original ID so existing matches and conversations follow the renamed profile.
  (await run('UPDATE users SET name=? WHERE id=?', 'Lisa', 'demo-yuki'));
  async function saveDemoMessage(matchId, actor, phrase) {
    const id = randomUUID();
    (await run('INSERT INTO messages VALUES (?,?,?,?,?)', id, matchId, actor.id, phrase.original, Date.now()));
    (await run('INSERT INTO translations (message_id,text,language,status,pronunciation,source_language) VALUES (?,?,?,?,?,?)', id, phrase.translation, 'Español', 'demo', phrase.pronunciation, actor.language));
  }
  // Upgrade only the known canned messages previously written by fictional actors.
  const legacyReplies = ['¡Me encanta conocer nuevas culturas! Cuéntame más sobre ti.', 'Un café y una buena conversación suenan como un gran plan ☕', '¿Qué lugar de tu país me recomendarías visitar primero?'];
  for (const message of (await all('SELECT m.*,u.language,u.name FROM messages m JOIN users u ON m.sender_id=u.id WHERE u.actor=1'))) {
    let phrase = findDemoPhrase(message.language, message.text);
    const oldReply = legacyReplies.indexOf(message.text);
    if (oldReply >= 0) phrase = demoPhrase(message.language, oldReply + 1);
    if (message.text.startsWith('¡Hola! Soy ') && message.text.endsWith('¿Qué es lo que más te gusta de tu ciudad?')) phrase = demoPhrase(message.language, 0);
    if (phrase) {
      (await run('UPDATE messages SET text=? WHERE id=?', phrase.original, message.id));
      (await run('INSERT INTO translations (message_id,text,language,status,pronunciation,source_language) VALUES (?,?,?,?,?,?) ON CONFLICT(message_id) DO UPDATE SET text=excluded.text,pronunciation=excluded.pronunciation,source_language=excluded.source_language,status=excluded.status', message.id, phrase.translation, 'Español', 'demo', phrase.pronunciation, message.language));
    }
  }
  const limits = new Map();
  function limit(key, max) {
    const now = Date.now();
    let entry = limits.get(key);
    if (!entry || entry.until < now) { entry = { count: 0, until: now + 60_000 }; limits.set(key, entry); }
    assert(++entry.count <= max, 429, 'Demasiados intentos. Espera un minuto.');
    if (limits.size > 10_000) for (const [k, v] of limits) if (v.until < now) limits.delete(k);
  }
  const blocked = async (a, b) => (await get('SELECT 1 FROM blocks WHERE (user_id=? AND target_id=?) OR (user_id=? AND target_id=?)', a, b, b, a));
  async function session(req) {
    const token = /(?:^|;\s*)lingodate=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    const user = token && (await get('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?', digest(token), Date.now()));
    assert(user && !user.actor, 401, 'Inicia sesión para continuar.');
    return user;
  }
  async function setSession(res, id) {
    const token = randomBytes(32).toString('hex');
    (await run('DELETE FROM sessions WHERE expires<?', Date.now()));
    (await run('INSERT INTO sessions VALUES (?,?,?)', digest(token), id, Date.now() + 7 * DAY));
    res.setHeader('Set-Cookie', `lingodate=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secureCookie ? '; Secure' : ''}`);
  }
  async function matchFor(user, id) {
    const match = (await get('SELECT * FROM matches WHERE id=? AND (a=? OR b=?)', id, user.id, user.id));
    assert(match && !(await blocked(match.a, match.b)), 404, 'Conversación no disponible.');
    return match;
  }
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    const json = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      if (!url.pathname.startsWith('/api/')) {
        assert(req.method === 'GET' || req.method === 'HEAD', 405, 'Método no permitido.');
        const files = { '/': 'index.html', '/app.js': 'public/app.js', '/styles.css': 'public/styles.css', '/kasia.jpg': 'public/kasia.jpg', '/favicon.svg': 'public/favicon.svg', '/demo-profiles.js': 'public/demo-profiles.js', '/language-kit.js': 'public/language-kit.js', ...Object.fromEntries(['sofia', 'lucas', 'yuki', 'emma', 'alex', 'lisa', 'emma-reference'].map(name => [`/portraits/${name}.jpg`, `public/portraits/${name}.jpg`])) };
        const file = files[url.pathname];
        assert(file, 404, 'Página no encontrada.');
        const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.png': 'image/png' };
        res.writeHead(200, { 'Content-Type': `${mime[extname(file)]}; charset=utf-8`, 'Cache-Control': 'no-cache' });
        res.end(req.method === 'HEAD' ? undefined : readFileSync(resolve(root, file)));
        return;
      }
      assert(!req.headers['sec-fetch-site'] || req.headers['sec-fetch-site'] !== 'cross-site', 403, 'Solicitud de otro sitio no permitida.');
      if (req.headers.origin) assert(new URL(req.headers.origin).host === req.headers.host, 403, 'Origen no permitido.');
      if (req.method !== 'GET') assert((req.headers['content-type'] || '').startsWith('application/json'), 415, 'Usa application/json.');
      limit(`api:${req.socket?.remoteAddress || 'function'}`, 300);
      const path = url.pathname;
      if (req.method === 'POST' && ['/api/register', '/api/login', '/api/demo'].includes(path)) {
        limit(`auth:${req.socket.remoteAddress}`, 15);
        const input = await body(req);
        let user;
        if (path === '/api/demo') {
          user = (await insertUser(randomUUID(), { name: 'Viajero', age: 26, city: 'Lima', country: 'Perú', language: 'Español', intention: 'Intercambio cultural', bio: 'Explorando nuevas culturas y conexiones alrededor del mundo.', interests: ['Viajes', 'Café', 'Idiomas'] }, null, null, null, 1));
        } else {
          const email = clean(input.email, 254).toLowerCase();
          assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 400, 'Ingresa un correo válido.');
          assert(typeof input.password === 'string' && input.password.length >= 10 && input.password.length <= 128, 400, 'La contraseña debe tener entre 10 y 128 caracteres.');
          if (path === '/api/register') {
            const p = validateProfile(input);
            assert(input.adult === true, 400, 'Debes confirmar que eres mayor de edad.');
            assert(!(await get('SELECT id FROM users WHERE email=?', email)), 409, 'Ya existe una cuenta con ese correo.');
            const salt = randomBytes(16).toString('hex');
            const password = (await hashPassword(input.password, salt, 64)).toString('hex');
            // Recheck after the asynchronous password hash to avoid concurrent duplicate registration.
            assert(!(await get('SELECT id FROM users WHERE email=?', email)), 409, 'Ya existe una cuenta con ese correo.');
            user = (await insertUser(randomUUID(), p, email, password, salt));
          } else {
            user = (await get('SELECT * FROM users WHERE email=? AND demo=0', email));
            const candidate = await hashPassword(input.password, user?.salt || 'lingodate-placeholder', 64);
            assert(user && timingSafeEqual(candidate, Buffer.from(user.password, 'hex')), 401, 'Correo o contraseña incorrectos.');
          }
        }
        (await setSession(res, user.id));
        return json(200, { user: publicUser(user) });
      }
      if (path === '/api/config' && req.method === 'GET') return json(200, { translation: { enabled: translator.enabled, host: translator.host } });
      const user = (await session(req));
      if (path === '/api/me' && req.method === 'GET') return json(200, { user: publicUser(user) });
      if (path === '/api/logout' && req.method === 'POST') {
        const token = /lingodate=([a-f0-9]{64})/.exec(req.headers.cookie || '')?.[1];
        if (token) (await run('DELETE FROM sessions WHERE token=?', digest(token)));
        res.setHeader('Set-Cookie', `lingodate=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookie ? '; Secure' : ''}`);
        return json(200, { ok: true });
      }
      if (path === '/api/profile' && req.method === 'PUT') {
        const input = await body(req);
        const p = validateProfile({ ...input, gender: input.gender || user.gender });
        (await run('UPDATE users SET name=?,age=?,city=?,country=?,language=?,intention=?,bio=?,interests=? WHERE id=?', p.name, p.age, p.city, p.country, p.language, p.intention, p.bio, JSON.stringify(p.interests), user.id));
        (await run('UPDATE users SET gender=? WHERE id=?', p.gender, user.id));
        return json(200, { user: publicUser((await get('SELECT * FROM users WHERE id=?', user.id))) });
      }
      if (path === '/api/account' && req.method === 'DELETE') {
        (await run('DELETE FROM users WHERE id=?', user.id));
        res.setHeader('Set-Cookie', `lingodate=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookie ? '; Secure' : ''}`);
        return json(200, { ok: true });
      }
      if (path === '/api/preferences' && req.method === 'GET') return json(200, { explorer: (await get('SELECT explorer FROM preferences WHERE user_id=?', user.id))?.explorer || 'viajero' });
      if (path === '/api/preferences' && req.method === 'PUT') {
        const input = await body(req);
        assert(['viajero', 'viajera'].includes(input.explorer), 400, 'Elige viajero o viajera.');
        (await run('INSERT INTO preferences VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET explorer=excluded.explorer', user.id, input.explorer));
        if (user.demo && ['Viajero', 'Viajera'].includes(user.name)) (await run('UPDATE users SET name=? WHERE id=?', input.explorer === 'viajero' ? 'Viajero' : 'Viajera', user.id));
        return json(200, { explorer: input.explorer });
      }
      if (path === '/api/discover' && req.method === 'GET') {
        const profiles = (await all(`SELECT * FROM users u WHERE u.id!=? AND u.demo=? AND u.actor=?
          AND NOT EXISTS(SELECT 1 FROM decisions d WHERE d.user_id=? AND d.target_id=u.id AND NOT (d.liked=1 AND EXISTS(SELECT 1 FROM matches m WHERE (m.a=? AND m.b=u.id) OR (m.b=? AND m.a=u.id))))
          AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.target_id=u.id) OR (b.target_id=? AND b.user_id=u.id))
          AND (?='' OR u.gender=?) AND (?='' OR u.country=?) AND (?='' OR u.language=?) AND (?='' OR u.intention=?) ORDER BY created DESC LIMIT 100`, user.id, user.demo, user.demo ? 1 : 0, user.id, user.id, user.id, user.id, user.id,
          url.searchParams.get('gender') || '', url.searchParams.get('gender') || '',
          url.searchParams.get('country') || '', url.searchParams.get('country') || '',
          url.searchParams.get('language') || '', url.searchParams.get('language') || '',
          url.searchParams.get('intention') || '', url.searchParams.get('intention') || '')).map(publicUser);
        return json(200, { profiles });
      }
      if (path === '/api/decisions' && req.method === 'POST') {
        const input = await body(req);
        const target = (await get('SELECT * FROM users WHERE id=?', clean(input.targetId, 64)));
        assert(target && target.id !== user.id && target.demo === user.demo && target.actor === (user.demo ? 1 : 0) && !(await blocked(user.id, target.id)), 404, 'Perfil no disponible.');
        assert(typeof input.like === 'boolean', 400, 'Decisión no válida.');
        (await run('INSERT INTO decisions VALUES (?,?,?) ON CONFLICT(user_id,target_id) DO UPDATE SET liked=excluded.liked', user.id, target.id, input.like ? 1 : 0));
        let match = null;
        if (input.like && (target.actor || (await get('SELECT 1 FROM decisions WHERE user_id=? AND target_id=? AND liked=1', target.id, user.id)))) {
          const [a, b] = [user.id, target.id].sort();
          (await run('INSERT OR IGNORE INTO matches VALUES (?,?,?,?)', randomUUID(), a, b, Date.now()));
          match = (await get('SELECT id FROM matches WHERE a=? AND b=?', a, b));
          if (target.actor && !(await get('SELECT id FROM messages WHERE match_id=?', match.id))) (await saveDemoMessage(match.id, target, demoPhrase(target.language, 0)));
        }
        return json(200, { match });
      }
      if (path === '/api/discover/reset' && req.method === 'POST') {
        assert(user.demo, 403, 'Esta opción está disponible en la demo.');
        (await run('DELETE FROM decisions WHERE user_id=? AND liked=0', user.id));
        return json(200, { ok: true });
      }
      if (path === '/api/matches' && req.method === 'GET') {
        const matches = [];
        for (const m of (await all('SELECT * FROM matches WHERE a=? OR b=? ORDER BY created DESC', user.id, user.id))) {
          if ((await blocked(m.a, m.b))) continue;
          const peer = (await get('SELECT * FROM users WHERE id=?', m.a === user.id ? m.b : m.a));
          matches.push({ id: m.id, user: publicUser(peer), lastMessage: (await get('SELECT text,created FROM messages WHERE match_id=? ORDER BY created DESC,rowid DESC LIMIT 1', m.id)) || null });
        }
        return json(200, { matches });
      }
      const messageRoute = /^\/api\/matches\/([a-zA-Z0-9-]+)\/messages$/.exec(path);
      if (messageRoute && ['GET', 'POST'].includes(req.method)) {
        const match = (await matchFor(user, messageRoute[1]));
        if (req.method === 'POST') {
          limit(`message:${user.id}`, 30);
          const input = await body(req);
          assert(typeof input.text === 'string' && input.text.trim().length > 0 && input.text.trim().length <= 2000, 400, 'Escribe un mensaje de entre 1 y 2000 caracteres.');
          const messageId = randomUUID();
          (await run('INSERT INTO messages VALUES (?,?,?,?,?)', messageId, match.id, user.id, input.text.trim(), Date.now()));
          const peer = (await get('SELECT * FROM users WHERE id=?', match.a === user.id ? match.b : match.a));
          if (!user.demo && translator.enabled && user.language !== peer.language) {
            (await run('INSERT INTO translations (message_id,text,language,status,source_language) VALUES (?,?,?,?,?)', messageId, null, peer.language, 'pending', user.language));
            try {
              const result = translator.analyze ? await translator.analyze(input.text.trim(), user.language, peer.language) : { translatedText: await translator.translate(input.text.trim(), user.language, peer.language), pronunciation: null };
              (await run('UPDATE translations SET text=?,pronunciation=?,status=? WHERE message_id=?', result.translatedText, result.pronunciation, result.translatedText ? 'translated' : 'unavailable', messageId));
            } catch {
              // Deliver the original even when the provider is unavailable. Never log private text.
              (await run('UPDATE translations SET status=? WHERE message_id=?', 'unavailable', messageId));
            }
            // The other participant may have blocked or deleted their account while awaiting translation.
            (await matchFor(user, match.id));
          }
          if (peer.actor) {
            const count = (await get('SELECT COUNT(*) AS n FROM messages WHERE match_id=? AND sender_id=?', match.id, user.id)).n;
            (await saveDemoMessage(match.id, peer, demoPhrase(peer.language, 1 + (count - 1) % 3)));
          }
        }
        return json(200, { messages: (await all('SELECT m.id,m.sender_id AS senderId,m.text,m.created,t.text AS translatedText,t.language AS translatedLanguage,t.status AS translationStatus,t.pronunciation,t.source_language AS sourceLanguage FROM (SELECT rowid AS seq,* FROM messages WHERE match_id=? ORDER BY created DESC,rowid DESC LIMIT 200) m LEFT JOIN translations t ON t.message_id=m.id ORDER BY m.created,m.seq', match.id)) });
      }
      if (path === '/api/blocks' && req.method === 'POST') {
        const input = await body(req);
        const target = (await get('SELECT * FROM users WHERE id=?', clean(input.targetId, 64)));
        assert(target && target.id !== user.id && target.demo === user.demo, 404, 'Perfil no disponible.');
        (await run('INSERT OR IGNORE INTO blocks VALUES (?,?)', user.id, target.id));
        return json(200, { ok: true });
      }
      throw new HttpError(404, 'Recurso no encontrado.');
    } catch (error) {
      if (!error.status) console.error(error);
      if (!res.headersSent) json(error.status || 500, { error: error.status ? error.message : 'Ocurrió un error. Inténtalo de nuevo.' });
      else res.end();
    }
  });
  server.on('close', () => db.close());
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  const server = await createApp();
  server.listen(port, host, () => console.log(`LingōDate → http://${host}:${port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
}
