// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { useConfirmDialog } from '../common/useConfirmDialog';
import { BulkDeleteBar, CheckCell, useBulkSelect, useIsAdmin } from '../common/BulkDelete';
import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  Download,
  Upload,
  History,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Users,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { Company, Director } from '../../types/treasury';
import { ApiClient } from '../../services/api';
import { useToast } from '../common/Toast';
import { ImportModal } from '../common/ImportModal';
import { VersionHistoryModal } from '../common/VersionHistoryModal';

export const CompaniesModule: React.FC = () => {
  const { confirm, confirmDialog } = useConfirmDialog();
  const { showToast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Form state
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [tradeName, setTradeName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [directorsInput, setDirectorsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const res = await ApiClient.request('/api/companies');
      setCompanies(res);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const handleOpenCreate = () => {
    setEditingCompany(null);
    setTradeName('');
    setLegalName('');
    setCnpj('');
    setState('');
    setCity('');
    setDirectorsInput('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (comp: Company) => {
    setEditingCompany(comp);
    setTradeName(comp.tradeName);
    setLegalName(comp.legalName);
    setCnpj(comp.cnpj);
    setState(comp.state || '');
    setCity(comp.city || '');
    setDirectorsInput((comp.directors || []).map((d) => d.name).join(', '));
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!(await confirm(`Confirma a exclusão controlada da empresa "${name}"?`))) return;
    try {
      await ApiClient.request(`/api/companies/${id}`, { method: 'DELETE' });
      showToast('Empresa excluída com sucesso.', 'success');
      await loadCompanies();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        tradeName,
        legalName,
        cnpj,
        state,
        city,
        directorNames: directorsInput
      };

      if (editingCompany) {
        await ApiClient.request(`/api/companies/${editingCompany.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('Empresa atualizada com sucesso.', 'success');
      } else {
        await ApiClient.request('/api/companies', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('Empresa cadastrada com sucesso.', 'success');
      }

      setIsFormOpen(false);
      loadCompanies();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    ApiClient.downloadFile('/api/spreadsheets/export/companies', 'empresas_elo.xlsx');
  };

  const handleDownloadTemplate = () => {
    ApiClient.downloadFile('/api/spreadsheets/template/companies', 'modelo_empresas.xlsx');
  };

  const filteredCompanies = companies.filter((c) => {
    const q = searchTerm.toLowerCase();
    return (
      c.tradeName.toLowerCase().includes(q) ||
      c.legalName.toLowerCase().includes(q) ||
      c.cnpj.includes(q)
    );
  });

  const isAdmin = useIsAdmin();
  const sel = useBulkSelect(filteredCompanies.map((x) => x.id));

  return (
    <>
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Gestão das Empresas & Diretores Estatutários</h1>
          <p className="text-xs text-slate-500 mt-1">
            Cadastro centralizado das empresas pertencentes à estrutura da Elo Participações e vinculação estatutária.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Baixar Modelo</span>
          </button>

          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-sky-600" />
            <span>Importar Planilha</span>
          </button>

          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>Versões</span>
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Exportar XLSX</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Empresa</span>
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
            placeholder="Pesquisar por Nome Fantasia, Razão Social ou CNPJ..."
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
          />
        </div>
        <div className="text-xs font-mono tabular-nums text-slate-500">
          {filteredCompanies.length} empresas registradas
        </div>
      </div>

      {/* Table */}
      {isAdmin && <BulkDeleteBar sel={sel} urlFor={(id) => `/api/companies/${id}`} onDone={loadCompanies} onError={(m) => showToast(m, 'error')} onSuccess={(m) => showToast(m, 'success')} />}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
            {isAdmin && <CheckCell header checked={sel.allChecked} onChange={sel.toggleAll} title="Selecionar todos" />}
              <th className="py-3 px-4">Nome Fantasia</th>
              <th className="py-3 px-4">Razão Social</th>
              <th className="py-3 px-4">CNPJ</th>
              <th className="py-3 px-4">Diretores Estatutários</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  Carregando empresas...
                </td>
              </tr>
            ) : filteredCompanies.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  Nenhuma empresa localizada com o filtro informado.
                </td>
              </tr>
            ) : (
              filteredCompanies.map((comp) => (
                <tr key={comp.id} className="hover:bg-slate-50/70 transition-colors">
                  {isAdmin && <CheckCell checked={sel.isSelected(comp.id)} onChange={() => sel.toggle(comp.id)} title="Selecionar" />}
                  <td className="py-3 px-4 font-bold text-slate-900">{comp.tradeName}</td>
                  <td className="py-3 px-4 text-slate-600">{comp.legalName}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-800">{comp.cnpj}</td>
                  <td className="py-3 px-4 text-slate-700">
                    {comp.directors && comp.directors.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {comp.directors.map((d) => (
                          <span
                            key={d.id}
                            className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]"
                          >
                            {d.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Nenhum diretor vinculado</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(comp)}
                        className="p-1 text-slate-500 hover:text-sky-700 rounded transition-colors"
                        title="Editar Empresa"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {isAdmin && (
                      <button
                        onClick={() => handleDelete(comp.id, comp.tradeName)}
                        className="p-1 text-slate-500 hover:text-rose-700 rounded transition-colors"
                        title="Excluir Empresa"
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
                {editingCompany ? 'Editar Empresa' : 'Cadastrar Nova Empresa'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Nome Fantasia *</label>
                <input
                  type="text"
                  required
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  placeholder="Ex: Elo Serviços"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Razão Social *</label>
                <input
                  type="text"
                  required
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Ex: Elo Serviços S.A."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">CNPJ (com validação oficial) *</label>
                <input
                  type="text"
                  required
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-sky-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Diretores Estatutários (separados por vírgula)
                </label>
                <input
                  type="text"
                  value={directorsInput}
                  onChange={(e) => setDirectorsInput(e.target.value)}
                  placeholder="Ex: Eduardo Chedid, Roberto Valério"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Apenas nome completo dos diretores. Relação N:N gerenciada automaticamente.
                </span>
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
                  {submitting ? 'Salvando...' : 'Salvar Empresa'}
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
        moduleKey="companies"
        moduleTitle="Empresas & Diretores Estatutários"
        onSuccess={loadCompanies}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        moduleKey="companies"
        moduleTitle="Empresas"
      />
    </div>
      {confirmDialog}
    </>
  );
};
