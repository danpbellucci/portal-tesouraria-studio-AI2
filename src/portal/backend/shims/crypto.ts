/** Browser implementation of the Node `crypto` subset used by the backend. */
import { Buffer } from 'buffer';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha512, sha256 } from '@noble/hashes/sha2.js';

function randomBytes(n: number): Buffer {
  const arr = new Uint8Array(n);
  globalThis.crypto.getRandomValues(arr);
  return Buffer.from(arr);
}

function pbkdf2Sync(password: string, salt: string, iterations: number, keylen: number, _digest: string): Buffer {
  return Buffer.from(pbkdf2(sha512, password, salt, { c: iterations, dkLen: keylen }));
}

function createHash(_alg: string) {
  const chunks: Uint8Array[] = [];
  const api = {
    update(data: string | Uint8Array) {
      chunks.push(typeof data === 'string' ? new TextEncoder().encode(data) : data);
      return api;
    },
    digest(enc: string) {
      const total = chunks.reduce((s, c) => s + c.length, 0);
      const all = new Uint8Array(total);
      let o = 0;
      for (const c of chunks) { all.set(c, o); o += c.length; }
      return Buffer.from(sha256(all)).toString(enc as any);
    },
  };
  return api;
}

const crypto = { randomBytes, pbkdf2Sync, createHash, randomUUID: () => globalThis.crypto.randomUUID() };
export default crypto;
