// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { Router, Response } from '../shims/express';
import multer from '../shims/multer';
import fs from '../shims/fs';
import path from '../shims/path';
import crypto from '../shims/crypto';
import { JsonRepository } from '../storage/db';
import { BaseRecord } from '../storage/schemas';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.middleware';
import { AuditService } from '../services/audit.service';

const router = Router();
const FILES_DIR = path.join('', 'documents');
fs.mkdirSync(FILES_DIR, { recursive: true });
const allowed = new Set(['tariffs','judicial_blocks','bank_contacts','powers','procurators','contracts','policies','manuals','accounting_routes','activity_divisions','dividends_jcp']);
const repositories = new Map<string, JsonRepository<any>>();
const requiredByCollection: Record<string, string[]> = {
  tariffs: ['companyId','name','bankId','type','unitFee','validUntil'],
  judicial_blocks: ['companyId','bankId','date','type','amount','processNumber'],
  bank_contacts: ['bankId'],
  powers: ['companyId','validUntil','storedName'],
  procurators: ['name','email','type'],
  contracts: ['companyId','name','counterparty','maturityDate'],
  policies: ['name','storedName'],
  manuals: ['name','storedName'],
  accounting_routes: ['companyId','movementName','accountingAccount'],
  activity_divisions: ['name','activity','companyId','frequency'],
  dividends_jcp: ['originCompanyId','destinationCompanyId','date','amount','type','storedName']
};
const validateRecord = (collection: string, value: Record<string, any>) => {
  const missing = (requiredByCollection[collection] || []).filter((key) => value[key] === undefined || value[key] === null || String(value[key]).trim() === '');
  if (missing.length) throw new Error(`Preencha os campos obrigatórios: ${missing.join(', ')}.`);
  if (collection === 'judicial_blocks' && !['Bloqueio','Desbloqueio','Transferência'].includes(value.type)) throw new Error('Tipo de movimento judicial inválido.');
  if (collection === 'dividends_jcp' && !['Dividendos','JCP'].includes(value.type)) throw new Error('Tipo deve ser Dividendos ou JCP.');
  if (collection === 'procurators' && !['Coordenador','Especialista','Gerente','Gerente executivo','Superintendente','Outro'].includes(value.type)) throw new Error('Tipo de procurador inválido.');
  if (collection === 'activity_divisions' && !['Diária','Semanal','Quinzenal','Mensal','Trimestral','Semestral','Anual','Sob demanda'].includes(value.frequency)) throw new Error('Frequência inválida.');
  if (value.storedName && path.basename(value.storedName) !== value.storedName) throw new Error('Nome de arquivo inválido.');
};
const repo = (name: string) => {
  if (!allowed.has(name)) throw new Error('Coleção inválida.');
  if (!repositories.has(name)) repositories.set(name, new JsonRepository<BaseRecord & Record<string, any>>(`${name}.json`));
  return repositories.get(name)!;
};
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, FILES_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 12);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const ok = ['.pdf','.doc','.docx','.xls','.xlsx','.png','.jpg','.jpeg'].includes(ext);
  cb(ok ? null : new Error('Formato não permitido. Utilize PDF, DOC, DOCX, XLS, XLSX, PNG ou JPG.'), ok);
}});

router.get('/:collection', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try { res.json(await repo(req.params.collection).getAll()); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});
router.post('/:collection/upload', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'Selecione um arquivo.' }); return; }
  res.status(201).json({ fileName: req.file.originalname, storedName: req.file.filename, size: req.file.size, uploadedAt: new Date().toISOString() });
});
router.get('/files/:filename', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(FILES_DIR, filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Arquivo não encontrado.' }); return; }
  res.download(filePath);
});
router.post('/:collection', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    validateRecord(req.params.collection, req.body);
    const record = await repo(req.params.collection).create(req.body);
    await AuditService.log({ userId: req.user?.userId, userEmail: req.user?.email, module: req.params.collection as any, action: 'CREATE', recordId: record.id, summary: `Registro criado em ${req.params.collection}`, newValue: record, ipAddress: req.ip });
    res.status(201).json(record);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
router.put('/:collection/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repository = repo(req.params.collection); const before = await repository.getById(req.params.id);
    if (!before) { res.status(404).json({ error: 'Registro não encontrado.' }); return; }
    validateRecord(req.params.collection, { ...before, ...req.body });
    const updated = await repository.update(req.params.id, req.body);
    await AuditService.log({ userId: req.user?.userId, userEmail: req.user?.email, module: req.params.collection as any, action: 'UPDATE', recordId: req.params.id, summary: `Registro atualizado em ${req.params.collection}`, previousValue: before, newValue: updated, ipAddress: req.ip });
    res.json(updated);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
router.delete('/:collection/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repository = repo(req.params.collection); const before = await repository.getById(req.params.id);
    if (!before) { res.status(404).json({ error: 'Registro não encontrado.' }); return; }
    await repository.delete(req.params.id);
    await AuditService.log({ userId: req.user?.userId, userEmail: req.user?.email, module: req.params.collection as any, action: 'DELETE', recordId: req.params.id, summary: `Registro removido de ${req.params.collection}`, previousValue: before, ipAddress: req.ip });
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
export default router;
