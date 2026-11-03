// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Building2,
  CreditCard,
  Handshake,
  KeyRound,
  DollarSign,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Calendar,
  Layers,
  FileSpreadsheet,
  ExternalLink,
  Landmark
} from 'lucide-react';
import { ApiClient } from '../../services/api';
import { useToast } from '../common/Toast';
import { formatDateBR } from '../../utils/date';
import { FundReturnsChart } from './FundReturnsChart';

interface DashboardData {
  companiesCount: number;
  currentAccountsCount: number;
  agreementsCount: number;
  accessesCount: number;
  activeLoansCount: number;
  loanConsolidatedBalance: string;
  loanProjectedInterest: string;
  upcomingEvents: any[];
  latestIndicator: any;
  cashSummary: {
    date: string;
    latestCashBalance: string;
    latestCashProjected: string;
  };
  latestTecban: any;
  recentImports: any[];
  economicSummary: any;
  alerts: any[];
}

const FUNDS = [
  { key: 'barauna', label: 'Fundo Baraúna' },
  { key: 'carnauba', label: 'Fundo Carnaúba' },
  { key: 'jacaranda', label: 'Fundo Jacarandá' },
  { key: 'caliandra', label: 'Fundo Caliandra' },
  { key: 'bbCorporateFacil', label: 'BB Corporate Fácil' },
];

