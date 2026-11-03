// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { Router, Response } from '../shims/express';
import Decimal from 'decimal.js';
import { JsonRepository } from '../storage/db';
import {
  Company,
  CurrentAccount,
  BankAgreement,
  BankAccess,
  LoanContract,
  IndicatorRecord,
  CashProjection,
  TecbanRecord,
  ImportVersion
} from '../storage/schemas';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.middleware';
import { EconomicIndicatorsService } from '../services/economic-indicators.service';
import { formatDateBR } from '../utils/date';

const router = Router();
const companiesRepo = new JsonRepository<Company>('companies.json');
const accountsRepo = new JsonRepository<CurrentAccount>('current_accounts.json');
const agreementsRepo = new JsonRepository<BankAgreement>('bank_agreements.json');
const accessesRepo = new JsonRepository<BankAccess>('bank_accesses.json');
const loansRepo = new JsonRepository<LoanContract>('loan_contracts.json');
const indicatorsRepo = new JsonRepository<IndicatorRecord>('indicators.json');
const cashRepo = new JsonRepository<CashProjection>('cash_projections.json');
const tecbanRepo = new JsonRepository<TecbanRecord>('tecban_records.json');
const versionsRepo = new JsonRepository<ImportVersion>('import_versions.json');

router.get('/overview', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [
      companies,
      accounts,
      agreements,
      accesses,
      loans,
      indicators,
      cashProjections,
      tecbanRecords,
      importVersions,
      economicSummary
    ] = await Promise.all([
      companiesRepo.getAll(),
      accountsRepo.getAll(),
      agreementsRepo.getAll(),
      accessesRepo.getAll(),
      loansRepo.getAll(),
      indicatorsRepo.getAll(),
      cashRepo.getAll(),
      tecbanRepo.getAll(),
      versionsRepo.getAll(),
      EconomicIndicatorsService.syncOfficialRates().then((r) => r.state)
    ]);

    // Loans consolidation
    let loanBalance = new Decimal(0);
    let loanInterest = new Decimal(0);
    const activeLoans = loans.filter((l) => l.active);
    const upcomingLoanEvents: any[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (const l of activeLoans) {
      loanBalance = loanBalance.plus(l.currentOutstandingBalance || l.contractedAmount || 0);
      for (const e of l.events || []) {
        loanInterest = loanInterest.plus(e.plannedInterest || 0);
        if (e.plannedDate >= today && e.status === 'PENDING') {
          upcomingLoanEvents.push({
            contractNumber: l.contractNumber,
            ...e
          });
        }
      }
    }
    upcomingLoanEvents.sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));

    // Latest fund quotas and CDI
    const sortedIndicators = [...indicators].sort((a, b) => b.date.localeCompare(a.date));
    const latestIndicator = sortedIndicators[0] || null;

    // Latest Cash Projection Summary
    const sortedCash = [...cashProjections].sort((a, b) => b.date.localeCompare(a.date));
    let latestCashBalance = new Decimal(0);
    let latestCashProjected = new Decimal(0);
    if (sortedCash.length > 0) {
      const mostRecentDate = sortedCash[0].date;
      const sameDayRows = sortedCash.filter((c) => c.date === mostRecentDate);
      for (const row of sameDayRows) {
        latestCashBalance = latestCashBalance.plus(row.actualBalance || 0);
        latestCashProjected = latestCashProjected.plus(row.projectedBalance || 0);
      }
    }

    // Latest Tecban Summary
    const sortedTecban = [...tecbanRecords].sort((a, b) => b.date.localeCompare(a.date));
    const latestTecban = sortedTecban[0] || null;

    // Last 5 imports
    const sortedImports = [...importVersions]
      .sort((a, b) => b.importedAt.localeCompare(a.importedAt))
      .slice(0, 5);

    // Alerts
    const alerts: Array<{ type: 'warning' | 'info' | 'alert'; message: string; module: string }> = [];
    if ([economicSummary.selicOver, economicSummary.ptaxVenda, economicSummary.ipcaMonthly].some((x: any) => x.status !== 'ONLINE')) {
      alerts.push({
        type: 'warning',
        message: 'Atualização de taxas com fontes externas pendente. Últimos valores oficiais preservados.',
        module: 'indicators'
      });
    }

    if (upcomingLoanEvents.length > 0) {
      const nextEvent = upcomingLoanEvents[0];
      const val = Number(nextEvent.plannedAmortization || nextEvent.plannedInterest || 0);
      const valFormatted = val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      alerts.push({
        type: 'info',
        message: `Próximo vencimento de empréstimo: Contrato ${nextEvent.contractNumber} em ${formatDateBR(nextEvent.plannedDate)} (R$ ${valFormatted})`,
        module: 'loans'
      });
    }

    res.json({
      companiesCount: companies.length,
      currentAccountsCount: accounts.length,
      agreementsCount: agreements.length,
      accessesCount: accesses.length,
      activeLoansCount: activeLoans.length,
      loanConsolidatedBalance: loanBalance.toFixed(2),
      loanProjectedInterest: loanInterest.toFixed(2),
      upcomingEvents: upcomingLoanEvents.slice(0, 5),
      latestIndicator,
      cashSummary: {
        date: sortedCash[0]?.date || today,
        latestCashBalance: latestCashBalance.toFixed(2),
        latestCashProjected: latestCashProjected.toFixed(2)
      },
      latestTecban,
      recentImports: sortedImports,
      economicSummary,
      alerts
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
