import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ApiClient } from '../../services/api';
import { isAdminUser } from '../../utils/access';
import { useConfirmDialog } from './useConfirmDialog';

export function useIsAdmin(): boolean {
  const { user } = useAuth() as any;
  return isAdminUser(user);
}

export function useBulkSelect(ids: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const valid = useMemo(() => new Set(ids), [ids]);
  const current = useMemo(() => new Set([...selected].filter((id) => valid.has(id))), [selected, valid]);
  const allChecked = ids.length > 0 && ids.every((id) => current.has(id));
  return {
    selected: current,
    isSelected: (id: string) => current.has(id),
    toggle: (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n; }),
    toggleAll: () => setSelected(allChecked ? new Set() : new Set(ids)),
    allChecked,
    clear: () => setSelected(new Set()),
  };
}

export const CheckCell: React.FC<{ checked: boolean; onChange: () => void; header?: boolean; title?: string }> = ({ checked, onChange, header, title }) => {
  const input = <input type="checkbox" className="h-3.5 w-3.5 accent-[#0F2744] cursor-pointer" checked={checked} onChange={onChange} title={title} aria-label={title} />;
  return header ? <th className="py-3 px-3 w-8">{input}</th> : <td className="py-3 px-3 w-8">{input}</td>;
};

export const BulkDeleteBar: React.FC<{
  sel: ReturnType<typeof useBulkSelect>;
  urlFor: (id: string) => string;
  onDone: () => void | Promise<void>;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}> = ({ sel, urlFor, onDone, onError, onSuccess }) => {
  const [busy, setBusy] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();
  const n = sel.selected.size;
  if (n === 0) return null;
  const run = async () => {
    if (!(await confirm(`Confirma a exclusão de ${n} registro(s) selecionado(s)? Esta ação não pode ser desfeita.`))) return;
    setBusy(true);
    const failures: string[] = [];
    let ok = 0;
    for (const id of sel.selected) {
      try { await ApiClient.request(urlFor(id), { method: 'DELETE' }); ok++; }
      catch (e: any) { failures.push(e?.message || String(e)); }
    }
    setBusy(false);
    sel.clear();
    await onDone();
    if (failures.length) onError?.(`${ok} excluído(s), ${failures.length} não excluído(s): ${[...new Set(failures)].join(' | ')}`);
    else onSuccess?.(`${ok} registro(s) excluído(s).`);
  };
  return (
    <>{confirmDialog}<div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs">
      <span className="font-semibold text-rose-800">{n} selecionado(s)</span>
      <div className="flex gap-2">
        <button type="button" onClick={sel.clear} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold">Limpar seleção</button>
        <button type="button" disabled={busy} onClick={run} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
          <Trash2 className="w-3.5 h-3.5" />{busy ? 'Excluindo...' : 'Excluir selecionados'}
        </button>
      </div>
    </div></>
  );
};
