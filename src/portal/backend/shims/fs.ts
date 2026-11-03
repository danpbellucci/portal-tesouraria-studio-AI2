/**
 * Unified filesystem implementation:
 * - In Node.js (local dev / server): uses native `node:fs` to read/write real JSON files on disk in ./data
 * - In Browser: falls back to in-memory entries persisted to IndexedDB (write-through)
 */
import { Buffer } from 'buffer';

type FileValue = string | Uint8Array;
type Entry = { kind: 'file'; data: FileValue; mtime: number } | { kind: 'dir'; mtime: number };

const DB_NAME = 'elopar_tesouraria_fs';
const STORE = 'entries';
const entries = new Map<string, Entry>();
let dbPromise: Promise<IDBDatabase> | null = null;

const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);

let nodeFs: any = null;
let nodePath: any = null;

if (isNode) {
  try {
    nodeFs = (process as any).getBuiltinModule ? (process as any).getBuiltinModule('node:fs') : null;
    nodePath = (process as any).getBuiltinModule ? (process as any).getBuiltinModule('node:path') : null;
    if (!nodeFs && typeof require !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      nodeFs = require('node:fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      nodePath = require('node:path');
    }
  } catch (err) {
    console.warn('[FS] Native node:fs unavailable, falling back to virtual fs', err);
  }
}

const norm = (p: string) => {
  const parts: string[] = [];
  for (const seg of String(p).split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return '/' + parts.join('/');
};

function openDb(): Promise<IDBDatabase> {
  if (isNode || typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB not supported'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

let writeChain: Promise<void> = Promise.resolve();
function persist(path: string, entry: Entry | null) {
  if (isNode || typeof indexedDB === 'undefined') return;
  writeChain = writeChain.then(async () => {
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        if (entry) store.put(entry, path);
        else store.delete(path);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error('[FS] Falha ao persistir', path, err);
    }
  });
}

export function flushFs(): Promise<void> {
  return writeChain;
}

export async function initFs(): Promise<void> {
  if (isNode && nodeFs) {
    const cwd = process.cwd();
    const dirs = ['data', 'imports', 'backups', 'exports', 'logs'].map((d) => (nodePath ? nodePath.join(cwd, d) : d));
    for (const d of dirs) {
      if (!nodeFs.existsSync(d)) {
        nodeFs.mkdirSync(d, { recursive: true });
      }
    }
    return;
  }

  if (typeof indexedDB === 'undefined') return;

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        entries.set(String(cursor.key), cursor.value as Entry);
        cursor.continue();
      } else resolve();
    };
    req.onerror = () => reject(tx.error);
  });
}

function ensureParents(p: string) {
  const parts = norm(p).split('/').filter(Boolean);
  let cur = '';
  for (let i = 0; i < parts.length - 1; i++) {
    cur += '/' + parts[i];
    if (!entries.has(cur)) {
      const e: Entry = { kind: 'dir', mtime: Date.now() };
      entries.set(cur, e);
      persist(cur, e);
    }
  }
}

function enoent(p: string) {
  const err: any = new Error(`ENOENT: no such file or directory, '${p}'`);
  err.code = 'ENOENT';
  return err;
}

function toStored(data: any): FileValue {
  if (typeof data === 'string') return data;
  if (data instanceof Uint8Array) return new Uint8Array(data);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return String(data);
}

function readValue(p: string, encoding?: any): any {
  const e = entries.get(norm(p));
  if (!e || e.kind !== 'file') throw enoent(p);
  const enc = typeof encoding === 'string' ? encoding : encoding?.encoding;
  if (enc) {
    return typeof e.data === 'string' ? e.data : Buffer.from(e.data).toString(enc);
  }
  return typeof e.data === 'string' ? Buffer.from(e.data, 'utf-8') : Buffer.from(e.data);
}

function writeValue(p: string, data: any) {
  const key = norm(p);
  ensureParents(key);
  const e: Entry = { kind: 'file', data: toStored(data), mtime: Date.now() };
  entries.set(key, e);
  persist(key, e);
}