export const DashboardModule: React.FC<{ onNavigate: (module: string) => void }> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await ApiClient.request('/api/dashboard/overview');
      setData(res);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // Period is resolved per fund by the backend from the most recent indicators version:
  // last date with quota + CDI realizado, back to the first day of M-2.
  const [fundReturns, setFundReturns] = useState<Record<string, any>>({});
  useEffect(() => {
    if (!data) return;
    setFundReturns({});
    FUNDS.forEach(async (f) => {
      try {
        const r = await ApiClient.request(`/api/indicators/fund-remuneration?auto=1&fund=${f.key}`);
        setFundReturns((p) => ({ ...p, [f.key]: r }));
      } catch (err: any) {
        setFundReturns((p) => ({ ...p, [f.key]: { error: err.message } }));
      }
    });
  }, [data?.latestIndicator?.date]);
  const fundPeriod = React.useMemo(() => {
    const ok = Object.values(fundReturns).filter((r: any) => r && r.endDate);
    if (!ok.length) return data?.latestIndicator?.date ? { start: '', end: '' } : null;
    const end = ok.map((r: any) => r.endDate).sort().pop();
    const start = ok.find((r: any) => r.endDate === end).startDate;
    return { start, end };
  }, [fundReturns, data?.latestIndicator?.date]);

  const fmtPct = (v: string | number) =>
    `${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

  const formatCurrency = (val: string | number) => {
    const num = Number(val || 0);
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (loading || !data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[500px]">
        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
          Carregando indicadores consolidados da tesouraria...
        </div>
      </div>
    );
  }

  const { economicSummary } = data;
  const monthlyIpcaHistory = economicSummary.ipcaMonthly.history12m || [];
  const accumulatedIpcaHistory = economicSummary.ipca12m.history12m || [];
  const getSignedChartScale = (history: Array<{ value: number }>) => {
    const values = history.map((item) => Number(item.value)).filter(Number.isFinite);
    const minimum = Math.min(0, ...values);
    const maximum = Math.max(0, ...values);
    const span = maximum - minimum || 1;

    return {
      zeroPosition: (Math.abs(minimum) / span) * 100,
      barHeight: (value: number) => (Math.abs(value) / span) * 100
    };
  };
  const monthlyIpcaScale = getSignedChartScale(monthlyIpcaHistory);
  const accumulatedIpcaScale = getSignedChartScale(accumulatedIpcaHistory);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Page Title & Context */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Painel Executivo de Tesouraria</h1>
          <p className="text-xs text-slate-500 mt-1">
            Visão consolidada da posição financeira, indicadores econômicos e controles operacionais da Elo Participações.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Internet Banking Banco do Brasil */}
          <a
            href="https://autoatendimento.bb.com.br/apf-apj-acesso/index.html?origemLogin=bbdigital"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-blue-900 bg-amber-100/80 hover:bg-amber-200/80 border border-amber-300 rounded-lg shadow-xs transition-colors"
            title="Acessar Internet Banking Banco do Brasil (BB Digital PJ)"
          >
            <span className="w-2 h-2 rounded-full bg-blue-700" />
            <span>Internet Banking BB</span>
            <ExternalLink className="w-3.5 h-3.5 text-blue-800" />
          </a>

          {/* Internet Banking Bradesco */}
          <a
            href="https://www.ne12.bradesconetempresa.b.br/ibpjlogin/login.jsf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-red-950 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg shadow-xs transition-colors"
            title="Acessar Bradesco Net Empresa (IBPJ)"
          >
            <span className="w-2 h-2 rounded-full bg-red-600" />
            <span>Bradesco Net Empresa</span>
            <ExternalLink className="w-3.5 h-3.5 text-red-700" />
          </a>

          <button
            onClick={loadDashboard}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Atualizar Painel</span>
          </button>
        </div>
      </div>

      {/* Alerts Banner */}
      {data.alerts && data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((al, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${
                al.type === 'warning'
                  ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                  : 'bg-sky-50/80 border-sky-200 text-sky-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span className="font-medium">{al.message}</span>
              </div>
              <button
                onClick={() => onNavigate(al.module)}
                className="text-xs font-bold underline hover:opacity-80"
              >
                Ver Detalhes
              </button>
            </div>
          ))}
        </div>
      )}

      {/* SECTION 1: Indicadores Econômicos Oficiais */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Indicadores de Mercado (Fontes Oficiais: Banco Central / IBGE)
          </span>
          <span className="text-[11px] text-slate-400">
            Última checagem: {new Date(economicSummary.lastSyncAttempt).toLocaleString('pt-BR')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* SELIC Over */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">SELIC Over</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${economicSummary.selicOver.status === 'ONLINE' ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                {economicSummary.selicOver.status === 'ONLINE' ? 'ATUALIZADO' : 'PENDENTE'}
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                {economicSummary.selicOver.value ? Number(economicSummary.selicOver.value.replace(',', '.')).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}% <span className="text-xs font-sans font-normal text-slate-500">a.a.</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <Calendar className="w-3 h-3" />
                <span>Referência: {economicSummary.selicOver.date ? formatDateBR(economicSummary.selicOver.date) : 'Sem dado'}</span>
                <span className="ml-2">Atualizado: {economicSummary.selicOver.updatedAt ? new Date(economicSummary.selicOver.updatedAt).toLocaleString('pt-BR') : '—'}</span>
              </div>
            </div>
            {/* Simple sparkline */}
            <div className="mt-auto pt-2 border-t border-slate-100 flex-1 flex flex-col">
              <div className="flex items-end gap-1 flex-1 min-h-[3rem]">
                {economicSummary.selicOver.history12m?.map((h: any, i: number) => (
                  <div
                    key={i}
                    title={`${formatDateBR(h.date)} (última observação do mês): ${Number(h.value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.`}
                    style={{ height: `${Math.min(100, Math.max(20, (h.value / 18) * 100))}%` }}
                    className="flex-1 bg-sky-600 rounded-t-sm hover:bg-sky-500 transition-colors"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Dólar PTAX */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Dólar PTAX Venda</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${economicSummary.ptaxVenda.status === 'ONLINE' ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                {economicSummary.ptaxVenda.status === 'ONLINE' ? 'ATUALIZADO' : 'PENDENTE'}
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                R$ {economicSummary.ptaxVenda.value ? Number(economicSummary.ptaxVenda.value.replace(',', '.')).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : '—'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <Calendar className="w-3 h-3" />
                <span>Referência: {economicSummary.ptaxVenda.date ? formatDateBR(economicSummary.ptaxVenda.date) : 'Sem dado'}</span>
                <span className="ml-2">Atualizado: {economicSummary.ptaxVenda.updatedAt ? new Date(economicSummary.ptaxVenda.updatedAt).toLocaleString('pt-BR') : '—'}</span>
              </div>
            </div>
            <div className="mt-auto pt-2 border-t border-slate-100 flex items-end gap-1 flex-1 min-h-[3rem]">
              {economicSummary.ptaxVenda.history12m?.map((h: any, i: number) => (
                <div
                  key={i}
                  title={`${formatDateBR(h.date)}: R$ ${h.value}`}
                  style={{ height: `${Math.min(100, Math.max(20, (h.value / 7) * 100))}%` }}
                  className="flex-1 bg-indigo-600 rounded-t-sm hover:bg-indigo-500 transition-colors"
                />
              ))}
            </div>
          </div>

          {/* IPCA Mensal */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">IPCA Mensal</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${economicSummary.ipcaMonthly.status === 'ONLINE' ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                {economicSummary.ipcaMonthly.status === 'ONLINE' ? 'ATUALIZADO' : 'PENDENTE'}
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                {economicSummary.ipcaMonthly.value ? Number(economicSummary.ipcaMonthly.value.replace(',', '.')).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}%
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <Calendar className="w-3 h-3" />
                <span>Competência: {economicSummary.ipcaMonthly.date ? economicSummary.ipcaMonthly.date.slice(5, 7) + '/' + economicSummary.ipcaMonthly.date.slice(0, 4) : 'Sem dado'}</span>
                <span className="ml-2">Atualizado: {economicSummary.ipcaMonthly.updatedAt ? new Date(economicSummary.ipcaMonthly.updatedAt).toLocaleString('pt-BR') : '—'}</span>
              </div>
            </div>
            <div className="mt-auto pt-2 border-t border-slate-100 flex-1 flex flex-col">
              <div className="relative flex-1 min-h-[3rem]">
                <div className="absolute left-0 right-0 border-t border-slate-300" style={{ bottom: `${monthlyIpcaScale.zeroPosition}%` }} />
                <div className="absolute inset-0 flex gap-1">
                  {monthlyIpcaHistory.map((h: any, i: number) => {
                    const value = Number(h.value);
                    const positive = value >= 0;
                    return (
                      <div key={i} className="relative flex-1" title={`${formatDateBR(h.date)}: ${h.value}%`}>
                        <div
                          style={{
                            height: `${monthlyIpcaScale.barHeight(value)}%`,
                            bottom: positive ? `${monthlyIpcaScale.zeroPosition}%` : undefined,
                            top: positive ? undefined : `${100 - monthlyIpcaScale.zeroPosition}%`
                          }}
                          className={`absolute inset-x-0 ${positive ? 'bg-emerald-600 rounded-t-sm hover:bg-emerald-500' : 'bg-rose-600 rounded-b-sm hover:bg-rose-500'} transition-colors`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* IPCA 12 Meses */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">IPCA Acumulado 12M</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${economicSummary.ipca12m.status === 'ONLINE' ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                {economicSummary.ipca12m.status === 'ONLINE' ? 'ATUALIZADO' : 'PENDENTE'}
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                {economicSummary.ipca12m.value ? Number(economicSummary.ipca12m.value.replace(',', '.')).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}%
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <Calendar className="w-3 h-3" />
                <span>Competência: {economicSummary.ipca12m.date ? economicSummary.ipca12m.date.slice(5, 7) + '/' + economicSummary.ipca12m.date.slice(0, 4) : 'Sem dado'}</span>
                <span className="ml-2">Atualizado: {economicSummary.ipca12m.updatedAt ? new Date(economicSummary.ipca12m.updatedAt).toLocaleString('pt-BR') : '—'}</span>
              </div>
            </div>
            <div className="mt-auto pt-2 border-t border-slate-100 flex-1 flex flex-col">
              <div className="relative flex-1 min-h-[3rem]">
                <div className="absolute left-0 right-0 border-t border-slate-300" style={{ bottom: `${accumulatedIpcaScale.zeroPosition}%` }} />
                <div className="absolute inset-0 flex gap-1">
                  {accumulatedIpcaHistory.map((h: any, i: number) => {
                    const value = Number(h.value);
                    const positive = value >= 0;
                    return (
                      <div key={i} className="relative flex-1" title={`${formatDateBR(h.date)}: ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% acumulado em 12 meses`}>
                        <div
                          style={{
                            height: `${accumulatedIpcaScale.barHeight(value)}%`,
                            bottom: positive ? `${accumulatedIpcaScale.zeroPosition}%` : undefined,
                            top: positive ? undefined : `${100 - accumulatedIpcaScale.zeroPosition}%`
                          }}
                          className={`absolute inset-x-0 ${positive ? 'bg-violet-600 rounded-t-sm hover:bg-violet-500' : 'bg-rose-600 rounded-b-sm hover:bg-rose-500'} transition-colors`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* SECTION 4: Remuneração dos Fundos (% CDI) & Remuneração dos Fundos (3 meses) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FundReturnsChart period={fundPeriod?.end ? fundPeriod : null} />

        {/* Remuneração dos Fundos — últimos 3 meses (M-2 a M-0) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900">Remuneração dos Fundos (3 meses)</h3>
              {fundPeriod?.end && (
                <span className="text-[11px] text-slate-500">
                  {formatDateBR(fundPeriod.start)} a {formatDateBR(fundPeriod.end)}
                </span>
              )}
            </div>
            <button
              onClick={() => onNavigate('indicators')}
              className="text-xs font-semibold text-sky-700 hover:text-sky-800 shrink-0"
            >
              Histórico →
            </button>
          </div>

          {!fundPeriod ? (
            <div className="text-xs text-slate-500 py-6 text-center">Nenhuma cota registrada.</div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-1.5 grid grid-cols-[1fr_auto_auto] gap-4 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                <span>Fundo</span><span className="text-right w-20">Rentab.</span><span className="text-right w-20">% CDI</span>
              </div>
              {FUNDS.map((f) => {
                const r = fundReturns[f.key];
                return (
                  <div key={f.key} className="py-2 grid grid-cols-[1fr_auto_auto] gap-4 items-center">
                    <span className="font-medium text-slate-700 truncate">{f.label}</span>
                    {r === undefined ? (
                      <span className="col-span-2 text-right text-slate-400">Calculando...</span>
                    ) : r.error ? (
                      <span className="col-span-2 text-right text-amber-600 truncate" title={r.error}>Sem dados suficientes</span>
                    ) : (
                      <>
                        <span className="text-right w-20 font-mono tabular-nums text-slate-700">{fmtPct(r.fundReturnPercent)}</span>
                        <span className="text-right w-20 font-mono tabular-nums font-bold text-slate-900">{fmtPct(r.percentageOfCdi)}</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
