// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { IndicatorRecord } from '../../types/treasury';
import { formatDateBR } from '../../utils/date';
import { Calendar, CheckSquare, Square, RotateCcw, SlidersHorizontal, TrendingUp } from 'lucide-react';

export interface SeriesOption {
  key: string;
  label: string;
  shortLabel: string;
  category: 'cdi' | 'fund';
  color: string;
  yAxisId: 'left' | 'right';
  unit: string;
  isDashed?: boolean;
}

export const INDICATOR_SERIES: SeriesOption[] = [
  {
    key: 'cdiRealizedAnnual',
    label: 'CDI Realizado (% a.a.)',
    shortLabel: 'CDI Realizado',
    category: 'cdi',
    color: '#0284C7', // Sky 600
    yAxisId: 'left',
    unit: '% a.a.',
  },
  {
    key: 'cdiProjectedAnnual',
    label: 'CDI Projetado (% a.a.)',
    shortLabel: 'CDI Projetado',
    category: 'cdi',
    color: '#6366F1', // Indigo 500
    yAxisId: 'left',
    unit: '% a.a.',
    isDashed: true,
  },
  {
    key: 'quotaBarauna',
    label: 'Fundo Baraúna',
    shortLabel: 'Baraúna',
    category: 'fund',
    color: '#0F2744', // Navy
    yAxisId: 'right',
    unit: 'R$',
  },
  {
    key: 'quotaCarnauba',
    label: 'Fundo Carnaúba',
    shortLabel: 'Carnaúba',
    category: 'fund',
    color: '#2563EB', // Blue 600
    yAxisId: 'right',
    unit: 'R$',
  },
  {
    key: 'quotaJacaranda',
    label: 'Fundo Jacarandá',
    shortLabel: 'Jacarandá',
    category: 'fund',
    color: '#0D9488', // Teal 600
    yAxisId: 'right',
    unit: 'R$',
  },
  {
    key: 'quotaCaliandra',
    label: 'Fundo Caliandra',
    shortLabel: 'Caliandra',
    category: 'fund',
    color: '#D97706', // Amber 600
    yAxisId: 'right',
    unit: 'R$',
  },
  {
    key: 'quotaBBCorporateFacil',
    label: 'BB Corporate Fácil',
    shortLabel: 'BB Corp Fácil',
    category: 'fund',
    color: '#9333EA', // Purple 600
    yAxisId: 'right',
    unit: 'R$',
  },
];

interface IndicatorsLineChartProps {
  data: IndicatorRecord[];
}

type PeriodPreset = '15d' | '30d' | '90d' | '180d' | 'ytd' | 'all' | 'custom';

