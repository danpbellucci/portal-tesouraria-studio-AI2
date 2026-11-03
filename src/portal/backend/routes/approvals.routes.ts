// @ts-nocheck — shares the legacy route conventions with the local Express server
import { Router, Response } from '../shims/express';
import { JsonRepository } from '../storage/db';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.middleware';
import { AuditService } from '../services/audit.service';
import { normalizeApprovers, validateApproval, buildApprovalMailto, type ApprovalLine } from '../services/approvals.logic';

const router = Router();
const repo = new JsonRepository<any>('approvals.json');
const companiesRepo = new JsonRepository<any>('companies.json');
const accountsRepo = new JsonRepository<any>('current_accounts.json');
const banksRepo = new JsonRepository<any>('banks.json');

const sanitize = (b: any) => ({
  kind: b.kind,
  operation: b.operation,
  companyId: b.companyId,
  date: b.date,
  amount: String(b.amount ?? '').replace(',', '.'),
  sourceAccountId: b.sourceAccountId,
  destinationAccountId: b.destinationAccountId || undefined,
  destinationDescription: b.destinationDescription?.trim() || undefined,
  product: b.product?.trim() || undefined,
  approvers: normalizeApprovers(b.approvers),
  description: b.description?.trim() || undefined,
});

router.get('/', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  const all = await repo.getAll();
  res.json(all.sort((a, b) => (b.date || '').localeCompare(a.date || '')));
});

router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const data = sanitize(req.body);
  const err = validateApproval(data);
  if (err) { res.status(400).json({ error: err }); return; }
  const rec = await repo.create({ ...data, status: 'PENDING', createdBy: req.user?.email });
  await AuditService.log({ userId: req.user?.userId, userEmail: req.user?.email, module: 'approvals', action: 'CREATE', recordId: rec.id, summary: `Transação incluída para aprovação (${data.operation})`, newValue: rec, ipAddress: req.ip });
  res.status(201).json(rec);
});

router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const before = await repo.getById(req.params.id);
  if (!before) { res.status(404).json({ error: 'Lançamento não encontrado.' }); return; }
  if (before.status === 'COMPLETED') { res.status(400).json({ error: 'Lançamentos concluídos não podem ser alterados.' }); return; }
  const data = sanitize(req.body);
  const err = validateApproval(data);
  if (err) { res.status(400).json({ error: err }); return; }
  const updated = await repo.update(req.params.id, data);
  await AuditService.log({ userId: req.user?.userId, userEmail: req.user?.email, module: 'approvals', action: 'UPDATE', recordId: req.params.id, summary: 'Lançamento de aprovação atualizado', previousValue: before, newValue: updated, ipAddress: req.ip });
  res.json(updated);
});

router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const before = await repo.getById(req.params.id);
  if (!before) { res.status(404).json({ error: 'Lançamento não encontrado.' }); return; }
  await repo.delete(req.params.id);
  await AuditService.log({ userId: req.user?.userId, userEmail: req.user?.email, module: 'approvals', action: 'DELETE', recordId: req.params.id, summary: 'Lançamento de aprovação excluído', previousValue: before, ipAddress: req.ip });
  res.json({ success: true });
});

/** Marks the selected entries as COMPLETED and returns the formatted mailto link. */
router.post('/request', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!ids.length) { res.status(400).json({ error: 'Selecione ao menos um lançamento.' }); return; }
  const all = await repo.getAll();
  const selected = all.filter((r) => ids.includes(r.id));
  if (selected.length !== ids.length) { res.status(404).json({ error: 'Lançamento não encontrado.' }); return; }
  if (selected.some((r) => r.status === 'COMPLETED')) { res.status(400).json({ error: 'Há lançamentos já concluídos na seleção.' }); return; }

  const [companies, accounts, banks] = await Promise.all([companiesRepo.getAll(), accountsRepo.getAll(), banksRepo.getAll()]);
  const comp = (id: string) => companies.find((c) => c.id === id)?.tradeName || id;
  const acc = (id?: string) => {
    if (!id) return '';
    const a = accounts.find((x) => x.id === id);
    if (!a) return id;
    const b = banks.find((x) => x.id === a.bankId);
    return `${b ? `${b.code} ${b.name}` : a.bankId} — Ag. ${a.agency} / CC ${a.accountNumber} (${comp(a.companyId)})`;
  };
  const lines: ApprovalLine[] = selected.map((r) => ({
    operation: r.operation, company: comp(r.companyId), date: r.date, amount: r.amount,
    source: acc(r.sourceAccountId), destination: r.destinationAccountId ? acc(r.destinationAccountId) : r.destinationDescription || '',
    product: r.product, description: r.description,
  }));
  const approvers = [...new Set(selected.flatMap((r) => r.approvers))];
  const mailto = buildApprovalMailto(lines, approvers, req.user?.name || req.user?.email || 'Tesouraria');

  const now = new Date().toISOString();
  for (const r of selected) {
    const updated = await repo.update(r.id, { status: 'COMPLETED', requestedAt: now, requestedBy: req.user?.email });
    await AuditService.log({ userId: req.user?.userId, userEmail: req.user?.email, module: 'approvals', action: 'UPDATE', recordId: r.id, summary: 'Aprovação solicitada por e-mail; lançamento concluído', previousValue: r, newValue: updated, ipAddress: req.ip });
  }
  res.json({ mailto, approvers, count: selected.length });
});

export default router;
