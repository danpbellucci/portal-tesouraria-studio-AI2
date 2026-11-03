/**
 * Tiny Express-compatible router that runs in the browser. Route files are the
 * same ones used by the local Express server, so every REST path matches exactly.
 */
export type NextFunction = (err?: any) => void;
export interface Request {
  method: string;
  path: string;
  url: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body: any;
  headers: Record<string, string>;
  cookies?: Record<string, string>;
  ip: string;
  file?: any;
  formData?: FormData;
  [k: string]: any;
}
export interface Response {
  statusCode: number;
  headers: Record<string, string>;
  body: BodyInit | null;
  finished: boolean;
  status(code: number): Response;
  json(data: any): Response;
  send(data: any): Response;
  setHeader(name: string, value: string): Response;
  download(filePath: string, name?: string): void;
  sendFile(filePath: string): void;
  end(): void;
}
type Handler = (req: any, res: any, next: NextFunction) => any;
type Layer = { method: string; keys: string[]; regex: RegExp; handlers: Handler[] };

function compile(pattern: string) {
  const keys: string[] = [];
  const src = pattern
    .replace(/\/$/, '')
    .replace(/[.+?^${}()|[\]\\]/g, (m) => '\\' + m)
    .replace(/\/:(\w+)/g, (_m, k) => { keys.push(k); return '/([^/]+)'; })
    .replace(/\*/g, '.*');
  return { keys, regex: new RegExp('^' + src + '/?$') };
}

export class RouterImpl {
  layers: Layer[] = [];
  private add(method: string, path: string, handlers: Handler[]) {
    const { keys, regex } = compile(path);
    this.layers.push({ method, keys, regex, handlers });
    return this;
  }
  get(p: string, ...h: Handler[]) { return this.add('GET', p, h); }
  post(p: string, ...h: Handler[]) { return this.add('POST', p, h); }
  put(p: string, ...h: Handler[]) { return this.add('PUT', p, h); }
  patch(p: string, ...h: Handler[]) { return this.add('PATCH', p, h); }
  delete(p: string, ...h: Handler[]) { return this.add('DELETE', p, h); }

  /** Returns true when a route handled the request. */
  async handle(subPath: string, req: Request, res: Response): Promise<boolean> {
    for (const layer of this.layers) {
      if (layer.method !== req.method) continue;
      const m = layer.regex.exec(subPath || '/');
      if (!m) continue;
      req.params = {};
      layer.keys.forEach((k, i) => (req.params[k] = decodeURIComponent(m[i + 1] ?? "")));
      let passed = false;
      await runChain(layer.handlers, req, res, () => { passed = true; });
      if (!passed || res.finished) return true;
    }
    return false;
  }
}

export async function runChain(handlers: Handler[], req: any, res: any, done: () => void) {
  let idx = 0;
  const next = async (err?: any): Promise<void> => {
    if (err) {
      res.status(err.status || 400).json({ error: err.message || String(err) });
      return;
    }
    if (res.finished) return;
    const h = handlers[idx++];
    if (!h) { done(); return; }
    let nextCalled: Promise<void> | null = null;
    await h(req, res, (e?: any) => { nextCalled = next(e); });
    if (nextCalled) await nextCalled;
  };
  await next();
}

export function Router() {
  return new RouterImpl();
}

export function createResponse(): Response {
  const res: Response = {
    statusCode: 200,
    headers: {},
    body: null,
    finished: false,
    status(code) { res.statusCode = code; return res; },
    json(data) {
      res.headers['content-type'] = 'application/json';
      res.body = JSON.stringify(data ?? null);
      res.finished = true;
      return res;
    },
    send(data) {
      if (data instanceof Uint8Array) res.body = new Uint8Array(data) as any;
      else if (typeof data === 'object' && data !== null && !(data instanceof Blob)) return res.json(data);
      else res.body = data as any;
      if (!res.headers['content-type']) res.headers['content-type'] = 'text/plain';
      res.finished = true;
      return res;
    },
    setHeader(name, value) { res.headers[name.toLowerCase()] = value; return res; },
    download() { throw new Error('download handled by adapter'); },
    sendFile() { throw new Error('sendFile handled by adapter'); },
    end() { res.finished = true; },
  };
  return res;
}

export default { Router };
