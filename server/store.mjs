// Локальное хранилище данных для своего сервера (замена Netlify Blobs).
// Все записи лежат в папке data/ в виде JSON-файлов.
import { readFile, writeFile, mkdir, readdir, unlink, stat } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');

function safeName(key) {
  return String(key).replace(/[^a-zA-Z0-9._-]/g, (m) => '_' + m.charCodeAt(0).toString(16));
}

function toRecord(key, value, metadata) {
  if (value instanceof ArrayBuffer) {
    return { key, v: { __b64: Buffer.from(value).toString('base64') }, meta: metadata || {} };
  }
  if (Buffer.isBuffer(value)) {
    return { key, v: { __b64: value.toString('base64') }, meta: metadata || {} };
  }
  if (value instanceof Uint8Array) {
    return { key, v: { __b64: Buffer.from(value).toString('base64') }, meta: metadata || {} };
  }
  return { key, v: value, meta: metadata || {} };
}

function fromRecord(rec, type) {
  if (!rec) return null;
  if (type === 'json') return rec.v;
  if (type === 'arrayBuffer') {
    if (rec.v && typeof rec.v === 'object' && rec.v.__b64) {
      return Buffer.from(rec.v.__b64, 'base64');
    }
    return Buffer.from(String(rec.v ?? ''), 'utf8');
  }
  return rec.v;
}

class LocalStore {
  constructor() {
    this.dir = DATA_DIR;
  }

  async file(key) {
    await mkdir(this.dir, { recursive: true });
    return path.join(this.dir, safeName(key) + '.json');
  }

  async readRec(key) {
    try {
      const raw = await readFile(await this.file(key), 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }

  async get(key, opts = {}) {
    const rec = await this.readRec(key);
    if (!rec) return null;
    return fromRecord(rec, opts.type);
  }

  async getWithMetadata(key, opts = {}) {
    const rec = await this.readRec(key);
    if (!rec) return null;
    return { data: fromRecord(rec, opts.type), metadata: rec.meta || {} };
  }

  async set(key, value, opts = {}) {
    const rec = toRecord(key, value, opts.metadata);
    await writeFile(await this.file(key), JSON.stringify(rec), 'utf8');
  }

  async setJSON(key, value, opts = {}) {
    const f = await this.file(key);
    if (opts.onlyIfNew) {
      const exists = await stat(f).then(() => true).catch(() => false);
      if (exists) return { modified: false };
    }
    await writeFile(f, JSON.stringify({ key, v: value, meta: opts.metadata || {} }), 'utf8');
    return { modified: true };
  }

  async delete(key) {
    try {
      await unlink(await this.file(key));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }

  async list(opts = {}) {
    const prefix = opts.prefix || '';
    await mkdir(this.dir, { recursive: true });
    const files = await readdir(this.dir).catch(() => []);
    const blobs = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const rec = JSON.parse(await readFile(path.join(this.dir, f), 'utf8'));
        if (rec && typeof rec.key === 'string' && rec.key.startsWith(prefix)) {
          blobs.push({ key: rec.key });
        }
      } catch {
        /* пропускаем битые файлы */
      }
    }
    return { blobs };
  }
}

const store = new LocalStore();

export function getStore() {
  return store;
}
