# LingoLite

**Habla en tu idioma. Todos entienden.** Piloto de videollamadas privadas para dos personas, con chat y subtítulos en español y alemán. Esta rama es independiente del LingoDate publicado: no migra sus cuentas, perfiles ni conversaciones.

## Ejecutar

Requiere Node.js 24. Sin servicios externos, usa SQLite en `data/lingolite.sqlite`.

```sh
npm ci
npm run dev
npm run check
npm test
npm run build
```

Abre http://127.0.0.1:3000. Si el puerto está ocupado, arranca con `PORT=3100 npm run dev`. Para usar otro dispositivo, despliega con **HTTPS**; una dirección IP local por HTTP no suele habilitar cámara y micrófono.

## Prueba Mariana / Daniel

1. Mariana entra como invitada en **Español**, crea una sala y copia el enlace.
2. Daniel abre la invitación en otro navegador, perfil o ventana privada, entra como invitado en **Deutsch** y pulsa **Entrar a la reunión**. Las dos identidades deben tener cookies distintas.
3. Esperen **Llamada conectada**. Activen cámara y micrófono cuando los necesiten y comprueben que se ven y se oyen.
4. Activen **Subtítulos** ambos. El navegador transcribe el micrófono en el idioma elegido en el perfil; el receptor ve el original y, si la traducción está disponible, su idioma. Para usar un proveedor configurado en el servidor, ambos deben pulsar **Activar traducción**. Prueben con «¿Puedes oírme bien?» y «Schön, dich kennenzulernen».
5. Prueben también el chat en ambos idiomas. Si falla la traducción, el mensaje original sigue disponible. **Salir** libera el lugar de Daniel o cierra la sala si sale Mariana.

El reconocimiento de voz depende de [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API), puede usar un servicio del navegador y puede no funcionar en todos los dispositivos. El idioma hablado se elige explícitamente; el piloto no lo detecta ni alterna automáticamente. Los subtítulos se envían al terminar cada fragmento reconocido. El audio sigue siendo el original.

### Traducción

- Sin proveedor de servidor, se usa el [traductor integrado de Chrome](https://developer.chrome.com/docs/ai/translator-api) cuando el navegador y el par ES/DE están disponibles. **Activar traducción** permite preparar el modelo; si hace falta, el navegador descarga datos la primera vez.
- Para un entorno con un proveedor compatible con [LibreTranslate](https://docs.libretranslate.com/guides/api_usage/), configura `LINGOLITE_TRANSLATE_URL` (endpoint `/translate`) y, si aplica, `LINGOLITE_TRANSLATE_KEY`. El proveedor solo recibe el texto cuando los dos participantes habilitan la traducción en la sala. Audio y video no se envían al proveedor de traducción.
- Para una prueba local con [Ollama](https://docs.ollama.com/api/chat), arranca Ollama y usa un modelo multilingüe local ya instalado. Ejemplo: `LINGOLITE_OLLAMA_MODEL=qwen3.5:4b npm run dev`. El servidor llama a Ollama en `127.0.0.1:11434`; esta opción no se habilita en Vercel.

## Vercel y redes

El build publica solo la interfaz de LingoLite. La función de Vercel mantiene sesiones y señalización en Turso/libSQL. Puedes usar `LINGOLITE_DATABASE_URL` y `LINGOLITE_DATABASE_TOKEN` para aislar el piloto, o las variables de la integración existente (`TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`): las tablas `lite_*` y la cookie `lingolite` están separadas de LingoDate.

Publica la rama como **Preview** o en un proyecto independiente. Para probar con otra persona, ambos necesitan acceso al enlace del despliegue. Conserva `main` como rama de producción de LingoDate. HTTPS es necesario para los dispositivos y las cookies seguras.

El piloto usa [WebRTC entre pares](https://webrtc.org/getting-started/peer-connections), con señalización por HTTP y sin un servidor LiveKit. Para redes que bloqueen la conexión directa, configura un [relay TURN](https://webrtc.org/getting-started/turn-server) con `LINGOLITE_TURN_URL` y `LINGOLITE_TURN_SECRET` (secreto compartido de coturn; el navegador recibe credenciales que vencen con la sala). `LINGOLITE_STUN_URL` permite cambiar o desactivar el servidor STUN. Evalúa LiveKit si después necesitas un servicio de medios administrado, métricas o salas de más participantes.

La sala caduca a las dos horas. El servidor guarda el perfil, la sesión y los datos temporales para conectar la sala. La aplicación no graba audio ni video; el chat y los subtítulos solo viven en la sesión del navegador. La rama conserva el código histórico para ejecutar sus pruebas, fuera del despliegue de LingoLite.

## Después del piloto

- Medir el tiempo desde que se pronuncia una frase hasta que aparece traducida, así como la estabilidad en dos redes diferentes.
- Evaluar audio traducido y selección automática de idioma después de validar subtítulos.
- Comparar Free (llamadas de prueba) y Premium (más minutos, audio traducido) una vez medido el costo por minuto. No hay pagos, suscripciones ni planes activados.
