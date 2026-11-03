// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import React, { useRef, useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  History,
  GitCompare,
  Building2,
  CreditCard,
  Handshake,
  KeyRound,
  TrendingUp,
  DollarSign,
  Cpu,
  CalendarDays
} from 'lucide-react';
import { ApiClient } from '../../services/api';
import { ImportModal } from '../common/ImportModal';
import { VersionHistoryModal } from '../common/VersionHistoryModal';
import { useToast } from '../common/Toast';

interface ConsolidatedImportResult {
  moduleKey: string;
  title: string;
  status: 'empty' | 'ready' | 'invalid' | 'error';
  totalRows: number;
  validRowsCount: number;
  errorRowsCount: number;
  validationErrors: string[];
  sampleRows: Array<{ data: Record<string, unknown> }>;
  error?: string;
}

export const SpreadsheetsCentralModule: React.FC = () => {
  const { showToast } = useToast();
  const allModelsInputRef = useRef<HTMLInputElement>(null);
  const [activeImportKey, setActiveImportKey] = useState<string | null>(null);
  const [activeHistoryKey, setActiveHistoryKey] = useState<string | null>(null);
  const [allModelsFile, setAllModelsFile] = useState<File | null>(null);
  const [allModelsResults, setAllModelsResults] = useState<ConsolidatedImportResult[]>([]);
  const [allModelsLoading, setAllModelsLoading] = useState(false);

  const modulesList = [
    {
      key: 'companies',
      title: 'Empresas & Diretores',
      desc: 'Cadastro de CNPJ, Razão Social, Nome Fantasia e Diretores Estatutários vinculados.',
      icon: Building2
    },
    {
      key: 'current_accounts',
      title: 'Contas Correntes',
      desc: 'Contas bancárias, agências com zeros preservados, intraday, aplicação automática e tombamento.',
      icon: CreditCard
    },
    {
      key: 'agreements',
      title: 'Convênios Bancários',
      desc: 'Códigos de convênio com caracteres especiais preservados, tipos de convênio e gestores.',
      icon: Handshake
    },
    {
      key: 'accesses',
      title: 'Acessos Bancários',
      desc: 'Usuários dos portais bancários corporativos e perfis livres de autorização.',
      icon: KeyRound
    },
    {
      key: 'indicators',
      title: 'Indicadores & Curva CDI',
      desc: 'Taxas CDI anualizadas realizadas/projetadas e cotas diárias de todos os fundos de investimento.',
      icon: TrendingUp
    },
    {
      key: 'cash_projections',
      title: 'Projeção de Caixa',
      desc: 'Saldos, entradas e saídas reais versus projetadas. Saldo projetado preservado verbatim.',
      icon: DollarSign
    },
    {
      key: 'tecban',
      title: 'Controle Tecban',
      desc: 'Movimentações de saques, recargas e saldos diários da rede de terminais Tecban.',
      icon: Cpu
    },
    {
      key: 'tariffs',
      title: 'Mapa de Tarifas',
      desc: 'Tarifas bancárias por empresa, banco e conta corrente, com valor unitário e validade.',
      icon: CreditCard
    },
    {
      key: 'holidays',
      title: 'Calendário Financeiro',
      desc: 'Feriados bancários oficiais (FEBRABAN), estaduais e municipais para contagem de 252 dias úteis.',
      icon: CalendarDays
    }
  ];

  const handleDownloadTemplate = (key: string) => {
    ApiClient.downloadFile(`/api/spreadsheets/template/${key}`, `modelo_${key}.xlsx`);
  };

  const handleDownloadAllTemplates = () => {
    ApiClient.downloadFile('/api/spreadsheets/templates/all', 'todos_os_modelos.xlsx');
  };

  const handleExportData = (key: string) => {
    ApiClient.downloadFile(`/api/spreadsheets/export/${key}`, `export_${key}_${Date.now()}.xlsx`);
  };

  const handleAllModelsFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAllModelsLoading(true);
    try {
      const results = await Promise.all(modulesList.map(async (module): Promise<ConsolidatedImportResult> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sheetName', module.key);
        try {
          const result = await ApiClient.request<any>(`/api/spreadsheets/preview/${module.key}`, { method: 'POST', body: formData });
          if (!result.totalRows) {
            return { moduleKey: module.key, title: module.title, status: 'empty', totalRows: 0, validRowsCount: 0, errorRowsCount: 0, validationErrors: [], sampleRows: [] };
          }
          return {
            moduleKey: module.key,
            title: module.title,
            status: result.errorRowsCount ? 'invalid' : 'ready',
            totalRows: result.totalRows,
            validRowsCount: result.validRowsCount,
            errorRowsCount: result.errorRowsCount,
            validationErrors: result.validationErrors || [],
            sampleRows: result.rows || []
          };
        } catch (error: any) {
          const message = error.message || 'Não foi possível ler esta aba.';
          const isEmpty = message.includes('não contém dados legíveis');
          return { moduleKey: module.key, title: module.title, status: isEmpty ? 'empty' : 'error', totalRows: 0, validRowsCount: 0, errorRowsCount: 0, validationErrors: [], sampleRows: [], error: isEmpty ? undefined : message };
        }
      }));
      const readyCount = results.filter((result) => result.status === 'ready').length;
      const issueCount = results.filter((result) => result.status === 'invalid' || result.status === 'error').length;
      setAllModelsFile(file);
      setAllModelsResults(results);
      showToast(issueCount ? `${issueCount} aba(s) precisam de correção antes da importação.` : readyCount ? `${readyCount} aba(s) prontas para importar.` : 'Nenhuma aba preenchida foi encontrada.', issueCount ? 'error' : readyCount ? 'info' : 'error');
    } finally {
      setAllModelsLoading(false);
    }
  };

  const handleAllModelsImport = async () => {
    const populatedSheets = allModelsResults.filter((result) => result.status !== 'empty' && result.status !== 'error');
    if (!allModelsFile || !populatedSheets.length) return;
    setAllModelsLoading(true);
    try {
      let insertedCount = 0;
      let updatedCount = 0;
      let rejectedCount = 0;
      for (const sheet of populatedSheets) {
        const formData = new FormData();
        formData.append('file', allModelsFile);
        formData.append('sheetName', sheet.moduleKey);
        formData.append('duplicateStrategy', 'replace');
        formData.append('notes', 'Importação via Todos os modelos');
        const response = await ApiClient.request<any>(`/api/spreadsheets/commit/${sheet.moduleKey}`, { method: 'POST', body: formData });
        insertedCount += response.summary?.insertedCount || 0;
        updatedCount += response.summary?.updatedCount || 0;
        rejectedCount += response.summary?.rejectedCount || 0;
      }
      showToast(`Importação concluída: ${insertedCount} incluído(s), ${updatedCount} atualizado(s), ${rejectedCount} rejeitado(s) em ${populatedSheets.length} aba(s).`, rejectedCount ? 'info' : 'success');
      setAllModelsFile(null);
      setAllModelsResults([]);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setAllModelsLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Central Unificada de Planilhas (XLSX & CSV)</h1>
        <p className="text-xs text-slate-500 mt-1">
          Ponto central para download de modelos oficiais, carga de dados com pré-validação, controle de duplicidades e comparação histórica de versões.
        </p>
      </div>

      <section className="bg-gradient-to-r from-sky-700 to-sky-600 p-5 rounded-xl shadow-sm text-white">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold">Todos os modelos</h2>
            <p className="text-xs text-sky-100 mt-0.5 leading-relaxed">Baixe um único arquivo XLSX com uma aba para cada módulo importável, usando os mesmos cabeçalhos e exemplos dos modelos individuais.</p>
          </div>
        </div>
          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={() => allModelsInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-white/15 hover:bg-white/25 border border-white/25 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              Importar
            </button>
            <input ref={allModelsInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleAllModelsFile} />
            <button
              onClick={handleDownloadAllTemplates}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-sky-800 bg-white hover:bg-sky-50 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Baixar todos os modelos
            </button>
          </div>
        </div>
        {allModelsFile && (
          <div className="mt-4 pt-4 border-t border-white/20">
            <p className="text-xs font-semibold text-sky-50">{allModelsLoading ? 'Validando as abas da planilha...' : 'Resultado da validação por aba'}</p>
            {!allModelsLoading && <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {allModelsResults.map((result) => (
                <div key={result.moduleKey} className={`rounded-lg border p-3 text-xs ${result.status === 'ready' ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : result.status === 'empty' ? 'bg-white/10 border-white/20 text-sky-50' : 'bg-rose-50 border-rose-200 text-rose-950'}`}>
                  <p className="font-bold">{result.title}</p>
                  {result.status === 'ready' && <p className="mt-1">{result.totalRows} registro(s) serão carregados.</p>}
                  {result.status === 'empty' && <p className="mt-1">Aba sem dados. Nenhum registro será carregado.</p>}
                  {result.status === 'invalid' && <p className="mt-1">{result.validRowsCount} válido(s), {result.errorRowsCount} com inconsistência(s). A aba será revalidada após as abas-base serem carregadas.</p>}
                  {result.status === 'error' && <p className="mt-1">{result.error}</p>}
                  {result.sampleRows.length > 0 && <p className="mt-1 truncate" title={JSON.stringify(result.sampleRows[0].data)}>Prévia: {Object.values(result.sampleRows[0].data).filter(Boolean).slice(0, 2).join(' · ')}</p>}
                  {result.validationErrors[0] && <p className="mt-1 text-rose-700">{result.validationErrors[0]}</p>}
                </div>
              ))}
            </div>}
            {!allModelsLoading && allModelsResults.some((result) => result.status === 'ready' || result.status === 'invalid') && !allModelsResults.some((result) => result.status === 'error') && <button onClick={handleAllModelsImport} className="mt-3 px-3 py-2 text-xs font-bold text-sky-800 bg-white hover:bg-sky-50 rounded-lg">Confirmar importação das abas preenchidas</button>}
          </div>
        )}
      </section>

      {/* Grid of Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modulesList.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.key}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{m.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{m.desc}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadTemplate(m.key)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded font-medium transition-colors"
                    title="Baixar modelo com cabeçalhos oficiais e linhas de exemplo"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Modelo</span>
                  </button>

                  <button
                    onClick={() => setActiveImportKey(m.key)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded font-medium transition-colors"
                    title="Carregar planilha com validação prévia"
                  >
                    <Upload className="w-3.5 h-3.5 text-sky-600" />
                    <span>Importar</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveHistoryKey(m.key)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded font-medium transition-colors"
                    title="Comparar versões de importação anteriores"
                  >
                    <History className="w-3.5 h-3.5 text-slate-500" />
                    <span>Versões</span>
                  </button>

                  <button
                    onClick={() => handleExportData(m.key)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded font-medium transition-colors"
                    title="Exportar base de dados atualizada para XLSX"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Exportar</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Universal Import Modal */}
      {activeImportKey && (
        <ImportModal
          isOpen={true}
          onClose={() => setActiveImportKey(null)}
          moduleKey={activeImportKey}
          moduleTitle={modulesList.find((m) => m.key === activeImportKey)?.title || activeImportKey}
          onSuccess={() => {}}
        />
      )}

      {/* Version History Modal */}
      {activeHistoryKey && (
        <VersionHistoryModal
          isOpen={true}
          onClose={() => setActiveHistoryKey(null)}
          moduleKey={activeHistoryKey}
          moduleTitle={modulesList.find((m) => m.key === activeHistoryKey)?.title || activeHistoryKey}
        />
      )}
    </div>
  );
};
