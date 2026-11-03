// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { DataTabs } from './ImportedDataTab';
import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Download,
  Upload,
  History,
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  Layers,
  X
} from 'lucide-react';
import { TecbanRecord } from '../../types/treasury';
import { ApiClient } from '../../services/api';
import { useToast } from '../common/Toast';
import { ImportModal } from '../common/ImportModal';
import { VersionHistoryModal } from '../common/VersionHistoryModal';
import { formatDateBR } from '../../utils/date';
import { TecbanLineChart } from './TecbanLineChart';

const TecbanModuleMain: React.FC = () => {
  const { showToast } = useToast();
  const [records, setRecords] = useState<TecbanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Form
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [actualBalance, setActualBalance] = useState('0.00');
  const [actualWithdrawals, setActualWithdrawals] = useState('0.00');
  const [actualReloads, setActualReloads] = useState('0.00');
  const [projectedBalance, setProjectedBalance] = useState('0.00');
  const [projectedWithdrawals, setProjectedWithdrawals] = useState('0.00');
  const [projectedReloads, setProjectedReloads] = useState('0.00');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);

      const res = await ApiClient.request(`/api/tecban?${queryParams.toString()}`);
      setRecords(res);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const formatBRL = (val: string | number) => {
    if (val === null || val === undefined || val === '') return '—';
    const n = Number(val);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await ApiClient.request('/api/tecban', {
        method: 'POST',
        body: JSON.stringify({
          date,
          actualBalance,
          actualWithdrawals,
          actualReloads,
          projectedBalance,
          projectedWithdrawals,
          projectedReloads
        })
      });
      showToast('Registro Tecban gravado com sucesso.', 'success');
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
          <h1 className="text-xl font-bold text-slate-900">Controle Operacional Tecban</h1>
          <p className="text-xs text-slate-500 mt-1">
            Acompanhamento diário de saques, recargas e saldos da operação de autoatendimento da rede Tecban.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => ApiClient.downloadFile('/api/spreadsheets/template/tecban', 'modelo_controle_tecban.xlsx')}
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
            onClick={() => ApiClient.downloadFile('/api/spreadsheets/export/tecban', 'controle_tecban_elo.xlsx')}
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
            <span>Novo Registro Diário</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-600">Período:</span>
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

        <div className="text-xs font-mono tabular-nums text-slate-500">
          {records.length} posições diárias registradas
        </div>
      </div>

      <TecbanLineChart records={records} />

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px] sticky top-0">
              <tr>
                <th className="py-3 px-4 font-mono">Data</th>
                <th className="py-3 px-4 text-right font-mono">Saldo Real</th>
                <th className="py-3 px-4 text-right font-mono">Saldo Projetado</th>
                <th className="py-3 px-4 text-right font-mono">Dif. Saldo (%)</th>
                <th className="py-3 px-4 text-right font-mono">Saques (R / P)</th>
                <th className="py-3 px-4 text-right font-mono">Dif. Saques (%)</th>
                <th className="py-3 px-4 text-right font-mono">Recargas (R / P)</th>
                <th className="py-3 px-4 text-right font-mono">Dif. Recargas (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                    Carregando movimentações Tecban...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                    Nenhum registro Tecban encontrado.
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">{formatDateBR(rec.date)}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                      {formatBRL(rec.actualBalance)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-indigo-700 tabular-nums">
                      {formatBRL(rec.projectedBalance)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-700 font-bold">
                      {rec.variance?.diffBalancePercent}%
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-rose-800">
                      {formatBRL(rec.actualWithdrawals)} / {formatBRL(rec.projectedWithdrawals)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-600">
                      {rec.variance?.diffWithdrawalsPercent}%
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-emerald-800">
                      {formatBRL(rec.actualReloads)} / {formatBRL(rec.projectedReloads)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-600">
                      {rec.variance?.diffReloadsPercent}%
                    </td>
                  </tr>
                ))
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
              <h3 className="text-sm font-bold text-slate-900">Registrar Posição Tecban</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Data (AAAA-MM-DD) *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600 font-mono"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <span className="text-xs font-bold text-slate-800 block">Posição Realizada (R$):</span>
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
                    <label className="text-[11px] text-slate-600 block mb-0.5">Saques Reais</label>
                    <input
                      type="text"
                      value={actualWithdrawals}
                      onChange={(e) => setActualWithdrawals(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Recargas Reais</label>
                    <input
                      type="text"
                      value={actualReloads}
                      onChange={(e) => setActualReloads(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-lg space-y-2">
                <span className="text-xs font-bold text-indigo-950 block">Posição Projetada (R$):</span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="text-[11px] text-indigo-800 block mb-0.5 font-bold">Saldo Projetado</label>
                    <input
                      type="text"
                      value={projectedBalance}
                      onChange={(e) => setProjectedBalance(e.target.value)}
                      className="w-full px-2 py-1.5 border border-indigo-300 rounded font-mono bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-indigo-800 block mb-0.5">Saques Projetados</label>
                    <input
                      type="text"
                      value={projectedWithdrawals}
                      onChange={(e) => setProjectedWithdrawals(e.target.value)}
                      className="w-full px-2 py-1.5 border border-indigo-300 rounded font-mono bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-indigo-800 block mb-0.5">Recargas Projetadas</label>
                    <input
                      type="text"
                      value={projectedReloads}
                      onChange={(e) => setProjectedReloads(e.target.value)}
                      className="w-full px-2 py-1.5 border border-indigo-300 rounded font-mono bg-white"
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
                  {submitting ? 'Gravando...' : 'Gravar Posição Tecban'}
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
        moduleKey="tecban"
        moduleTitle="Controle Tecban"
        onSuccess={loadData}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        moduleKey="tecban"
        moduleTitle="Controle Tecban"
      />
    </div>
  );
};

export const TecbanModule: React.FC = () => (
  <DataTabs module="tecban">
    <TecbanModuleMain />
  </DataTabs>
);
