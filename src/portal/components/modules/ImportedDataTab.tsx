// @ts-nocheck — legacy-style module (looser TS config)
import React, { useEffect, useMemo, useState } from 'react';
import { Database, Search, Trash2 } from 'lucide-react';
import { useIsAdmin } from '../common/BulkDelete';
import { useConfirmDialog } from '../common/useConfirmDialog';
import { ApiClient } from '../../services/api';
import { formatDateBR } from '../../utils/date';

type Col = { key: string; label: string; kind?: 'date' | 'money' | 'rate' | 'quota' | 'company' };

const COLUMNS: Record<string, Col[]> = {
  tecban: [
    { key: 'date', label: 'Data', kind: 'date' },
    { key: 'actualBalance', label: 'Saldo real', kind: 'money' },
    { key: 'actualWithdrawals', label: 'Saques reais', kind: 'money' },
    { key: 'actualReloads', label: 'Recargas reais', kind: 'money' },
    { key: 'projectedBalance', label: 'Saldo projetado', kind: 'money' },
    { key: 'projectedWithdrawals', label: 'Saques projetados', kind: 'money' },
    { key: 'projectedReloads', label: 'Recargas projetadas', kind: 'money' },
  ],
  cash_projections: [
    { key: 'companyId', label: 'Empresa', kind: 'company' },
    { key: 'date', label: 'Data', kind: 'date' },
    { key: 'actualBalance', label: 'Saldo real', kind: 'money' },
    { key: 'actualOutflow', label: 'Saídas reais', kind: 'money' },
    { key: 'actualInflow', label: 'Entradas reais', kind: 'money' },
    { key: 'projectedBalance', label: 'Saldo projetado', kind: 'money' },
    { key: 'projectedOutflow', label: 'Saídas projetadas', kind: 'money' },
    { key: 'projectedInflow', label: 'Entradas projetadas', kind: 'money' },
  ],
  indicators: [
    { key: 'date', label: 'Data', kind: 'date' },
    { key: 'cdiRealizedAnnual', label: 'CDI realizado (% a.a.)', kind: 'rate' },
    { key: 'cdiProjectedAnnual', label: 'CDI projetado (% a.a.)', kind: 'rate' },
    { key: 'quotaBarauna', label: 'Baraúna', kind: 'quota' },
    { key: 'quotaCarnauba', label: 'Carnaúba', kind: 'quota' },
    { key: 'quotaJacaranda', label: 'Jacarandá', kind: 'quota' },
    { key: 'quotaCaliandra', label: 'Caliandra', kind: 'quota' },
    { key: 'quotaBBCorporateFacil', label: 'BB Corp. Fácil', kind: 'quota' },
  ],
};

const num = (v: any, min: number, max: number) => {
  if (v === undefined || v === null || v === '') return '—';
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max }) : String(v);
};

const MANUAL = '__manual__';

