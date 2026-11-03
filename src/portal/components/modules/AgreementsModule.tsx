// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { useConfirmDialog } from '../common/useConfirmDialog';
import { BulkDeleteBar, CheckCell, useBulkSelect, useIsAdmin } from '../common/BulkDelete';
import React, { useState, useEffect } from 'react';
import {
  Handshake,
  Plus,
  Search,
  Download,
  Upload,
  History,
  FileSpreadsheet,
  Edit2,
  Trash2,
  X
} from 'lucide-react';
import { BankAgreement, Company, Bank, CurrentAccount } from '../../types/treasury';
import { ApiClient } from '../../services/api';
import { useToast } from '../common/Toast';
import { ImportModal } from '../common/ImportModal';
import { VersionHistoryModal } from '../common/VersionHistoryModal';

export const AgreementsModule: React.FC = () => {
  const { confirm, confirmDialog } = useConfirmDialog();
  const { showToast } = useToast();
  const [agreements, setAgreements] = useState<BankAgreement[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [currentAccounts, setCurrentAccounts] = useState<CurrentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Form
  const [editingAgreement, setEditingAgreement] = useState<BankAgreement | null>(null);
  const [companyId, setCompanyId] = useState('');
  const [bankId, setBankId] = useState('');
  const [currentAccountId, setCurrentAccountId] = useState('');
  const [agreementType, setAgreementType] = useState('');
  const [agreementCode, setAgreementCode] = useState('');
  const [managerName, setManagerName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [agrRes, compRes, bankRes, accRes] = await Promise.all([
        ApiClient.request('/api/agreements'),
        ApiClient.request('/api/companies'),
        ApiClient.request('/api/banks'),
        ApiClient.request('/api/current-accounts')
      ]);
      setAgreements(agrRes);
      setCompanies(compRes);
      setBanks(bankRes);
      setCurrentAccounts(accRes);
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
    setEditingAgreement(null);
    setCompanyId(companies[0]?.id || '');
    setBankId(banks[0]?.id || '');
    setCurrentAccountId('');
    setAgreementType('PAGFOR');
    setAgreementCode('');
    setManagerName('');
    setNotes('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (agr: BankAgreement) => {
    setEditingAgreement(agr);
    setCompanyId(agr.companyId);
    setBankId(agr.bankId);
    setCurrentAccountId(agr.currentAccountId || '');
    setAgreementType(agr.agreementType);
    setAgreementCode(agr.agreementCode);
    setManagerName(agr.managerName);
    setNotes(agr.notes || '');
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string, code: string) => {
    if (!(await confirm(`Confirma a exclusão do convênio ${code}?`))) return;
    try {
      await ApiClient.request(`/api/agreements/${id}`, { method: 'DELETE' });
      showToast('Convênio excluído com sucesso.', 'success');
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
        currentAccountId,
        agreementType,
        agreementCode,
        managerName,
        notes
      };

      if (editingAgreement) {
        await ApiClient.request(`/api/agreements/${editingAgreement.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('Convênio atualizado com sucesso.', 'success');
      } else {
        await ApiClient.request('/api/agreements', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('Convênio cadastrado com sucesso.', 'success');
      }

      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAgreements = agreements.filter((agr) => {
    const q = searchTerm.toLowerCase();
    return (
      agr.agreementCode.toLowerCase().includes(q) ||
      agr.agreementType.toLowerCase().includes(q) ||
      agr.managerName.toLowerCase().includes(q) ||
      (agr.company?.tradeName || '').toLowerCase().includes(q) ||
      (agr.bank?.name || '').toLowerCase().includes(q)
    );
  });

  const isAdmin = useIsAdmin();
  const sel = useBulkSelect(filteredAgreements.map((x) => x.id));

  return (
    <>
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Gestão de Convênios Bancários</h1>
          <p className="text-xs text-slate-500 mt-1">
            Controle de convênios de cobrança, pagamentos, custódia e serviços mantidos com as instituições financeiras.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => ApiClient.downloadFile('/api/spreadsheets/template/agreements', 'modelo_convenios_bancarios.xlsx')}
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
            onClick={() => ApiClient.downloadFile('/api/spreadsheets/export/agreements', 'convenios_bancarios_elo.xlsx')}
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
            <span>Novo Convênio</span>
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
            placeholder="Pesquisar por código, tipo de convênio, gestor ou banco..."
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
          />
        </div>
        <div className="text-xs font-mono tabular-nums text-slate-500">
          {filteredAgreements.length} convênios cadastrados
        </div>
      </div>

      {/* Table */}
      {isAdmin && <BulkDeleteBar sel={sel} urlFor={(id) => `/api/agreements/${id}`} onDone={loadData} onError={(m) => showToast(m, 'error')} onSuccess={(m) => showToast(m, 'success')} />}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
            {isAdmin && <CheckCell header checked={sel.allChecked} onChange={sel.toggleAll} title="Selecionar todos" />}
              <th className="py-3 px-4">Código do Convênio</th>
              <th className="py-3 px-4">Tipo de Convênio</th>
              <th className="py-3 px-4">Conta Corrente</th>
              <th className="py-3 px-4">Empresa</th>
              <th className="py-3 px-4">Banco</th>
              <th className="py-3 px-4">Gestor Responsável</th>
              <th className="py-3 px-4">Observações</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400">
                  Carregando convênios bancários...
                </td>
              </tr>
            ) : filteredAgreements.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400">
                  Nenhum convênio bancário localizado.
                </td>
              </tr>
            ) : (
              filteredAgreements.map((agr) => (
                <tr key={agr.id} className="hover:bg-slate-50/70 transition-colors">
                  {isAdmin && <CheckCell checked={sel.isSelected(agr.id)} onChange={() => sel.toggle(agr.id)} title="Selecionar" />}
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{agr.agreementCode}</td>
                  <td className="py-3 px-4 text-slate-700 font-medium">{agr.agreementType === 'PAGFOR' ? 'Pagfor' : agr.agreementType === 'COBRANCA' ? 'Cobrança' : 'Outros'}</td>
                  <td className="py-3 px-4 font-mono text-xs">{agr.currentAccount ? `${agr.currentAccount.agency} / ${agr.currentAccount.accountNumber}` : agr.currentAccountId || '—'}</td>
                  <td className="py-3 px-4 text-slate-800 font-semibold">{agr.company?.tradeName || (/^(comp_|companies_)/.test(String(agr.companyId || '')) ? <span className="text-rose-600" title="A empresa vinculada foi excluída. Edite o registro para escolher a empresa correta.">Empresa não localizada</span> : agr.companyId)}</td>
                  <td className="py-3 px-4 text-slate-600">
                    {agr.bank ? `${agr.bank.code} - ${agr.bank.name}` : agr.bankId}
                  </td>
                  <td className="py-3 px-4 text-slate-700">{agr.managerName || '—'}</td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs whitespace-pre-wrap break-words">{agr.notes || '—'}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(agr)}
                        className="p-1 text-slate-500 hover:text-sky-700 rounded"
                        title="Editar Convênio"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {isAdmin && (
                      <button
                        onClick={() => handleDelete(agr.id, agr.agreementCode)}
                        className="p-1 text-slate-500 hover:text-rose-700 rounded"
                        title="Excluir Convênio"
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
                {editingAgreement ? 'Editar Convênio Bancário' : 'Cadastrar Novo Convênio'}
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
                  onChange={(e) => { setCompanyId(e.target.value); setCurrentAccountId(''); }}
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
                  onChange={(e) => { setBankId(e.target.value); setCurrentAccountId(''); }}
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
                <label className="text-xs font-semibold text-slate-700 block mb-1">Conta Corrente *</label>
                <select required value={currentAccountId} onChange={(e) => setCurrentAccountId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white">
                  <option value="">Selecione a conta corrente...</option>
                  {currentAccounts.filter((a) => a.companyId === companyId && a.bankId === bankId).map((a) => (
                    <option key={a.id} value={a.id}>{a.agency} / {a.accountNumber}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Tipo de Convênio *</label>
                <select required value={agreementType} onChange={(e) => setAgreementType(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white">
                  <option value="PAGFOR">Pagfor</option>
                  <option value="COBRANCA">Cobrança</option>
                  <option value="OUTROS">Outros</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Código do Convênio (preserva zeros) *</label>
                <input
                  type="text"
                  required
                  value={agreementCode}
                  onChange={(e) => setAgreementCode(e.target.value)}
                  placeholder="Ex: 00987654-01"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-sky-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Gestor do Convênio</label>
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
                  placeholder="Ex: Contrato assinado com vigência indeterminada"
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
                  {submitting ? 'Salvando...' : 'Salvar Convênio'}
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
        moduleKey="agreements"
        moduleTitle="Convênios Bancários"
        onSuccess={loadData}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        moduleKey="agreements"
        moduleTitle="Convênios Bancários"
      />
    </div>
      {confirmDialog}
    </>
  );
};
