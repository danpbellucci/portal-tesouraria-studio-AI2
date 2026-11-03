// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { Router, Response } from '../shims/express';
import Decimal from 'decimal.js';
import { JsonRepository } from '../storage/db';
import { TecbanRecord } from '../storage/schemas';
import { AuthenticatedRequest, requireAuth, requirePermission } from '../middleware/auth.middleware';
import { AuditService } from '../services/audit.service';

const router = Router();
const tecbanRepo = new JsonRepository<TecbanRecord>('tecban_records.json');

// List Tecban records with variance calculations
router.get('/', requireAuth, requirePermission('tecban', 'view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const records = await tecbanRepo.getAll();

    let filtered = records;
    if (startDate) {
      filtered = filtered.filter((r) => r.date >= String(startDate));
    }
    if (endDate) {
      filtered = filtered.filter((r) => r.date <= String(endDate));
    }

    filtered.sort((a, b) => b.date.localeCompare(a.date));

    const enriched = filtered.map((r) => {
      const actBal = new Decimal(r.actualBalance || 0);
      const projBal = new Decimal(r.projectedBalance || 0);
      const diffBal = actBal.minus(projBal);

      let diffBalPercent = '0.00';
      if (!projBal.isZero()) {
        diffBalPercent = diffBal.dividedBy(projBal.abs()).times(100).toFixed(2);
      }

      const actWithdraw = new Decimal(r.actualWithdrawals || 0);
      const projWithdraw = new Decimal(r.projectedWithdrawals || 0);
      const diffWithdraw = actWithdraw.minus(projWithdraw);
      let diffWithdrawPercent = '0.00';
      if (!projWithdraw.isZero()) {
        diffWithdrawPercent = diffWithdraw.dividedBy(projWithdraw.abs()).times(100).toFixed(2);
      }

      const actReload = new Decimal(r.actualReloads || 0);
      const projReload = new Decimal(r.projectedReloads || 0);
      const diffReload = actReload.minus(projReload);
      let diffReloadPercent = '0.00';
      if (!projReload.isZero()) {
        diffReloadPercent = diffReload.dividedBy(projReload.abs()).times(100).toFixed(2);
      }

      return {
        ...r,
        variance: {
          diffBalance: diffBal.toFixed(2),
          diffBalancePercent: diffBalPercent,
          diffWithdrawals: diffWithdraw.toFixed(2),
          diffWithdrawalsPercent: diffWithdrawPercent,
          diffReloads: diffReload.toFixed(2),
          diffReloadsPercent: diffReloadPercent
        }
      };
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create manual Tecban record
router.post('/', requireAuth, requirePermission('tecban', 'create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date, actualBalance, actualWithdrawals, actualReloads, projectedBalance, projectedWithdrawals, projectedReloads } = req.body;

    if (!date) {
      res.status(400).json({ error: 'A data do registro Tecban é obrigatória.' });
      return;
    }

    const created = await tecbanRepo.create({
      date,
      actualBalance: String(actualBalance ?? '0.00'),
      actualWithdrawals: String(actualWithdrawals ?? '0.00'),
      actualReloads: String(actualReloads ?? '0.00'),
      projectedBalance: String(projectedBalance ?? '0.00'),
      projectedWithdrawals: String(projectedWithdrawals ?? '0.00'),
      projectedReloads: String(projectedReloads ?? '0.00')
    });

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'tecban',
      action: 'CREATE',
      recordId: created.id,
      summary: `Registro Tecban criado para data ${date}`,
      newValue: created,
      ipAddress: req.ip
    });

    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update manual Tecban record
router.put('/:id', requireAuth, requirePermission('tecban', 'edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await tecbanRepo.getById(id);
    if (!existing) {
      res.status(404).json({ error: 'Registro não encontrado.' });
      return;
    }

    const updated = await tecbanRepo.update(id, req.body);

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'tecban',
      action: 'UPDATE',
      recordId: id,
      summary: `Registro Tecban atualizado para data ${updated?.date}`,
      previousValue: existing,
      newValue: updated,
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Tecban record
router.delete('/:id', requireAuth, requirePermission('tecban', 'delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await tecbanRepo.getById(id);
    if (!existing) {
      res.status(404).json({ error: 'Registro não encontrado.' });
      return;
    }

    await tecbanRepo.delete(id);

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'tecban',
      action: 'DELETE',
      recordId: id,
      summary: `Registro Tecban excluído: ${existing.date}`,
      previousValue: existing,
      ipAddress: req.ip
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
