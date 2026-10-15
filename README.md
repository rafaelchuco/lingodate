# LingōDate

MVP web de conexiones interculturales. Convierte la landing original en una aplicación con cuentas reales, perfiles, descubrimiento, likes mutuos y conversaciones persistentes. Conserva la identidad visual cálida, coral y serif del proyecto.

## Ejecutar

Requiere **Node.js 24 o superior**. No usa dependencias de terceros ni necesita `npm install`.

```sh
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

Servidor Node HTTP y SQLite nativo, sin servicios externos obligatorios. Contraseñas con scrypt y sal aleatoria; tokens de sesión aleatorios guardados como SHA-256 en la base de datos. Cookies HttpOnly, SameSite=Lax y vencimiento de 7 días. Consultas parametrizadas, comprobación de participantes en cada operación de chat, escape de contenido en la interfaz, CSP restrictiva, protección de origen, límites de tamaño y rate limiting básico en memoria.

El correo y los hashes no forman parte de los perfiles públicos. No se publica una dirección exacta. No hay analítica, fuentes remotas ni rastreadores. La imagen `public/kasia.jpg` proviene del repositorio original y solo ilustra un perfil ficticio.

Los mensajes **no tienen cifrado de extremo a extremo**. El administrador puede leer la base de datos. El rate limit se aplica a la IP del socket; detrás de un proxy se comparte entre visitantes y conviene implementar límites por IP en el proxy. No se confía automáticamente en `X-Forwarded-For`.

## Validación

```sh
npm run check
npm test
```

Las pruebas HTTP cubren registro, login, validación de adultos, sesiones, aislamiento de la demo, filtros, likes mutuos, autorización del chat, bloqueo, eliminación en cascada, persistencia en SQLite, traducción con proveedor simulado, fallos del proveedor, protección de origen y rate limiting. El adaptador de traducción también verifica el contrato de solicitud y el rechazo de respuestas incorrectas. GitHub Actions ejecuta las comprobaciones con Node 24 en cada push a `main` o pull request.

## Despliegue

Esto requiere **un servidor Node con disco persistente**. GitHub Pages por sí solo no puede ejecutar la API ni guardar cuentas. Subir el código a GitHub no publica automáticamente una aplicación con backend.

También se incluye un Dockerfile:

```sh
docker build -t lingodate .
docker run --rm -p 3000:3000 -v lingodate-data:/app/data lingodate
```

El Dockerfile no se ha ejecutado en este entorno. En hosting público, termina HTTPS en un proxy, usa `COOKIE_SECURE=true`, mantén el archivo SQLite fuera del directorio público y configura copias de seguridad. El backend debe ejecutarse en una sola instancia que use ese disco; no se ha diseñado para almacenamiento efímero ni múltiples réplicas.

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
