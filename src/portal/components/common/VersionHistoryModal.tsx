// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import React, { useState, useEffect } from 'react';
import { History, GitCompare, X, RefreshCw, ArrowRight } from 'lucide-react';
import { ApiClient } from '../../services/api';
import { ImportVersion } from '../../types/treasury';
import { useToast } from './Toast';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleKey: string;
  moduleTitle: string;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  moduleKey,
  moduleTitle
}) => {
  const { showToast } = useToast();
  const [versions, setVersions] = useState<ImportVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [v1, setV1] = useState<string>('');
  const [v2, setV2] = useState<string>('');
  const [comparison, setComparison] = useState<any | null>(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, moduleKey]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const data = await ApiClient.request(`/api/spreadsheets/versions/${moduleKey}`);
      setVersions(data);
      if (data.length >= 2) {
        setV1(data[1].id);
        setV2(data[0].id);
      } else if (data.length === 1) {
        setV1(data[0].id);
        setV2(data[0].id);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!v1 || !v2) return;
    setComparing(true);
    try {
      const res = await ApiClient.request(`/api/spreadsheets/compare?v1=${v1}&v2=${v2}`);
      setComparison(res);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setComparing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-slate-700" />
            <div>
              <h3 className="text-base font-bold text-slate-900">Histórico de Versões e Comparação — {moduleTitle}</h3>
              <p className="text-xs text-slate-500">Rastreabilidade completa de todas as importações e snapshots gerados.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-500">
              <RefreshCw className="w-4 h-4 animate-spin text-sky-600 mr-2" />
              Carregando histórico de versões...
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              Nenhuma versão de importação registrada para este módulo até o momento.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Compare Selector */}
              {versions.length >= 2 && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-sky-600" />
                    Comparar Duas Versões de Dados
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-slate-600 block mb-1">Versão Base (Anterior)</label>
                      <select
                        value={v1}
                        onChange={(e) => setV1(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        {versions.map((v) => (
                          <option key={v.id} value={v.id}>
                            {new Date(v.importedAt).toLocaleString('pt-BR')} — {v.fileName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-slate-600 block mb-1">Versão Comparada (Mais Recente)</label>
                      <select
                        value={v2}
                        onChange={(e) => setV2(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        {versions.map((v) => (
                          <option key={v.id} value={v.id}>
                            {new Date(v.importedAt).toLocaleString('pt-BR')} — {v.fileName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-1">
                      <button
                        type="button"
                        onClick={handleCompare}
                        disabled={comparing || v1 === v2}
                        className="w-full py-2 px-3 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                      >
                        {comparing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <GitCompare className="w-3.5 h-3.5" />}
                        Comparar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Comparison Results */}
              {comparison && (
                <div className="border border-sky-200 bg-sky-50/40 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-950 uppercase tracking-wide">Resultado do Comparativo</span>
                    <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                      <span className="text-emerald-700 font-semibold">+{comparison.addedCount} novos</span>
                      <span className="text-amber-700 font-semibold">{comparison.modifiedCount} modificados</span>
                      <span className="text-rose-700 font-semibold">-{comparison.removedCount} ausentes</span>
                    </div>
                  </div>

                  {comparison.diffDetails.length > 0 ? (
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 font-medium text-slate-600">
                          <tr>
                            <th className="py-2 px-3">Identificador</th>
                            <th className="py-2 px-3">Campo</th>
                            <th className="py-2 px-3">Valor Anterior</th>
                            <th className="py-2 px-3">Novo Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                          {comparison.diffDetails.map((diff: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-semibold text-slate-800">{diff.id}</td>
                              <td className="py-2 px-3 text-slate-600">{diff.key}</td>
                              <td className="py-2 px-3 text-rose-700 line-through">{String(diff.oldValue || '—')}</td>
                              <td className="py-2 px-3 text-emerald-700 font-bold flex items-center gap-1.5">
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                {String(diff.newValue || '—')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-600 italic">Nenhuma divergência detectada nos campos dos registros entre as duas versões.</div>
                  )}
                </div>
              )}

              {/* Version History List */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700">Todas as Versões Gravadas</div>
                <div className="divide-y divide-slate-100">
                  {versions.map((ver) => (
                    <div key={ver.id} className="p-4 hover:bg-slate-50 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{ver.fileName}</span>
                          <span className="text-xs text-slate-400 font-mono">({ver.id})</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                          <span>Importado por: <strong className="text-slate-700">{ver.importedBy}</strong></span>
                          <span>·</span>
                          <span className="font-mono tabular-nums">{new Date(ver.importedAt).toLocaleString('pt-BR')}</span>
                          <span>·</span>
                          <span>{ver.snapshotSummary}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono tabular-nums text-slate-600 font-medium">
                          {ver.totalRows} registros processados
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
