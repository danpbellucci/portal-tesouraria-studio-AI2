// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { DataTabs } from './ImportedDataTab';
import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Download,
  Upload,
  History,
  FileSpreadsheet,
  Plus,
  Calendar,
  Layers,
  ArrowRight,
  Filter,
  X
} from 'lucide-react';
import { IndicatorRecord, IndicatorVersion } from '../../types/treasury';
import { ApiClient } from '../../services/api';
import { useToast } from '../common/Toast';
import { ImportModal } from '../common/ImportModal';
import { VersionHistoryModal } from '../common/VersionHistoryModal';
import { formatDateBR } from '../../utils/date';
import { IndicatorsLineChart } from './IndicatorsLineChart';

const localIsoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const IndicatorsModuleMain: React.FC = () => {
  const { showToast } = useToast();
  const [history, setHistory] = useState<IndicatorRecord[]>([]);
  const [versions, setVersions] = useState<IndicatorVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [remStart, setRemStart] = useState(localIsoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [remEnd, setRemEnd] = useState(localIsoDate(new Date()));
  const [remFund, setRemFund] = useState('barauna');
  const [remResult, setRemResult] = useState<any>(null);
  const [remLoading, setRemLoading] = useState(false);
  const [selectedVersionFilter, setSelectedVersionFilter] = useState<string>('all');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Manual entry
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [cdiRealizedAnnual, setCdiRealizedAnnual] = useState('10.65');
  const [cdiProjectedAnnual, setCdiProjectedAnnual] = useState('10.50');
  const [quotaBarauna, setQuotaBarauna] = useState('1.4285');
  const [quotaCarnauba, setQuotaCarnauba] = useState('1.3854');
  const [quotaJacaranda, setQuotaJacaranda] = useState('1.5120');
  const [quotaCaliandra, setQuotaCaliandra] = useState('1.2941');
  const [quotaBBCorporateFacil, setQuotaBBCorporateFacil] = useState('1.1895');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [histRes, verRes] = await Promise.all([
        ApiClient.request('/api/indicators/history'),
        ApiClient.request('/api/indicators/versions')
      ]);
      setHistory(histRes);
      setVersions(verRes);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await ApiClient.request('/api/indicators/history', {
        method: 'POST',
        body: JSON.stringify({
          date,
          cdiRealizedAnnual,
          cdiProjectedAnnual,
          quotaBarauna,
          quotaCarnauba,
          quotaJacaranda,
          quotaCaliandra,
          quotaBBCorporateFacil
        })
      });
      showToast('Indicador financeiro gravado com sucesso.', 'success');
      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredHistory = history.filter((h) => {
    if (selectedVersionFilter !== 'all' && h.versionId !== selectedVersionFilter) {
      return false;
    }
    return true;
  });

  const calculateFundRemuneration = async () => {
    if (!remStart || !remEnd || remStart > remEnd) {
      showToast('Informe um período válido.', 'error'); return;
    }
    setRemLoading(true); setRemResult(null);
    try {
      const params = new URLSearchParams({ startDate: remStart, endDate: remEnd, fund: remFund, versionId: selectedVersionFilter });
      const result = await ApiClient.request(`/api/indicators/fund-remuneration?${params.toString()}`);
      setRemResult(result);
    } catch (err: any) { showToast(err.message, 'error'); }
    finally { setRemLoading(false); }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Indicadores Econômicos, Taxas & Curva CDI</h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestão histórica de CDI realizado e projetado (% a.a.) e evolução das cotas dos fundos corporativos (Baraúna, Carnaúba, Jacarandá, Caliandra e BB Corp Fácil).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => ApiClient.downloadFile('/api/spreadsheets/template/indicators', 'modelo_indicadores_taxas.xlsx')}
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
            <span>Versões Imutáveis</span>
          </button>

          <button
            onClick={() => ApiClient.downloadFile('/api/spreadsheets/export/indicators', 'indicadores_taxas_elo.xlsx')}
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

      {/* Interactive Line Chart for CDI and Fund Quotas */}
      <IndicatorsLineChart data={filteredHistory} />

      {/* Fund remuneration calculator */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Remuneração dos Fundos (% do CDI)</h3>
          <p className="text-xs text-slate-500 mt-1">Rentabilidade pela variação da cota entre o dia anterior à data inicial e a data final, dividida pelo CDI acumulado no período.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Fundo</label>
            <select value={remFund} onChange={(e) => setRemFund(e.target.value)} className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white">
              <option value="barauna">Baraúna</option><option value="carnauba">Carnaúba</option><option value="jacaranda">Jacarandá</option><option value="caliandra">Caliandra</option><option value="bbCorporateFacil">BB Corporate Fácil</option>
            </select>
          </div>
          <div><label className="text-xs font-semibold text-slate-600 block mb-1">Data inicial</label><input type="date" value={remStart} onChange={(e) => setRemStart(e.target.value)} className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg" /></div>
          <div><label className="text-xs font-semibold text-slate-600 block mb-1">Data final</label><input type="date" value={remEnd} onChange={(e) => setRemEnd(e.target.value)} className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg" /></div>
          <button onClick={calculateFundRemuneration} disabled={remLoading} className="py-2 px-4 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50">{remLoading ? 'Calculando...' : 'Calcular remuneração'}</button>
        </div>
        {remResult && <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div><span className="block text-[10px] text-slate-500">Rentabilidade do fundo</span><strong className="text-sm font-mono">{Number(remResult.fundReturnPercent).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%</strong></div>
          <div><span className="block text-[10px] text-slate-500">CDI acumulado</span><strong className="text-sm font-mono">{Number(remResult.cdiAccumulatedPercent).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%</strong></div>
          <div><span className="block text-[10px] text-slate-500">Remuneração (% CDI)</span><strong className="text-lg font-mono text-emerald-700">{Number(remResult.percentageOfCdi).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</strong></div>
          <div><span className="block text-[10px] text-slate-500">Cota-base / data</span><strong className="text-xs font-mono">{remResult.initialQuota} · {formatDateBR(remResult.quotaBaseDate)}</strong></div>
          <div><span className="block text-[10px] text-slate-500">Cota final / data</span><strong className="text-xs font-mono">{remResult.finalQuota} · {formatDateBR(remResult.quotaFinalDate)}</strong></div>
          <div className="col-span-full text-[10px] text-slate-500">{remResult.businessDays} dias úteis considerados · Curva: {remResult.versionId}</div>
        </div>}
      </div>

      {/* Filter and Version Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-600">Filtrar por Versão da Curva:</span>
          <select
            value={selectedVersionFilter}
            onChange={(e) => setSelectedVersionFilter(e.target.value)}
            className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
          >
            <option value="all">Todas as Versões</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} ({formatDateBR(v.createdAt)})
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs font-mono tabular-nums text-slate-500">
          {filteredHistory.length} posições diárias registradas
        </div>
      </div>

      {/* Historical Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px] sticky top-0">
              <tr>
                <th className="py-3 px-4 font-mono">Data</th>
                <th className="py-3 px-4 text-right font-mono">CDI Realizado</th>
                <th className="py-3 px-4 text-right font-mono">CDI Projetado</th>
                <th className="py-3 px-4 text-right font-mono">Baraúna</th>
                <th className="py-3 px-4 text-right font-mono">Carnaúba</th>
                <th className="py-3 px-4 text-right font-mono">Jacarandá</th>
                <th className="py-3 px-4 text-right font-mono">Caliandra</th>
                <th className="py-3 px-4 text-right font-mono">BB Corp Fácil</th>
                <th className="py-3 px-4 font-mono">Versão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 font-sans">
                    Carregando histórico financeiro...
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 font-sans">
                    Nenhum indicador registrado para a versão selecionada.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">{formatDateBR(rec.date)}</td>
                    <td className="py-3 px-4 text-right text-sky-700 font-bold tabular-nums">
                      {rec.cdiRealizedAnnual}% a.a.
                    </td>
                    <td className="py-3 px-4 text-right text-indigo-700 font-semibold tabular-nums">
                      {rec.cdiProjectedAnnual}% a.a.
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-800">{rec.quotaBarauna}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-800">{rec.quotaCarnauba}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-800">{rec.quotaJacaranda}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-800">{rec.quotaCaliandra}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-800">{rec.quotaBBCorporateFacil}</td>
                    <td className="py-3 px-4 text-slate-400 text-[10px]">{rec.versionId}</td>
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
              <h3 className="text-sm font-bold text-slate-900">Registrar Posição Diária de Indicadores</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Data de Referência (AAAA-MM-DD) *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">CDI Realizado (% a.a.)</label>
                  <input
                    type="text"
                    required
                    value={cdiRealizedAnnual}
                    onChange={(e) => setCdiRealizedAnnual(e.target.value)}
                    placeholder="10.65"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-sky-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">CDI Projetado (% a.a.)</label>
                  <input
                    type="text"
                    required
                    value={cdiProjectedAnnual}
                    onChange={(e) => setCdiProjectedAnnual(e.target.value)}
                    placeholder="10.50"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-sky-600"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <span className="text-xs font-bold text-slate-700 block">Cotas Patrimoniais dos Fundos:</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Cota Baraúna</label>
                    <input
                      type="text"
                      value={quotaBarauna}
                      onChange={(e) => setQuotaBarauna(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Cota Carnaúba</label>
                    <input
                      type="text"
                      value={quotaCarnauba}
                      onChange={(e) => setQuotaCarnauba(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Cota Jacarandá</label>
                    <input
                      type="text"
                      value={quotaJacaranda}
                      onChange={(e) => setQuotaJacaranda(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Cota Caliandra</label>
                    <input
                      type="text"
                      value={quotaCaliandra}
                      onChange={(e) => setQuotaCaliandra(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 block mb-0.5">Cota BB Corporate Fácil</label>
                  <input
                    type="text"
                    value={quotaBBCorporateFacil}
                    onChange={(e) => setQuotaBBCorporateFacil(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                  />
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
                  {submitting ? 'Gravando...' : 'Gravar Indicadores'}
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
        moduleKey="indicators"
        moduleTitle="Indicadores e Taxas (Curva CDI)"
        onSuccess={loadData}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        moduleKey="indicators"
        moduleTitle="Indicadores e Taxas"
      />
    </div>
  );
};

export const IndicatorsModule: React.FC = () => (
  <DataTabs module="indicators">
    <IndicatorsModuleMain />
  </DataTabs>
);
