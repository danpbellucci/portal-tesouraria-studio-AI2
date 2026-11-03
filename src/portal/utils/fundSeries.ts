import Decimal from 'decimal.js';

export type FundSeriesMode = 'daily' | 'accumulated';
const filled = (v: any) => v !== undefined && v !== null && v !== '' && Number(v) > 0;
const hasValue = (v: any) => v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v));

type Quote = { date: string; quota: Decimal };

/**
 * Builds a per-date return series (in %) for each fund field within [start, end].
 * daily: quota_t / previous available quota - 1.
 * accumulated: quota_t / last quota before `start` - 1.
 * Days without a quota are left out for that fund (never treated as zero).
 */
export function buildFundSeries(records: any[], fields: string[], start: string, end: string, mode: FundSeriesMode) {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const prev: Record<string, Decimal | null> = {};
  const base: Record<string, Decimal | null> = {};
  for (const f of fields) {
    const before = sorted.filter((r) => r.date < start && filled(r[f]));
    const last = before[before.length - 1];
    prev[f] = last ? new Decimal(last[f]) : null;
    base[f] = prev[f];
  }
  const rows: any[] = [];
  for (const r of sorted) {
    if (r.date < start || r.date > end) continue;
    const row: any = { date: r.date };
    let any = false;
    for (const f of fields) {
      if (!filled(r[f])) continue;
      const q = new Decimal(r[f]);
      const ref = mode === 'daily' ? prev[f] : base[f];
      if (ref && ref.gt(0)) { row[f] = q.div(ref).minus(1).times(100).toNumber(); any = true; }
      prev[f] = q;
      if (!base[f]) base[f] = q;
    }
    if (any) rows.push(row);
  }
  return rows;
}

/**
 * Período de referência dos fundos: o fim é o dia mais recente (até `today`) em que
 * algum fundo tenha cota e CDI realizado; o início é o primeiro dia do mês dois meses
 * antes. É a mesma janela usada pelo bloco "Remuneração dos Fundos (3 meses)".
 */
export function resolveFundPeriod(records: any[], fields: string[], today: string) {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  let end: string | null = null;
  for (const f of fields) {
    const withData = sorted.filter((r) => r.date <= today && filled(r[f]) && filled(r.cdiRealizedAnnual));
    const latest = withData[withData.length - 1];
    if (latest && (!end || latest.date > end)) end = latest.date;
  }
  if (!end) return null;
  const [yStr, mStr] = end.split('-');
  return { start: new Date(Date.UTC(Number(yStr), Number(mStr) - 3, 1)).toISOString().slice(0, 10), end };
}

/**
 * Data-base de cada fundo: a última cota anterior a `start` ou, se não existir,
 * a primeira cota dentro do período. É a partir dela que o retorno é medido.
 */
export function fundBaseDates(records: any[], fields: string[], start: string, end: string): Record<string, string | null> {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const out: Record<string, string | null> = {};
  for (const f of fields) {
    const before = sorted.filter((r) => r.date < start && filled(r[f]));
    const inPeriod = sorted.filter((r) => r.date >= start && r.date <= end && filled(r[f]));
    const ref = before[before.length - 1] || inPeriod[0];
    out[f] = ref ? ref.date : null;
  }
  return out;
}

const dailyCdiFactor = (annual: Decimal) =>
  new Decimal(1).plus(annual.div(100)).pow(new Decimal(1).div(252));

/**
 * Remuneração em % do CDI de um ponto:
 *   (cota_p / cota_base - 1) / (CDI acumulado no mesmo intervalo) x 100
 * O CDI acumulado é o produto dos fatores diários (1 + CDI a.a. / 100)^(1/252)
 * dos dias úteis entre a data-base da cota (exclusiva) e a data do ponto (inclusive).
 * `businessDays` são os dias úteis de (rangeFrom, end]; se algum dia do intervalo não
 * tiver CDI realizado o ponto é descartado — dado ausente nunca é tratado como zero.
 */
function percentageOfCdi(
  ref: Quote,
  point: Quote,
  businessDays: string[],
  rangeFrom: string,
  cdiByDate: Map<string, Decimal | null>,
): number | null {
  if (!businessDays.length || ref.date < rangeFrom || point.date <= ref.date) return null;
  let factor = new Decimal(1);
  for (const day of businessDays) {
    if (day <= ref.date) continue;
    if (day > point.date) break;
    const cdi = cdiByDate.get(day);
    if (cdi === undefined || cdi === null) return null;
    factor = factor.times(dailyCdiFactor(cdi));
  }
  const cdiReturn = factor.minus(1);
  if (cdiReturn.lte(0)) return null;
  return point.quota.div(ref.quota).minus(1).div(cdiReturn).times(100).toNumber();
}

/**
 * Série de remuneração em % do CDI para cada fundo dentro de [start, end].
 * accumulated: retorno da cota desde a data-base do fundo.
 * daily: retorno da cota desde a cota imediatamente anterior.
 * Em ambos os casos o CDI acumulado é o do mesmo intervalo.
 */
export function buildFundCdiSeries(
  records: any[],
  fields: string[],
  start: string,
  end: string,
  mode: FundSeriesMode,
  businessDays: string[],
  rangeFrom: string,
) {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const days = [...businessDays].sort();
  const cdiByDate = new Map<string, Decimal | null>();
  for (const r of sorted) {
    cdiByDate.set(r.date, hasValue(r.cdiRealizedAnnual) ? new Decimal(r.cdiRealizedAnnual) : null);
  }

  const base: Record<string, Quote | null> = {};
  const prev: Record<string, Quote | null> = {};
  for (const f of fields) {
    const before = sorted.filter((r) => r.date < start && filled(r[f]));
    const inPeriod = sorted.filter((r) => r.date >= start && r.date <= end && filled(r[f]));
    const ref = before[before.length - 1] || inPeriod[0];
    base[f] = ref ? { date: ref.date, quota: new Decimal(ref[f]) } : null;
    prev[f] = base[f];
  }

  const rows: any[] = [];
  for (const r of sorted) {
    if (r.date < start || r.date > end) continue;
    const row: any = { date: r.date };
    let any = false;
    for (const f of fields) {
      if (!filled(r[f])) continue;
      const point: Quote = { date: r.date, quota: new Decimal(r[f]) };
      const ref = mode === 'daily' ? prev[f] : base[f];
      if (ref) {
        const value = percentageOfCdi(ref, point, days, rangeFrom, cdiByDate);
        if (value !== null) { row[f] = value; any = true; }
      }
      prev[f] = point;
    }
    if (any) rows.push(row);
  }
  return rows;
}