export const IndicatorsLineChart: React.FC<IndicatorsLineChartProps> = ({ data }) => {
  // Visible series state: defaults to CDI Realizado, CDI Projetado and Baraúna
  const [activeSeries, setActiveSeries] = useState<Record<string, boolean>>({
    cdiRealizedAnnual: true,
    cdiProjectedAnnual: true,
    quotaBarauna: true,
    quotaCarnauba: true,
    quotaJacaranda: false,
    quotaCaliandra: false,
    quotaBBCorporateFacil: false,
  });

  // Period Preset state
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Determine overall date range from data
  const sortedDates = useMemo(() => {
    return [...data].map((d) => d.date).sort();
  }, [data]);

  const minAvailableDate = sortedDates[0] || '';
  const maxAvailableDate = sortedDates[sortedDates.length - 1] || '';

  // Calculate start/end date based on active preset
  const { filterStart, filterEnd } = useMemo(() => {
    if (periodPreset === 'custom') {
      return { filterStart: customStart, filterEnd: customEnd };
    }
    if (periodPreset === 'all' || !maxAvailableDate) {
      return { filterStart: '', filterEnd: '' };
    }

    const refDate = new Date(`${maxAvailableDate}T00:00:00`);
    const endStr = maxAvailableDate;
    let startStr = '';

    if (periodPreset === '15d') {
      const d = new Date(refDate);
      d.setDate(d.getDate() - 15);
      startStr = d.toISOString().split('T')[0];
    } else if (periodPreset === '30d') {
      const d = new Date(refDate);
      d.setDate(d.getDate() - 30);
      startStr = d.toISOString().split('T')[0];
    } else if (periodPreset === '90d') {
      const d = new Date(refDate);
      d.setDate(d.getDate() - 90);
      startStr = d.toISOString().split('T')[0];
    } else if (periodPreset === '180d') {
      const d = new Date(refDate);
      d.setDate(d.getDate() - 180);
      startStr = d.toISOString().split('T')[0];
    } else if (periodPreset === 'ytd') {
      startStr = `${refDate.getFullYear()}-01-01`;
    }

    return { filterStart: startStr, filterEnd: endStr };
  }, [periodPreset, customStart, customEnd, maxAvailableDate]);

  // Toggle a single series
  const toggleSeries = (key: string) => {
    setActiveSeries((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Helper selectors
  const selectAll = () => {
    const next: Record<string, boolean> = {};
    INDICATOR_SERIES.forEach((s) => (next[s.key] = true));
    setActiveSeries(next);
  };

  const selectOnlyCdi = () => {
    const next: Record<string, boolean> = {};
    INDICATOR_SERIES.forEach((s) => (next[s.key] = s.category === 'cdi'));
    setActiveSeries(next);
  };

  const selectOnlyFunds = () => {
    const next: Record<string, boolean> = {};
    INDICATOR_SERIES.forEach((s) => (next[s.key] = s.category === 'fund'));
    setActiveSeries(next);
  };

  const clearAll = () => {
    const next: Record<string, boolean> = {};
    INDICATOR_SERIES.forEach((s) => (next[s.key] = false));
    setActiveSeries(next);
  };

  // Filtered and prepared data for Recharts
  const chartData = useMemo(() => {
    // Deduplicate by date (keep latest)
    const byDate = new Map<string, any>();
    for (const r of data) {
      if (!r.date) continue;
      if (filterStart && r.date < filterStart) continue;
      if (filterEnd && r.date > filterEnd) continue;

      const dateLabel = formatDateBR(r.date).slice(0, 5);
      const fullDate = formatDateBR(r.date);

      byDate.set(r.date, {
        date: r.date,
        dateLabel,
        fullDate,
        cdiRealizedAnnual: r.cdiRealizedAnnual ? Number(r.cdiRealizedAnnual.replace(',', '.')) : undefined,
        cdiProjectedAnnual: r.cdiProjectedAnnual ? Number(r.cdiProjectedAnnual.replace(',', '.')) : undefined,
        quotaBarauna: r.quotaBarauna ? Number(r.quotaBarauna.replace(',', '.')) : undefined,
        quotaCarnauba: r.quotaCarnauba ? Number(r.quotaCarnauba.replace(',', '.')) : undefined,
        quotaJacaranda: r.quotaJacaranda ? Number(r.quotaJacaranda.replace(',', '.')) : undefined,
        quotaCaliandra: r.quotaCaliandra ? Number(r.quotaCaliandra.replace(',', '.')) : undefined,
        quotaBBCorporateFacil: r.quotaBBCorporateFacil ? Number(r.quotaBBCorporateFacil.replace(',', '.')) : undefined,
      });
    }

    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, filterStart, filterEnd]);

  // Check which Y-axes are needed
  const hasCdiSelected = INDICATOR_SERIES.some((s) => s.category === 'cdi' && activeSeries[s.key]);
  const hasFundsSelected = INDICATOR_SERIES.some((s) => s.category === 'fund' && activeSeries[s.key]);
  const anySeriesSelected = Object.values(activeSeries).some(Boolean);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const fullDate = payload[0]?.payload?.fullDate || label;

    return (
      <div className="bg-white/95 backdrop-blur-md p-3 rounded-lg border border-slate-200 shadow-lg text-xs space-y-1.5 min-w-[200px]">
        <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1">
          {fullDate}
        </div>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => {
            const seriesDef = INDICATOR_SERIES.find((s) => s.key === entry.dataKey);
            const val = entry.value;
            if (val === undefined || val === null || isNaN(val)) return null;

            const isPct = seriesDef?.unit.includes('%');
            const formattedVal = isPct
              ? `${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.`
              : `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;

            return (
              <div key={index} className="flex items-center justify-between gap-3 font-mono text-[11px]">
                <span className="flex items-center gap-1.5 font-sans font-medium text-slate-600">
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ backgroundColor: entry.color }}
                  />
                  {seriesDef?.shortLabel || entry.name}:
                </span>
                <span className="font-semibold text-slate-900">{formattedVal}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
      {/* Title & Top Description */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-sky-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Evolução Temporal: Curva CDI e Cotas dos Fundos
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Gráfico de linha interativo com seleção múltipla de séries e filtro de período.
          </p>
        </div>

        {/* Quick Period Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 mr-1 hidden sm:inline">Período:</span>
          {[
            { id: '15d', label: '15D' },
            { id: '30d', label: '30D' },
            { id: '90d', label: '90D' },
            { id: '180d', label: '180D' },
            { id: 'ytd', label: 'Ano' },
            { id: 'all', label: 'Tudo' },
            { id: 'custom', label: 'Personalizado' },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                setPeriodPreset(preset.id as PeriodPreset);
                if (preset.id === 'custom' && !customStart && minAvailableDate) {
                  setCustomStart(minAvailableDate);
                  setCustomEnd(maxAvailableDate);
                }
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                periodPreset === preset.id
                  ? 'bg-[#0F2744] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Range Inputs if "Personalizado" is active */}
      {periodPreset === 'custom' && (
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-wrap items-center gap-3 text-xs">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="font-semibold text-slate-700">Intervalo de Datas:</span>
          <div className="flex items-center gap-2">
            <label className="text-slate-500 text-[11px]">De:</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded-md text-xs font-mono"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-500 text-[11px]">Até:</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded-md text-xs font-mono"
            />
          </div>
          <button
            onClick={() => {
              setCustomStart(minAvailableDate);
              setCustomEnd(maxAvailableDate);
            }}
            className="text-[11px] text-sky-700 hover:underline ml-auto"
          >
            Redefinir para todo o histórico
          </button>
        </div>
      )}

      {/* Series Selection Bar */}
      <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Linhas Exibidas no Gráfico
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={selectAll}
              className="text-[11px] font-semibold text-slate-600 hover:text-[#0F2744] hover:underline"
            >
              Marcar Todos
            </button>
            <span className="text-slate-300">·</span>
            <button
              onClick={selectOnlyCdi}
              className="text-[11px] font-semibold text-sky-700 hover:underline"
            >
              Apenas CDI
            </button>
            <span className="text-slate-300">·</span>
            <button
              onClick={selectOnlyFunds}
              className="text-[11px] font-semibold text-indigo-700 hover:underline"
            >
              Apenas Fundos
            </button>
            <span className="text-slate-300">·</span>
            <button
              onClick={clearAll}
              className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 hover:underline"
            >
              Limpar
            </button>
          </div>
        </div>

        {/* Series Pill Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {INDICATOR_SERIES.map((s) => {
            const isSelected = !!activeSeries[s.key];
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleSeries(s.key)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white border-slate-300 text-slate-900 shadow-2xs'
                    : 'bg-transparent border-dashed border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400'
                }`}
                title={isSelected ? `Ocultar ${s.label}` : `Exibir ${s.label}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: isSelected ? s.color : '#cbd5e1',
                  }}
                />
                <span className="whitespace-nowrap">{s.shortLabel}</span>
                <span className="text-[10px] text-slate-400 font-mono">({s.unit})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="min-h-[380px] w-full pt-2">
        {!anySeriesSelected ? (
          <div className="h-[360px] flex flex-col items-center justify-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
            <SlidersHorizontal className="w-8 h-8 text-slate-300 mb-2" />
            <p className="font-semibold text-slate-600">Nenhuma linha selecionada</p>
            <p className="text-slate-400 mt-0.5">Selecione ao menos um indicador ou fundo acima para visualizar o gráfico.</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[360px] flex flex-col items-center justify-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
            <Calendar className="w-8 h-8 text-slate-300 mb-2" />
            <p className="font-semibold text-slate-600">Sem dados para o período selecionado</p>
            <p className="text-slate-400 mt-0.5">Ajuste o filtro de datas ou selecione "Tudo" para exibir o histórico completo.</p>
          </div>
        ) : (
          <div className="w-full h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  stroke="#94a3b8"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />

                {/* Left Y-Axis for CDI (% a.a.) */}
                {hasCdiSelected && (
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    stroke="#0284C7"
                    tick={{ fontSize: 11, fill: '#0284C7' }}
                    tickFormatter={(val) => `${Number(val).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                  />
                )}

                {/* Right Y-Axis for Fund Quotas (R$) */}
                {hasFundsSelected && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#2563EB"
                    tick={{ fontSize: 11, fill: '#2563EB' }}
                    tickFormatter={(val) => `${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    domain={['dataMin * 0.98', 'dataMax * 1.02']}
                  />
                )}

                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
                  formatter={(value) => {
                    const s = INDICATOR_SERIES.find((item) => item.key === value);
                    return <span className="text-slate-700 font-medium">{s?.shortLabel || value}</span>;
                  }}
                />

                {/* Render active lines */}
                {INDICATOR_SERIES.map((s) => {
                  if (!activeSeries[s.key]) return null;
                  return (
                    <Line
                      key={s.key}
                      yAxisId={s.yAxisId}
                      type="monotone"
                      dataKey={s.key}
                      name={s.key}
                      stroke={s.color}
                      strokeWidth={s.key === 'cdiRealizedAnnual' ? 2.5 : 2}
                      strokeDasharray={s.isDashed ? '4 4' : undefined}
                      dot={chartData.length <= 25 ? { r: 3, fill: s.color } : false}
                      activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                      connectNulls
                      isAnimationActive={true}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Bottom Summary Bar */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-100">
        <span className="font-mono tabular-nums">
          {chartData.length} dias exibidos no intervalo
          {filterStart && filterEnd ? ` (${formatDateBR(filterStart)} até ${formatDateBR(filterEnd)})` : ''}
        </span>
        <div className="flex items-center gap-3">
          {hasCdiSelected && (
            <span className="flex items-center gap-1 text-sky-700 font-medium">
              <span className="w-2 h-0.5 bg-sky-600 inline-block" /> Eixo esquerdo: Taxas (% a.a.)
            </span>
          )}
          {hasFundsSelected && (
            <span className="flex items-center gap-1 text-blue-700 font-medium">
              <span className="w-2 h-0.5 bg-blue-600 inline-block" /> Eixo direito: Cotas (R$)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