function existsSync(p: string): boolean {
  if (isNode && nodeFs) return nodeFs.existsSync(p);
  return entries.has(norm(p));
}

function mkdirSync(p: string, opts?: any) {
  if (isNode && nodeFs) return nodeFs.mkdirSync(p, { recursive: true, ...opts });
  const key = norm(p);
  ensureParents(key + '/x');
}

function readdirSync(p: string): string[] {
  if (isNode && nodeFs) return nodeFs.readdirSync(p);
  const key = norm(p);
  const prefix = key === '/' ? '/' : key + '/';
  const out: string[] = [];
  for (const k of entries.keys()) {
    if (k.startsWith(prefix)) {
      const rest = k.slice(prefix.length);
      if (rest && !rest.includes('/')) out.push(rest);
    }
  }
  return out.sort();
}

function statSync(p: string) {
  if (isNode && nodeFs) return nodeFs.statSync(p);
  const e = entries.get(norm(p));
  if (!e) throw enoent(p);
  const size = e.kind === 'file' ? (typeof e.data === 'string' ? new TextEncoder().encode(e.data).length : e.data.length) : 0;
  return {
    size,
    mtime: new Date(e.mtime),
    birthtime: new Date(e.mtime),
    isFile: () => e.kind === 'file',
    isDirectory: () => e.kind === 'dir',
  };
}

function renameSync(from: string, to: string) {
  if (isNode && nodeFs) return nodeFs.renameSync(from, to);
  const a = norm(from);
  const e = entries.get(a);
  if (!e) throw enoent(from);
  entries.delete(a);
  persist(a, null);
  const b = norm(to);
  ensureParents(b);
  entries.set(b, e);
  persist(b, e);
}

function unlinkSync(p: string) {
  if (isNode && nodeFs) return nodeFs.unlinkSync(p);
  const key = norm(p);
  if (!entries.has(key)) throw enoent(p);
  entries.delete(key);
  persist(key, null);
}

const fs = {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  renameSync,
  unlinkSync,
  readFileSync: (p: string, enc?: any) => {
    if (isNode && nodeFs) return nodeFs.readFileSync(p, enc);
    return readValue(p, enc);
  },
  writeFileSync: (p: string, d: any, enc?: any) => {
    if (isNode && nodeFs) {
      if (nodePath) {
        const dir = nodePath.dirname(p);
        if (!nodeFs.existsSync(dir)) nodeFs.mkdirSync(dir, { recursive: true });
      }
      return nodeFs.writeFileSync(p, d, enc);
    }
    return writeValue(p, d);
  },
  promises: {
    readFile: async (p: string, enc?: any) => {
      if (isNode && nodeFs) return nodeFs.promises.readFile(p, enc);
      return readValue(p, enc);
    },
    writeFile: async (p: string, d: any, enc?: any) => {
      if (isNode && nodeFs) {
        if (nodePath) {
          const dir = nodePath.dirname(p);
          if (!nodeFs.existsSync(dir)) nodeFs.mkdirSync(dir, { recursive: true });
        }
        return nodeFs.promises.writeFile(p, d, enc);
      }
      return writeValue(p, d);
    },
    rename: async (a: string, b: string) => {
      if (isNode && nodeFs) return nodeFs.promises.rename(a, b);
      return renameSync(a, b);
    },
    readdir: async (p: string) => {
      if (isNode && nodeFs) return nodeFs.promises.readdir(p);
      return readdirSync(p);
    },
    stat: async (p: string) => {
      if (isNode && nodeFs) return nodeFs.promises.stat(p);
      return statSync(p);
    },
    mkdir: async (p: string, o?: any) => {
      if (isNode && nodeFs) return nodeFs.promises.mkdir(p, { recursive: true, ...o });
      return mkdirSync(p, o);
    },
    unlink: async (p: string) => {
      if (isNode && nodeFs) return nodeFs.promises.unlink(p);
      return unlinkSync(p);
    },
  },
};

export default fs;
