/* Confirm — a proper modal-based replacement for window.confirm().
   Usage:
     const confirm = useConfirm();
     const ok = await confirm({
       title: 'Delete lead?', body: 'This cannot be undone.',
       confirmLabel: 'Delete', tone: 'danger'
     });
     if (ok) { ... }
*/
import { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, Trash2, Info } from 'lucide-react';

const ConfirmCtx = createContext(() => Promise.resolve(false));
export function useConfirm() { return useContext(ConfirmCtx); }

const TONES = {
  default: { icon: Info, accent: 'text-slate-600', btn: 'bg-blue-600 hover:bg-blue-700' },
  danger:  { icon: Trash2,        accent: 'text-rose-600',  btn: 'bg-rose-600 hover:bg-rose-700' },
  warn:    { icon: AlertTriangle, accent: 'text-amber-600', btn: 'bg-amber-600 hover:bg-amber-700' },
};

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback((opts) => new Promise(resolve => {
    setState({ ...opts, resolve });
  }), []);

  const close = (value) => {
    state?.resolve(value);
    setState(null);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && <Dialog state={state} onCancel={() => close(false)} onConfirm={() => close(true)} />}
    </ConfirmCtx.Provider>
  );
}

function Dialog({ state, onCancel, onConfirm }) {
  const t = TONES[state.tone] || TONES.default;
  const Icon = t.icon;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onCancel} onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); if (e.key === 'Enter') onConfirm(); }}>
      <div onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl bg-slate-50 ${t.accent}`}><Icon size={20}/></div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-slate-800">{state.title || 'Are you sure?'}</h3>
              {state.body && <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{state.body}</p>}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onCancel}
            className="text-sm font-medium px-4 py-2 rounded-xl border border-slate-200 hover:bg-white text-slate-700">
            {state.cancelLabel || 'Cancel'}
          </button>
          <button onClick={onConfirm} autoFocus
            className={`text-sm font-medium px-4 py-2 rounded-xl text-white ${t.btn}`}>
            {state.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
