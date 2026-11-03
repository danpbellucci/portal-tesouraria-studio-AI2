/** Browser implementation of the `multer` API subset (single file upload). */
import { Buffer } from 'buffer';
import fs from './fs';
import path from './path';

type Opts = {
  storage?: { destination: (...args: any[]) => any; filename: (...args: any[]) => any; __disk: true };
  limits?: { fileSize?: number };
  fileFilter?: (req: any, file: any, cb: (err: any, ok?: boolean) => void) => void;
};

async function readBlobAsBuffer(blob: any): Promise<Buffer> {
  if (Buffer.isBuffer(blob)) return blob;
  if (blob instanceof Uint8Array || blob instanceof ArrayBuffer) {
    return Buffer.from(blob as any);
  }
  if (typeof blob.arrayBuffer === 'function') {
    const ab = await blob.arrayBuffer();
    return Buffer.from(new Uint8Array(ab));
  }
  if (typeof FileReader !== 'undefined') {
    const ab = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo'));
      reader.readAsArrayBuffer(blob);
    });
    return Buffer.from(new Uint8Array(ab));
  }
  if (blob && (blob as any)._buffer) {
    return Buffer.from((blob as any)._buffer);
  }
  throw new Error('Não foi possível ler o conteúdo do arquivo enviado.');
}

function multer(opts: Opts = {}) {
  return {
    single(field: string) {
      return async (req: any, res: any, next: (e?: any) => void) => {
        const fd: FormData | undefined = req.formData;
        const blob: any = fd?.get(field);
        const isFileOrBlob = blob && (
          (typeof Blob !== 'undefined' && blob instanceof Blob) ||
          typeof blob.arrayBuffer === 'function' ||
          typeof blob.slice === 'function' ||
          (blob.size !== undefined && blob.name !== undefined)
        );
        if (!isFileOrBlob) return next();

        const originalname = blob.name || 'arquivo';
        const size = typeof blob.size === 'number' ? blob.size : 0;
        const file: any = { fieldname: field, originalname, mimetype: blob.type || 'application/octet-stream', size };
        if (opts.limits?.fileSize && size > opts.limits.fileSize) {
          return next(Object.assign(new Error('Arquivo excede o tamanho máximo permitido.'), { status: 413 }));
        }
        if (opts.fileFilter) {
          let filterErr: any = null; let ok = true;
          opts.fileFilter(req, file, (e, o) => { filterErr = e; ok = !!o; });
          if (filterErr) return next(filterErr);
          if (!ok) return next();
        }

        try {
          const buffer = await readBlobAsBuffer(blob);
          if (opts.storage?.__disk) {
            const dest: string = await new Promise((r) => opts.storage!.destination(req, file, (_e: any, d: string) => r(d)));
            const filename: string = await new Promise((r) => opts.storage!.filename(req, file, (_e: any, n: string) => r(n)));
            fs.writeFileSync(path.join(dest, filename), buffer);
            Object.assign(file, { destination: dest, filename, path: path.join(dest, filename) });
          } else {
            file.buffer = buffer;
          }
          req.file = file;
          next();
        } catch (err) {
          next(err);
        }
      };
    },
  };
}

multer.diskStorage = (o: { destination: (...args: any[]) => any; filename: (...args: any[]) => any }) => ({ ...o, __disk: true as const });
multer.memoryStorage = () => undefined;

export default multer;