export const ImportedDataTab: React.FC<{ module: 'tecban' | 'cash_projections' | 'indicators' }> = ({ module }) => {
  const [records, setRecords] = useState<any[]>([]);
  const { confirm, confirmDialog } = useConfirmDialog();
  const [versions, setVersions] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [version, setVersion] = useState('ALL');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [reload, setReload] = useState(0);
  const isAdmin = useIsAdmin();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n; });
  const deleteManual = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!(await confirm(`Excluir ${ids.length} lançamento(s) manual(is)? Esta ação não pode ser desfeita.`))) return;
    try {
      await ApiClient.request(`/api/spreadsheets/records/${module}/delete-manual`, { method: 'POST', body: JSON.stringify({ ids }) });
      setSelected(new Set());
      setReload((n) => n + 1);
    } catch (e: any) { setError(e.message); }
  };
  const deleteVersion = async () => {
    const v = versions.find((x) => x.id === version);
    if (!v) return;
    const count = records.filter((r) => r.importVersionId === v.id).length;
    if (!(await confirm(`Excluir a versão "${v.fileName}" e os ${count} registro(s) gravados por ela? Esta ação não pode ser desfeita.`))) return;
    try {
      await ApiClient.request(`/api/spreadsheets/versions/${module}/${v.id}`, { method: 'DELETE' });
      setVersion('ALL');
      setReload((n) => n + 1);
    } catch (e: any) { setError(e.message); }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [r, v, c] = await Promise.all([
          ApiClient.request<any[]>(`/api/spreadsheets/records/${module}`),
          ApiClient.request<any[]>(`/api/spreadsheets/versions/${module}`),
          module === 'cash_projections' ? ApiClient.request<any[]>('/api/companies') : Promise.resolve([]),
        ]);
        setRecords(r || []);
        setVersions((v || []).slice().sort((a, b) => String(b.importedAt).localeCompare(String(a.importedAt))));
        setCompanies(c || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [module, reload]);

  const cols = COLUMNS[module];
  const compName = (id: string) => companies.find((c) => c.id === id)?.tradeName || id || '—';
  const versionLabel = (v: any, i: number) =>
    `v${versions.length - i} · ${v.fileName} · ${new Date(v.importedAt).toLocaleString('pt-BR')}`;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return records.filter((r) => {
      const vid = r.importVersionId;
      if (version === MANUAL && vid) return false;
      if (version !== 'ALL' && version !== MANUAL && vid !== version) return false;
      if (!s) return true;
      return formatDateBR(r.date).includes(s) || (module === 'cash_projections' && compName(r.companyId).toLowerCase().includes(s));
    });
  }, [records, version, q, companies]);

  const render = (c: Col, r: any) => {
    const v = r[c.key];
    if (c.kind === 'date') return formatDateBR(v);
    if (c.kind === 'money') return v === undefined || v === '' ? '—' : `R$ ${num(v, 2, 2)}`;
    if (c.kind === 'rate') return v === undefined || v === '' ? '—' : `${num(v, 2, 4)}%`;
    if (c.kind === 'quota') return num(v, 6, 8);
    if (c.kind === 'company') return compName(v);
    return v ?? '—';
  };

  const versionName = (id?: string) => {
    if (!id) return 'Manual';
    const i = versions.findIndex((v) => v.id === id);
    return i >= 0 ? `v${versions.length - i}` : '—';
  };

  return (
    <div className="space-y-4">
      {confirmDialog}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={module === 'cash_projections' ? 'Buscar por data (DD/MM/AAAA) ou empresa...' : 'Buscar por data (DD/MM/AAAA)...'} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          Versão:
          <select value={version} onChange={(e) => setVersion(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white max-w-[420px]">
            <option value="ALL">Todas as versões</option>
            {versions.map((v, i) => <option key={v.id} value={v.id}>{versionLabel(v, i)}</option>)}
            <option value={MANUAL}>Lançamentos manuais</option>
          </select>
        </label>
        {isAdmin && versions.some((v) => v.id === version) && (
          <button type="button" onClick={deleteVersion} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold">
            <Trash2 className="w-3.5 h-3.5" /> Excluir versão
          </button>
        )}
        {isAdmin && selected.size > 0 && (
          <button type="button" onClick={() => deleteManual([...selected])} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold">
            <Trash2 className="w-3.5 h-3.5" /> Excluir manuais selecionados ({selected.size})
          </button>
        )}
        <span className="text-xs text-slate-500">{filtered.length} registro(s)</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {isAdmin && <th className="py-3 px-3 w-8"><input type="checkbox" title="Selecionar lançamentos manuais" checked={filtered.some((r) => !r.importVersionId) && filtered.filter((r) => !r.importVersionId).every((r) => selected.has(r.id))} onChange={(e) => setSelected(e.target.checked ? new Set(filtered.filter((r) => !r.importVersionId).map((r) => r.id)) : new Set())} /></th>}
              {cols.map((c) => <th key={c.key} className={`py-3 px-4 whitespace-nowrap ${c.kind === 'date' || c.kind === 'company' ? 'text-left' : 'text-right'}`}>{c.label}</th>)}
              <th className="py-3 px-4 text-left">Versão</th>
              {isAdmin && <th className="py-3 px-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={cols.length + 3} className="py-8 text-center text-slate-400">Carregando dados...</td></tr>
            ) : error ? (
              <tr><td colSpan={cols.length + 3} className="py-8 text-center text-rose-600">{error}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={cols.length + 3} className="py-10 text-center text-slate-400"><Database className="w-6 h-6 mx-auto mb-2" />Nenhum dado para o filtro selecionado.</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70">
                  {isAdmin && <td className="py-2.5 px-3">{!r.importVersionId && <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />}</td>}
                  {cols.map((c) => <td key={c.key} className={`py-2.5 px-4 whitespace-nowrap tabular-nums ${c.kind === 'date' || c.kind === 'company' ? 'text-left text-slate-800' : 'text-right text-slate-700'}`}>{render(c, r)}</td>)}
                  <td className="py-2.5 px-4 text-xs text-slate-500">{versionName(r.importVersionId)}</td>
                  {isAdmin && <td className="py-2.5 px-3 text-right">{!r.importVersionId && <button type="button" title="Excluir lançamento manual" onClick={() => deleteManual([r.id])} className="text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const DataTabs: React.FC<{ module: 'tecban' | 'cash_projections' | 'indicators'; children: React.ReactNode }> = ({ module, children }) => {
  const [tab, setTab] = useState<'main' | 'data'>('main');
  return (
    <div>
      <div className="px-8 pt-6 max-w-7xl mx-auto">
        <div className="inline-flex bg-slate-100 rounded-xl p-1">
          {[['main', 'Visão geral'], ['data', 'Dados']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k as any)} className={`px-4 py-1.5 text-sm rounded-lg font-medium transition ${tab === k ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>{l}</button>
          ))}
        </div>
      </div>
      {tab === 'main' ? children : <div className="p-8 max-w-7xl mx-auto"><ImportedDataTab module={module} /></div>}
    </div>
  );
};
