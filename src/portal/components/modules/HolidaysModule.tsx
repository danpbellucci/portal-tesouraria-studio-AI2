// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { useConfirmDialog } from '../common/useConfirmDialog';
import { useIsAdmin } from '../common/BulkDelete';
import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Plus,
  Search,
  Download,
  Upload,
  History,
  FileSpreadsheet,
  Calendar,
  CheckCircle2,
  Trash2,
  Calculator,
  X
} from 'lucide-react';
import { FinancialHoliday, Company } from '../../types/treasury';
import { ApiClient } from '../../services/api';
import { useToast } from '../common/Toast';
import { ImportModal } from '../common/ImportModal';
import { VersionHistoryModal } from '../common/VersionHistoryModal';
import { formatDateBR } from '../../utils/date';

export const HolidaysModule: React.FC = () => {
  const { confirm, confirmDialog } = useConfirmDialog();
  const { showToast } = useToast();
  const [holidays, setHolidays] = useState<FinancialHoliday[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Business days testing tool
  const calendarYear = new Date().getFullYear();
  const [calcStart, setCalcStart] = useState(`${calendarYear}-01-01`);
  const [calcEnd, setCalcEnd] = useState(`${calendarYear}-12-31`);
  const [calcResult, setCalcResult] = useState<number | null>(null);
  const [calculating, setCalculating] = useState(false);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Form
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'NATIONAL_BANKING' | 'STATE' | 'MUNICIPAL'>('NATIONAL_BANKING');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [source, setSource] = useState('FEBRABAN');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [holRes, compRes] = await Promise.all([
        ApiClient.request('/api/holidays'),
        ApiClient.request('/api/companies')
      ]);
      setHolidays(holRes);
      setCompanies(compRes);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTestBusinessDays = async () => {
    setCalculating(true);
    try {
      const res = await ApiClient.request(
        `/api/holidays/count-business-days?startDate=${calcStart}&endDate=${calcEnd}`
      );
      setCalcResult(res.businessDaysCount);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setCalculating(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await ApiClient.request('/api/holidays', {
        method: 'POST',
        body: JSON.stringify({
          date,
          description,
          type,
          state: type === 'STATE' ? state : undefined,
          city: type === 'MUNICIPAL' ? city : undefined,
          companyId: companyId || undefined,
          source
        })
      });
      showToast('Feriado financeiro cadastrado com sucesso.', 'success');
      setIsFormOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, desc: string) => {
    if (!(await confirm(`Confirma a exclusão do feriado "${desc}"?`))) return;
    try {
      await ApiClient.request(`/api/holidays/${id}`, { method: 'DELETE' });
      showToast('Feriado excluído com sucesso.', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const filteredHolidays = holidays.filter((h) => {
    const q = searchTerm.toLowerCase();
    return (
      h.description.toLowerCase().includes(q) ||
      h.date.includes(q) ||
      (h.source || '').toLowerCase().includes(q)
    );
  });

  const isAdmin = useIsAdmin();

  return (
    <>
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Calendário Financeiro & Dias Úteis</h1>
          <p className="text-xs text-slate-500 mt-1">
            Calendário bancário nacional projetado para anos futuros, além dos feriados estaduais e municipais cadastrados. 31 de dezembro é tratado como dia útil bancário, ainda que apareça em listas de expediente especial.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => ApiClient.downloadFile('/api/spreadsheets/template/holidays', 'modelo_feriados_financeiros.xlsx')}
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
            onClick={() => ApiClient.downloadFile('/api/spreadsheets/export/holidays', 'feriados_financeiros_elo.xlsx')}
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
            <span>Novo Feriado</span>
          </button>
        </div>
      </div>

      {/* Interactive Business Days Calculator Widget */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-sky-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            Calculadora de Dias Úteis (Convenção Financeira 252 d.u.)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Data Inicial (D+0)</label>
            <input
              type="date"
              value={calcStart}
              onChange={(e) => setCalcStart(e.target.value)}
              className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Data Final (D+N)</label>
            <input
              type="date"
              value={calcEnd}
              onChange={(e) => setCalcEnd(e.target.value)}
              className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg font-mono"
            />
          </div>

          <div>
            <button
              onClick={handleTestBusinessDays}
              disabled={calculating}
              className="w-full py-2 px-3 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
            >
              <span>{calculating ? 'Contando...' : 'Contar Dias Úteis'}</span>
            </button>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Dias Úteis no Período</span>
            <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
              {calcResult !== null ? `${calcResult} d.u.` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar por descrição, data ou fonte..."
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600 bg-white"
            />
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {filteredHolidays.length} feriados no calendário
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 font-mono">Data</th>
                <th className="py-3 px-4">Descrição do Feriado</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Abrangência / Localidade</th>
                <th className="py-3 px-4">Fonte Oficial</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">Carregando feriados...</td>
                </tr>
              ) : filteredHolidays.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">Nenhum feriado localizado.</td>
                </tr>
              ) : (
                filteredHolidays.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">{formatDateBR(h.date)}</td>
                  <td className="py-3 px-4 text-slate-800 font-medium">{h.description}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      h.type === 'NATIONAL_BANKING'
                        ? 'bg-sky-50 text-sky-800 border border-sky-200'
                        : h.type === 'STATE'
                        ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}>
                      {h.type === 'NATIONAL_BANKING' ? 'Bancário Nacional' : h.type === 'STATE' ? 'Estadual' : 'Municipal'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {h.city ? `${h.city} - ${h.state || ''}` : h.state || 'Nacional'}
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{h.source}</td>
                  <td className="py-3 px-4 text-right">
                    {isAdmin && (
                    <button
                      onClick={() => handleDelete(h.id, h.description)}
                      className="p-1 text-slate-400 hover:text-rose-700 transition-colors"
                      title="Excluir Feriado"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    )}
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
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Cadastrar Feriado Financeiro</h3>
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
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-sky-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Descrição do Feriado *</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Aniversário da Cidade de Barueri"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Tipo de Feriado *</label>
                <select
                  value={type}
                  onChange={(e: any) => setType(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="NATIONAL_BANKING">Feriado Bancário Nacional (FEBRABAN)</option>
                  <option value="STATE">Feriado Estadual</option>
                  <option value="MUNICIPAL">Feriado Municipal</option>
                </select>
              </div>

              {type !== 'NATIONAL_BANKING' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">UF</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase())}
                      placeholder="SP"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg uppercase"
                    />
                  </div>
                  {type === 'MUNICIPAL' && (
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Município</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Barueri"
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Fonte da Publicação</label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Ex: FEBRABAN / Decreto Municipal 123"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
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
                  {submitting ? 'Salvando...' : 'Salvar Feriado'}
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
        moduleKey="holidays"
        moduleTitle="Calendário Financeiro"
        onSuccess={loadData}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        moduleKey="holidays"
        moduleTitle="Calendário Financeiro"
      />
    </div>
      {confirmDialog}
    </>
  );
};
