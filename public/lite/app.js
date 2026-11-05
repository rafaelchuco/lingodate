import { Call } from './call.js';

const app = document.querySelector('#app'), toast = document.querySelector('#toast');
const el = id => document.getElementById(id);
const labels = { es: 'Español', de: 'Deutsch' };
const other = lang => lang === 'es' ? 'de' : 'es';
const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const paths = {
  arrow: 'M4 12h15m-6-6 6 6-6 6', video: 'M3 6h12v12H3zm12 4 6-4v12l-6-4', mic: 'M9 5a3 3 0 1 1 6 0v6a3 3 0 0 1-6 0zm-3 6a6 6 0 0 0 12 0m-6 6v4m-3 0h6',
  cc: 'M3 5h18v14H3zm7 5a2 2 0 1 0 0 4m7-4a2 2 0 1 0 0 4', link: 'M10 13a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-2 2m2 5a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l2-2',
  shield: 'M12 22c5-3 8-6 8-11V5l-8-3-8 3v6c0 5 3 8 8 11zm-3-10 2 2 4-4', chat: 'M4 4h16v12H9l-5 4zm4 5h8m-8 3h5', globe: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0zM2 12h20M12 2a15 15 0 0 1 0 20m0-20a15 15 0 0 0 0 20',
  plus: 'M12 5v14M5 12h14', exit: 'M11 4H4v16h7m4-13 5 5-5 5m-7-5h12', send: 'm3 4 18 8-18 8 4-8zm4 8h14', settings: 'M4 7h16m-16 10h16M8 4v6m8 4v6'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
const roomPattern = /^[a-f0-9]{48}$/;
const inviteCode = () => new URL(location.href).searchParams.get('sala');
let user, call, activeRoom, config = {}, view = 'loading', mode = 'guest', flashTimer;
let speech, captions = false, captionSequence = 0, chatSequence = 0, lastCaptionAt = 0, translator, translatorVersion = 0;
let connected = false, peerTranslation = false, peerMic = false, peerCamera = false;
const roomLink = id => location.origin + '/?sala=' + id;
const locale = language => language === 'de' ? 'de-DE' : 'es-PE';
const languages = selected => Object.entries(labels).map(([id, name]) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${name}</option>`).join('');
const brand = `<a class="brand" href="/" data-go="home"><img src="/lite/mark.svg" width="36" height="36" alt=""><span>Lingo<span>Lite</span></span></a>`;

function notice(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => toast.classList.remove('show'), 4500);
}
async function api(path, method = 'GET', data, headers = {}) {
  const response = await fetch('/api' + path, {
    method, credentials: 'same-origin', signal: AbortSignal.timeout(12_000),
    headers: { ...headers, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) })
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(result?.error || 'No se pudo conectar con LingoLite.'), { status: response.status });
  return result;
}
function header() {
  return `<header class="site-header"><div class="shell nav">${brand}<div class="nav-actions">${user ? (view === 'call' ? '<span class="quiet">Sala privada</span>' : `<button class="quiet user-pill" data-go="profile"><span class="avatar small">${safe(user.name[0])}</span><span>${safe(user.name)}</span>${icon('settings')}</button><button class="button ghost compact" data-go="logout">Salir</button>`) : `<button class="button ghost compact" data-go="login">Iniciar sesión</button><button class="button primary compact" data-go="guest">Entrar</button>`}</div></div></header>`;
}
function landing() {
  return `<main id="contenido" class="shell landing"><section class="hero"><div><p class="kicker"><i></i> CONVERSACIONES SIN FRONTERAS</p><h1>Habla en tu idioma.<br><em>Todos entienden.</em></h1><p class="intro">Una videollamada, dos idiomas. Comparte un enlace privado y conversa con subtítulos en español o alemán.</p><div class="actions"><button class="button primary" data-go="guest">${icon('video')} Empezar ahora ${icon('arrow')}</button><button class="button secondary" data-go="join">${icon('link')} Unirme a una sala</button></div><p class="footnote">${icon('shield')} Acceso como invitado · Sin tarjeta</p></div>
  <div class="preview" aria-label="Vista ilustrativa de una llamada">
    <div class="preview-head"><span><i></i> LINGOLITE STUDIO</span><span class="pill">VISTA PREVIA</span></div>
    <div class="preview-grid"><div class="portrait coral"><span class="orbit"></span><span class="initial">M</span><span class="preview-name">Mariana <small>ES</small></span></div><div class="portrait cyan"><span class="orbit"></span><span class="initial">D</span><span class="preview-name">Daniel <small>DE</small></span></div></div>
    <div class="preview-caption"><span>${icon('cc')} SUBTÍTULO DE EJEMPLO</span><strong>«Qué gusto conocerte.»</strong><small>Original · Schön, dich kennenzulernen.</small></div>
  </div></section>
  <section class="features" aria-label="Cómo funciona">
    <article>${icon('link')}<div><h2>Un enlace privado</h2><p>Crea una sala para dos personas y comparte la invitación.</p></div></article>
    <article>${icon('globe')}<div><h2>Español ↔ alemán</h2><p>Elige en qué idioma hablas y quieres leer los subtítulos.</p></div></article>
    <article>${icon('mic')}<div><h2>Tú tienes el control</h2><p>Entra con la cámara y el micrófono apagados.</p></div></article>
  </section><footer class="footer">${brand.replace('data-go="home"', '')}<span>Piloto · Videollamadas para dos personas</span></footer></main>`;
}
function auth() {
  const guest = mode === 'guest', login = mode === 'login';
  return `<main id="contenido" class="shell narrow"><section class="card form-card"><p class="kicker"><i></i> ${inviteCode() ? 'INVITACIÓN PRIVADA' : 'TU ESPACIO DE CONVERSACIÓN'}</p><h1>${guest ? 'Entra a LingoLite' : login ? 'Qué gusto verte' : 'Crea tu cuenta'}</h1><p class="muted">${guest ? 'Tu nombre y tu idioma son suficientes para empezar.' : login ? 'Inicia sesión con tu cuenta de LingoLite.' : 'Guarda tu nombre y tu idioma para las próximas llamadas.'}</p>
  <form id="auth-form">${login ? '' : `<label>Nombre<input name="name" required minlength="2" maxlength="40" autocomplete="given-name" placeholder="Tu nombre"></label><label>Idioma para hablar y leer<select name="language">${languages(navigator.language?.startsWith('de') ? 'de' : 'es')}</select></label>`}
  ${guest ? '' : `<label>Correo<input type="email" name="email" maxlength="254" required autocomplete="username"></label><label>Contraseña<input type="password" name="password" minlength="10" maxlength="128" required autocomplete="${login ? 'current-password' : 'new-password'}" placeholder="Al menos 10 caracteres"></label>`}
  <button class="button primary wide" type="submit">${guest ? 'Continuar como invitado' : login ? 'Iniciar sesión' : 'Crear cuenta'} ${icon('arrow')}</button></form>
  <p class="switch">${guest ? '<button class="text-button" data-go="login">Ya tengo cuenta</button><button class="text-button" data-go="register">Crear cuenta</button>' : '<button class="text-button" data-go="guest">Entrar como invitado</button>' + (login ? '<button class="text-button" data-go="register">Crear cuenta</button>' : '<button class="text-button" data-go="login">Iniciar sesión</button>')}</p></section></main>`;
}
function joinForm() {
  return `<main id="contenido" class="shell narrow"><section class="card form-card"><p class="kicker"><i></i> INVITACIÓN PRIVADA</p><h1>Unirme a una sala</h1><p class="muted">Pega el enlace que te enviaron.</p><form id="join-form"><label>Enlace de invitación<input name="invite" maxlength="600" required inputmode="url" placeholder="https://…/?sala=…"></label><button class="button primary wide" type="submit">Continuar ${icon('arrow')}</button></form><button class="text-button back" data-go="home">Volver</button></section></main>`;
}
function dashboard() {
  return `<main id="contenido" class="shell dashboard"><p class="kicker"><i></i> TU ESPACIO DE CONVERSACIÓN</p><div class="dash-head"><div><h1>Hola, ${safe(user.name)}<em>.</em></h1><p class="intro">¿Con quién te gustaría conversar hoy?</p></div><button class="pill language-pill" data-go="profile">${icon('globe')} ${labels[user.language]} <span>· Cambiar</span></button></div>
  <div class="dash-grid"><section class="card dash-card highlighted"><span class="feature-icon">${icon('video')}</span><h2>Crear una sala</h2><p class="muted">Genera un enlace privado para invitar a una persona. La sala caduca en dos horas.</p><form id="create-form"><label>Nombre de la reunión <small>· opcional</small><input name="title" maxlength="60" placeholder="Conversación privada"></label><button class="button primary" type="submit">${icon('plus')} Crear sala</button></form></section>
  <section class="card dash-card"><span class="feature-icon coral-icon">${icon('link')}</span><h2>Unirme a una sala</h2><p class="muted">Entra desde el enlace que recibiste. Puedes activar tus dispositivos cuando estés dentro.</p><form id="join-form"><label>Enlace de invitación<input name="invite" maxlength="600" required inputmode="url" placeholder="https://…/?sala=…"></label><button class="button secondary" type="submit">Entrar a la sala ${icon('arrow')}</button></form></section></div>
  <section class="dash-note">${icon('shield')}<div><strong>Piloto gratuito</strong><p>Las llamadas admiten dos personas. No grabamos el audio ni el video y el chat se borra al salir.</p></div></section></main>`;
}
function profile() {
  return `<main id="contenido" class="shell narrow"><section class="card form-card"><p class="kicker"><i></i> PREFERENCIAS</p><h1>Tu perfil</h1><p class="muted">Tu idioma indica qué hablas y en qué idioma lees las traducciones.</p><form id="profile-form"><label>Nombre<input name="name" required minlength="2" maxlength="40" autocomplete="given-name" value="${safe(user.name)}"></label><label>Idioma<select name="language">${languages(user.language)}</select></label><button class="button primary wide" type="submit">Guardar perfil</button></form><button class="text-button back" data-go="home">Volver</button></section></main>`;
}
function lobby() {
  return `<main id="contenido" class="shell narrow"><section class="card form-card"><span class="feature-icon">${icon('video')}</span><p class="kicker">SALA PRIVADA · DOS PERSONAS</p><h1>¿Listo para entrar?</h1><p class="muted">Entrarás como <strong>${safe(user.name)}</strong> con el micrófono y la cámara apagados.</p><button class="button primary wide" data-go="enter">${icon('video')} Entrar a la reunión</button><p class="footnote">Idioma: ${labels[user.language]}. Puedes cambiarlo en Tu perfil.</p><button class="text-button back" data-go="cancel">Volver al inicio</button></section></main>`;
}
function room() {
  return `<main id="contenido" class="shell studio"><div class="room-head"><div><p class="kicker"><i id="live-dot"></i> <span id="status">Abriendo sala…</span></p><h1 id="room-title">${safe(activeRoom.title || 'Conversación privada')}</h1></div><button class="button secondary compact" data-go="copy">${icon('link')} Copiar invitación</button></div>
  <div class="studio-grid"><section class="stage" aria-label="Videollamada">
    <div class="video-grid">
      <div class="video-tile coral"><video id="local-video" autoplay playsinline muted hidden></video><span class="avatar video-avatar" id="local-avatar">${safe(user.name[0])}</span><span class="video-name">${safe(user.name)} <small>Tú · ${user.language.toUpperCase()}</small></span></div>
      <div class="video-tile cyan"><video id="remote-video" autoplay playsinline></video><span class="avatar video-avatar" id="remote-avatar">·</span><span class="video-name" id="remote-name">Esperando participante</span><button id="play-audio" class="button secondary compact play-audio" data-go="play" hidden>Reproducir audio</button></div>
    </div>
    <div class="caption" id="caption" aria-live="polite"><span>${icon('cc')} <span id="caption-title">SUBTÍTULOS</span></span><strong id="caption-text">Actívalos cuando quieras</strong><small id="caption-original">La traducción aparece aquí, debajo del video.</small></div>
    <div class="controls" aria-label="Controles de videollamada">
      <button class="button control" data-go="microphone" aria-pressed="false">${icon('mic')} <span>Micrófono</span></button>
      <button class="button control" data-go="camera" aria-pressed="false">${icon('video')} <span>Cámara</span></button>
      <button class="button control" data-go="captions" aria-pressed="false">${icon('cc')} <span>Subtítulos</span></button>
      <button class="button danger" data-go="leave">${icon('exit')} <span>Salir</span></button>
    </div>
    <p class="fine-print" id="speech-status">Al activar subtítulos, el navegador puede usar su servicio de reconocimiento de voz.</p>
    <button class="text-button" id="retry" data-go="retry" hidden>Reconectar</button>
  </section><aside class="card room-chat"><div class="chat-head"><span class="feature-icon">${icon('chat')}</span><div><h2>Chat de sala</h2><p>Solo entre participantes.</p></div></div><div class="messages" id="messages" role="log" aria-label="Mensajes"><p id="chat-empty">El chat se habilita al conectar con la otra persona.</p></div>
  <form id="chat-form"><label class="sr-only" for="message">Mensaje</label><input id="message" name="message" placeholder="Escribe un mensaje…" maxlength="1000" required disabled><button class="button primary" aria-label="Enviar mensaje" disabled>${icon('send')}</button></form>
  <div><button class="text-button translation-control" data-go="translation" aria-pressed="false">Activar traducción</button><p class="fine-print" id="translation-status">${config.translationHost ? 'Si ambos la activan, el texto de chat y subtítulos se envía a ' + safe(config.translationHost) + '.' : 'Usa el traductor del navegador si está disponible.'} No se guarda el historial.</p></div></aside></div>
  </main>`;
}
function render(next) {
  view = next;
  const page = { landing, auth, dashboard, profile, join: joinForm, lobby, call: room }[view];
  app.innerHTML = header() + page();
}
function home() {
  history.replaceState(null, '', '/');
  render(user ? 'dashboard' : 'landing');
}
function route() {
  if (roomPattern.test(inviteCode() || '')) render(user ? 'lobby' : 'auth');
  else render(user ? 'dashboard' : 'landing');
}
function openInvite(id) {
  history.replaceState(null, '', '/?sala=' + id);
  if (user) render('lobby');
  else { mode = 'guest'; render('auth'); }
}
function parseInvite(raw) {
  const text = raw.trim();
  if (roomPattern.test(text)) return text;
  try {
    const url = new URL(text);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const id = url.searchParams.get('sala');
    if (roomPattern.test(id || '')) return id;
  } catch { /* Invalid invite. */ }
  return null;
}

const statusLabels = { waiting: 'Esperando a la otra persona', connecting: 'Conectando…', connected: 'Llamada conectada', disconnected: 'Conexión interrumpida', failed: 'No se pudo conectar' };
function callStatus(status) {
  if (!el('status')) return;
  el('status').textContent = statusLabels[status] || statusLabels.connecting;
  el('live-dot').classList.toggle('live', status === 'connected');
  el('retry').hidden = !['disconnected', 'failed'].includes(status);
}
function peerName(peer) {
  if (!el('remote-name')) return;
  el('remote-name').textContent = peer ? peer.name + ' · ' + peer.language.toUpperCase() : 'Esperando participante';
  el('remote-avatar').textContent = peer ? peer.name[0] : '·';
}
function control(action, on) {
  app.querySelector('[data-go="' + action + '"]')?.setAttribute('aria-pressed', String(on));
}
function chatAvailability(open) {
  connected = open;
  if (!el('message')) return;
  el('message').disabled = !open;
  el('chat-form').querySelector('button').disabled = !open;
  if (el('chat-empty')) el('chat-empty').textContent = open ? 'Ya puedes escribirle a la otra persona.' : 'El chat se habilita al conectar con la otra persona.';
}
function updateLocal(tracks) {
  if (!el('local-video')) return;
  const video = tracks.get('video');
  el('local-video').srcObject = video ? new MediaStream([video]) : null;
  el('local-video').hidden = !video;
  el('local-avatar').hidden = Boolean(video);
  control('camera', Boolean(video));
  control('microphone', tracks.has('audio'));
  if (captions) {
    if (tracks.has('audio')) startSpeech();
    else {
      stopSpeech();
      el('speech-status').textContent = 'Activa tu micrófono para compartir tus propios subtítulos.';
    }
  }
}
function updateRemote(stream) {
  const player = el('remote-video');
  if (!player) return;
  player.srcObject = stream;
  playRemote();
}
function playRemote() {
  const player = el('remote-video'), button = el('play-audio');
  if (!player) return;
  player.muted = !peerMic;
  if (!peerMic) button.hidden = true;
  if ((peerMic || peerCamera) && player.srcObject?.getTracks().length) {
    player.play().then(() => { button.hidden = true; }).catch(() => {
      if (peerMic && el('remote-video') === player) button.hidden = false;
    });
  }
}
function updatePeerMedia({ mic, camera, translation }) {
  peerTranslation = Boolean(translation);
  showTranslationStatus();
  if (el('remote-video')) {
    // Preserve the attached audio when the remote camera is off.
    el('remote-video').classList.toggle('audio-only', !camera);
    el('remote-avatar').hidden = camera;
  }
  if (peerMic !== Boolean(mic) || peerCamera !== Boolean(camera)) {
    peerMic = Boolean(mic);
    peerCamera = Boolean(camera);
    playRemote();
  }
}
async function enter(id, title) {
  if (!window.RTCPeerConnection) throw new Error('Este navegador no admite videollamadas WebRTC.');
  activeRoom = { id, title };
  history.replaceState(null, '', '/?sala=' + id);
  render('call');
  const instance = new Call(id, api, {
    status: callStatus, peer: peerName, channel: chatAvailability, local: updateLocal,
    remote: updateRemote, peerMedia: updatePeerMedia, message: receive,
    problem(message) { if (el('status')) { el('status').textContent = message; el('retry').hidden = false; } },
    ended(message) { if (call === instance) { clearCall(); home(); notice(message); } }
  });
  call = instance;
  try {
    await instance.start();
    if (instance === call && el('room-title')) el('room-title').textContent = instance.title || activeRoom.title || 'Conversación privada';
  } catch (error) {
    clearCall();
    home();
    throw error;
  }
}
function clearCall() {
  stopSpeech();
  translatorVersion++;
  translator?.destroy?.();
  translator = null;
  captions = connected = false;
  peerTranslation = peerMic = peerCamera = false;
  call?.stop();
  call = activeRoom = null;
}
function subtitle(title, text, original = '') {
  if (!el('caption')) return;
  el('caption-title').textContent = title;
  el('caption-text').textContent = text;
  el('caption-original').textContent = original;
}
async function prepareTranslation() {
  const current = call, version = ++translatorVersion;
  if (config.translationHost) return;
  if (!window.Translator) {
    el('translation-status').textContent = 'Este navegador no tiene traductor. Puedes leer el texto original.';
    return;
  }
  try {
    const options = { sourceLanguage: other(user.language), targetLanguage: user.language };
    const availability = await window.Translator.availability(options);
    if (current !== call || version !== translatorVersion) return;
    if (availability === 'unavailable') {
      el('translation-status').textContent = 'El traductor no está disponible para estos idiomas.';
      return;
    }
    const ready = await window.Translator.create({ ...options, monitor(monitor) {
      monitor.addEventListener('downloadprogress', event => {
        if (current === call && version === translatorVersion) el('translation-status').textContent = 'Descargando el traductor del navegador: ' + Math.round(event.loaded * 100) + ' %.';
      });
    } });
    if (current !== call || version !== translatorVersion) { ready.destroy(); return; }
    translator?.destroy?.();
    translator = ready;
    control('translation', true);
    el('translation-status').textContent = 'Traductor del navegador listo.';
  } catch {
    if (current === call && version === translatorVersion) el('translation-status').textContent = 'No se pudo preparar el traductor del navegador. Verás el texto original.';
  }
}
function showTranslationStatus() {
  const status = el('translation-status');
  if (!status || !config.translationHost || !call) return;
  status.textContent = !call.translation
    ? 'Si ambos la activan, el texto de chat y subtítulos se envía a ' + config.translationHost + '.'
    : peerTranslation ? 'Traducción activa con ' + config.translationHost + '.' : 'Falta que la otra persona active la traducción.';
}
async function toggleTranslation() {
  if (config.translationHost) {
    const current = call;
    try { await current.setTranslation(!current.translation); }
    finally {
      if (current === call) {
        control('translation', current.translation);
        showTranslationStatus();
      }
    }
  } else if (translator) {
    translator.destroy();
    translator = null;
    control('translation', false);
    el('translation-status').textContent = 'Traducción apagada. Verás el texto original.';
  } else await prepareTranslation();
}
async function translate(text, source) {
  if (source === user.language) return null;
  try {
    if (config.translationHost && call.translation && peerTranslation) return (await call.sendRequest('/translate', { text, source, target: user.language })).text;
    if (translator) return await translator.translate(text);
  } catch { /* Always preserve the original. */ }
  return null;
}
function addMessage(text, own, language) {
  const list = el('messages');
  if (!list) return;
  el('chat-empty')?.remove();
  const item = document.createElement('article');
  item.className = own ? 'bubble own' : 'bubble';
  const label = document.createElement('small'), value = document.createElement('p');
  label.textContent = (own ? 'Tú · ' : '') + labels[language];
  value.textContent = text;
  item.append(label, value);
  list.append(item);
  while (list.children.length > 100) list.firstElementChild.remove();
  list.scrollTop = list.scrollHeight;
  return item;
}
async function receive(data) {
  const current = call;
  if (data.kind === 'chat') {
    if (performance.now() - chatSequence < 80) return;
    chatSequence = performance.now();
    const item = addMessage(data.text, false, data.language);
    const result = await translate(data.text, data.language);
    if (result && current === call && item?.isConnected) {
      const extra = document.createElement('p');
      extra.className = 'translated';
      extra.textContent = labels[user.language] + ' · ' + result;
      item.append(extra);
      el('messages').scrollTop = el('messages').scrollHeight;
    }
    return;
  }
  if (!captions || performance.now() - lastCaptionAt < 250) return;
  lastCaptionAt = performance.now();
  const sequence = ++captionSequence;
  const source = labels[data.language];
  subtitle('ORIGINAL · ' + source, data.text, data.language === user.language ? '' : 'Buscando traducción…');
  const result = await translate(data.text, data.language);
  if (current !== call || sequence !== captionSequence || !captions) return;
  if (result) subtitle('TRADUCCIÓN · ' + labels[user.language], result, 'Original · ' + data.text);
  else if (data.language !== user.language) subtitle('ORIGINAL · ' + source, data.text, 'Traducción no disponible en este navegador o sala.');
}
function stopSpeech() {
  const current = speech;
  speech = null;
  if (current) { current.onend = null; current.abort(); }
}
function startSpeech() {
  if (speech || !captions || !call?.tracks.has('audio')) return;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    el('speech-status').textContent = 'Este navegador no transcribe tu voz. Aún puedes recibir subtítulos y usar el chat.';
    return;
  }
  const instance = new Recognition(), current = call;
  instance.lang = locale(user.language);
  instance.continuous = true;
  instance.interimResults = false;
  instance.onresult = event => {
    if (current !== call || speech !== instance || !captions || !call?.tracks.has('audio')) return;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal && result[0]?.transcript?.trim()) call.send({ kind: 'caption', text: result[0].transcript.trim().slice(0, 1000), language: user.language });
    }
  };
  instance.onstart = () => { if (speech === instance) el('speech-status').textContent = 'Escuchando en ' + labels[user.language] + '. Las frases se muestran al terminar.'; };
  instance.onerror = event => {
    if (speech !== instance || ['aborted', 'no-speech'].includes(event.error)) return;
    stopSpeech();
    el('speech-status').textContent = 'No se pudo transcribir la voz. Revisa el permiso o desactiva y vuelve a activar los subtítulos.';
  };
  instance.onend = () => {
    if (speech !== instance) return;
    speech = null;
    setTimeout(() => { if (current === call) startSpeech(); }, 350);
  };
  speech = instance;
  try { instance.start(); } catch { speech = null; el('speech-status').textContent = 'El navegador no pudo iniciar el reconocimiento de voz.'; }
}
function toggleCaptions() {
  captions = !captions;
  control('captions', captions);
  if (!captions) {
    stopSpeech();
    captionSequence++;
    subtitle('SUBTÍTULOS', 'Subtítulos apagados', 'Puedes activarlos de nuevo en cualquier momento.');
    el('speech-status').textContent = 'No se está transcribiendo tu voz.';
    return;
  }
  subtitle('SUBTÍTULOS', 'Esperando la voz de la otra persona…', 'Ambos deben activar subtítulos y el hablante debe encender su micrófono.');
  if (!call.tracks.has('audio')) el('speech-status').textContent = 'Puedes recibir subtítulos con tu micrófono apagado.';
  if (!translator) prepareTranslation();
  startSpeech();
}

app.addEventListener('click', async event => {
  const button = event.target.closest('[data-go]');
  if (!button) return;
  event.preventDefault();
  const action = button.dataset.go;
  if (button.disabled) return;
  button.disabled = true;
  try {
    if (view === 'call' && !['copy', 'play', 'microphone', 'camera', 'captions', 'translation', 'retry', 'leave'].includes(action)) return;
    if (action === 'home' || action === 'cancel') home();
    else if (['guest', 'login', 'register'].includes(action)) { mode = action; render('auth'); }
    else if (action === 'join' || action === 'profile') render(action);
    else if (action === 'enter') await enter(inviteCode());
    else if (action === 'logout') { await api('/logout', 'POST', {}); user = null; home(); }
    else if (action === 'copy') {
      try { await navigator.clipboard.writeText(roomLink(call.id)); notice('Enlace de invitación copiado.'); }
      catch {
        const field = document.createElement('input');
        field.value = roomLink(call.id); field.readOnly = true;
        field.setAttribute('aria-label', 'Enlace de invitación');
        const existing = el('copy-fallback'); existing?.remove();
        field.id = 'copy-fallback'; button.after(field); field.select();
        notice('Copia el enlace seleccionado.');
      }
    } else if (action === 'camera' || action === 'microphone') {
      try { await call.toggle(action === 'camera' ? 'video' : 'audio'); }
      catch (error) { throw new Error(error.name === 'NotAllowedError' ? 'Permite el acceso al dispositivo en tu navegador.' : error.name === 'NotFoundError' ? 'No se encontró ese dispositivo.' : error.message); }
    } else if (action === 'captions') toggleCaptions();
    else if (action === 'translation') await toggleTranslation();
    else if (action === 'play') { await el('remote-video').play(); button.hidden = true; }
    else if (action === 'retry') {
      await call.restart();
      if (config.translationHost) { control('translation', false); showTranslationStatus(); }
    }
    else if (action === 'leave') {
      const leaving = call;
      clearCall();
      home();
      try { await leaving.leave(); } catch { notice('Saliste. La sala caducará automáticamente si no pudo cerrarse.'); }
    }
  } catch (error) { notice(error.message); }
  finally { button.disabled = false; }
});
app.addEventListener('submit', async event => {
  const form = event.target;
  event.preventDefault();
  const button = form.querySelector('button[type="submit"], button');
  if (button.disabled) return;
  const data = Object.fromEntries(new FormData(form));
  button.disabled = true;
  try {
    if (form.id === 'auth-form') {
      user = (await api('/' + mode, 'POST', data)).user;
      route();
    } else if (form.id === 'profile-form') {
      user = (await api('/me', 'PUT', data)).user;
      route(); notice('Perfil guardado.');
    } else if (form.id === 'join-form') {
      const id = parseInvite(data.invite);
      if (!id) throw new Error('Pega un enlace de invitación válido de LingoLite.');
      openInvite(id);
    } else if (form.id === 'create-form') {
      const { id } = await api('/rooms', 'POST', data);
      await enter(id, data.title);
    } else if (form.id === 'chat-form') {
      const text = data.message?.trim();
      if (!text) return;
      if (!connected || !call.send({ kind: 'chat', text, language: user.language })) throw new Error('El chat no está conectado.');
      addMessage(text, true, user.language);
      form.reset();
    }
  } catch (error) { notice(error.message); }
  finally { button.disabled = form.id === 'chat-form' && !connected; }
});
window.addEventListener('pagehide', clearCall);
window.addEventListener('pageshow', event => { if (event.persisted) route(); });
(async () => {
  const [settings, me] = await Promise.allSettled([api('/config'), api('/me')]);
  if (settings.status === 'fulfilled') config = settings.value;
  if (me.status === 'fulfilled') user = me.value.user;
  route();
  if (settings.status === 'rejected') notice(settings.reason.message);
})();
