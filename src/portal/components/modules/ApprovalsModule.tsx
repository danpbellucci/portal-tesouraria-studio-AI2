import { useIsAdmin } from '../common/BulkDelete';
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, Pencil, Send, X, CheckCircle2, Clock } from 'lucide-react';
import { ApiClient } from '../../services/api';
import { useToast } from '../common/Toast';
import { useConfirmDialog } from '../common/useConfirmDialog';
import { formatBRL, formatDateBR, maskBRL, REQUIRED_APPROVERS } from '../../backend/services/approvals.logic';

type Kind = 'APLICACAO_RESGATE' | 'TRANSFERENCIA_PAGAMENTO';
const KIND_LABEL: Record<Kind, string> = { APLICACAO_RESGATE: 'Aplicações / Resgates', TRANSFERENCIA_PAGAMENTO: 'Transferências / Pagamentos' };
const OPS: Record<Kind, string[]> = { APLICACAO_RESGATE: ['Aplicação', 'Resgate'], TRANSFERENCIA_PAGAMENTO: ['Transferência', 'Pagamento'] };

const empty = (kind: Kind) => ({ kind, operation: OPS[kind][0], companyId: '', date: new Date().toISOString().slice(0, 10), amount: '', sourceAccountId: '', destinationAccountId: '', destinationDescription: '', product: '', approvers: [] as string[], description: '' });

