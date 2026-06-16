/* Toast — a tiny notification system used everywhere in place of alert().
   Usage:
     import { useToast } from '../components/Toast';
     const toast = useToast();
     toast.success('Saved');     // green
     toast.error(e.message);     // red
     toast.info('Heads up');     // slate
   Auto-dismisses after 4 s. Click X to dismiss earlier.
*/
import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastCtx = createContext({ push: () => {}, success: () => {}, error: () => {}, info: () => {} });

export function useToast() { return useContext(ToastCtx); }

const STYLES = {
  success: { icon: CheckCircle2, ring: 'ring-emerald-200', bar: 'bg-emerald-500',  bg: 'bg-emerald-50',  text: 'text-emerald-800', iconCls: 'text-emerald-500' },
  error:   { icon: AlertCircle,  ring: 'ring-rose-200',    bar: 'bg-rose-500',     bg: 'bg-rose-50',     text: 'text-rose-800',    iconCls: 'text-rose-500'    },
  info:    { icon: Info,         ring: 'ring-slate-200',   bar: 'bg-slate-400',    bg: 'bg-white',       text: 'text-slate-800',   iconCls: 'text-slate-500'   },
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const push = useCallback((kind, message, opts = {}) => {
    const id = Date.now() + Math.random();
    const duration = opts.duration ?? (kind === 'error' ? 6000 : 3500);
    setItems(prev => [...prev, { id, kind, message: String(message || ''), duration }]);
    if (duration > 0) {
      setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), duration);
    }
    return id;
  }, []);

  const dismiss = useCallback((id) => setItems(prev => prev.filter(t => t.id !== id)), []);

  // Stable reference — wrap in useMemo so consumers that include `toast` in
  // useCallback/useEffect deps don't re-run on every toast notification.
  const api = useMemo(() => ({
    push,
    success: (m, opts) => push('success', m, opts),
    error:   (m, opts) => push('error',   m, opts),
    info:    (m, opts) => push('info',    m, opts),
  }), [push]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none w-full max-w-sm">
        {items.map(t => <ToastItem key={t.id} t={t} onClose={() => dismiss(t.id)} />)}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastItem({ t, onClose }) {
  const s = STYLES[t.kind] || STYLES.info;
  const Icon = s.icon;
  const [open, setOpen] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setOpen(true)); }, []);

  return (
    <div className={`pointer-events-auto rounded-xl shadow-lg border border-slate-100 overflow-hidden transition-all duration-200
      ${open ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-3'} ${s.bg} ring-1 ${s.ring}`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <Icon size={18} className={`${s.iconCls} flex-shrink-0 mt-0.5`} />
        <p className={`flex-1 text-sm font-medium ${s.text} whitespace-pre-wrap`}>{t.message}</p>
        <button onClick={onClose} className={`${s.iconCls} hover:opacity-70`} aria-label="Close notification"><X size={15} /></button>
      </div>
      <div className={`h-0.5 ${s.bar}`} />
    </div>
  );
}
