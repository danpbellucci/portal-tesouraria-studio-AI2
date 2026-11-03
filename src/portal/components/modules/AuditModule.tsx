// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  User,
  Shield,
  Eye,
  X
} from 'lucide-react';
import { AuditLog } from '../../types/treasury';
import { ApiClient } from '../../services/api';
import { useToast } from '../common/Toast';
import { formatDateTimeBR } from '../../utils/date';

export const AuditModule: React.FC = () => {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Diff inspection modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (moduleFilter) queryParams.append('module', moduleFilter);
      if (actionFilter) queryParams.append('action', actionFilter);
      if (searchTerm) queryParams.append('search', searchTerm);
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);

      const res = await ApiClient.request(`/api/audit?${queryParams.toString()}`);
      setLogs(res);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [moduleFilter, actionFilter, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs();
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Trilha Global de Auditoria Corporativa</h1>
          <p className="text-xs text-slate-500 mt-1">
            Registro imutável de todas as operações, alterações cadastrais, importações, logins e restaurações do sistema.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Atualizar Logs</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <form onSubmit={handleSearchSubmit} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar em resumos, e-mails ou IDs..."
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
            />
          </div>

          <div>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="">Todos os Módulos</option>
              <option value="companies">Empresas</option>
              <option value="current_accounts">Contas Correntes</option>
              <option value="agreements">Convênios</option>
              <option value="accesses">Acessos Bancários</option>
              <option value="indicators">Indicadores</option>
              <option value="cash_projections">Projeção de Caixa</option>
              <option value="tecban">Controle Tecban</option>
              <option value="loans">Empréstimos</option>
              <option value="holidays">Calendário</option>
              <option value="backups">Backups</option>
              <option value="users">Usuários</option>
              <option value="auth">Autenticação</option>
            </select>
          </div>

          <div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="">Todas as Ações</option>
              <option value="CREATE">Inclusão (CREATE)</option>
              <option value="UPDATE">Alteração (UPDATE)</option>
              <option value="DELETE">Exclusão (DELETE)</option>
              <option value="IMPORT">Importação (IMPORT)</option>
              <option value="BACKUP">Backup (BACKUP)</option>
              <option value="RESTORE">Restauração (RESTORE)</option>
              <option value="LOGIN">Autenticação (LOGIN)</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              className="w-full py-2 px-3 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Aplicar Filtros
            </button>
          </div>
        </div>
      </form>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Histórico de Eventos Auditados</h3>
          <span className="text-xs text-slate-500 font-mono tabular-nums">{logs.length} eventos gravados</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 font-mono">Data e Hora</th>
                <th className="py-3 px-4">Usuário Responsável</th>
                <th className="py-3 px-4">Módulo</th>
                <th className="py-3 px-4 text-center">Operação</th>
                <th className="py-3 px-4">Descrição da Ocorrência</th>
                <th className="py-3 px-4 font-mono">IP Origem</th>
                <th className="py-3 px-4 text-right">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">Carregando logs de auditoria...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">Nenhum evento registrado com os filtros aplicados.</td>
                </tr>
              ) : (
                logs.map((log) => {
                  let badgeClass = 'bg-slate-100 text-slate-700';
                  if (log.action === 'CREATE') badgeClass = 'bg-emerald-50 text-emerald-800 border border-emerald-200';
                  else if (log.action === 'UPDATE') badgeClass = 'bg-sky-50 text-sky-800 border border-sky-200';
                  else if (log.action === 'DELETE') badgeClass = 'bg-rose-50 text-rose-800 border border-rose-200';
                  else if (log.action === 'IMPORT') badgeClass = 'bg-indigo-50 text-indigo-800 border border-indigo-200';
                  else if (log.action === 'RESTORE') badgeClass = 'bg-amber-50 text-amber-800 border border-amber-200';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-800 font-bold whitespace-nowrap">
                        {formatDateTimeBR(log.timestamp)}
                      </td>
                    <td className="py-3 px-4 font-sans font-medium text-slate-800">{log.userEmail}</td>
                    <td className="py-3 px-4 font-sans text-slate-600">{log.module}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeClass}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-700 max-w-md truncate" title={log.summary}>
                      {log.summary}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[10px]">{log.ipAddress || '127.0.0.1'}</td>
                    <td className="py-3 px-4 text-right font-sans">
                      {(log.previousValue || log.newValue) && (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2 py-1 text-slate-600 hover:text-sky-700 font-medium rounded hover:bg-slate-100 transition-colors"
                        >
                          Inspecionar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Diff Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Inspeção Detalhada de Alteração</h3>
                <span className="text-xs text-slate-500 font-mono">
                  {selectedLog.userEmail} · {new Date(selectedLog.timestamp).toLocaleString('pt-BR')}
                </span>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="p-3 bg-slate-50 rounded-lg text-xs font-sans text-slate-800">
                <strong>Resumo:</strong> {selectedLog.summary}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="font-bold text-rose-800 block mb-1">Estado Anterior:</span>
                  <pre className="p-3 bg-slate-950 text-slate-100 rounded-lg text-[10px] font-mono overflow-auto max-h-60">
                    {selectedLog.previousValue ? JSON.stringify(selectedLog.previousValue, null, 2) : 'Nenhum estado prévio (criação)'}
                  </pre>
                </div>
                <div>
                  <span className="font-bold text-emerald-800 block mb-1">Novo Estado Gravado:</span>
                  <pre className="p-3 bg-slate-950 text-slate-100 rounded-lg text-[10px] font-mono overflow-auto max-h-60">
                    {selectedLog.newValue ? JSON.stringify(selectedLog.newValue, null, 2) : 'Nenhum novo estado (exclusão)'}
                  </pre>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
