const app = document.querySelector('#app');
const languages = ['Español', 'Inglés', 'Polaco', 'Portugués', 'Francés', 'Japonés'];
const countries = ['Perú', 'Polonia', 'Brasil', 'Japón', 'Francia', 'Estados Unidos', 'España', 'México', 'Argentina', 'Colombia', 'Otro'];
const intentions = ['Relación', 'Amistad', 'Intercambio cultural'];
const interests = ['Viajes', 'Café', 'Música', 'Arte', 'Cocina', 'Naturaleza', 'Fotografía', 'Libros', 'Idiomas', 'Playa'];
const flags = { 'Perú': '🇵🇪', 'Polonia': '🇵🇱', 'Brasil': '🇧🇷', 'Japón': '🇯🇵', 'Francia': '🇫🇷', 'Estados Unidos': '🇺🇸', 'España': '🇪🇸', 'México': '🇲🇽', 'Argentina': '🇦🇷', 'Colombia': '🇨🇴' };
const state = { translation: { enabled: false, host: null }, user: null, page: 'home', profiles: [], matches: [], active: null, messages: [], filters: {}, busy: false, generation: 0 };
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icons = { globe: '◎', discover: '✧', matches: '♡', profile: '◉', arrow: '↗', close: '×', send: '↑', moon: '◐' };
const icon = name => `<span aria-hidden="true">${icons[name]}</span>`;
const options = (values, selected, placeholder = '') => `${placeholder ? `<option value="">${placeholder}</option>` : ''}${values.map(v => `<option${v === selected ? ' selected' : ''}>${escape(v)}</option>`).join('')}`;
let toastTimer, polling, pollBusy = false;
try { document.documentElement.dataset.theme = localStorage.getItem('lingodate-theme') || 'dark'; } catch { /* Theme storage is optional. */ }
function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message; el.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 4500);
}
async function api(path, method = 'GET', data) {
  const response = await fetch(`/api${path}`, { method, credentials: 'same-origin', headers: method !== 'GET' ? { 'Content-Type': 'application/json' } : {}, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && state.user) { state.user = null; state.generation++; go('login'); }
    throw new Error(result.error || 'No se pudo completar la solicitud.');
  }
  return result;
}
function avatar(user, large = false) {
  return `<div class="avatar ${large ? 'large' : ''} tone-${escape((user.id || 'a').charCodeAt(0) % 4)}" aria-hidden="true">${user.id === 'demo-kasia' ? '<img src="/kasia.jpg" alt="">' : escape(user.name.slice(0, 1).toUpperCase())}</div>`;
}
function header() {
  return `<header class="topbar"><a href="#" class="brand" data-action="home">${icon('globe')} LingōDate<span class="beta">MVP</span></a><div class="header-actions"><button class="theme" data-action="theme" aria-label="Cambiar tema">${icon('moon')}</button>${state.user ? `<span class="desktop muted">Hola, ${escape(state.user.name)}</span><button class="text-button" data-action="logout">Salir</button>` : `<button class="text-button" data-action="login">Iniciar sesión</button><button class="button small" data-action="register">Crear cuenta ${icon('arrow')}</button>`}</div></header>`;
}
function navigation() {
  return `<nav class="app-nav" aria-label="Navegación principal">${[['discover', 'Descubrir'], ['matches', 'Conexiones'], ['profile', 'Mi perfil']].map(([page, label]) => `<button class="nav-item ${state.page === page ? 'active' : ''}" data-action="${page}" ${state.page === page ? 'aria-current="page"' : ''}>${icon(page)} ${label}${page === 'matches' && state.matches.length ? `<span class="count">${state.matches.length}</span>` : ''}</button>`).join('')}</nav>`;
}
function demoBanner() { return state.user?.demo ? '<div class="demo-banner"><span>✦ Modo demo · Todos los perfiles y las respuestas son ficticios.</span><button class="text-button" data-action="leave-demo">Crear mi cuenta real ↗</button></div>' : ''; }
function landing() {
  return `<main id="content" class="landing"><section class="hero"><div class="hero-copy"><span class="eyebrow"><span class="dot"></span> Un mundo de personas por conocer</span><h1>Una conexión.<br>Mil formas de<br>decir <em>hola.</em></h1><p>Tu próxima gran historia puede empezar al otro lado del mundo. Conoce personas, comparte tu cultura y encuentra lo que los une.</p><div class="hero-actions"><button class="button" data-action="register">Empieza tu historia ${icon('arrow')}</button><button class="button secondary" data-action="demo">Explorar la demo</button></div><div class="hero-note"><span class="mini-flags">🇵🇪 🇵🇱 🇧🇷 🇯🇵</span><span>Sin fronteras. Con intención. Solo +18.</span></div></div><div class="hero-art"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><span class="floating-label label-top">Varsovia, Polonia <span>↗</span></span><article class="preview-card"><div class="preview-photo"><img src="/kasia.jpg" alt="Imagen del perfil ficticio de Kasia"><span class="photo-tag">Perfil de demostración</span><div class="photo-caption"><span>🇵🇱 Polonia</span><h2>Kasia, 25</h2><p>El café sabe mejor en buena compañía.</p></div></div><div class="preview-bottom"><span>☕ Café</span><span>✈ Viajes</span><span>◎ Idiomas</span></div></article><div class="floating-message"><span>♡</span><div><strong>La curiosidad nos conecta.</strong><p>El resto empieza con un hola.</p></div></div><span class="art-spark">✧</span></div></section><section class="intro-strip"><p>Menos barreras.<br><em>Más historias compartidas.</em></p><div><span>01 / DESCUBRE</span><h3>Amplía tu mundo</h3><p>Explora por país, idioma e intención.</p></div><div><span>02 / CONECTA</span><h3>El interés es mutuo</h3><p>Dos likes abren una conversación.</p></div><div><span>03 / CONVERSA</span><h3>Empieza con un hola</h3><p>Mensajes guardados, a tu ritmo.</p></div></section><section class="honest-note"><span>Una primera versión, con intención.</span><p>El MVP incluye perfiles, likes mutuos y chat. La demo usa personas ficticias y frases bilingües de ejemplo. La traducción automática se puede activar conectando un proveedor. Videollamadas y verificación de identidad quedan para próximas versiones.</p></section></main><footer><span class="brand">◎ LingōDate</span><span>Hecho en Lima. Abierto al mundo.</span><button class="text-button" data-action="privacy">Privacidad y seguridad ↗</button></footer>`;
}
function profileFields(user = {}) {
  return `<div class="form-grid"><label>Tu nombre<input name="name" value="${escape(user.name)}" required minlength="2" maxlength="40" autocomplete="given-name" placeholder="¿Cómo te llamas?"></label><label>Edad<input name="age" type="number" value="${escape(user.age)}" min="18" max="100" required placeholder="18 o más"></label><label>País<select name="country" required>${options(countries, user.country || 'Perú')}</select></label><label>Ciudad<input name="city" value="${escape(user.city)}" required minlength="2" maxlength="60" placeholder="Tu ciudad, sin dirección exacta"></label><label>Mi idioma<select name="language">${options(languages, user.language || 'Español')}</select></label><label>Estoy buscando<select name="intention">${options(intentions, user.intention || 'Intercambio cultural')}</select></label></div><label>Un poco de ti<textarea name="bio" required minlength="10" maxlength="400" rows="3" placeholder="Tu plan perfecto, algo que amas, una historia por compartir…">${escape(user.bio)}</textarea></label><fieldset class="interest-picker"><legend>Tus intereses <span class="muted">· elige hasta 5</span></legend>${interests.map(i => `<label><input type="checkbox" name="interests" value="${i}" ${(user.interests || []).includes(i) ? 'checked' : ''}><span>${i}</span></label>`).join('')}</fieldset>`;
}
function authPage(register) {
  return `<main id="content" class="auth-layout"><aside><span class="eyebrow">Tu mundo está por crecer</span><h1>Cada historia<br>empieza con<br><em>curiosidad.</em></h1><p>Un espacio para adultos que quieren conocer personas y culturas con respeto.</p><div class="auth-orb">◎<span>hola · cześć · hello · olá</span></div></aside><section class="form-card"><button class="text-button back" data-action="home">← Volver al inicio</button><h2>${register ? 'Preséntate al mundo' : 'Qué bueno verte de nuevo'}</h2><p class="muted">${register ? 'Crea tu cuenta gratis. Tu próxima conexión está por llegar.' : 'Continúa esa conversación que te hizo sonreír.'}</p><form id="auth-form" data-mode="${register ? 'register' : 'login'}"><label>Correo electrónico<input name="email" type="email" autocomplete="email" maxlength="254" required placeholder="tu@correo.com"></label><label>Contraseña<input name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" minlength="10" maxlength="128" required placeholder="Mínimo 10 caracteres"></label>${register ? `${profileFields()}<label class="checkbox-row"><input type="checkbox" name="adult" required>Confirmo que tengo 18 años o más y he leído la información de privacidad.</label><button type="button" class="text-button privacy-link" data-action="privacy">Ver privacidad y seguridad</button>` : ''}<p class="form-error" role="alert"></p><button class="button full" type="submit">${register ? 'Crear mi cuenta' : 'Iniciar sesión'} ${icon('arrow')}</button></form><p class="form-switch">${register ? '¿Ya tienes cuenta?' : '¿Primera vez aquí?'} <button class="text-button accent" data-action="${register ? 'login' : 'register'}">${register ? 'Inicia sesión' : 'Crea tu cuenta'}</button></p></section></main>`;
}
function profileCard(p) {
  const common = p.interests.filter(i => state.user.interests.includes(i));
  return `<article class="person-card"><div class="person-visual tone-${p.id.charCodeAt(0) % 4}">${p.id === 'demo-kasia' ? '<img src="/kasia.jpg" alt="Imagen ilustrativa de Kasia">' : `<div class="monogram" aria-hidden="true">${escape(p.name[0])}</div><div class="visual-orbit"></div>`}<span class="country-tag">${flags[p.country] || '🌍'} ${escape(p.country)}</span>${p.fictional ? '<span class="fiction-tag">Ficticio</span>' : ''}<div class="visual-caption"><span>${escape(p.city)}</span><h2>${escape(p.name)}, ${p.age}</h2></div></div><div class="person-body"><div class="profile-info"><span>◎ ${escape(p.language)}</span><span>♡ ${escape(p.intention)}</span></div><p>${escape(p.bio)}</p><div class="tags">${p.interests.map(i => `<span class="${common.includes(i) ? 'common' : ''}">${escape(i)}</span>`).join('')}</div><div class="card-actions"><button class="pass-button" data-action="pass" data-id="${p.id}" aria-label="Pasar a ${escape(p.name)}">×</button><button class="button like-button" data-action="like" data-id="${p.id}">♡ Me interesa</button></div></div></article>`;
}
function discover() {
  return `<main id="content" class="workspace"><div class="page-heading"><div><span class="eyebrow">La conexión empieza con curiosidad</span><h1>Tu próxima <em>historia.</em></h1><p class="muted">Personas, culturas y algo en común.</p></div><span class="result-count">${state.profiles.length} perfiles por descubrir</span></div><form id="filters" class="filter-bar"><label>País<select name="country">${options(countries, state.filters.country, 'Todo el mundo')}</select></label><label>Idioma<select name="language">${options(languages, state.filters.language, 'Todos los idiomas')}</select></label><label>Intención<select name="intention">${options(intentions, state.filters.intention, 'Todas las intenciones')}</select></label><button class="text-button" type="button" data-action="clear-filters">Limpiar filtros ↺</button></form>${state.profiles.length ? `<div class="profile-grid">${state.profiles.map(profileCard).join('')}</div><p class="end-note">Cada persona es un mundo. Tómate el tiempo de conocerlo.</p>` : `<div class="empty"><span>◎</span><h2>El mundo aún se está sumando</h2><p>${state.user.demo ? 'Prueba otros filtros o vuelve a ver los perfiles que pasaste.' : 'Todavía no hay más perfiles para estos filtros. Invita a alguien a crear su cuenta o vuelve más tarde.'}</p><button class="button secondary" data-action="${state.user.demo ? 'reset' : 'clear-filters'}">${state.user.demo ? 'Volver a explorar' : 'Ver todos los perfiles'}</button></div>`}</main>`;
}
function matches() {
  return `<main id="content" class="workspace"><div class="page-heading"><div><span class="eyebrow">Dos personas. Una posibilidad.</span><h1>Tus <em>conexiones.</em></h1><p class="muted">Las buenas conversaciones empiezan por algo pequeño.</p></div><button class="text-button" data-action="matches">Actualizar ↻</button></div><div class="inbox"><aside class="conversations" aria-label="Tus conversaciones">${state.matches.length ? state.matches.map(m => `<button class="conversation ${state.active === m.id ? 'selected' : ''}" data-action="open-chat" data-id="${m.id}">${avatar(m.user)}<span><strong>${escape(m.user.name)} <small>${flags[m.user.country] || '🌍'}</small></strong><span class="conversation-preview">${escape(m.lastMessage?.text || 'Un match. Mil cosas por descubrir.')}</span></span><span class="chat-arrow">↗</span></button>`).join('') : '<div class="empty small-empty"><span>♡</span><h3>Todo empieza con un like</h3><p>Cuando sea mutuo, tu conexión aparecerá aquí.</p><button class="button secondary" data-action="discover">Descubrir personas</button></div>'}</aside><section class="chat-panel" id="chat-panel">${chatPanel()}</section></div></main>`;
}
const bilingual = {
  '¡Hola! Me encantaría conocer más sobre tu ciudad.': { Polaco: 'Cześć! Chętnie dowiem się więcej o twoim mieście.', Inglés: 'Hi! I would love to learn more about your city.', Portugués: 'Oi! Adoraria saber mais sobre a sua cidade.', Francés: 'Salut ! J’aimerais en savoir plus sur ta ville.', Japonés: 'こんにちは！あなたの街についてもっと知りたいです。' },
  '¿Qué te parece un café y una buena conversación?': { Polaco: 'Co powiesz na kawę i dobrą rozmowę?', Inglés: 'How about a coffee and a good conversation?', Portugués: 'Que tal um café e uma boa conversa?', Francés: 'Que dirais-tu d’un café et d’une bonne conversation ?', Japonés: 'コーヒーを飲みながらお話ししませんか？' },
  '¿Qué música te hace sonreír?': { Polaco: 'Jaka muzyka sprawia, że się uśmiechasz?', Inglés: 'What music makes you smile?', Portugués: 'Que música faz você sorrir?', Francés: 'Quelle musique te fait sourire ?', Japonés: 'どんな音楽を聴くと笑顔になりますか？' }
};
function messageHtml(m, peer) {
  const sent = m.senderId === state.user.id;
  const translated = state.user.demo && sent && bilingual[m.text]?.[peer.language];
  return `<div class="message ${sent ? 'sent' : 'received'}"><div>${escape(!sent && m.translatedText ? m.translatedText : m.text)}</div>${m.translatedText ? `<p class="translation"><span>${sent ? `Traducción · ${escape(m.translatedLanguage)}` : 'Mensaje original'}</span>${escape(sent ? m.translatedText : m.text)}</p>` : m.translationStatus === 'unavailable' ? '<p class="translation">Traducción no disponible · Se entregó el original.</p>' : m.translationStatus === 'pending' ? '<p class="translation">Traduciendo…</p>' : ''}${translated ? `<p class="translation"><span>Frase de ejemplo · ${escape(peer.language)}</span>${escape(translated)}</p>` : ''}<time datetime="${new Date(m.created).toISOString()}">${new Date(m.created).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</time></div>`;
}
function chatPanel() {
  const match = state.matches.find(m => m.id === state.active);
  if (!match) return '<div class="empty chat-empty"><span>✧</span><h2>Un hola puede cambiarlo todo.</h2><p>Elige una conexión para conversar.</p></div>';
  return `<header class="chat-heading">${avatar(match.user)}<div><h2>${escape(match.user.name)}</h2><p>${escape(match.user.city)} · ${escape(match.user.language)}${match.user.fictional ? ' · Perfil ficticio' : ''}</p></div><button class="text-button" data-action="block" data-id="${match.user.id}">Bloquear</button></header><div class="chat-notice">${state.user.demo ? 'Conversación simulada · Las frases sugeridas incluyen traducciones de ejemplo.' : state.translation.enabled ? `Traducción automática · El texto se envía a ${escape(state.translation.host)}. Siempre puedes ver el original.` : 'Chat privado entre ambos. La traducción automática aún no está conectada.'}</div><div id="messages" class="message-list" role="log" aria-live="polite" aria-label="Mensajes">${state.messages.map(m => messageHtml(m, match.user)).join('')}</div><div class="suggestions" aria-label="Frases para romper el hielo">${Object.keys(bilingual).map((text, i) => `<button data-action="suggest" data-id="${i}">${['◎ Su ciudad', '☕ Un café', '♫ Música'][i]}</button>`).join('')}</div><form id="message-form" class="composer"><label class="sr-only" for="message-input">Tu mensaje</label><textarea id="message-input" name="message" maxlength="2000" rows="1" required placeholder="Escribe un hola, o algo más…"></textarea><button class="send-button" type="submit" aria-label="Enviar mensaje">↑</button></form>`;
}
function profile() {
  return `<main id="content" class="workspace profile-workspace"><div class="page-heading"><div><span class="eyebrow">Lo que te hace tú</span><h1>Tu <em>perfil.</em></h1><p class="muted">Una pequeña ventana a tu mundo.</p></div>${avatar(state.user, true)}</div><section class="form-card"><form id="profile-form">${profileFields(state.user)}<p class="form-error" role="alert"></p><button class="button" type="submit">Guardar mi perfil ↗</button></form></section><section class="account-note"><h3>Tu privacidad importa</h3><p>Solo se muestra tu ciudad; tu correo nunca aparece en tu perfil. Tu edad es autodeclarada y los perfiles aún no tienen verificación de identidad.</p><div><button class="text-button" data-action="privacy">Cómo se guardan tus datos</button><button class="text-button danger" data-action="delete-account">Eliminar mi cuenta y sus datos</button></div></section></main>`;
}
function privacy() {
  return `<main id="content" class="workspace policy"><button class="text-button" data-action="${state.user ? 'profile' : 'home'}">← Volver</button><span class="eyebrow">MVP · Información de uso</span><h1>Conecta con <em>cuidado.</em></h1><h2>Qué se guarda</h2><p>El servidor almacena tu correo, contraseña protegida con un hash scrypt, perfil, likes y mensajes en una base de datos SQLite. Tu correo es privado. Las conversaciones no tienen cifrado de extremo a extremo y el administrador del servidor puede acceder a la base de datos.</p><h2>Tu sesión</h2><p>Usamos una cookie de sesión necesaria, HttpOnly y SameSite, que caduca a los 7 días. El tema visual se guarda en tu navegador. No se incluyen analítica ni cookies publicitarias.</p><h2>Personas y demo</h2><p>Solo para mayores de 18 años. La edad es autodeclarada: aún no verificamos identidad ni documentos. Las cuentas demo están separadas de las cuentas reales y usan perfiles y respuestas ficticios. La demo no envía mensajes a proveedores externos. Si el administrador activa LibreTranslate, los mensajes entre cuentas reales en distintos idiomas se envían al proveedor indicado en el chat para traducirlos.</p><h2>Mensajes y bloqueo</h2><p>El chat se abre con interés mutuo. Puedes bloquear una conexión para ocultarla y detener el acceso al chat para ambas partes. El bloqueo no borra los mensajes. La interfaz muestra los últimos 200 mensajes de cada conversación.</p><h2>Control de tus datos</h2><p>Puedes editar el perfil o eliminar tu cuenta desde Mi perfil. Eliminarla borra también sesiones, likes, matches y mensajes asociados en este servidor. Las cuentas demo también se guardan hasta su eliminación. Esta versión no incluye recuperación de contraseña, verificación de correo ni moderación con un equipo de soporte.</p><h2>Cuida lo que compartes</h2><p>No compartas tu dirección exacta, documentos, contraseñas ni datos financieros. Para una primera cita, elige un lugar público y avisa a alguien de confianza.</p></main>`;
}
function render() {
  const views = { home: landing, login: () => authPage(false), register: () => authPage(true), discover, matches, profile, privacy };
  app.innerHTML = header() + (state.user ? demoBanner() + navigation() : '') + (views[state.page] || landing)();
}
async function loadDiscovery() {
  const { profiles } = await api(`/discover?${new URLSearchParams(state.filters)}`);
  state.profiles = profiles;
}
async function loadMatches() { state.matches = (await api('/matches')).matches; }
async function openChat(id) {
  state.active = id;
  state.messages = (await api(`/matches/${id}/messages`)).messages;
  render(); scrollMessages();
}
function scrollMessages() { const el = document.querySelector('#messages'); if (el) el.scrollTop = el.scrollHeight; }
async function go(page) {
  if (state.user && ['home', 'register', 'login'].includes(page)) page = 'discover';
  if (!state.user && ['discover', 'matches', 'profile'].includes(page)) page = 'login';
  state.page = page;
  state.generation++;
  if (page === 'discover') { await Promise.all([loadDiscovery(), loadMatches()]); }
  if (page === 'matches') {
    await loadMatches();
    if (!state.matches.some(m => m.id === state.active)) state.active = state.matches[0]?.id || null;
    state.messages = state.active ? (await api(`/matches/${state.active}/messages`)).messages : [];
  }
  render(); scrollMessages(); window.scrollTo(0, 0);
}
async function auth(mode, data) {
  state.user = (await api(`/${mode}`, 'POST', data)).user;
  state.active = null; state.messages = []; state.filters = {};
  await go('discover');
}
async function decision(id, like) {
  const result = await api('/decisions', 'POST', { targetId: id, like });
  const person = state.profiles.find(p => p.id === id);
  state.profiles = state.profiles.filter(p => p.id !== id);
  await loadMatches(); render();
  if (result.match) {
    const dialog = document.querySelector('#match-dialog');
    dialog.innerHTML = `<button class="dialog-close text-button" data-action="close-dialog" aria-label="Cerrar">×</button><span class="match-symbol">♡</span><span class="eyebrow">La curiosidad fue mutua</span><h2 id="match-title">Es el comienzo de <em>algo.</em></h2><p>Tú y ${escape(person.name)} quieren conocerse.${state.user.demo ? ' Este match es simulado.' : ''}</p><button class="button full" data-action="match-chat" data-id="${result.match.id}">Decir hola ↗</button><button class="text-button" data-action="close-dialog">Seguir explorando</button>`;
    dialog.showModal();
  } else toast(like ? 'Like guardado. Si es mutuo, tendrán un match.' : 'Seguimos explorando.');
}
function formData(form) {
  const fd = new FormData(form);
  return { ...Object.fromEntries(fd), age: Number(fd.get('age')), interests: fd.getAll('interests'), adult: fd.get('adult') === 'on' };
}
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  event.preventDefault();
  const action = button.dataset.action, id = button.dataset.id;
  if (action === 'theme') {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('lingodate-theme', theme); } catch { /* Optional preference. */ }
    return;
  }
  if (action === 'close-dialog') return document.querySelector('#match-dialog').close();
  if (action === 'suggest') {
    const input = document.querySelector('#message-input'); input.value = Object.keys(bilingual)[Number(id)]; input.focus(); return;
  }
  if (state.busy) return;
  state.busy = true; button.disabled = true;
  try {
    if (action === 'demo') await auth('demo', {});
    else if (action === 'logout' || action === 'leave-demo') {
      await api('/logout', 'POST', {}); state.user = null; state.matches = []; state.active = null; await go(action === 'logout' ? 'home' : 'register');
    } else if (action === 'like' || action === 'pass') await decision(id, action === 'like');
    else if (action === 'open-chat') await openChat(id);
    else if (action === 'match-chat') { document.querySelector('#match-dialog').close(); state.active = id; await go('matches'); }
    else if (action === 'clear-filters' || action === 'reset') {
      state.filters = {};
      if (action === 'reset') await api('/discover/reset', 'POST', {});
      await go('discover');
    } else if (action === 'block') {
      if (!confirm('¿Bloquear a esta persona? El perfil y la conversación se ocultarán para ambos.')) return;
      await api('/blocks', 'POST', { targetId: id }); state.active = null; await go('matches'); toast('Conexión bloqueada.');
    } else if (action === 'delete-account') {
      if (!confirm('¿Eliminar tu cuenta y todos los datos asociados de forma permanente?')) return;
      await api('/account', 'DELETE', {}); state.user = null; state.matches = []; state.active = null; await go('home'); toast('Tu cuenta y sus datos se eliminaron.');
    } else await go(action);
  } catch (error) { toast(error.message); }
  finally { state.busy = false; button.disabled = false; }
});
document.addEventListener('change', async event => {
  if (event.target.closest('#filters')) {
    state.filters = Object.fromEntries(new FormData(document.querySelector('#filters')));
    const generation = ++state.generation;
    const filters = new URLSearchParams(state.filters);
    try { const { profiles } = await api(`/discover?${filters}`); if (state.page === 'discover' && state.generation === generation) { state.profiles = profiles; render(); } } catch (error) { toast(error.message); }
  }
  if (event.target.name === 'interests' && document.querySelectorAll('input[name="interests"]:checked').length > 5) { event.target.checked = false; toast('Elige hasta 5 intereses.'); }
});
document.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  if (!['auth-form', 'profile-form', 'message-form'].includes(form.id) || state.busy) return;
  state.busy = true;
  const button = form.querySelector('[type="submit"]'); button.disabled = true;
  const errorEl = form.querySelector('.form-error'); if (errorEl) errorEl.textContent = '';
  try {
    if (form.id === 'auth-form') await auth(form.dataset.mode, formData(form));
    if (form.id === 'profile-form') { state.user = (await api('/profile', 'PUT', formData(form))).user; render(); toast('Tu perfil está listo para el mundo.'); }
    if (form.id === 'message-form') {
      const text = form.elements.message.value.trim(); if (!text) return;
      state.messages = (await api(`/matches/${state.active}/messages`, 'POST', { text })).messages;
      await loadMatches(); render(); scrollMessages(); document.querySelector('#message-input')?.focus();
    }
  } catch (error) { if (errorEl) errorEl.textContent = error.message; else toast(error.message); }
  finally { state.busy = false; button.disabled = false; }
});
document.addEventListener('keydown', event => {
  if (event.target.id === 'message-input' && event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); event.target.form.requestSubmit(); }
});
async function poll() {
  if (!state.user || state.page !== 'matches' || document.hidden || state.busy || pollBusy) return;
  const generation = state.generation, active = state.active;
  pollBusy = true;
  try {
    const matches = (await api('/matches')).matches;
    if (generation !== state.generation || state.busy) return;
    state.matches = matches;
    if (active && !matches.some(m => m.id === active)) { state.active = null; state.messages = []; render(); return; }
    if (active) {
      const messages = (await api(`/matches/${active}/messages`)).messages;
      if (generation !== state.generation || state.busy || state.active !== active) return;
      if (JSON.stringify(messages) !== JSON.stringify(state.messages)) {
        const el = document.querySelector('#messages');
        const atBottom = el && el.scrollHeight - el.scrollTop - el.clientHeight < 90;
        state.messages = messages;
        const match = matches.find(m => m.id === active);
        if (el && match) { el.innerHTML = messages.map(m => messageHtml(m, match.user)).join(''); if (atBottom) scrollMessages(); }
      }
    }
    // Refresh the list without replacing the composer or interrupting a draft.
    const sidebar = document.querySelector('.conversations');
    if (sidebar) {
      const fragment = document.createElement('template'); fragment.innerHTML = matchesPageSidebar(); sidebar.innerHTML = fragment.innerHTML;
    }
  } catch (error) { if (state.user) toast(error.message); }
  finally { pollBusy = false; }
}
function matchesPageSidebar() {
  const fragment = document.createElement('template'); fragment.innerHTML = matches();
  return fragment.content.querySelector('.conversations').innerHTML;
}
try {
  state.translation = (await api('/config')).translation;
  state.user = (await api('/me')).user;
  await go('discover');
} catch (error) {
  render();
  if (error.message !== 'Inicia sesión para continuar.') toast('No se pudo conectar al servidor. Recarga para volver a intentarlo.');
}
polling = setInterval(poll, 3500);
window.addEventListener('pagehide', () => clearInterval(polling));
