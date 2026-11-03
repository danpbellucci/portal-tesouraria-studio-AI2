import { describe, it, expect } from 'vitest';
import { buildFundSeries, buildFundCdiSeries, fundBaseDates, resolveFundPeriod } from '../portal/utils/fundSeries';

const recs = [
  { date: '2026-07-31', q: '100' },
  { date: '2026-08-03', q: '101' },
  { date: '2026-08-04', q: '' },
  { date: '2026-08-05', q: '102.01' },
];

describe('buildFundSeries', () => {
  it('accumulated return is relative to the last quota before the start', () => {
    const r = buildFundSeries(recs, ['q'], '2026-08-01', '2026-08-31', 'accumulated');
    expect(r.map((x) => x.date)).toEqual(['2026-08-03', '2026-08-05']);
    expect(r[1].q).toBeCloseTo(2.01, 6);
  });
  it('daily return uses the previous available quota and skips empty days', () => {
    const r = buildFundSeries(recs, ['q'], '2026-08-01', '2026-08-31', 'daily');
    expect(r[0].q).toBeCloseTo(1, 6);
    expect(r[1].q).toBeCloseTo(1, 6);
  });
});

// CDI a.a. de 12% -> fator diário (1+0,12)^(1/252)
const dayCdi = Math.pow(1.12, 1 / 252) - 1;
const twoDayCdi = Math.pow(1.12, 2 / 252) - 1;

const complete = [
  { date: '2026-08-03', q: '100', cdiRealizedAnnual: '12' },
  { date: '2026-08-04', q: '100.10', cdiRealizedAnnual: '12' },
  { date: '2026-08-05', q: '100.20', cdiRealizedAnnual: '12' },
];

describe('buildFundCdiSeries', () => {
  it('accumulated % CDI divides the quota return by the CDI accumulated over the same business days', () => {
    const rows = buildFundCdiSeries(
      complete, ['q'], '2026-08-04', '2026-08-05', 'accumulated',
      ['2026-08-04', '2026-08-05'], '2026-08-03',
    );
    expect(rows.map((r) => r.date)).toEqual(['2026-08-04', '2026-08-05']);
    expect(rows[0].q).toBeCloseTo(0.001 / dayCdi * 100, 6);
    expect(rows[1].q).toBeCloseTo(0.002 / twoDayCdi * 100, 6);
  });

  it('daily % CDI uses the previous quota and only the CDI of that interval', () => {
    const rows = buildFundCdiSeries(
      complete, ['q'], '2026-08-04', '2026-08-05', 'daily',
      ['2026-08-04', '2026-08-05'], '2026-08-03',
    );
    expect(rows[1].q).toBeCloseTo((100.20 / 100.10 - 1) / dayCdi * 100, 6);
  });

  it('drops points whose interval has a business day without CDI instead of treating it as zero', () => {
    const withGap = [
      { date: '2026-08-03', q: '100', cdiRealizedAnnual: '12' },
      { date: '2026-08-04', q: '100.10', cdiRealizedAnnual: '12' },
      { date: '2026-08-05', q: '100.20', cdiRealizedAnnual: '' },
      { date: '2026-08-06', q: '100.30', cdiRealizedAnnual: '12' },
    ];
    const rows = buildFundCdiSeries(
      withGap, ['q'], '2026-08-04', '2026-08-06', 'accumulated',
      ['2026-08-04', '2026-08-05', '2026-08-06'], '2026-08-03',
    );
    expect(rows.map((r) => r.date)).toEqual(['2026-08-04']);
  });

  it('returns nothing when the period has no CDI at all', () => {
    const noCdi = [
      { date: '2026-08-03', q: '100', cdiRealizedAnnual: '' },
      { date: '2026-08-04', q: '100.10', cdiRealizedAnnual: '' },
    ];
    const rows = buildFundCdiSeries(
      noCdi, ['q'], '2026-08-04', '2026-08-04', 'accumulated',
      ['2026-08-04'], '2026-08-03',
    );
    expect(rows).toEqual([]);
  });

  it('fundBaseDates is the last quota before the start, or the first one inside the period', () => {
    expect(fundBaseDates(complete, ['q'], '2026-08-04', '2026-08-05')).toEqual({ q: '2026-08-03' });
    expect(fundBaseDates(complete, ['q'], '2026-08-01', '2026-08-05')).toEqual({ q: '2026-08-03' });
  });
});

describe('resolveFundPeriod', () => {
  it('ends on the most recent day with quota and CDI and starts at the first day of M-2', () => {
    expect(resolveFundPeriod(complete, ['q'], '2026-08-05')).toEqual({ start: '2026-06-01', end: '2026-08-05' });
    expect(resolveFundPeriod(complete, ['q'], '2026-08-04')).toEqual({ start: '2026-06-01', end: '2026-08-04' });
  });

  it('returns nothing when no day has both quota and CDI', () => {
    expect(resolveFundPeriod([{ date: '2026-08-03', q: '100', cdiRealizedAnnual: '' }], ['q'], '2026-08-31')).toBeNull();
  });
});
