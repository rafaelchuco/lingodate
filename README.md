# LingōDate

MVP web de conexiones interculturales. Convierte la landing original en una aplicación con cuentas reales, perfiles, descubrimiento, likes mutuos y conversaciones persistentes. Conserva la identidad visual cálida, coral y serif del proyecto.

## Ejecutar

Requiere **Node.js 24**. Instala las dependencias del cliente de base de datos antes de ejecutar.

```sh
npm ci
npm start
```

Abre [http://127.0.0.1:3000](http://127.0.0.1:3000). Para reiniciar automáticamente al editar el servidor, usa `npm run dev`.

### Probar en dos minutos

1. Pulsa **Explorar la demo**: se crea una sesión aislada con seis perfiles ficticios.
2. Filtra por país, idioma o intención y pulsa **Me interesa**.
3. La demo simula el like recíproco. Pulsa **Decir hola** en el match.
4. Escribe un mensaje o elige una frase para romper el hielo. Las tres frases sugeridas muestran traducciones de ejemplo si el idioma es distinto del español.
5. Edita el perfil, recarga para comprobar la persistencia o bloquea una conexión.

Las respuestas automáticas solo existen en la demo. Las cuentas demo se guardan en SQLite y se pueden eliminar desde Mi perfil. No aparecen en el descubrimiento de cuentas reales.

Para probar el flujo real, crea dos cuentas en navegadores o perfiles de navegador diferentes. Cada cuenta debe dar like a la otra antes de poder chatear. No hay perfiles reales precargados, por lo que un primer registro puede ver una lista vacía.

## Alcance funcional

- Registro y login con email y contraseña de 10 a 128 caracteres.
- Edad mínima de 18 años autodeclarada; no se afirma verificación de identidad.
- Perfil editable: nombre, edad, ciudad, país, idioma, intención, biografía y hasta cinco intereses.
- Descubrimiento con filtros; pasar perfiles y guardar likes.
- Match solo con interés mutuo. Los matches existentes permanecen hasta bloquear o eliminar una cuenta.
- Chat accesible exclusivamente por sus participantes; actualización cada 3,5 segundos mientras está abierto. Muestra los últimos 200 mensajes.
- Traducción automática opcional entre idiomas distintos mediante LibreTranslate, guardando tanto el original como la traducción.
- Bloqueo bilateral que oculta la conexión e impide acceder al chat. Sin opción de desbloqueo en esta versión.
- Eliminación de cuenta con borrado en cascada de sesiones, likes, matches y mensajes asociados.
- Diseño adaptable a móvil, modo claro/oscuro, formularios con etiquetas y soporte de teclado.

## Configuración

Las variables se leen del entorno. Puedes copiar `.env.example` a `.env` y arrancar con:

```sh
node --env-file=.env server.js
```

| Variable | Predeterminado | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Puerto HTTP |
| `HOST` | `127.0.0.1` | Usa `0.0.0.0` en contenedores o hosting |
| `DATABASE_PATH` | `./data/lingodate.sqlite` | Archivo SQLite; debe estar en un volumen persistente |
| `COOKIE_SECURE` | `false` | Activa `true` detrás de HTTPS |
| `TRANSLATE_URL` | sin configurar | URL completa del endpoint `/translate` de LibreTranslate |
| `TRANSLATE_API_KEY` | sin configurar | Clave opcional, solo del servidor |

### Traducción

La integración sigue el [contrato oficial de LibreTranslate](https://docs.libretranslate.com/api/operations/translate/): texto plano, código de idioma de origen y destino y `translatedText` en la respuesta. Puedes usar una instancia propia o un proveedor compatible. La disponibilidad de cada par de idiomas depende de los modelos instalados en esa instancia.

Sin `TRANSLATE_URL`, los mensajes reales se entregan en su idioma original y la interfaz indica que la traducción no está conectada. No se envían textos a terceros por defecto. Al configurar el proveedor, los mensajes reales entre idiomas distintos se envían a él y su dominio aparece en el chat. La API key nunca se expone al navegador. La demo nunca llama al proveedor.

La espera del proveedor tiene un máximo de 8 segundos. Si falla, se conserva y entrega el original, marcado como traducción no disponible. Las traducciones son automáticas y pueden contener errores. Las pruebas usan un proveedor simulado; no se ha validado un proveedor real con credenciales.

## Datos y seguridad implementada

Servidor Node HTTP con SQLite nativo en local y libSQL/Turso remoto para Vercel. Contraseñas con scrypt y sal aleatoria; tokens de sesión aleatorios guardados como SHA-256 en la base de datos. Cookies HttpOnly, SameSite=Lax y vencimiento de 7 días. Consultas parametrizadas, comprobación de participantes en cada operación de chat, escape de contenido en la interfaz, CSP restrictiva, protección de origen, límites de tamaño y rate limiting básico en memoria.

El correo y los hashes no forman parte de los perfiles públicos. No se publica una dirección exacta. No hay analítica, fuentes remotas ni rastreadores. La imagen `public/kasia.jpg` proviene del repositorio original y solo ilustra un perfil ficticio.

Los mensajes **no tienen cifrado de extremo a extremo**. El administrador puede leer la base de datos. El rate limit se aplica a la IP del socket; detrás de un proxy se comparte entre visitantes y conviene implementar límites por IP en el proxy. No se confía automáticamente en `X-Forwarded-For`.

## Validación

```sh
npm run check
npm test
```

Las pruebas HTTP cubren registro, login, validación de adultos, sesiones, aislamiento de la demo, filtros, likes mutuos, autorización del chat, bloqueo, eliminación en cascada, persistencia en SQLite, traducción con proveedor simulado, fallos del proveedor, protección de origen y rate limiting. El adaptador de traducción también verifica el contrato de solicitud y el rechazo de respuestas incorrectas. GitHub Actions ejecuta las comprobaciones con Node 24 en cada push a `main` o pull request.

## Despliegue

Puedes desplegar con **Vercel + Turso** (ver abajo), o con un servidor Node y disco persistente. GitHub Pages por sí solo no puede ejecutar la API ni guardar cuentas.

También se incluye un Dockerfile:

```sh
docker build -t lingodate .
docker run --rm -p 3000:3000 -v lingodate-data:/app/data lingodate
```

El Dockerfile no se ha ejecutado en este entorno. En hosting público, termina HTTPS en un proxy, usa `COOKIE_SECURE=true`, mantén el archivo SQLite fuera del directorio público y configura copias de seguridad. El modo de archivo local requiere una sola instancia con ese disco. En Vercel, usa el modo Turso remoto para compartir datos persistentes entre funciones.

## Límites del MVP

No incluye subida de fotografías (las cuentas reales usan iniciales), verificación de correo/documentos, recuperación de contraseña, cobros, videollamadas, voz, notificaciones push, moderación con un equipo de soporte ni reportes gestionados. Las cuentas demo no se purgan automáticamente: deben eliminarse desde la interfaz o añadirse una política de retención antes de un lanzamiento amplio. La información de privacidad en la app describe el funcionamiento técnico; se deben completar los términos y datos del operador antes de captar usuarios en producción.

## Estructura

```text
index.html               Entrada accesible, sin scripts inline
public/app.js            Interfaz y flujos de usuario
public/styles.css        Diseño adaptable y temas
server.js                API, autenticación y persistencia
translation.js           Adaptador opcional LibreTranslate
test/                    Pruebas de integración y del adaptador
data/                    SQLite generado, excluido de Git
.github/workflows/ci.yml  Validación automática
```

## Mejoras de la demo

Lucas y Álex tienen retratos generados con IA; Emma, Lisa y Sofía usan imágenes aportadas por el usuario, guardadas localmente en `public/portraits/`. Las fichas ampliadas incluyen preguntas personales, pequeños detalles culturales, el plan favorito del personaje e intereses realmente compartidos con tu perfil. Los textos adicionales son ficticios y se muestran solo para los personajes demo. [Procedencia y prompts de los retratos](docs/portrait-prompts.md).

El descubrimiento permite buscar por nombre, ciudad, biografía o interés entre los perfiles cargados, ordenar por intereses en común o nombre y explorar países con accesos rápidos. La coincidencia de intereses se calcula a partir de las selecciones de ambos perfiles; no representa un porcentaje de compatibilidad psicológica.

En Mi perfil se muestra un progreso basado en campos completados. “Viajero” sigue siendo el nombre inicial de una sesión demo y puede editarse; nunca se asigna el nombre del dueño del repositorio a visitantes.

Desde un chat con match, **Proponer un plan** prepara una invitación para un encuentro virtual de café, música o intercambio cultural, con fecha, duración y zona horaria del navegador. El usuario revisa y puede editar el borrador antes de enviarlo. La propuesta solo queda guardada como mensaje cuando se pulsa Enviar; no crea reservas, llamadas ni eventos de calendario.

## Países, viajeros y chat de tres partes

La barra **Hola, viajero / Hola, viajera** guarda una preferencia de descubrimiento en SQLite. Viajero muestra mujeres; viajera muestra hombres. La demo presenta primero a Emma, Sofía, Lisa y Kasia, o a Lucas y Álex según la opción seleccionada. Álex también tiene un retrato generado con IA. Cambiar la selección conserva los matches y chats existentes. El género de las cuentas reales se declara en el formulario de perfil: no se deduce del nombre, foto ni opción de viajero. Los perfiles con género sin indicar no aparecen en estas selecciones.

**Países** abre una pantalla independiente de destinos. Al elegir uno se muestra su vista de descubrimiento con los filtros correspondientes y una opción para volver a los otros países. Los contadores reflejan los perfiles disponibles para la preferencia seleccionada.

Un perfil con match sigue visible en Descubrir con **Ya conectaron · Conversar**. Esto incluye Kasia; los perfiles bloqueados siguen ocultos y los pasados requieren el reinicio de demo ya existente.

Cada mensaje muestra, en este orden y dentro de una misma tarjeta:

1. El texto original con su idioma.
2. Una pronunciación escrita aproximada para lectores de español.
3. La traducción y el idioma de destino.

`public/language-kit.js` contiene ejemplos nativos de los seis idiomas de la demo con traducciones y lecturas orientativas. Las respuestas de personajes ficticios se guardan con sus tres partes, sin llamar a servicios externos. Las respuestas antiguas conocidas de la demo se migran a estos ejemplos; los mensajes de usuarios reales se conservan. La pronunciación no es IPA ni una transcripción fonética exacta.

Para mensajes libres entre cuentas reales, hay dos opciones:

- **LibreTranslate:** configuración existente. Traduce, pero no genera pronunciación. La interfaz indica cuando una lectura no está disponible.
- **OpenAI:** configurar explícitamente `LANGUAGE_PROVIDER=openai`, `OPENAI_API_KEY` y, opcionalmente, `LANGUAGE_MODEL` (predeterminado: `gpt-4.1-mini`). La integración utiliza [Responses y Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) para solicitar una traducción y una lectura en grafía española del **original**, en un objeto validado. Se usa `store: false`. El texto se envía a `api.openai.com`; la clave permanece en el servidor.

El proveedor solo se utiliza al configurarlo explícitamente y no se llama para los personajes demo. Los resultados se muestran al completarse la solicitud, con hasta 8 segundos de espera; no se promete una latencia fija ni streaming de palabras. Si falla, se mantiene el original. Las pruebas del proveedor usan respuestas simuladas; no se ha realizado una llamada con una clave real. Las tres partes no se inventan para mensajes libres cuando falta el proveedor.

### Imágenes aportadas para Emma y Lisa

Emma usa la primera imagen aportada por el usuario (`public/portraits/emma-reference.jpg`). El antiguo personaje Yuki ahora se muestra como Lisa con la segunda imagen (`public/portraits/lisa.jpg`). Se conserva el ID interno `demo-yuki` para mantener matches, bloqueos y conversaciones anteriores. Los nombres, edades, países y biografías de estos perfiles siguen siendo datos ficticios de la demo; las imágenes no implican participación o respaldo de las personas representadas.

Sofía utiliza la imagen aportada posteriormente por el usuario, guardada como `public/portraits/sofia.jpg`, en lugar de su retrato generado anterior.

## Despliegue en Vercel

`vercel.json` define un build estático seguro en `dist/` y enruta `/api/*` a `api/index.js`. La función reutiliza el backend sin ejecutar `listen()`. La raíz `index.html` se copia explícitamente al directorio publicado para evitar un `404 NOT_FOUND` cuando Vercel elige `public/` como salida. No se publican archivos fuente, claves ni bases de datos.

1. Conecta una base **Turso / Serverless SQLite** desde Storage del proyecto en Vercel.
2. Configura `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` como variables del servidor para Production y Preview. No uses prefijos públicos para estas claves.
3. Selecciona Node.js 24 y el directorio raíz del repositorio. El build y el directorio de salida quedan definidos en `vercel.json`.
4. Despliega el commit de `main`. Las cookies se marcan Secure automáticamente en Vercel.

El cliente remoto utiliza consultas parametrizadas y el mismo esquema SQLite. Las migraciones son aditivas. El archivo SQLite local no se sube automáticamente al proveedor. En Vercel, si no se configura almacenamiento remoto, la API responde 503 con una indicación de configuración; no guarda cuentas o chats en un archivo temporal ni promete que esos datos sobrevivirán. La portada y los recursos estáticos se sirven independientemente de la base.

Referencias: [funciones Node de Vercel](https://vercel.com/docs/functions/runtimes/node-js), [límites de SQLite local en Vercel](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel) y [cliente oficial de Turso/libSQL](https://docs.turso.tech/sdk/ts/reference).
