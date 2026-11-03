// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { Router, Response } from '../shims/express';
import Decimal from 'decimal.js';
import { JsonRepository } from '../storage/db';
import { CashProjection, Company } from '../storage/schemas';
import { AuthenticatedRequest, requireAuth, requirePermission } from '../middleware/auth.middleware';
import { AuditService } from '../services/audit.service';

const router = Router();
const projectionsRepo = new JsonRepository<CashProjection>('cash_projections.json');
const companiesRepo = new JsonRepository<Company>('companies.json');

// Get projections with filters
router.get('/', requireAuth, requirePermission('cash_projections', 'view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, startDate, endDate } = req.query;
    const records = await projectionsRepo.getAll();
    const companies = await companiesRepo.getAll();
    const compMap = new Map(companies.map((c) => [c.id, c]));

    let filtered = records;
    if (companyId) {
      filtered = filtered.filter((r) => r.companyId === companyId);
    }
    if (startDate) {
      filtered = filtered.filter((r) => r.date >= String(startDate));
    }
    if (endDate) {
      filtered = filtered.filter((r) => r.date <= String(endDate));
    }

    // Sort chronologically
    filtered.sort((a, b) => b.date.localeCompare(a.date));

    // Enrich with company object and calculate variance without altering projected balance
    const enriched = filtered.map((r) => {
      const actBal = new Decimal(r.actualBalance || 0);
      const projBal = new Decimal(r.projectedBalance || 0);
      const diffBalance = actBal.minus(projBal);

      let diffBalancePercent = '0.00';
      if (!projBal.isZero()) {
        diffBalancePercent = diffBalance.dividedBy(projBal.abs()).times(100).toFixed(2);
      }

      const actInflow = new Decimal(r.actualInflow || 0);
      const projInflow = new Decimal(r.projectedInflow || 0);
      const diffInflow = actInflow.minus(projInflow);

      const actOutflow = new Decimal(r.actualOutflow || 0);
      const projOutflow = new Decimal(r.projectedOutflow || 0);
      const diffOutflow = actOutflow.minus(projOutflow);

      return {
        ...r,
        company: compMap.get(r.companyId) || null,
        variance: {
          diffBalance: diffBalance.toFixed(2),
          diffBalancePercent,
          diffInflow: diffInflow.toFixed(2),
          diffOutflow: diffOutflow.toFixed(2)
        }
      };
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create manual projection entry
router.post('/', requireAuth, requirePermission('cash_projections', 'create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, date, actualBalance, actualInflow, actualOutflow, projectedBalance, projectedInflow, projectedOutflow } = req.body;

    if (!companyId || !date) {
      res.status(400).json({ error: 'Empresa e Data são campos obrigatórios.' });
      return;
    }

    // Preserve projected balance verbatim as informed by user
    const created = await projectionsRepo.create({
      companyId,
      date,
      actualBalance: String(actualBalance ?? '0.00'),
      actualInflow: String(actualInflow ?? '0.00'),
      actualOutflow: String(actualOutflow ?? '0.00'),
      projectedBalance: String(projectedBalance ?? '0.00'),
      projectedInflow: String(projectedInflow ?? '0.00'),
      projectedOutflow: String(projectedOutflow ?? '0.00')
    });

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'cash_projections',
      action: 'CREATE',
      recordId: created.id,
      summary: `Posição de caixa cadastrada para empresa ${companyId} na data ${date}`,
      newValue: created,
      ipAddress: req.ip
    });

    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update manual projection entry
router.put('/:id', requireAuth, requirePermission('cash_projections', 'edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await projectionsRepo.getById(id);
    if (!existing) {
      res.status(404).json({ error: 'Registro não encontrado.' });
      return;
    }

    const updated = await projectionsRepo.update(id, {
      ...req.body,
      // Strictly maintain exact user inputs
      actualBalance: req.body.actualBalance !== undefined ? String(req.body.actualBalance) : existing.actualBalance,
      projectedBalance: req.body.projectedBalance !== undefined ? String(req.body.projectedBalance) : existing.projectedBalance
    });

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'cash_projections',
      action: 'UPDATE',
      recordId: id,
      summary: `Posição de caixa atualizada para data ${updated?.date}`,
      previousValue: existing,
      newValue: updated,
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete projection entry
router.delete('/:id', requireAuth, requirePermission('cash_projections', 'delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await projectionsRepo.getById(id);
    if (!existing) {
      res.status(404).json({ error: 'Registro não encontrado.' });
      return;
    }

    await projectionsRepo.delete(id);

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'cash_projections',
      action: 'DELETE',
      recordId: id,
      summary: `Posição de caixa excluída: ${existing.date}`,
      previousValue: existing,
      ipAddress: req.ip
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
