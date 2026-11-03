import { isAdminUser } from '../utils/access';
/**
 * In-browser API adapter. Mirrors server.ts of the local Express deployment:
 * same mounts, same routes, same services. `localFetch` replaces `fetch('/api/...')`.
 */
import { Buffer } from 'buffer';
import { initFs, flushFs } from './shims/fs';
import fs from './shims/fs';
import { createResponse, runChain, type RouterImpl } from './shims/express';

(globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;

let mounts: Array<[string, RouterImpl]> = [];
let extractSession: any;
let ready: Promise<void> | null = null;

async function boot() {
  await initFs();
  const { initializeStorage } = await import('./storage/db');
  await initializeStorage();
  const { seedInitialBusinessData } = await import('./storage/seed');
  await seedInitialBusinessData();
  extractSession = (await import('./middleware/auth.middleware')).extractSession;
  const m = await Promise.all([
    import('./routes/auth.routes'),
    import('./routes/companies.routes'),
    import('./routes/accounts.routes'),
    import('./routes/indicators.routes'),
    import('./routes/cash-projections.routes'),
    import('./routes/tecban.routes'),
    import('./routes/loans.routes'),
    import('./routes/holidays.routes'),
    import('./routes/spreadsheets.routes'),
    import('./routes/backups.routes'),
    import('./routes/audit.routes'),
    import('./routes/dashboard.routes'),
    import('./routes/treasury-records.routes'),
    import('./routes/approvals.routes'),
  ]);
  const prefixes = ['/api/auth', '/api/companies', '/api', '/api/indicators', '/api/cash-projections', '/api/tecban', '/api/loans', '/api/holidays', '/api/spreadsheets', '/api/backups', '/api/audit', '/api/dashboard', '/api/treasury-records', '/api/approvals'];
  mounts = prefixes.map((p, i) => [p, (m[i] as any).default as RouterImpl]);
  await flushFs();
}

export function ensureBackend() {
  if (!ready) ready = boot();
  return ready;
}

export async function localFetch(endpoint: string, init: RequestInit = {}): Promise<Response> {
  await ensureBackend();
  const url = new URL(endpoint, 'http://local');
  const method = (init.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {};
  Object.entries((init.headers as Record<string, string>) || {}).forEach(([k, v]) => (headers[k.toLowerCase()] = v));
  let body: any = {};
  let formData: FormData | undefined;
  if (init.body instanceof FormData) {
    formData = init.body;
    formData.forEach((v, k) => { if (typeof v === 'string') body[k] = v; });
  } else if (headers['content-type']?.includes('multipart/form-data') && init.body) {
    try {
      const dummyReq = new Request('http://local', {
        method,
        headers,
        body: init.body as any,
        // @ts-ignore
        duplex: 'half'
      });
      formData = await dummyReq.formData();
      formData.forEach((v, k) => { if (typeof v === 'string') body[k] = v; });
    } catch (e) {
      console.error('[localFetch] Falha ao extrair FormData do buffer:', e);
    }
  } else if (typeof init.body === 'string' && init.body) {
    try { body = JSON.parse(init.body); } catch { body = init.body; }
  }
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (query[k] = v));
  const req: any = { method, path: url.pathname, url: url.pathname + url.search, originalUrl: url.pathname + url.search, params: {}, query, body, headers, ip: '127.0.0.1', formData, cookies: {} };
  const res = createResponse();

  // res.download / sendFile read from the virtual filesystem
  res.download = (filePath: string, name?: string) => {
    const data = fs.readFileSync(filePath) as Buffer;
    res.setHeader('content-type', 'application/octet-stream');
    res.setHeader('content-disposition', `attachment; filename="${name || filePath.split('/').pop()}"`);
    res.send(new Uint8Array(data));
  };
  res.sendFile = (p: string) => res.download(p);

  try {
    await runChain([extractSession], req, res, () => {});
    // Data deletion is restricted to administrators in every module.
    if (method === 'DELETE' && url.pathname !== '/api/auth/logout' && !isAdminUser(req.user)) {
      res.status(req.user ? 403 : 401).json({ error: 'Apenas administradores podem excluir dados.' });
      await flushFs();
      return new Response(res.body as BodyInit, { status: res.statusCode, headers: res.headers });
    }
    let handled = false;
    for (const [prefix, router] of mounts) {
      if (url.pathname !== prefix && !url.pathname.startsWith(prefix + '/')) continue;
      const sub = url.pathname.slice(prefix.length) || '/';
      if (await router.handle(sub, req, res)) { handled = true; break; }
    }
    if (url.pathname === '/api/health') {
      const storageType = typeof process !== 'undefined' && process.versions?.node ? 'Arquivos JSON locais (./data)' : 'IndexedDB (navegador)';
      res.json({ status: 'healthy', system: 'Portal Tesouraria EloPar', timestamp: new Date().toISOString(), storage: storageType });
      handled = true;
    }
    if (!handled && !res.finished) res.status(404).json({ error: `Rota não encontrada: ${method} ${url.pathname}` });
  } catch (err: any) {
    console.error('[API]', err);
    res.status(500).json({ error: err?.message || 'Erro interno' });
  }
  await flushFs();
  return new Response(res.body as BodyInit, { status: res.statusCode, headers: res.headers });
}
