import { createApp } from '../server.js';

export function createHandler(appFactory = createApp) {
  let application;
  return async function handler(req, res) {
    try {
      // Reuse connections on warm invocations without opening a TCP listener.
      application ||= appFactory();
      const app = await application;
      await app.listeners('request')[0](req, res);
    } catch (error) {
      application = undefined;
      console.error('Lingodate startup failed:', error.code || error.status || error.name);
      if (!res.headersSent) {
        res.writeHead(error.status || 503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ error: error.status === 503 ? error.message : 'No se pudo conectar con la base de datos del despliegue. Revisa su configuración.' }));
      }
    }
  };
}
export default createHandler();
