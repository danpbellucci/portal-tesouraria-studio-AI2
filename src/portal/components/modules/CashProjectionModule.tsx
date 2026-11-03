// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { DataTabs } from './ImportedDataTab';
import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Download,
  Upload,
  History,
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  X,
  AlertCircle
} from 'lucide-react';
import { CashProjection, Company } from '../../types/treasury';
import { ApiClient } from '../../services/api';
import { useToast } from '../common/Toast';
import { ImportModal } from '../common/ImportModal';
import { VersionHistoryModal } from '../common/VersionHistoryModal';
import { formatDateBR } from '../../utils/date';
import { TecbanLineChart, CASH_METRICS } from './TecbanLineChart';

const CashProjectionModuleMain: React.FC = () => {
  const { showToast } = useToast();
  const [projections, setProjections] = useState<CashProjection[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Form
  const [companyId, setCompanyId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [actualBalance, setActualBalance] = useState('0.00');
  const [actualInflow, setActualInflow] = useState('0.00');
  const [actualOutflow, setActualOutflow] = useState('0.00');
  const [projectedBalance, setProjectedBalance] = useState('0.00');
  const [projectedInflow, setProjectedInflow] = useState('0.00');
  const [projectedOutflow, setProjectedOutflow] = useState('0.00');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (selectedCompanyId !== 'all') queryParams.append('companyId', selectedCompanyId);
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);

      const [projRes, compRes] = await Promise.all([
        ApiClient.request(`/api/cash-projections?${queryParams.toString()}`),
        ApiClient.request('/api/companies')
      ]);
      setProjections(projRes);
      setCompanies(compRes);
      if (!companyId && compRes.length > 0) setCompanyId(compRes[0].id);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCompanyId, startDate, endDate]);

  const formatBRL = (val: string | number) => {
    if (val === null || val === undefined || val === '') return '—';
    const n = Number(val);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await ApiClient.request('/api/cash-projections', {
        method: 'POST',
        body: JSON.stringify({
          companyId,
          date,
          actualBalance,
          actualInflow,
          actualOutflow,
          projectedBalance,
          projectedInflow,
          projectedOutflow
        })
      });
      showToast('Posição de caixa gravada com sucesso.', 'success');
      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Projeção Diária de Caixa</h1>
          <p className="text-xs text-slate-500 mt-1">
            Controle de saldos, entradas e saídas reais versus projetadas por empresa. Preservação fiel dos saldos informados.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => ApiClient.downloadFile('/api/spreadsheets/template/cash_projections', 'modelo_projecao_caixa.xlsx')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Baixar Modelo</span>
          </button>

          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Upload className="w-3.5 h-3.5 text-sky-600" />
            <span>Importar Planilha</span>
          </button>

          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>Versões</span>
          </button>

          <button
            onClick={() => ApiClient.downloadFile('/api/spreadsheets/export/cash_projections', 'projecao_caixa_elo.xlsx')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Exportar XLSX</span>
          </button>

          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Posição</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">Empresa:</span>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
            >
              <option value="all">Todas as Empresas</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.tradeName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">Período:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs px-2 py-1.5 border border-slate-300 rounded-lg font-mono"
            />
            <span className="text-slate-400">até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs px-2 py-1.5 border border-slate-300 rounded-lg font-mono"
            />
          </div>
        </div>

        <div className="text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
          {projections.length} registros diários
        </div>
      </div>

      <TecbanLineChart records={projections} metricsDef={CASH_METRICS} />

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px] sticky top-0">
              <tr>
                <th className="py-3 px-4 font-mono">Data</th>
                <th className="py-3 px-4">Empresa</th>
                <th className="py-3 px-4 text-right font-mono">Saldo Real</th>
                <th className="py-3 px-4 text-right font-mono">Saldo Projetado</th>
                <th className="py-3 px-4 text-right font-mono">Diferença (R$)</th>
                <th className="py-3 px-4 text-right font-mono">Variação (%)</th>
                <th className="py-3 px-4 text-right font-mono">Entradas (R / P)</th>
                <th className="py-3 px-4 text-right font-mono">Saídas (R / P)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                    Carregando posições de caixa...
                  </td>
                </tr>
              ) : projections.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                    Nenhuma projeção cadastrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                projections.map((rec) => {
                  const diffVal = Number(rec.variance?.diffBalance || 0);
                  const isPositive = diffVal >= 0;

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">{formatDateBR(rec.date)}</td>
                      <td className="py-3 px-4 font-sans font-medium text-slate-800">
                        {rec.company?.tradeName || rec.companyId}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                        {formatBRL(rec.actualBalance)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-sky-800 tabular-nums">
                        {formatBRL(rec.projectedBalance)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-bold tabular-nums ${
                          isPositive ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {formatBRL(rec.variance?.diffBalance || 0)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-bold tabular-nums ${
                          isPositive ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {rec.variance?.diffBalancePercent}%
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-600">
                        {formatBRL(rec.actualInflow)} / {formatBRL(rec.projectedInflow)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-600">
                        {formatBRL(rec.actualOutflow)} / {formatBRL(rec.projectedOutflow)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Entry Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Registrar Posição Diária de Caixa</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Empresa *</label>
                <select
                  required
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600 bg-white"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.tradeName} ({c.cnpj})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Data da Posição (AAAA-MM-DD) *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600 font-mono"
                />
              </div>

              {/* Actuals */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <span className="text-xs font-bold text-slate-800 block">Valores Realizados (R$):</span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Saldo Real</label>
                    <input
                      type="text"
                      value={actualBalance}
                      onChange={(e) => setActualBalance(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Entradas Reais</label>
                    <input
                      type="text"
                      value={actualInflow}
                      onChange={(e) => setActualInflow(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Saídas Reais</label>
                    <input
                      type="text"
                      value={actualOutflow}
                      onChange={(e) => setActualOutflow(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Projected */}
              <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-lg space-y-2">
                <span className="text-xs font-bold text-sky-950 block">Valores Projetados (R$ - Preservados):</span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="text-[11px] text-sky-800 block mb-0.5 font-bold">Saldo Projetado *</label>
                    <input
                      type="text"
                      value={projectedBalance}
                      onChange={(e) => setProjectedBalance(e.target.value)}
                      className="w-full px-2 py-1.5 border border-sky-300 rounded font-mono bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-sky-800 block mb-0.5">Entrada Projetada</label>
                    <input
                      type="text"
                      value={projectedInflow}
                      onChange={(e) => setProjectedInflow(e.target.value)}
                      className="w-full px-2 py-1.5 border border-sky-300 rounded font-mono bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-sky-800 block mb-0.5">Saída Projetada</label>
                    <input
                      type="text"
                      value={projectedOutflow}
                      onChange={(e) => setProjectedOutflow(e.target.value)}
                      className="w-full px-2 py-1.5 border border-sky-300 rounded font-mono bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Gravando...' : 'Gravar Posição'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Universal Import Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        moduleKey="cash_projections"
        moduleTitle="Projeção Diária de Caixa"
        onSuccess={loadData}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        moduleKey="cash_projections"
        moduleTitle="Projeção de Caixa"
      />
    </div>
  );
};

export const CashProjectionModule: React.FC = () => (
  <DataTabs module="cash_projections">
    <CashProjectionModuleMain />
  </DataTabs>
);
