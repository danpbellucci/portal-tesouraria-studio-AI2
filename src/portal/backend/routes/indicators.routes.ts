// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { Router, Response } from '../shims/express';
import Decimal from 'decimal.js';
import { FinancialCalendarService } from '../services/financial-math';
import { JsonRepository } from '../storage/db';
import { IndicatorRecord, IndicatorVersion } from '../storage/schemas';
import { AuthenticatedRequest, requireAuth, requirePermission } from '../middleware/auth.middleware';
import { EconomicIndicatorsService } from '../services/economic-indicators.service';
import { AuditService } from '../services/audit.service';

const router = Router();
const indicatorsRepo = new JsonRepository<IndicatorRecord>('indicators.json');
const versionsRepo = new JsonRepository<IndicatorVersion>('indicator_versions.json');

// Get economic summary (SELIC, PTAX, IPCA)
router.get('/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const summary = await EconomicIndicatorsService.getSummary();
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sync with official BCB / IBGE APIs
router.post('/sync-official', requireAuth, requirePermission('indicators', 'edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await EconomicIndicatorsService.syncOfficialRates(true);
    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'indicators',
      action: 'UPDATE',
      summary: `Tentativa de sincronização de indicadores oficiais: ${result.message}`,
      ipAddress: req.ip
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update manual summary rates
router.put('/summary', requireAuth, requirePermission('indicators', 'edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await EconomicIndicatorsService.updateManualSummary(req.body);
    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'indicators',
      action: 'UPDATE',
      summary: 'Atualização manual de indicadores econômicos executivos',
      ipAddress: req.ip
    });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// List all historical indicator records
router.get('/history', requireAuth, requirePermission('indicators', 'view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const records = await indicatorsRepo.getAll();
    const sorted = records.sort((a, b) => b.date.localeCompare(a.date));
    res.json(sorted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create or update a manual daily indicator record
router.post('/history', requireAuth, requirePermission('indicators', 'create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date, cdiRealizedAnnual, cdiProjectedAnnual, quotaBarauna, quotaCarnauba, quotaJacaranda, quotaCaliandra, quotaBBCorporateFacil, versionId } = req.body;

    if (!date) {
      res.status(400).json({ error: 'A data do indicador é obrigatória.' });
      return;
    }

    const all = await indicatorsRepo.getAll();
    const existingIndex = all.findIndex((r) => r.date === date);

    let savedRecord: IndicatorRecord;
    if (existingIndex >= 0) {
      savedRecord = (await indicatorsRepo.update(all[existingIndex].id, {
        cdiRealizedAnnual: String(cdiRealizedAnnual || '0'),
        cdiProjectedAnnual: String(cdiProjectedAnnual || '0'),
        quotaBarauna: String(quotaBarauna || '0'),
        quotaCarnauba: String(quotaCarnauba || '0'),
        quotaJacaranda: String(quotaJacaranda || '0'),
        quotaCaliandra: String(quotaCaliandra || '0'),
        quotaBBCorporateFacil: String(quotaBBCorporateFacil || '0'),
        versionId: versionId || all[existingIndex].versionId
      }))!;
    } else {
      savedRecord = await indicatorsRepo.create({
        date,
        cdiRealizedAnnual: String(cdiRealizedAnnual || '0'),
        cdiProjectedAnnual: String(cdiProjectedAnnual || '0'),
        quotaBarauna: String(quotaBarauna || '0'),
        quotaCarnauba: String(quotaCarnauba || '0'),
        quotaJacaranda: String(quotaJacaranda || '0'),
        quotaCaliandra: String(quotaCaliandra || '0'),
        quotaBBCorporateFacil: String(quotaBBCorporateFacil || '0'),
        versionId: versionId || 'v_manual_initial'
      });
    }

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'indicators',
      action: 'UPDATE',
      recordId: savedRecord.id,
      summary: `Indicador financeiro gravado para data ${savedRecord.date}`,
      ipAddress: req.ip
    });

    res.json(savedRecord);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Calculate fund remuneration as a percentage of accumulated CDI for a user-selected period.
router.get('/fund-remuneration', requireAuth, requirePermission('indicators', 'view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, fund, versionId } = req.query;
    let start = String(startDate || '');
    let end = String(endDate || '');
    const auto = String(req.query.auto || '') === '1';
    const fundKey = String(fund || '');
    const allowedFunds: Record<string, keyof Pick<IndicatorRecord, 'quotaBarauna' | 'quotaCarnauba' | 'quotaJacaranda' | 'quotaCaliandra' | 'quotaBBCorporateFacil'>> = {
      barauna: 'quotaBarauna', carnauba: 'quotaCarnauba', jacaranda: 'quotaJacaranda',
      caliandra: 'quotaCaliandra', bbCorporateFacil: 'quotaBBCorporateFacil'
    };
    const quotaField = allowedFunds[fundKey];
    const isRealDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    if (!auto && (!isRealDate(start) || !isRealDate(end) || start > end || !quotaField)) {
      res.status(400).json({ error: 'Informe datas válidas e selecione um fundo.' }); return;
    }

    let records = await indicatorsRepo.getAll();
    let effectiveVersionId = versionId && versionId !== 'all' ? String(versionId) : 'all';
    if (versionId && versionId !== 'all') {
      records = records.filter((r) => r.versionId === String(versionId));
    } else {
      const allVersions = await versionsRepo.getAll();
      const currentVersion = allVersions.find((v) => v.isCurrent) || allVersions.sort((a, b) => b.versionNumber - a.versionNumber)[0];
      const fallbackVersionId = currentVersion?.id || [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.versionId;
      if (fallbackVersionId) {
        effectiveVersionId = fallbackVersionId;
        records = records.filter((r) => r.versionId === fallbackVersionId);
      }
    }
    if (!records.length) throw new Error('Não existem indicadores na versão selecionada.');
    if (auto) {
      if (!quotaField) { res.status(400).json({ error: 'Selecione um fundo.' }); return; }
      // Auto mode: end = most recent date (up to today) with both quota and CDI realizado in the version;
      // start = first day of M-2 relative to that date.
      const today = new Date().toISOString().slice(0, 10);
      const filled = (v: any) => v !== undefined && v !== null && v !== '';
      const latest = records.filter((r) => r.date <= today && filled(r[quotaField]) && filled(r.cdiRealizedAnnual))
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!latest) throw new Error('Sem cota e CDI realizado na versão mais atual.');
      end = latest.date;
      const [y, m] = end.split('-').map(Number);
      const s = new Date(Date.UTC(y, m - 3, 1));
      start = s.toISOString().slice(0, 10);
    }
    const byDate = new Map<string, IndicatorRecord>();
    records.sort((a, b) => a.date.localeCompare(b.date)).forEach((r) => byDate.set(r.date, r));

    const previousQuotaRecord = records.filter((r) => r.date < start && r[quotaField] !== undefined && r[quotaField] !== null && r[quotaField] !== "")
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const endingQuotaRecord = records.filter((r) => r.date <= end && r[quotaField] !== undefined && r[quotaField] !== null && r[quotaField] !== "")
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!previousQuotaRecord || !endingQuotaRecord) {
      throw new Error('Não há cota registrada no dia anterior à data inicial ou até a data final do período.');
    }
    const initialQuota = new Decimal(previousQuotaRecord[quotaField]);
    const finalQuota = new Decimal(endingQuotaRecord[quotaField]);
    if (initialQuota.lte(0)) throw new Error('A cota-base deve ser maior que zero.');

    // CDI is compounded over business days from the initial date through the final date, inclusive.
    const dayBeforeStart = new Date(`${start}T00:00:00Z`);
    dayBeforeStart.setUTCDate(dayBeforeStart.getUTCDate() - 1);
    const businessDays = await FinancialCalendarService.getBusinessDaysList(dayBeforeStart.toISOString().slice(0, 10), end);
    let cdiFactor = new Decimal(1);
    const missing: string[] = [];
    for (const day of businessDays) {
      const record = byDate.get(day);
      if (!record || record.cdiRealizedAnnual == null || record.cdiRealizedAnnual === '') { missing.push(day); continue; }
      const annual = new Decimal(record.cdiRealizedAnnual).div(100);
      const dailyFactor = new Decimal(1).plus(annual).pow(new Decimal(1).div(252));
      cdiFactor = cdiFactor.times(dailyFactor);
    }
    if (missing.length) throw new Error(`CDI realizado ausente em ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ` e mais ${missing.length - 8} dia(s)` : ''}. Importe os dados antes de calcular.`);

    const fundReturn = finalQuota.div(initialQuota).minus(1);
    const cdiReturn = cdiFactor.minus(1);
    if (cdiReturn.isZero()) throw new Error('CDI acumulado igual a zero no período; não é possível calcular %CDI.');
    const percentageOfCdi = fundReturn.div(cdiReturn).times(100);
    res.json({
      fund: fundKey, startDate: start, endDate: end,
      quotaBaseDate: previousQuotaRecord.date, quotaFinalDate: endingQuotaRecord.date,
      initialQuota: initialQuota.toString(), finalQuota: finalQuota.toString(),
      fundReturnPercent: fundReturn.times(100).toFixed(6),
      cdiAccumulatedPercent: cdiReturn.times(100).toFixed(6),
      percentageOfCdi: percentageOfCdi.toFixed(2),
      businessDays: businessDays.length,
      versionId: effectiveVersionId
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Não foi possível calcular a remuneração do fundo.' });
  }
});

// List indicator versions
router.get('/versions', requireAuth, requirePermission('indicators', 'view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const versions = await versionsRepo.getAll();
    res.json(versions.sort((a, b) => b.versionNumber - a.versionNumber));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
