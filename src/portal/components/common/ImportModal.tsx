// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X, RefreshCw, AlertTriangle } from 'lucide-react';
import { ApiClient } from '../../services/api';
import { useToast } from './Toast';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleKey: string;
  moduleTitle: string;
  onSuccess: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  moduleKey,
  moduleTitle,
  onSuccess
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{
    fileName: string;
    totalRows: number;
    validRowsCount: number;
    errorRowsCount: number;
    duplicatesCount: number;
    validationErrors: string[];
    rows: any[];
  } | null>(null);

  const [duplicateStrategy, setDuplicateStrategy] = useState<'replace' | 'keep_existing' | 'cancel'>('replace');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', selected);

      const res = await ApiClient.request(`/api/spreadsheets/preview/${moduleKey}`, {
        method: 'POST',
        body: formData
      });

      setPreview(res);
      showToast(`Arquivo pré-analisado: ${res.totalRows} linhas identificadas.`, 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
      setFile(null);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!file) return;
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('duplicateStrategy', duplicateStrategy);
      formData.append('notes', notes);

      const res = await ApiClient.request(`/api/spreadsheets/commit/${moduleKey}`, {
        method: 'POST',
        body: formData
      });

      showToast(`Importação finalizada com sucesso! ${res.summary.insertedCount} inseridos, ${res.summary.updatedCount} atualizados.`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    ApiClient.downloadFile(`/api/spreadsheets/template/${moduleKey}`, `modelo_${moduleKey}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Importação de Planilha — {moduleTitle}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Formatos suportados: XLSX e CSV. Todas as alterações geram histórico versionado.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Step 1: File selection or template download */}
          {!preview ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-sky-50 border border-sky-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-6 h-6 text-sky-700" />
                  <div>
                    <h4 className="text-sm font-semibold text-sky-950">Ainda não possui o modelo padrão preenchido?</h4>
                    <p className="text-xs text-sky-700">Baixe o modelo com cabeçalhos exigidos, orientações e linha de exemplo.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3.5 py-2 text-xs font-semibold text-sky-700 bg-white border border-sky-300 rounded-lg hover:bg-sky-100 transition-colors shrink-0"
                >
                  Baixar Modelo XLSX
                </button>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-sky-600 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                />
                <Upload className="w-10 h-10 text-slate-400 mb-3" />
                <span className="text-sm font-semibold text-slate-800">Clique para selecionar a planilha</span>
                <span className="text-xs text-slate-500 mt-1">Arquivos .xlsx, .xls ou .csv (até 25 MB)</span>
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-2 text-slate-600 py-4 text-sm font-medium">
                  <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
                  Validando estrutura e linhas da planilha...
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Summary counters */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 block">Total de Linhas</span>
                  <span className="text-xl font-bold font-mono tabular-nums text-slate-900">{preview.totalRows}</span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="text-xs text-emerald-700 block">Linhas Válidas</span>
                  <span className="text-xl font-bold font-mono tabular-nums text-emerald-800">{preview.validRowsCount}</span>
                </div>
                <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                  <span className="text-xs text-rose-700 block">Inconsistências</span>
                  <span className="text-xl font-bold font-mono tabular-nums text-rose-800">{preview.errorRowsCount}</span>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <span className="text-xs text-amber-700 block">Duplicidades</span>
                  <span className="text-xl font-bold font-mono tabular-nums text-amber-800">{preview.duplicatesCount}</span>
                </div>
              </div>

              {/* Errors callout */}
              {preview.validationErrors.length > 0 && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg space-y-1">
                  <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Erros de validação encontrados nas linhas:
                  </div>
                  <ul className="text-xs text-rose-700 max-h-24 overflow-y-auto list-disc pl-5 font-mono space-y-0.5">
                    {preview.validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Duplicate Strategy options */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-slate-900 text-xs font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Tratamento de Duplicidades Cadastrais:
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <label className={`p-3 rounded-lg border cursor-pointer transition-colors ${duplicateStrategy === 'replace' ? 'bg-white border-sky-600 ring-1 ring-sky-600 shadow-sm' : 'bg-slate-100/60 border-slate-200'}`}>
                    <input
                      type="radio"
                      name="dup"
                      checked={duplicateStrategy === 'replace'}
                      onChange={() => setDuplicateStrategy('replace')}
                      className="sr-only"
                    />
                    <span className="font-semibold text-slate-900 block">Substituir Existente</span>
                    <span className="text-slate-500 mt-0.5 block text-[11px]">Atualiza os dados mantendo o histórico de auditoria.</span>
                  </label>

                  <label className={`p-3 rounded-lg border cursor-pointer transition-colors ${duplicateStrategy === 'keep_existing' ? 'bg-white border-sky-600 ring-1 ring-sky-600 shadow-sm' : 'bg-slate-100/60 border-slate-200'}`}>
                    <input
                      type="radio"
                      name="dup"
                      checked={duplicateStrategy === 'keep_existing'}
                      onChange={() => setDuplicateStrategy('keep_existing')}
                      className="sr-only"
                    />
                    <span className="font-semibold text-slate-900 block">Manter Existente</span>
                    <span className="text-slate-500 mt-0.5 block text-[11px]">Ignora registros repetidos e importa apenas os novos.</span>
                  </label>

                  <label className={`p-3 rounded-lg border cursor-pointer transition-colors ${duplicateStrategy === 'cancel' ? 'bg-white border-sky-600 ring-1 ring-sky-600 shadow-sm' : 'bg-slate-100/60 border-slate-200'}`}>
                    <input
                      type="radio"
                      name="dup"
                      checked={duplicateStrategy === 'cancel'}
                      onChange={() => setDuplicateStrategy('cancel')}
                      className="sr-only"
                    />
                    <span className="font-semibold text-slate-900 block">Cancelar se Repetido</span>
                    <span className="text-slate-500 mt-0.5 block text-[11px]">Cancela a operação inteira se houver qualquer duplicidade.</span>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Observações da Versão (opcional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Carga mensal de fechamento contábil"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                />
              </div>

              {/* Rows preview table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700">Prévia dos Dados a Gravar (Primeiras Linhas)</div>
                <div className="max-h-56 overflow-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-2 px-3 font-semibold text-slate-700">Linha</th>
                        <th className="py-2 px-3 font-semibold text-slate-700">Status</th>
                        <th className="py-2 px-3 font-semibold text-slate-700">Chave / Identificador</th>
                        <th className="py-2 px-3 font-semibold text-slate-700">Dados</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {preview.rows.slice(0, 15).map((row: any) => (
                        <tr key={row.rowIndex} className={row.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/40'}>
                          <td className="py-2 px-3 text-slate-500 tabular-nums">{row.rowIndex}</td>
                          <td className="py-2 px-3">
                            {row.isValid ? (
                              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Válida
                              </span>
                            ) : (
                              <span className="text-rose-700 font-semibold flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" /> Incorreta
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-800 truncate max-w-xs">{row.key || '—'}</td>
                          <td className="py-2 px-3 text-slate-600 truncate max-w-md">
                            {JSON.stringify(row.data)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          {preview ? (
            <button
              type="button"
              onClick={() => { setPreview(null); setFile(null); }}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Escolher outro arquivo
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
            >
              Cancelar
            </button>

            {preview && (
              <button
                type="button"
                disabled={loading || (preview.validRowsCount === 0 && preview.errorRowsCount > 0)}
                onClick={handleCommit}
                className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirmar Gravação e Gerar Versão
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
