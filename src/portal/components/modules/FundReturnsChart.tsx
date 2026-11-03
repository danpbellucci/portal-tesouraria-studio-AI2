import { cn } from '@/lib/utils';
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ApiClient } from '../../services/api';
import { buildFundCdiSeries, fundBaseDates, resolveFundPeriod, type FundSeriesMode } from '../../utils/fundSeries';
import { formatDateBR } from '../../utils/date';

const FUNDS = [
  { key: 'quotaBarauna', label: 'Baraúna', color: '#0F2744' },
  { key: 'quotaCarnauba', label: 'Carnaúba', color: '#2563EB' },
  { key: 'quotaJacaranda', label: 'Jacarandá', color: '#0D9488' },
  { key: 'quotaCaliandra', label: 'Caliandra', color: '#D97706' },
  { key: 'quotaBBCorporateFacil', label: 'BB Corporate Fácil', color: '#7C3AED' },
];
const KEYS = FUNDS.map((f) => f.key);

const pct = (v: number, digits = 2) =>
  `${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

/**
 * Gráfico de linha da remuneração dos fundos em % do CDI: cada ponto é o retorno
 * da cota dividido pelo CDI acumulado no mesmo intervalo (dias úteis, 252).
 * O usuário escolhe os fundos exibidos e se quer a leitura diária ou acumulada.
 */
export function FundReturnsChart({ period }: { period: { start: string; end: string } | null }) {
  const [records, setRecords] = React.useState<any[]>([]);
  const [businessDays, setBusinessDays] = React.useState<string[]>([]);
  const [mode, setMode] = React.useState<FundSeriesMode>('accumulated');
  const [visible, setVisible] = React.useState<Record<string, boolean>>(
    () => Object.fromEntries(FUNDS.map((f) => [f.key, true])),
  );
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [history, versions] = await Promise.all([
          ApiClient.request('/api/indicators/history'),
          ApiClient.request('/api/indicators/versions').catch(() => []),
        ]);
        if (cancelled) return;
        const current = (versions as any[]).find((v) => v.isCurrent) || (versions as any[])[0];
        const rows = current
          ? (history as any[]).filter((r) => r.versionId === current.id)
          : (history as any[]);
        // Um registro por data: se houver mais de um, vale o gravado por último.
        const byDate = new Map<string, any>();
        for (const r of [...rows].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))) {
          byDate.set(r.date, r);
        }
        setRecords([...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)));
      } catch {
        if (!cancelled) setRecords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // O bloco lateral só resolve o período quando existe cota antes do início dele;
  // sem isso o gráfico calcula a mesma janela a partir dos próprios indicadores.
  const resolvedPeriod = React.useMemo(() => {
    if (period?.start && period?.end) return period;
    return resolveFundPeriod(records, KEYS, new Date().toISOString().slice(0, 10));
  }, [period, records]);

  // A série parte da cota-base mais antiga entre os fundos; o CDI precisa cobrir
  // todos os dias úteis a partir dela.
  const rangeFrom = React.useMemo(() => {
    if (!resolvedPeriod?.end || !records.length) return null;
    const bases = Object.values(fundBaseDates(records, KEYS, resolvedPeriod.start, resolvedPeriod.end))
      .filter(Boolean) as string[];
    return bases.length ? bases.sort()[0] : resolvedPeriod.start;
  }, [records, resolvedPeriod?.start, resolvedPeriod?.end]);

  React.useEffect(() => {
    if (!rangeFrom || !resolvedPeriod?.end) { setBusinessDays([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const days = await ApiClient.request(`/api/holidays/business-days?start=${rangeFrom}&end=${resolvedPeriod.end}`);
        if (!cancelled) setBusinessDays(Array.isArray(days) ? days : []);
      } catch {
        if (!cancelled) setBusinessDays([]);
      }
    })();
    return () => { cancelled = true; };
  }, [rangeFrom, resolvedPeriod?.end]);

  const data = React.useMemo(() => {
    if (!resolvedPeriod?.end || !records.length || !businessDays.length) return [];
    return buildFundCdiSeries(records, KEYS, resolvedPeriod.start, resolvedPeriod.end, mode, businessDays, rangeFrom || resolvedPeriod.start);
  }, [records, businessDays, resolvedPeriod?.start, resolvedPeriod?.end, mode, rangeFrom]);

  const toggle = (key: string) => setVisible((p) => ({ ...p, [key]: !p[key] }));

  if (loading) {
    return <div className="h-64 flex items-center justify-center text-xs text-slate-400">Carregando remuneração dos fundos...</div>;
  }
  if (!resolvedPeriod?.end || !records.length) {
    return <div className="h-64 flex items-center justify-center text-xs text-slate-400">Sem indicadores importados para exibir a remuneração dos fundos.</div>;
  }
  if (!businessDays.length) {
    return <div className="h-64 flex items-center justify-center text-xs text-slate-400">Sem dias úteis no período selecionado.</div>;
  }
  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-center px-6 text-xs text-slate-400">
        Não há CDI realizado em todos os dias úteis do período — sem dados suficientes para calcular o % CDI.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {FUNDS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => toggle(f.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                visible[f.key]
                  ? 'border-slate-200 bg-white text-slate-700 shadow-sm'
                  : 'border-transparent bg-slate-100 text-slate-400',
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: f.color, opacity: visible[f.key] ? 1 : 0.35 }} />
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode('daily')}
            className={cn('rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors', mode === 'daily' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
          >
            Diária
          </button>
          <button
            type="button"
            onClick={() => setMode('accumulated')}
            className={cn('rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors', mode === 'accumulated' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
          >
            Acumulada 3 meses
          </button>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => formatDateBR(v).slice(0, 5)}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              minTickGap={28}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => pct(v)}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              width={58}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(15,23,42,0.08)' }}
              labelFormatter={(v: string) => formatDateBR(v)}
              formatter={(value: any, name: any) => {
                const fund = FUNDS.find((f) => f.key === name);
                return [`${pct(Number(value), 2)} do CDI`, fund?.label || name];
              }}
            />
            {FUNDS.filter((f) => visible[f.key]).map((f) => (
              <Line key={f.key} type="monotone" dataKey={f.key} name={f.key} stroke={f.color} strokeWidth={2} dot={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
