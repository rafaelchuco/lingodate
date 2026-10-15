// Fictional editorial details, never inferred about a real person.
export const demoProfiles = {
  'demo-kasia': { photo: '/kasia.jpg', greeting: 'Cześć', timezone: 'Europe/Warsaw', prompt: 'Mi domingo ideal', answer: 'Una librería pequeña, café de especialidad y perderme un rato por el casco antiguo.', teach: 'Te enseñaría a pedir pierogi en polaco.', plan: 'Café y una playlist con canciones de nuestros países.' },
  'demo-sofia': { photo: '/portraits/sofia.jpg', greeting: 'Hola', timezone: 'America/Lima', prompt: 'Si vienes a mi ciudad…', answer: 'Paseamos por el malecón de Miraflores y terminamos hablando de cuál es el mejor postre peruano.', teach: 'Te enseñaría a preparar una causa limeña.', plan: 'Un paseo al atardecer y un café con vista al mar.' },
  'demo-lucas': { photo: '/portraits/lucas.jpg', greeting: 'Olá', timezone: 'America/Sao_Paulo', prompt: 'Mi manera de romper el hielo', answer: 'Te paso una canción brasileña y tú me pasas una de tu país. La conversación viene sola.', teach: 'Te enseñaría mis expresiones favoritas en portugués.', plan: 'Intercambiar canciones y descubrir un café nuevo.' },
  'demo-yuki': { photo: '/portraits/yuki.jpg', greeting: 'こんにちは', timezone: 'Asia/Tokyo', prompt: 'Una pequeña felicidad', answer: 'Encontrar una tienda de cerámica, probar un té distinto y dibujar lo que veo en mi cuaderno.', teach: 'Te enseñaría a escribir tu nombre en japonés.', plan: 'Una tarde de té, dibujo y conversación tranquila.' },
  'demo-emma': { photo: '/portraits/emma.jpg', greeting: 'Salut', timezone: 'Europe/Paris', prompt: 'Podría hablar durante horas de…', answer: 'Una película que me cambió el día, recetas de mi abuela y ese próximo viaje que aún no planeo.', teach: 'Te enseñaría una receta francesa sin complicaciones.', plan: 'Café, una exposición y hablar de nuestras películas favoritas.' },
  'demo-alex': { photo: '/portraits/alex.jpg', greeting: 'Hello', timezone: 'America/New_York', prompt: 'Mi plan sin mirar el reloj', answer: 'Caminar por un parque, descubrir una librería y terminar hablando de todo un poco.', teach: 'Te enseñaría mis rincones favoritos de Nueva York.', plan: 'Un paseo y una conversación sobre el próximo viaje.' }
};
export function commonInterests(user, person) {
  return person.interests.filter(interest => user.interests.includes(interest));
}
export function profileProgress(user) {
  const items = [
    ['Tu presentación', Boolean(user.name?.length >= 2 && user.bio?.length >= 10)],
    ['Tu rincón del mundo', Boolean(user.city && user.country)],
    ['Tu idioma e intención', Boolean(user.language && user.intention)],
    ['Al menos tres intereses', user.interests.length >= 3]
  ];
  return { percent: Math.round(items.filter(([, complete]) => complete).length / items.length * 100), items };
}
export function buildDateProposal({ type, duration, date, time }, person) {
  const plans = {
    coffee: { title: 'Un café, dos culturas', activity: 'Cada quien prepara su bebida favorita y comparte una historia de su ciudad.' },
    music: { title: 'Nuestra primera playlist', activity: 'Elegimos tres canciones de cada país y nos contamos qué significan para nosotros.' },
    culture: { title: 'Un viaje sin maletas', activity: 'Compartimos fotos de nuestros lugares favoritos y nos enseñamos cinco palabras nuevas.' }
  };
  if (!plans[type] || !['30', '60', '90'].includes(String(duration))) throw new Error('Elige un plan y una duración válidos.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('Selecciona un día y una hora.');
  const when = new Date(`${date}T${time}`);
  if (!Number.isFinite(when.getTime()) || when <= new Date()) throw new Error('Elige una fecha y hora futuras.');
  const formatted = when.toLocaleString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const selected = plans[type];
  return { title: selected.title, activity: selected.activity, text: `✨ ${selected.title}\n\n${person.name}, ¿te animas a un encuentro virtual de ${duration} minutos?\n${selected.activity}\n\n📅 ${formatted} (${timezone}, mi zona horaria).\n💬 Si te gusta la idea, acordamos aquí el horario y el medio para conectarnos.` };
}
