/** Minimal POSIX `path` implementation for the browser backend. */
const normalize = (p: string) => {
  const abs = p.startsWith('/');
  const parts: string[] = [];
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return (abs ? '/' : '') + parts.join('/');
};

const path = {
  sep: '/',
  join: (...p: string[]) => normalize(p.filter((x) => x !== '').join('/')) || '.',
  resolve: (...p: string[]) => normalize('/' + p.filter(Boolean).join('/')),
  basename: (p: string, ext?: string) => {
    const b = String(p).split('/').filter(Boolean).pop() || '';
    return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b;
  },
  dirname: (p: string) => {
    const parts = String(p).split('/');
    parts.pop();
    return parts.join('/') || '/';
  },
  extname: (p: string) => {
    const b = String(p).split('/').pop() || '';
    const i = b.lastIndexOf('.');
    return i > 0 ? b.slice(i) : '';
  },
};

export default path;
