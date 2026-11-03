// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { useConfirmDialog } from '../common/useConfirmDialog';
import { BulkDeleteBar, CheckCell, useBulkSelect, useIsAdmin } from '../common/BulkDelete';
import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Download,
  Upload,
  History,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Check,
  X,
  Filter
} from 'lucide-react';
import { CurrentAccount, Company, Bank } from '../../types/treasury';
import { ApiClient } from '../../services/api';
import { useToast } from '../common/Toast';
import { ImportModal } from '../common/ImportModal';
import { VersionHistoryModal } from '../common/VersionHistoryModal';

export const AccountsModule: React.FC = () => {
  const { confirm, confirmDialog } = useConfirmDialog();
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<CurrentAccount[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIntraday, setFilterIntraday] = useState<'ALL' | 'YES' | 'NO'>('ALL');
  const [filterAutoInvest, setFilterAutoInvest] = useState<'ALL' | 'YES' | 'NO'>('ALL');
  const [filterSweeping, setFilterSweeping] = useState<'ALL' | 'YES' | 'NO'>('ALL');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Form
  const [editingAccount, setEditingAccount] = useState<CurrentAccount | null>(null);
  const [companyId, setCompanyId] = useState('');
  const [bankId, setBankId] = useState('');
  const [agency, setAgency] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [hasIntradayLimit, setHasIntradayLimit] = useState(false);
  const [intradayLimitAmount, setIntradayLimitAmount] = useState('');
  const [hasAutoInvestment, setHasAutoInvestment] = useState(false);
  const [hasSweeping, setHasSweeping] = useState(false);
  const [sweepingDestinationAccount, setSweepingDestinationAccount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accRes, compRes, bankRes] = await Promise.all([
        ApiClient.request('/api/current-accounts'),
        ApiClient.request('/api/companies'),
        ApiClient.request('/api/banks')
      ]);
      setAccounts(accRes);
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
    setEditingAccount(null);
    setCompanyId(companies[0]?.id || '');
    setBankId(banks[0]?.id || '');
    setAgency('');
    setAccountNumber('');
    setHasIntradayLimit(false);
    setIntradayLimitAmount('');
    setHasAutoInvestment(false);
    setHasSweeping(false);
    setSweepingDestinationAccount('');
    setNotes('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (acc: CurrentAccount) => {
    setEditingAccount(acc);
    setCompanyId(acc.companyId);
    setBankId(acc.bankId);
    setAgency(acc.agency);
    setAccountNumber(acc.accountNumber);
    setHasIntradayLimit(acc.hasIntradayLimit);
    setIntradayLimitAmount(acc.intradayLimitAmount || '');
    setHasAutoInvestment(acc.hasAutoInvestment);
    setHasSweeping(acc.hasSweeping);
    setSweepingDestinationAccount(acc.sweepingDestinationAccount || '');
    setNotes(acc.notes || '');
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string, accNum: string) => {
    if (!(await confirm(`Confirma a exclusão da conta corrente ${accNum}?`))) return;
    try {
      await ApiClient.request(`/api/current-accounts/${id}`, { method: 'DELETE' });
      showToast('Conta corrente excluída.', 'success');
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
        agency,
        accountNumber,
        hasIntradayLimit,
        intradayLimitAmount: hasIntradayLimit ? intradayLimitAmount : '',
        hasAutoInvestment,
        hasSweeping,
        sweepingDestinationAccount: hasSweeping ? sweepingDestinationAccount : '',
        notes
      };

      if (editingAccount) {
        await ApiClient.request(`/api/current-accounts/${editingAccount.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('Conta corrente atualizada com sucesso.', 'success');
      } else {
        await ApiClient.request('/api/current-accounts', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('Conta corrente cadastrada com sucesso.', 'success');
      }

      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAccounts = accounts.filter((acc) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      acc.agency.includes(q) ||
      acc.accountNumber.includes(q) ||
      (acc.company?.tradeName || '').toLowerCase().includes(q) ||
      (acc.bank?.name || '').toLowerCase().includes(q) ||
      (acc.bank?.code || '').includes(q);

    const matchIntraday =
      filterIntraday === 'ALL' ||
      (filterIntraday === 'YES' && acc.hasIntradayLimit) ||
      (filterIntraday === 'NO' && !acc.hasIntradayLimit);

    const matchAutoInvest =
      filterAutoInvest === 'ALL' ||
      (filterAutoInvest === 'YES' && acc.hasAutoInvestment) ||
      (filterAutoInvest === 'NO' && !acc.hasAutoInvestment);

    const matchSweeping =
      filterSweeping === 'ALL' ||
      (filterSweeping === 'YES' && acc.hasSweeping) ||
      (filterSweeping === 'NO' && !acc.hasSweeping);

    return matchSearch && matchIntraday && matchAutoInvest && matchSweeping;
  });

  const isAdmin = useIsAdmin();
  const sel = useBulkSelect(filteredAccounts.map((x) => x.id));

  return (
    <>
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Gestão de Contas Correntes</h1>
          <p className="text-xs text-slate-500 mt-1">
            Controle analítico das contas bancárias das empresas, agências com zeros preservados e indicadores operacionais.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => ApiClient.downloadFile('/api/spreadsheets/template/current_accounts', 'modelo_contas_correntes.xlsx')}
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
            onClick={() => ApiClient.downloadFile('/api/spreadsheets/export/current_accounts', 'contas_correntes_elo.xlsx')}
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
            <span>Nova Conta Corrente</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar por agência, conta, banco ou empresa..."
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <span className="font-semibold">Intraday:</span>
              <select
                value={filterIntraday}
                onChange={(e: any) => setFilterIntraday(e.target.value)}
                className="text-xs px-2 py-1 border border-slate-200 rounded bg-slate-50"
              >
                <option value="ALL">Todos</option>
                <option value="YES">Sim</option>
                <option value="NO">Não</option>
              </select>
            </div>

            <div className="flex items-center gap-1 text-xs text-slate-600">
              <span className="font-semibold">Apl. Auto:</span>
              <select
                value={filterAutoInvest}
                onChange={(e: any) => setFilterAutoInvest(e.target.value)}
                className="text-xs px-2 py-1 border border-slate-200 rounded bg-slate-50"
              >
                <option value="ALL">Todos</option>
                <option value="YES">Sim</option>
                <option value="NO">Não</option>
              </select>
            </div>

            <div className="flex items-center gap-1 text-xs text-slate-600">
              <span className="font-semibold">Tombamento:</span>
              <select
                value={filterSweeping}
                onChange={(e: any) => setFilterSweeping(e.target.value)}
                className="text-xs px-2 py-1 border border-slate-200 rounded bg-slate-50"
              >
                <option value="ALL">Todos</option>
                <option value="YES">Sim</option>
                <option value="NO">Não</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      {isAdmin && <BulkDeleteBar sel={sel} urlFor={(id) => `/api/current-accounts/${id}`} onDone={loadData} onError={(m) => showToast(m, 'error')} onSuccess={(m) => showToast(m, 'success')} />}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
            {isAdmin && <CheckCell header checked={sel.allChecked} onChange={sel.toggleAll} title="Selecionar todos" />}
              <th className="py-3 px-4">Empresa</th>
              <th className="py-3 px-4">Banco</th>
              <th className="py-3 px-4 font-mono">Agência</th>
              <th className="py-3 px-4 font-mono">Conta Corrente</th>
              <th className="py-3 px-4 text-center">Intraday</th>
              <th className="py-3 px-4 text-center">Apl. Automática</th>
              <th className="py-3 px-4 text-center">Tombamento</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400">
                  Carregando contas correntes...
                </td>
              </tr>
            ) : filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400">
                  Nenhuma conta corrente localizada.
                </td>
              </tr>
            ) : (
              filteredAccounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50/70 transition-colors">
                  {isAdmin && <CheckCell checked={sel.isSelected(acc.id)} onChange={() => sel.toggle(acc.id)} title="Selecionar" />}
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {acc.company?.tradeName || (/^(comp_|companies_)/.test(String(acc.companyId || '')) ? <span className="text-rose-600" title="A empresa vinculada foi excluída. Edite o registro para escolher a empresa correta.">Empresa não localizada</span> : acc.companyId)}
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    {acc.bank ? `${acc.bank.code} - ${acc.bank.name}` : acc.bankId}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-800">{acc.agency}</td>
                  <td className="py-3 px-4 font-mono tabular-nums font-bold text-slate-900">{acc.accountNumber}</td>
                  <td className="py-3 px-4 text-center">
                    {acc.hasIntradayLimit ? (
                      <span className="text-emerald-700 font-semibold inline-flex items-center gap-0.5">
                        <Check className="w-3.5 h-3.5" /> Sim{acc.intradayLimitAmount ? ` · R$ ${Number(acc.intradayLimitAmount.replace(',', '.')).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                      </span>
                    ) : (
                      <span className="text-slate-400">Não</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {acc.hasAutoInvestment ? (
                      <span className="text-emerald-700 font-semibold inline-flex items-center gap-0.5">
                        <Check className="w-3.5 h-3.5" /> Sim
                      </span>
                    ) : (
                      <span className="text-slate-400">Não</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {acc.hasSweeping ? (
                      <span className="text-emerald-700 font-semibold inline-flex items-center gap-0.5" title={`Destino: ${acc.sweepingDestinationAccount || 'não informado'}`}>
                        <Check className="w-3.5 h-3.5" /> Sim
                      </span>
                    ) : (
                      <span className="text-slate-400">Não</span>
                    )}
                    {acc.hasSweeping && acc.sweepingDestinationAccount && (
                      <div className="text-[11px] text-slate-600 mt-0.5">{acc.sweepingDestinationAccount}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(acc)}
                        className="p-1 text-slate-500 hover:text-sky-700 rounded"
                        title="Editar Conta"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {isAdmin && (
                      <button
                        onClick={() => handleDelete(acc.id, acc.accountNumber)}
                        className="p-1 text-slate-500 hover:text-rose-700 rounded"
                        title="Excluir Conta"
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
                {editingAccount ? 'Editar Conta Corrente' : 'Cadastrar Nova Conta Corrente'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Empresa Titular *</label>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Agência (preserva zeros) *</label>
                  <input
                    type="text"
                    required
                    value={agency}
                    onChange={(e) => setAgency(e.target.value)}
                    placeholder="0100"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-sky-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Conta Corrente (com dígito) *</label>
                  <input
                    type="text"
                    required
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="00012345-6"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-sky-600"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <span className="text-xs font-bold text-slate-700 block">Indicadores Operacionais:</span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasIntradayLimit}
                      onChange={(e) => setHasIntradayLimit(e.target.checked)}
                      className="rounded text-sky-600"
                    />
                    <span>Limite Intraday</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasAutoInvestment}
                      onChange={(e) => setHasAutoInvestment(e.target.checked)}
                      className="rounded text-sky-600"
                    />
                    <span>Apl. Automática</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasSweeping}
                      onChange={(e) => setHasSweeping(e.target.checked)}
                      className="rounded text-sky-600"
                    />
                    <span>Tombamento</span>
                  </label>
                </div>
              </div>

              {hasIntradayLimit && (
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Valor do limite Intraday (R$) *</label>
                  <input type="text" inputMode="decimal" required value={intradayLimitAmount}
                    onChange={(e) => setIntradayLimitAmount(e.target.value)} placeholder="Ex.: 250.000,00"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white" />
                </div>
              )}

              {hasSweeping && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Conta corrente que receberá os recursos do tombamento *</label>
                  <input type="text" required value={sweepingDestinationAccount}
                    onChange={(e) => setSweepingDestinationAccount(e.target.value)} placeholder="Banco / agência / conta de destino"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white" />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Observações Operacionais</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Conta destinada à liquidação de fornecedores"
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
                  {submitting ? 'Salvando...' : 'Salvar Conta'}
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
        moduleKey="current_accounts"
        moduleTitle="Contas Correntes"
        onSuccess={loadData}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        moduleKey="current_accounts"
        moduleTitle="Contas Correntes"
      />
    </div>
      {confirmDialog}
    </>
  );
};
