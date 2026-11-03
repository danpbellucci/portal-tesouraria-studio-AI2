import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';

const TECBAN_METRICS = [
  { id: 'Balance', label: 'Saldo', real: '#0F2744', proj: '#60A5FA' },
  { id: 'Withdrawals', label: 'Saques', real: '#BE123C', proj: '#FDA4AF' },
  { id: 'Reloads', label: 'Recargas', real: '#047857', proj: '#6EE7B7' },
];
export const CASH_METRICS = [
  { id: 'Balance', label: 'Saldo', real: '#0F2744', proj: '#60A5FA' },
  { id: 'Inflow', label: 'Entradas', real: '#047857', proj: '#6EE7B7' },
  { id: 'Outflow', label: 'Saídas', real: '#BE123C', proj: '#FDA4AF' },
];
const num = (v: any) => (v === null || v === undefined || v === '' ? null : Number(v));
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const brShort = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : Math.abs(v) >= 1e3 ? `${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil` : v.toLocaleString('pt-BR'));
const ddmm = (iso: string) => { const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };

export const TecbanLineChart: React.FC<{ records: any[]; metricsDef?: typeof TECBAN_METRICS }> = ({ records, metricsDef = TECBAN_METRICS }) => {
  const METRICS = metricsDef;
  const [metrics, setMetrics] = useState<Set<string>>(new Set(['Balance']));
  const [series, setSeries] = useState<Set<string>>(new Set(['actual', 'projected']));
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => { const n = new Set(set); if (n.has(id)) { n.delete(id); } else { n.add(id); } setter(n); };
  const data = useMemo(() => {
    const byDate = new Map<string, any>();
    for (const r of records) {
      const o = byDate.get(r.date) ?? { iso: r.date, date: ddmm(r.date) };
      for (const m of METRICS) for (const k of [`actual${m.id}`, `projected${m.id}`]) {
        const v = num(r[k]);
        if (v !== null) o[k] = (o[k] ?? 0) + v;
      }
      byDate.set(r.date, o);
    }
    return [...byDate.values()].sort((a, b) => a.iso.localeCompare(b.iso));
  }, [records, METRICS]);
  const chip = (on: boolean) => `px-3 py-1 rounded-full border text-xs font-semibold ${on ? 'bg-[#0F2744] text-white border-[#0F2744]' : 'bg-white text-slate-600 border-slate-300'}`;

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Evolução diária — Real x Projetado (R$)</h3>
          <p className="text-xs text-slate-500 mt-0.5">Selecione as curvas que deseja exibir.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {METRICS.map((m) => <button key={m.id} type="button" className={chip(metrics.has(m.id))} onClick={() => toggle(metrics, setMetrics, m.id)}>{m.label}</button>)}
          <span className="w-px bg-slate-200 mx-1" />
          <button type="button" className={chip(series.has('actual'))} onClick={() => toggle(series, setSeries, 'actual')}>Real</button>
          <button type="button" className={chip(series.has('projected'))} onClick={() => toggle(series, setSeries, 'projected')}>Projetado</button>
        </div>
      </div>
      <div className="h-72">
        {data.length === 0 ? <div className="h-full flex items-center justify-center text-xs text-slate-400">Sem dados no período.</div> : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v).slice(0, 5)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={brShort} width={60} />
              <Tooltip formatter={(v: any) => (v === null || v === undefined ? '—' : brl(Number(v)))} labelStyle={{ fontWeight: 600 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {METRICS.filter((m) => metrics.has(m.id)).flatMap((m) => [
                series.has('actual') && <Line key={`a${m.id}`} type="monotone" dataKey={`actual${m.id}`} name={`${m.label} real`} stroke={m.real} strokeWidth={2} dot={false} />,
                series.has('projected') && <Line key={`p${m.id}`} type="monotone" dataKey={`projected${m.id}`} name={`${m.label} projetado`} stroke={m.proj} strokeWidth={2} strokeDasharray="5 4" dot={false} />,
              ].filter(Boolean))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