export const ApprovalsModule: React.FC = () => {
  const { showToast } = useToast();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [kind, setKind] = useState<Kind | 'ALL'>('ALL');
  const [status, setStatus] = useState<'PENDING' | 'COMPLETED' | 'ALL'>('PENDING');
  const [rows, setRows] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [procurators, setProcurators] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [r, c, a, b, p] = await Promise.all([
      ApiClient.request<any[]>('/api/approvals'),
      ApiClient.request<any[]>('/api/companies'),
      ApiClient.request<any[]>('/api/current-accounts'),
      ApiClient.request<any[]>('/api/banks'),
      ApiClient.request<any[]>('/api/treasury-records/procurators').catch(() => []),
    ]);
    setRows(r); setCompanies(c); setAccounts(a); setBanks(b); setProcurators(p);
  };
  useEffect(() => { load().catch((e) => showToast(e.message, 'error')); }, []);
  useEffect(() => setSelected(new Set()), [status]);

  const comp = (id: string) => companies.find((c) => c.id === id)?.tradeName || '—';
  const accLabel = (id?: string) => {
    const a = accounts.find((x) => x.id === id);
    if (!a) return '';
    const b = banks.find((x) => x.id === a.bankId);
    return `${b?.code || ''} ${b?.name?.split(' ')[0] || ''} · Ag ${a.agency} · CC ${a.accountNumber}`;
  };

  const visible = useMemo(() => rows.filter((r) => (kind === 'ALL' || r.kind === kind) && (status === 'ALL' || r.status === status)).filter((r) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return [r.operation, comp(r.companyId), r.destinationDescription, r.product, r.description, ...(r.approvers || [])].join(' ').toLowerCase().includes(q);
  }), [rows, kind, status, query, companies]);

  const pendingVisible = visible.filter((r) => r.status === 'PENDING');
  const selectedTotal = rows.filter((r) => selected.has(r.id)).reduce((s, r) => s + Number(r.amount), 0);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n; });
  const allVisibleSelected = !!pendingVisible.length && pendingVisible.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected((s) => { const n = new Set(s); pendingVisible.forEach((r) => { if (allVisibleSelected) { n.delete(r.id); } else { n.add(r.id); } }); return n; });

  const open = (row?: any) => {
    setError('');
    if (row) { setEditingId(row.id); setForm({ ...empty(row.kind), ...row, approvers: [...(row.approvers || [])], amount: maskBRL(Number(row.amount).toFixed(2)) }); }
    else { setEditingId(null); setForm(empty(kind === 'ALL' ? 'APLICACAO_RESGATE' : kind)); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const payload = { ...form, approvers: (form.approvers || []).filter(Boolean), amount: String(form.amount).replace(/\./g, '').replace(',', '.') };
      await ApiClient.request(editingId ? `/api/approvals/${editingId}` : '/api/approvals', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      showToast(editingId ? 'Lançamento atualizado.' : 'Lançamento incluído para aprovação.', 'success');
      setForm(null); await load();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  const remove = async (row: any) => {
    if (!(await confirm(`Excluir o lançamento de ${formatBRL(row.amount)}?`))) return;
    try { await ApiClient.request(`/api/approvals/${row.id}`, { method: 'DELETE' }); showToast('Lançamento excluído.', 'success'); await load(); }
    catch (err: any) { showToast(err.message, 'error'); }
  };

  const requestApproval = async () => {
    if (!selected.size) return;
    setBusy(true);
    try {
      const res = await ApiClient.request<{ mailto: string; count: number }>('/api/approvals/request', { method: 'POST', body: JSON.stringify({ ids: [...selected] }) });
      window.location.href = res.mailto;
      showToast(`E-mail de aprovação gerado. ${res.count} lançamento(s) marcados como concluídos.`, 'success');
      setSelected(new Set()); await load();
    } catch (err: any) { showToast(err.message, 'error'); } finally { setBusy(false); }
  };

  const companyAccounts = accounts.filter((a) => !form?.companyId || a.companyId === form.companyId);
  const input = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900/20';

  const isAdmin = useIsAdmin();

  return (
    <div className="p-6 space-y-5">
      {confirmDialog}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Aprovações</h2>
          <p className="text-sm text-slate-500">Inclua transações, selecione as pendentes e solicite aprovação por e-mail (Outlook).</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => open()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Plus className="w-4 h-4" />Incluir transação</button>
          <button disabled={!selected.size || busy} onClick={requestApproval} className="inline-flex items-center gap-2 rounded-lg bg-[#0F2744] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1E3A8A] disabled:opacity-40"><Send className="w-4 h-4" />Solicitar aprovação{selected.size ? ` (${selected.size})` : ''}</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {(['ALL', ...Object.keys(KIND_LABEL)] as (Kind | 'ALL')[]).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={`px-4 py-1.5 text-xs font-semibold rounded-md ${kind === k ? 'bg-[#0F2744] text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{k === 'ALL' ? 'Todos' : KIND_LABEL[k]}</button>
          ))}
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
          <option value="PENDING">Pendentes</option><option value="COMPLETED">Concluídos</option><option value="ALL">Todos</option>
        </select>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar empresa, favorecido, aprovador..." className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs" />
        </div>
        {selected.size > 0 && <span className="text-xs text-slate-600">Selecionado: <b className="tabular-nums">{formatBRL(selectedTotal)}</b></span>}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase">
            <tr>
              <th className="px-3 py-3 w-8"><input type="checkbox" aria-label="Selecionar todos" checked={allVisibleSelected} onChange={toggleAll} /></th>
              <th className="px-3 py-3">Status</th><th className="px-3 py-3">Data</th><th className="px-3 py-3">Operação</th><th className="px-3 py-3">Empresa</th>
              <th className="px-3 py-3">Conta origem</th><th className="px-3 py-3">Destino</th><th className="px-3 py-3 text-right">Valor</th><th className="px-3 py-3">Aprovadores</th><th className="px-3 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.length === 0 ? <tr><td colSpan={10} className="p-8 text-center text-slate-400">Nenhum lançamento.</td></tr> : visible.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2.5">{r.status === 'PENDING' && <input type="checkbox" aria-label="Selecionar" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />}</td>
                <td className="px-3 py-2.5">{r.status === 'PENDING' ? <span className="inline-flex items-center gap-1 text-amber-700"><Clock className="w-3 h-3" />Pendente</span> : <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-3 h-3" />Concluído</span>}</td>
                <td className="px-3 py-2.5 tabular-nums">{formatDateBR(r.date)}</td>
                <td className="px-3 py-2.5 font-medium">{r.operation}{r.product ? <div className="text-slate-400 font-normal">{r.product}</div> : null}</td>
                <td className="px-3 py-2.5">{comp(r.companyId)}</td>
                <td className="px-3 py-2.5">{accLabel(r.sourceAccountId)}</td>
                <td className="px-3 py-2.5">{r.destinationAccountId ? accLabel(r.destinationAccountId) : r.destinationDescription || '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{formatBRL(r.amount)}</td>
                <td className="px-3 py-2.5 text-slate-500">{(r.approvers || []).map((e: string) => procurators.find((p) => String(p.email).toLowerCase() === e)?.name || e).join(', ')}</td>
                <td className="px-3 py-2.5">{r.status === 'PENDING' ? <div className="flex gap-2"><button onClick={() => open(r)} title="Editar"><Pencil className="w-4 h-4 text-slate-500" /></button>{isAdmin && <button onClick={() => remove(r)} title="Excluir"><Trash2 className="w-4 h-4 text-rose-500" /></button>}</div> : <span className="text-slate-400">{r.requestedAt ? formatDateBR(r.requestedAt) : ''}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <form onSubmit={save} className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-bold text-slate-900">{editingId ? 'Editar lançamento' : 'Incluir transação para aprovação'}</h3>
              <button type="button" onClick={() => setForm(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4 px-6 py-5 max-h-[70vh] overflow-y-auto text-xs">
              <label className="space-y-1"><span className="font-semibold text-slate-600">Tipo *</span>
                <select className={input} value={form.kind} onChange={(e) => { const k = e.target.value as Kind; setForm({ ...form, kind: k, operation: OPS[k][0], approvers: (form.approvers || []).slice(0, REQUIRED_APPROVERS[k]) }); }}>
                  {(Object.keys(KIND_LABEL) as Kind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                </select></label>
              <label className="space-y-1"><span className="font-semibold text-slate-600">Operação *</span>
                <select className={input} value={form.operation} onChange={(e) => setForm({ ...form, operation: e.target.value })}>{OPS[form.kind as Kind].map((o) => <option key={o}>{o}</option>)}</select></label>
              <label className="space-y-1"><span className="font-semibold text-slate-600">Empresa *</span>
                <select className={input} value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value, sourceAccountId: '', destinationAccountId: '' })}>
                  <option value="">Selecione</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.tradeName}</option>)}</select></label>
              <label className="space-y-1"><span className="font-semibold text-slate-600">Data *</span><input type="date" className={input} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
              <label className="space-y-1"><span className="font-semibold text-slate-600">Valor (R$) *</span><input inputMode="decimal" placeholder="0,00" className={`${input} tabular-nums`} value={form.amount} onChange={(e) => setForm({ ...form, amount: maskBRL(e.target.value) })} /></label>
              <label className="space-y-1"><span className="font-semibold text-slate-600">Conta de origem *</span>
                <select className={input} value={form.sourceAccountId} onChange={(e) => setForm({ ...form, sourceAccountId: e.target.value })}>
                  <option value="">Selecione</option>{companyAccounts.map((a) => <option key={a.id} value={a.id}>{accLabel(a.id)}</option>)}</select></label>
              {form.kind === 'APLICACAO_RESGATE' ? (
                <label className="space-y-1 col-span-2"><span className="font-semibold text-slate-600">Produto / Fundo</span><input className={input} placeholder="Ex.: BB Corporate Fácil, CDB, Fundo Baraúna" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} /></label>
              ) : (
                <>
                  <label className="space-y-1"><span className="font-semibold text-slate-600">Conta de destino (interna)</span>
                    <select className={input} value={form.destinationAccountId} onChange={(e) => setForm({ ...form, destinationAccountId: e.target.value })}>
                      <option value="">— Externa —</option>{accounts.filter((a) => a.id !== form.sourceAccountId).map((a) => <option key={a.id} value={a.id}>{comp(a.companyId)} · {accLabel(a.id)}</option>)}</select></label>
                  <label className="space-y-1"><span className="font-semibold text-slate-600">Favorecido / conta externa</span><input className={input} placeholder="Nome, CNPJ, banco, agência, conta" value={form.destinationDescription} onChange={(e) => setForm({ ...form, destinationDescription: e.target.value })} /></label>
                </>
              )}
              <div className="col-span-2 space-y-1">
                <span className="font-semibold text-slate-600">Aprovadores ({REQUIRED_APPROVERS[form.kind as Kind]} procurador{REQUIRED_APPROVERS[form.kind as Kind] > 1 ? 'es' : ''}) *</span>
                {procurators.length === 0 && <div className="text-amber-700">Nenhum procurador cadastrado. Cadastre em Procurações e Procuradores → Procuradores.</div>}
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: REQUIRED_APPROVERS[form.kind as Kind] }).map((_, i) => (
                    <select key={i} required className={input} value={form.approvers?.[i] || ''} onChange={(e) => { const list = [...(form.approvers || [])]; list[i] = e.target.value; setForm({ ...form, approvers: list }); }}>
                      <option value="">Selecione o {i + 1}º procurador</option>
                      {procurators.filter((p) => !(form.approvers || []).some((x: string, j: number) => j !== i && x === String(p.email).toLowerCase())).map((p) => <option key={p.id} value={String(p.email).toLowerCase()}>{p.name} — {p.type}</option>)}
                    </select>
                  ))}
                </div>
              </div>
              <label className="space-y-1 col-span-2"><span className="font-semibold text-slate-600">Observação</span><textarea rows={2} className={input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
              {error && <div className="col-span-2 rounded-lg bg-rose-50 px-3 py-2 text-rose-700">{error}</div>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button type="button" onClick={() => setForm(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Cancelar</button>
              <button disabled={busy} className="rounded-lg bg-[#0F2744] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1E3A8A] disabled:opacity-50">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
