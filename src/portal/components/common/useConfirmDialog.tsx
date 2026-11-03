// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import React, { useCallback, useState } from 'react';

export function useConfirmDialog() {
  const [state, setState] = useState<{open:boolean; title:string; message:string}>({open:false,title:'Confirmar exclusão',message:''});
  const [resolver, setResolver] = useState<((value:boolean)=>void)|null>(null);

  const confirm = useCallback((message:string, title='Confirmar exclusão') => new Promise<boolean>((resolve) => {
    setState({open:true,title,message});
    setResolver(() => resolve);
  }), []);

  const close = (value:boolean) => {
    setState((s) => ({...s,open:false}));
    const resolve = resolver;
    setResolver(null);
    resolve?.(value);
  };

  const dialog = state.open ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 id="confirm-dialog-title" className="text-sm font-bold text-slate-900">{state.title}</h2>
        </div>
        <div className="px-5 py-5 text-sm text-slate-600">{state.message}</div>
        <div className="px-5 py-4 flex justify-end gap-2 bg-slate-50 rounded-b-xl">
          <button type="button" onClick={() => close(false)} className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-white">Cancelar</button>
          <button type="button" onClick={() => close(true)} className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700">Excluir</button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, confirmDialog: dialog };
}
