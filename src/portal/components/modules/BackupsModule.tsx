// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  Download,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Clock,
  HardDrive
} from 'lucide-react';
import { ApiClient } from '../../services/api';
import { useToast } from '../common/Toast';
import { useAuth } from '../../context/AuthContext';
import { formatDateTimeBR } from '../../utils/date';

interface BackupItem {
  id: string;
  filename: string;
  createdAt: string;
  sizeBytes: number;
  filesCount: number;
  checksum: string;
  notes?: string;
  isAutoPreRestore?: boolean;
}

export const BackupsModule: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [notes, setNotes] = useState('');

  // Restore confirm modal
  const [targetBackup, setTargetBackup] = useState<BackupItem | null>(null);
  const [restoring, setRestoring] = useState(false);

  const loadBackups = async () => {
    try {
      setLoading(true);
      const res = await ApiClient.request('/api/backups');
      setBackups(res);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      await ApiClient.request('/api/backups/create', {
        method: 'POST',
        body: JSON.stringify({ notes: notes || 'Backup manual solicitado pelo administrador' })
      });
      showToast('Backup do Portal Tesouraria gerado com sucesso.', 'success');
      setNotes('');
      loadBackups();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = (id: string) => {
    ApiClient.downloadFile(`/api/backups/${id}/download`, `${id}.json`);
  };

  const handleConfirmRestore = async () => {
    if (!targetBackup) return;
    setRestoring(true);
    try {
      const res = await ApiClient.request(`/api/backups/${targetBackup.id}/restore`, {
        method: 'POST'
      });
      showToast(
        `Restauração concluída! ${res.restoredFiles} arquivos restaurados. Snapshot de segurança gerado: ${res.preRestoreBackupId}`,
        'success'
      );
      setTargetBackup(null);
      loadBackups();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Backups & Recuperação de Desastres</h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestão local de cópias de segurança de todos os dados JSON persistentes. Gravação atômica e snapshot pré-restauração.
          </p>
        </div>

        <button
          onClick={loadBackups}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Atualizar Lista</span>
        </button>
      </div>

      {/* Corporate Storage Guidance */}
      <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <HardDrive className="w-6 h-6 text-sky-400 shrink-0" />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-sky-300">
              Armazenamento Local Corporativo
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Os backups contêm todos os arquivos da pasta <code className="text-sky-400 font-mono text-[11px]">/data/</code> e são validados com checksum SHA-256.
            </p>
          </div>
        </div>
      </div>

      {/* Create Backup Box */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Gerar Novo Backup Sob Demanda</h3>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Identificação do motivo do backup (ex: Antes do fechamento contábil de outubro)"
            className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
          />
          <button
            onClick={handleCreateBackup}
            disabled={creating}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shrink-0"
          >
            {creating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{creating ? 'Gerando Snapshot...' : 'Criar Backup Agora'}</span>
          </button>
        </div>
      </div>

      {/* Backups List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Cópias de Segurança Disponíveis no Servidor</h3>
          <span className="text-xs text-slate-500 font-mono tabular-nums">{backups.length} snapshots</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 font-mono">Data e Hora</th>
                <th className="py-3 px-4">Identificação / Motivo</th>
                <th className="py-3 px-4 text-center">Coleções</th>
                <th className="py-3 px-4 text-right font-mono">Tamanho</th>
                <th className="py-3 px-4 font-mono">Checksum SHA-256</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">Carregando backups...</td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">Nenhum backup encontrado.</td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {formatDateTimeBR(b.createdAt)}
                    </td>
                  <td className="py-3 px-4 font-sans text-slate-700">
                    {b.isAutoPreRestore && (
                      <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded mr-1.5">
                        Pré-Restauração
                      </span>
                    )}
                    {b.notes || b.filename}
                  </td>
                  <td className="py-3 px-4 text-center tabular-nums text-slate-800 font-bold">
                    {b.filesCount} arquivos
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-slate-600">
                    {(b.sizeBytes / 1024).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} KB
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-[10px] truncate max-w-[140px]" title={b.checksum}>
                    {b.checksum.substring(0, 16)}...
                  </td>
                  <td className="py-3 px-4 text-right font-sans">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleDownload(b.id)}
                        className="px-2 py-1 text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors flex items-center gap-1 font-semibold"
                        title="Baixar arquivo JSON de backup"
                      >
                        <Download className="w-3 h-3 text-slate-500" />
                        <span>Baixar</span>
                      </button>

                      <button
                        onClick={() => setTargetBackup(b)}
                        className="px-2 py-1 text-rose-700 hover:text-rose-800 bg-rose-50 border border-rose-200 rounded hover:bg-rose-100 transition-colors flex items-center gap-1 font-semibold"
                        title="Restaurar este backup"
                      >
                        <RotateCcw className="w-3 h-3 text-rose-600" />
                        <span>Restaurar</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Confirmation Modal for Restore */}
      {targetBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">Confirmar Restauração de Backup</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Você está prestes a restaurar a base de dados do Portal Tesouraria para o estado de{' '}
              <strong className="text-slate-900 font-mono">
                {formatDateTimeBR(targetBackup.createdAt)}
              </strong>.
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              <strong className="font-semibold block mb-0.5">Procedimento de Segurança Obrigatório:</strong>
              Um novo backup de segurança automático será gerado imediatamente antes da restauração para evitar qualquer perda acidental de dados.
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setTargetBackup(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={restoring}
                onClick={handleConfirmRestore}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-700 rounded-lg hover:bg-rose-800 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {restoring && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{restoring ? 'Restaurando...' : 'Confirmar e Restaurar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
