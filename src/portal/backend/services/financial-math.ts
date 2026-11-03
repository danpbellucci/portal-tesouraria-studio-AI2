// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import Decimal from 'decimal.js';
import { JsonRepository } from '../storage/db';
import { FinancialHoliday, IndicatorRecord } from '../storage/schemas';

// Configure Decimal.js with 28 digits of precision for treasury operations
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

const holidaysRepo = new JsonRepository<FinancialHoliday>('financial_holidays.json');
const indicatorsRepo = new JsonRepository<IndicatorRecord>('indicators.json');

function easterSunday(year: number): Date {
  // Meeus/Jones/Butcher Gregorian computus
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDate(date: Date): string { return date.toISOString().slice(0, 10); }
function shiftDays(date: Date, days: number): Date { const copy = new Date(date); copy.setUTCDate(copy.getUTCDate() + days); return copy; }

export function generateNationalBankHolidays(year: number): FinancialHoliday[] {
  const easter = easterSunday(year);
  const definitions: Array<[string, string]> = [
    [`${year}-01-01`, 'Confraternização Universal'],
    [isoDate(shiftDays(easter, -48)), 'Carnaval'],
    [isoDate(shiftDays(easter, -47)), 'Carnaval'],
    [isoDate(shiftDays(easter, -2)), 'Sexta-feira Santa'],
    [`${year}-04-21`, 'Tiradentes'],
    [`${year}-05-01`, 'Dia do Trabalho'],
    [isoDate(shiftDays(easter, 60)), 'Corpus Christi'],
    [`${year}-09-07`, 'Independência do Brasil'],
    [`${year}-10-12`, 'Nossa Senhora Aparecida'],
    [`${year}-11-02`, 'Finados'],
    [`${year}-11-15`, 'Proclamação da República'],
    [`${year}-11-20`, 'Dia Nacional de Zumbi e da Consciência Negra'],
    [`${year}-12-25`, 'Natal']
  ];
  const now = new Date().toISOString();
  return definitions.map(([date, description]) => ({
    id: `auto_bank_${date}`, date, description,
    type: 'NATIONAL_BANKING' as const,
    source: 'Calendário bancário nacional — geração automática; validar publicação FEBRABAN',
    createdAt: now, updatedAt: now
  }));
}

export class FinancialCalendarService {
  static isWeekend(date: Date): boolean {
    const day = date.getUTCDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  static async getHolidaySet(companyId?: string, startYear?: number, endYear?: number): Promise<Set<string>> {
    const holidays = await holidaysRepo.getAll();
    const set = new Set<string>();
    for (const h of holidays) {
      // 31/12 é dia útil bancário, mesmo quando constar em listas de expediente especial da FEBRABAN.
      if (h.date.endsWith('-12-31')) continue;
      if (!h.companyId || h.companyId === companyId) set.add(h.date);
    }
    const firstYear = startYear ?? new Date().getUTCFullYear();
    const lastYear = endYear ?? firstYear;
    for (let year = firstYear; year <= lastYear; year++) {
      for (const holiday of generateNationalBankHolidays(year)) set.add(holiday.date);
    }
    return set;
  }

  static async isBusinessDay(dateStr: string, companyId?: string): Promise<boolean> {
    const dt = new Date(`${dateStr}T00:00:00Z`);
    if (this.isWeekend(dt)) return false;
    const year = Number(dateStr.slice(0, 4));
    const holidaySet = await this.getHolidaySet(companyId, year, year);
    return !holidaySet.has(dateStr);
  }

  /**
   * Count business days in the period, counting both startDate and endDate
   * (e.g. 01/10/2026 a 31/10/2026 = 21 d.u., excluding the 12/10 holiday).
   */
  static async countBusinessDays(startDateStr: string, endDateStr: string, companyId?: string): Promise<number> {
    const start = new Date(`${startDateStr}T00:00:00Z`);
    const end = new Date(`${endDateStr}T00:00:00Z`);
    const holidaySet = await this.getHolidaySet(companyId, start.getUTCFullYear(), end.getUTCFullYear());
    let count = 0;

    if (start.getTime() > end.getTime()) {
      return 0;
    }

    const curr = new Date(start.getTime()); // inclusive of the start date

    while (curr.getTime() <= end.getTime()) {
      const iso = curr.toISOString().split('T')[0];
      const dayOfWeek = curr.getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(iso)) {
        count++;
      }
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    return count;
  }

  /**
   * Get all business dates between start and end
   */
  static async getBusinessDaysList(startDateStr: string, endDateStr: string, companyId?: string): Promise<string[]> {
    const start = new Date(`${startDateStr}T00:00:00Z`);
    const end = new Date(`${endDateStr}T00:00:00Z`);
    const holidaySet = await this.getHolidaySet(companyId, start.getUTCFullYear(), end.getUTCFullYear());
    const list: string[] = [];

    const curr = new Date(start.getTime());
    curr.setUTCDate(curr.getUTCDate() + 1);

    while (curr.getTime() <= end.getTime()) {
      const iso = curr.toISOString().split('T')[0];
      const dayOfWeek = curr.getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(iso)) {
        list.push(iso);
      }
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    return list;
  }
}

export class LoanCalculatorService {
  /**
   * Daily rate formula per Section 13.5:
   * i_op = [(1 + CDI_aa)^(1/252) * (1 + Spread_aa)^(1/252)] - 1
   * where CDI_aa and Spread_aa are in decimal form (e.g. 10.75% -> 0.1075)
   */
  static calculateDailyRate(cdiAnnualPercent: Decimal | string | number, spreadAnnualPercent: Decimal | string | number): Decimal {
    const cdiDec = new Decimal(cdiAnnualPercent).dividedBy(100);
    const spreadDec = new Decimal(spreadAnnualPercent).dividedBy(100);
    const exponent = new Decimal(1).dividedBy(252);

    const cdiFactor = new Decimal(1).plus(cdiDec).pow(exponent);
    const spreadFactor = new Decimal(1).plus(spreadDec).pow(exponent);

    const dailyRate = cdiFactor.times(spreadFactor).minus(1);
    return dailyRate;
  }

  /**
   * Calculate interest accumulated over a period given daily rates
   */
  static async calculatePeriodInterest(
    principal: Decimal | string | number,
    startDateStr: string,
    endDateStr: string,
    spreadAnnualPercent: Decimal | string | number,
    cdiVersionId?: string,
    companyId?: string
  ): Promise<Decimal> {
    const principalDec = new Decimal(principal);
    if (principalDec.isZero() || principalDec.isNegative()) {
      return new Decimal(0);
    }

    const businessDays = await FinancialCalendarService.getBusinessDaysList(startDateStr, endDateStr, companyId);
    if (businessDays.length === 0) {
      return new Decimal(0);
    }

    // Load indicators
    const allIndicators = await indicatorsRepo.getAll();
    const versionedIndicators = cdiVersionId && cdiVersionId !== 'default'
      ? allIndicators.filter((i) => i.versionId === cdiVersionId)
      : allIndicators;
    if (versionedIndicators.length === 0) throw new Error(`Não há curva CDI disponível para a versão ${cdiVersionId}.`);

    // Map by date
    const indicatorMap = new Map<string, IndicatorRecord>();
    for (const ind of versionedIndicators) {
      indicatorMap.set(ind.date, ind);
    }

    let compoundingFactor = new Decimal(1);
    const todayIso = new Date().toISOString().split('T')[0];

    for (const day of businessDays) {
      const rec = indicatorMap.get(day);
      if (!rec) throw new Error(`Taxa CDI ausente para ${day} na curva selecionada. Atualize/import a curva antes de calcular.`);
      const rawRate = day <= todayIso ? rec.cdiRealizedAnnual : rec.cdiProjectedAnnual;
      if (rawRate === undefined || rawRate === null || rawRate === '') throw new Error(`Taxa CDI ${day <= todayIso ? 'realizada' : 'projetada'} ausente para ${day}.`);
      const dayCdi = new Decimal(rawRate);

      const dailyRate = this.calculateDailyRate(dayCdi, spreadAnnualPercent);
      const dayFactor = new Decimal(1).plus(dailyRate);
      compoundingFactor = compoundingFactor.times(dayFactor);
    }

    const periodInterest = principalDec.times(compoundingFactor.minus(1));
    return periodInterest.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  /**
   * Recalculates an entire loan schedule from startDate to maturity
   */
  static async projectLoanSchedule(
    contractedAmount: string | number,
    startDate: string,
    spreadAnnual: string | number,
    events: Array<{
      id?: string;
      plannedDate: string;
      type: 'INTEREST' | 'AMORTIZATION' | 'INTEREST_AND_AMORTIZATION';
      plannedAmortization: string | number;
      actualDate?: string;
      actualInterest?: string;
      actualAmortization?: string;
      status?: 'PENDING' | 'SETTLED' | 'CANCELLED';
      notes?: string;
    }>,
    cdiVersionId?: string,
    companyId?: string
  ): Promise<{
    events: any[];
    totalProjectedInterest: string;
    totalProjectedAmortization: string;
    finalOutstandingBalance: string;
  }> {
    let currentBalance = new Decimal(contractedAmount);
    let lastEventDate = startDate;
    let totalInterest = new Decimal(0);
    let totalAmortization = new Decimal(0);

    // Sort events chronologically
    const sortedEvents = [...events].sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
    const projectedEvents: any[] = [];

    for (const evt of sortedEvents) {
      const amortAmount = new Decimal(evt.plannedAmortization || 0);

      let eventInterest = new Decimal(0);
      if (evt.type === 'INTEREST' || evt.type === 'AMORTIZATION' || evt.type === 'INTEREST_AND_AMORTIZATION') {
        eventInterest = await this.calculatePeriodInterest(
          currentBalance,
          lastEventDate,
          evt.plannedDate,
          spreadAnnual,
          cdiVersionId,
          companyId
        );
      }

      totalInterest = totalInterest.plus(eventInterest);

      // Principal reduction happens on amortization or combo
      if (evt.type === 'AMORTIZATION' || evt.type === 'INTEREST_AND_AMORTIZATION') {
        currentBalance = currentBalance.minus(amortAmount);
        if (currentBalance.isNegative()) currentBalance = new Decimal(0);
        totalAmortization = totalAmortization.plus(amortAmount);
      }

      projectedEvents.push({
        id: evt.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        plannedDate: evt.plannedDate,
        type: evt.type,
        plannedAmortization: amortAmount.toFixed(2),
        plannedInterest: eventInterest.toFixed(2),
        plannedOutstandingBalance: currentBalance.toFixed(2),
        actualDate: evt.actualDate,
        actualInterest: evt.actualInterest,
        actualAmortization: evt.actualAmortization,
        status: evt.status || 'PENDING',
        notes: evt.notes
      });

      lastEventDate = evt.plannedDate;
    }

    return {
      events: projectedEvents,
      totalProjectedInterest: totalInterest.toFixed(2),
      totalProjectedAmortization: totalAmortization.toFixed(2),
      finalOutstandingBalance: currentBalance.toFixed(2)
    };
  }
}
