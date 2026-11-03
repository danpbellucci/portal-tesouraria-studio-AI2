// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Lock,
  Unlock,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { ApiClient } from '../../services/api';
import { useToast } from '../common/Toast';
import { useConfirmDialog } from '../common/useConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { formatDateTimeBR } from '../../utils/date';

interface UserAccountItem {
  id: string;
  email: string;
  name: string;
  roleId: string;
  status: 'ACTIVE' | 'PENDING_ACTIVATION' | 'BLOCKED';
  failedLoginAttempts: number;
  lastLoginAt?: string;
  createdAt: string;
}

export const UsersModule: React.FC = () => {
  const { confirm, confirmDialog } = useConfirmDialog();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserAccountItem[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAuthorizeModalOpen, setIsAuthorizeModalOpen] = useState(false);

  // Authorize form
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRoleId, setNewRoleId] = useState('role_analyst');
  const [submitting, setSubmitting] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await ApiClient.request(`/api/auth/users/${editUser.id}`, { method: 'PUT', body: JSON.stringify({ name: editUser.name, email: editUser.email, roleId: editUser.roleId }) });
      showToast('Dados do usuário atualizados.', 'success');
      setEditUser(null);
      loadUsers();
    } catch (err: any) { showToast(err.message, 'error'); } finally { setSubmitting(false); }
  };

  const handleDelete = async (user: UserAccountItem) => {
    if (!(await confirm(`Excluir definitivamente o usuário ${user.email}?`))) return;
    try {
      await ApiClient.request(`/api/auth/users/${user.id}`, { method: 'DELETE' });
      showToast('Usuário excluído.', 'success');
      loadUsers();
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes] = await Promise.all([
        ApiClient.request('/api/auth/users'),
        ApiClient.request('/api/auth/roles')
      ]);
      setUsers(usersRes);
      setRoles(rolesRes);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await ApiClient.request('/api/auth/users/authorize', {
        method: 'POST',
        body: JSON.stringify({
          email: newEmail,
          name: newName,
          roleId: newRoleId
        })
      });

      showToast('E-mail pré-aprovado. O colaborador já pode cadastrar sua própria senha.', 'success');
      setIsAuthorizeModalOpen(false);
      setNewEmail('');
      setNewName('');
      loadUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleBlock = async (user: UserAccountItem) => {
    const actionDesc = user.status === 'BLOCKED' ? 'desbloquear' : 'bloquear';
    if (!window.confirm(`Deseja realmente ${actionDesc} o usuário ${user.email}?`)) return;

    try {
      await ApiClient.request(`/api/auth/users/${user.id}/toggle-block`, { method: 'POST' });
      showToast(`Status do usuário alterado com sucesso.`, 'success');
      loadUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleResetAccess = async (user: UserAccountItem) => {
    if (!window.confirm(`Redefinir o acesso de ${user.email}? O usuário precisará cadastrar uma nova senha usando o e-mail pré-aprovado.`)) return;

    try {
      await ApiClient.request(`/api/auth/users/${user.id}/reset-code`, { method: 'POST' });
      showToast('Acesso redefinido. O usuário poderá cadastrar uma nova senha pelo e-mail pré-aprovado.', 'success');
      loadUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };



  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {confirmDialog}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Gestão Administrativa de Usuários</h1>
          <p className="text-xs text-slate-500 mt-1">
            Controle de permissões, pré-aprovação de e-mails, redefinição de acesso e bloqueios.
          </p>
        </div>

        <button
          onClick={() => setIsAuthorizeModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 shadow-sm"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Pré-aprovar E-mail</span>
        </button>
      </div>

      {/* Security Info Banner */}
      <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-xl text-xs text-sky-950 space-y-1">
        <strong className="font-semibold block">Protocolo de Primeiro Acesso Corporativo:</strong>
        <p className="leading-relaxed">
          O cadastro só é permitido para e-mails previamente autorizados pelo administrador. Após a pré-aprovação, o colaborador informa seu e-mail na tela de primeiro acesso e define sua própria senha, sem código de ativação.
        </p>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Usuários Autorizados no Servidor</h3>
          <span className="text-xs text-slate-500 font-mono tabular-nums">{users.length} contas cadastradas</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Nome e E-mail</th>
                <th className="py-3 px-4">Perfil / Permissões</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 font-mono">Último Acesso</th>
                <th className="py-3 px-4">Primeiro acesso</th>
                <th className="py-3 px-4 text-right">Ações Administrativas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">Carregando usuários...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">Nenhum usuário localizado.</td>
                </tr>
              ) : (
                users.map((u) => {
                  const isBlocked = u.status === 'BLOCKED';
                  const isPending = u.status === 'PENDING_ACTIVATION';
                  const roleName = roles.find((r) => r.id === u.roleId)?.name || u.roleId;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{u.name}</div>
                        <div className="text-slate-500 font-mono text-[11px]">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] font-semibold">
                          {roleName}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isBlocked ? (
                          <span className="bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded">
                            Bloqueado
                          </span>
                        ) : isPending ? (
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded">
                            Aguardando cadastro de senha
                          </span>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded">
                            Ativo
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {u.lastLoginAt ? formatDateTimeBR(u.lastLoginAt) : 'Nunca acessou'}
                      </td>
                    <td className="py-3 px-4 text-slate-600">
                      {isPending ? 'Aguardando cadastro de senha' : 'Concluído'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setEditUser({ ...u })} className="px-2 py-1 text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 font-semibold" title="Editar dados">Editar</button>
                      {u.id !== currentUser?.userId && (
                        <>
                          <button
                            onClick={() => handleResetAccess(u)}
                            className="px-2 py-1 text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors font-semibold"
                            title="Redefinir acesso"
                          >
                            Redefinir Acesso
                          </button>

                          <button
                            onClick={() => handleToggleBlock(u)}
                            className={`px-2 py-1 rounded transition-colors font-semibold ${
                              isBlocked
                                ? 'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100'
                                : 'text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100'
                            }`}
                            title={isBlocked ? 'Reativar conta' : 'Bloquear conta'}
                          >
                            {isBlocked ? 'Desbloquear' : 'Bloquear'}
                          </button>
                          <button onClick={() => handleDelete(u)} className="px-2 py-1 rounded font-semibold text-white bg-rose-600 hover:bg-rose-700" title="Excluir usuário">Excluir</button>
                        </>
                      )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Editar usuário</h3>
              <button onClick={() => setEditUser(null)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <label className="block"><span className="text-xs font-semibold text-slate-700 block mb-1">Nome Completo *</span>
                <input required value={editUser.name} onChange={(e) => setEditUser({ ...editUser, name: e.target.value })} className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg" /></label>
              <label className="block"><span className="text-xs font-semibold text-slate-700 block mb-1">E-mail *</span>
                <input required type="email" value={editUser.email} onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg" /></label>
              <label className="block"><span className="text-xs font-semibold text-slate-700 block mb-1">Perfil de Permissão *</span>
                <select disabled={editUser.id === currentUser?.userId} value={editUser.roleId} onChange={(e) => setEditUser({ ...editUser, roleId: e.target.value })} className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white">
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select></label>
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setEditUser(null)} className="px-4 py-2 text-xs border border-slate-300 rounded-lg">Cancelar</button>
                <button disabled={submitting} className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg disabled:opacity-50">{submitting ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Authorize Email Modal */}
      {isAuthorizeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Autorizar Acesso de Colaborador</h3>
              <button onClick={() => setIsAuthorizeModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAuthorize} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Carlos Drummond"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">E-mail Corporativo Autorizado *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="usuario@eloparticipacoes.com.br"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Perfil de Permissão *</label>
                <select
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {r.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAuthorizeModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Autorizando...' : 'Pré-aprovar E-mail'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
