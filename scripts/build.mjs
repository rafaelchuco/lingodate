import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = new URL('../dist/', import.meta.url);
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(root + 'public', output, { recursive: true });
cpSync(root + 'index.html', new URL('index.html', output));
console.log('Interfaz lista en dist/. Las rutas /api se ejecutan como Vercel Function.');
