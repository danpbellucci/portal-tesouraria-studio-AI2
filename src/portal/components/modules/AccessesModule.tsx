// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { useConfirmDialog } from '../common/useConfirmDialog';
import { BulkDeleteBar, CheckCell, useBulkSelect, useIsAdmin } from '../common/BulkDelete';
import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Plus,
  Search,
  Download,
  Upload,
  History,
  FileSpreadsheet,
  Edit2,
  Trash2,
  X,
  Info
} from 'lucide-react';
import { BankAccess, Company, Bank } from '../../types/treasury';
import { ApiClient } from '../../services/api';
import { useToast } from '../common/Toast';
import { ImportModal } from '../common/ImportModal';
import { VersionHistoryModal } from '../common/VersionHistoryModal';

export const AccessesModule: React.FC = () => {
  const { confirm, confirmDialog } = useConfirmDialog();
  const { showToast } = useToast();
  const [accesses, setAccesses] = useState<BankAccess[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Form
  const [editingAccess, setEditingAccess] = useState<BankAccess | null>(null);
  const [companyId, setCompanyId] = useState('');
  const [bankId, setBankId] = useState('');
  const [accessProfile, setAccessProfile] = useState('');
  const [userName, setUserName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accRes, compRes, bankRes] = await Promise.all([
        ApiClient.request('/api/accesses'),
        ApiClient.request('/api/companies'),
        ApiClient.request('/api/banks')
      ]);
      setAccesses(accRes);
      setCompanies(compRes);
      setBanks(bankRes);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingAccess(null);
    setCompanyId(companies[0]?.id || '');
    setBankId(banks[0]?.id || '');
    setAccessProfile('');
    setUserName('');
    setManagerName('');
    setNotes('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (acc: BankAccess) => {
    setEditingAccess(acc);
    setCompanyId(acc.companyId);
    setBankId(acc.bankId);
    setAccessProfile(acc.accessProfile);
    setUserName(acc.userName);
    setManagerName(acc.managerName);
    setNotes(acc.notes || '');
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!(await confirm(`Confirma a exclusão do acesso bancário de ${name}?`))) return;
    try {
      await ApiClient.request(`/api/accesses/${id}`, { method: 'DELETE' });
      showToast('Acesso bancário excluído com sucesso.', 'success');
      await loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        companyId,
        bankId,
        accessProfile,
        userName,
        managerName,
        notes
      };

      if (editingAccess) {
        await ApiClient.request(`/api/accesses/${editingAccess.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('Acesso bancário atualizado com sucesso.', 'success');
      } else {
        await ApiClient.request('/api/accesses', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('Acesso bancário cadastrado com sucesso.', 'success');
      }

      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAccesses = accesses.filter((acc) => {
    const q = searchTerm.toLowerCase();
    return (
      acc.userName.toLowerCase().includes(q) ||
      acc.accessProfile.toLowerCase().includes(q) ||
      acc.managerName.toLowerCase().includes(q) ||
      (acc.company?.tradeName || '').toLowerCase().includes(q) ||
      (acc.bank?.name || '').toLowerCase().includes(q)
    );
  });

  const isAdmin = useIsAdmin();
  const sel = useBulkSelect(filteredAccesses.map((x) => x.id));

  return (
    <>
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Gestão de Acessos Bancários</h1>
          <p className="text-xs text-slate-500 mt-1">
            Controle cadastral de colaboradores que possuem acesso aos portais bancários e contas da Elo Participações.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => ApiClient.downloadFile('/api/spreadsheets/template/accesses', 'modelo_acessos_bancarios.xlsx')}
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
            onClick={() => ApiClient.downloadFile('/api/spreadsheets/export/accesses', 'acessos_bancarios_elo.xlsx')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Exportar XLSX</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Acesso Bancário</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por nome do usuário, perfil, gestor, banco ou empresa..."
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
          />
        </div>
        <div className="text-xs font-mono tabular-nums text-slate-500">
          {filteredAccesses.length} acessos inventariados
        </div>
      </div>

      {/* Table */}
      {isAdmin && <BulkDeleteBar sel={sel} urlFor={(id) => `/api/accesses/${id}`} onDone={loadData} onError={(m) => showToast(m, 'error')} onSuccess={(m) => showToast(m, 'success')} />}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
            {isAdmin && <CheckCell header checked={sel.allChecked} onChange={sel.toggleAll} title="Selecionar todos" />}
              <th className="py-3 px-4">Nome do Usuário</th>
              <th className="py-3 px-4">Perfil de Acesso</th>
              <th className="py-3 px-4">Empresa</th>
              <th className="py-3 px-4">Instituição Bancária</th>
              <th className="py-3 px-4">Gestor Responsável</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  Carregando acessos bancários...
                </td>
              </tr>
            ) : filteredAccesses.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  Nenhum acesso bancário localizado.
                </td>
              </tr>
            ) : (
              filteredAccesses.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50/70 transition-colors">
                  {isAdmin && <CheckCell checked={sel.isSelected(acc.id)} onChange={() => sel.toggle(acc.id)} title="Selecionar" />}
                  <td className="py-3 px-4 font-bold text-slate-900">{acc.userName}</td>
                  <td className="py-3 px-4 text-sky-800 font-semibold">
                    <span className="bg-sky-50 border border-sky-200 px-2 py-0.5 rounded text-[11px]">
                      {acc.accessProfile}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-800 font-medium">{acc.company?.tradeName || (/^(comp_|companies_)/.test(String(acc.companyId || '')) ? <span className="text-rose-600" title="A empresa vinculada foi excluída. Edite o registro para escolher a empresa correta.">Empresa não localizada</span> : acc.companyId)}</td>
                  <td className="py-3 px-4 text-slate-600">
                    {acc.bank ? `${acc.bank.code} - ${acc.bank.name}` : acc.bankId}
                  </td>
                  <td className="py-3 px-4 text-slate-700">{acc.managerName || '—'}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(acc)}
                        className="p-1 text-slate-500 hover:text-sky-700 rounded"
                        title="Editar Acesso"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {isAdmin && (
                      <button
                        onClick={() => handleDelete(acc.id, acc.userName)}
                        className="p-1 text-slate-500 hover:text-rose-700 rounded"
                        title="Excluir Acesso"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingAccess ? 'Editar Acesso Bancário' : 'Cadastrar Novo Acesso Bancário'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Empresa *</label>
                <select
                  required
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600 bg-white"
                >
                  <option value="">Selecione a empresa...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.tradeName} ({c.cnpj})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Instituição Bancária *</label>
                <select
                  required
                  value={bankId}
                  onChange={(e) => setBankId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600 bg-white"
                >
                  <option value="">Selecione o banco...</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} - {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Nome do Usuário com Acesso *</label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Ex: Mariana Silveira"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Perfil de Acesso no Banco (campo livre) *
                </label>
                <input
                  type="text"
                  required
                  value={accessProfile}
                  onChange={(e) => setAccessProfile(e.target.value)}
                  placeholder="Ex: Master, Consulta Geral, Aprovador Nível 2, Operador VAN"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Informe o perfil exatamente como configurado no portal do banco.
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Gestor do Usuário</label>
                <input
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="Ex: Carlos Silva"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Observações</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Certificado digital e-CNPJ modelo A3 instalado na máquina da tesouraria"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
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
                  {submitting ? 'Salvando...' : 'Salvar Acesso'}
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
        moduleKey="accesses"
        moduleTitle="Acessos Bancários"
        onSuccess={loadData}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        moduleKey="accesses"
        moduleTitle="Acessos Bancários"
      />
    </div>
      {confirmDialog}
    </>
  );
};
