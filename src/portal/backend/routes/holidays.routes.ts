// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { Router, Response } from '../shims/express';
import { JsonRepository } from '../storage/db';
import { FinancialHoliday } from '../storage/schemas';
import { AuthenticatedRequest, requireAuth, requirePermission } from '../middleware/auth.middleware';
import { FinancialCalendarService, generateNationalBankHolidays } from '../services/financial-math';
import { AuditService } from '../services/audit.service';

const router = Router();
const holidaysRepo = new JsonRepository<FinancialHoliday>('financial_holidays.json');

// List holidays
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const saved = await holidaysRepo.getAll();
    const currentYear = new Date().getUTCFullYear();
    const generated = Array.from({ length: 16 }, (_, i) => currentYear + i)
      .flatMap((year) => generateNationalBankHolidays(year));
    const merged = new Map<string, FinancialHoliday>();
    [...generated, ...saved]
      // 31/12 pode constar em listas de expediente especial, mas não é feriado bancário.
      .filter((h) => !(h.type === 'NATIONAL_BANKING' && h.date.endsWith('-12-31')))
      .forEach((h) => merged.set(`${h.date}|${h.type}|${h.companyId || ''}`, h));
    res.json([...merged.values()].sort((a, b) => a.date.localeCompare(b.date)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create holiday
router.post('/', requireAuth, requirePermission('holidays', 'create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date, description, type, state, city, companyId, source } = req.body;

    if (!date || !description) {
      res.status(400).json({ error: 'Data e Descrição do feriado são obrigatórios.' });
      return;
    }

    const created = await holidaysRepo.create({
      date,
      description: description.trim(),
      type: type || 'NATIONAL_BANKING',
      state: state ? state.trim().toUpperCase() : undefined,
      city: city ? city.trim() : undefined,
      companyId: companyId || undefined,
      source: source ? source.trim() : 'Manual'
    });

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'holidays',
      action: 'CREATE',
      recordId: created.id,
      summary: `Feriado financeiro cadastrado: ${created.date} - ${created.description}`,
      newValue: created,
      ipAddress: req.ip
    });

    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update holiday
router.put('/:id', requireAuth, requirePermission('holidays', 'edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await holidaysRepo.getById(id);
    if (!existing) {
      res.status(404).json({ error: 'Feriado não encontrado.' });
      return;
    }

    const updated = await holidaysRepo.update(id, req.body);

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'holidays',
      action: 'UPDATE',
      recordId: id,
      summary: `Feriado financeiro atualizado: ${updated?.date}`,
      previousValue: existing,
      newValue: updated,
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete holiday
router.delete('/:id', requireAuth, requirePermission('holidays', 'delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await holidaysRepo.getById(id);
    if (!existing) {
      res.status(404).json({ error: 'Feriado não encontrado.' });
      return;
    }

    await holidaysRepo.delete(id);

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'holidays',
      action: 'DELETE',
      recordId: id,
      summary: `Feriado financeiro excluído: ${existing.date} - ${existing.description}`,
      previousValue: existing,
      ipAddress: req.ip
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Check if a date is a business day
// Lista de dias úteis de um período (exclusiva na data inicial, inclusiva na final)
router.get('/business-days', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const start = String(req.query.start || '');
    const end = String(req.query.end || '');
    const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
    if (!isDate(start) || !isDate(end) || start > end) {
      res.status(400).json({ error: 'Informe um período válido no formato AAAA-MM-DD.' });
      return;
    }
    res.json(await FinancialCalendarService.getBusinessDaysList(start, end));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/is-business-day', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date, companyId } = req.query;
    if (!date) {
      res.status(400).json({ error: 'Parâmetro date é obrigatório.' });
      return;
    }
    const isBusiness = await FinancialCalendarService.isBusinessDay(String(date), companyId ? String(companyId) : undefined);
    res.json({ date, isBusinessDay: isBusiness });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Count business days between two dates
router.get('/count-business-days', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, companyId } = req.query;
    if (!startDate || !endDate) {
      res.status(400).json({ error: 'Parâmetros startDate e endDate são obrigatórios.' });
      return;
    }
    const count = await FinancialCalendarService.countBusinessDays(
      String(startDate),
      String(endDate),
      companyId ? String(companyId) : undefined
    );
    res.json({ startDate, endDate, businessDaysCount: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
