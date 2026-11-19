// Dominoki — обычный Node.js-сервер (замена Netlify).
// Запуск: node server.mjs   |   Остановка: Ctrl+C
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import api from './server/api.mjs';
import transcribe from './server/transcribe.mjs';

// --- загрузка переменных из .env (если есть) ---
try {
  const envText = await readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '.env'), 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch {
  /* .env нет — работаем с переменными окружения системы */
}

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const STATIC = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/index.html': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/vhod': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/logo.png': { file: 'logo.png', type: 'image/png' },
  '/favicon.png': { file: 'favicon.png', type: 'image/png' },
};

function stripHopHeaders(headers) {
  const h = new Headers();
  for (const [k, v] of Object.entries(headers)) {
    const key = k.toLowerCase();
    if (key === 'host' || key === 'connection' || key === 'transfer-encoding' || key === 'keep-alive') continue;
    if (Array.isArray(v)) for (const item of v) h.append(k, item);
    else h.set(k, v);
  }
  return h;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');

    // --- серверные функции (пути оставлены как на Netlify, чтобы сайт не менять) ---
    if (url.pathname === '/.netlify/functions/api' || url.pathname === '/.netlify/functions/transcribe') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks);
      const request = new Request('http://localhost' + req.url, {
        method: req.method,
        headers: stripHopHeaders(req.headers),
        body: body.length ? body : undefined,
      });
      const out = url.pathname.endsWith('transcribe') ? await transcribe(request) : await api(request);
      res.statusCode = out.status;
      out.headers.forEach((v, k) => {
        if (k.toLowerCase() !== 'content-length') res.setHeader(k, v);
      });
      res.end(Buffer.from(await out.arrayBuffer()));
      return;
    }

    // --- статические файлы ---
    const entry = STATIC[url.pathname];
    if (entry) {
      const data = await readFile(path.join(ROOT, entry.file));
      res.setHeader('Content-Type', entry.type);
      res.end(data);
      return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Not found');
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: err && err.message ? err.message : 'Ошибка сервера' }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Dominoki запущен: http://127.0.0.1:' + PORT);
});
