import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export async function openDatabase({ path, url = process.env.TURSO_DATABASE_URL, authToken = process.env.TURSO_AUTH_TOKEN, serverless = Boolean(process.env.VERCEL) } = {}) {
  if (url) {
    const { createClient } = await import('@libsql/client/web');
    const client = createClient({ url, authToken });
    return {
      exec: sql => client.executeMultiple(sql.replace('PRAGMA journal_mode=WAL;', '')),
      run: (sql, ...args) => client.execute({ sql, args }),
      get: async (sql, ...args) => (await client.execute({ sql, args })).rows[0],
      all: async (sql, ...args) => (await client.execute({ sql, args })).rows,
      close: () => client.close()
    };
  }
  if (serverless) {
    const error = new Error('Falta conectar la base de datos persistente del despliegue. Configura TURSO_DATABASE_URL y TURSO_AUTH_TOKEN.');
    error.status = 503;
    throw error;
  }
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  return {
    exec: async sql => db.exec(sql),
    run: async (sql, ...args) => db.prepare(sql).run(...args),
    get: async (sql, ...args) => db.prepare(sql).get(...args),
    all: async (sql, ...args) => db.prepare(sql).all(...args),
    close: () => db.close()
  };
}
