import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function Modal({ title, onClose, children, wide, icon: Icon }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] w-full overflow-hidden ${wide ? 'max-w-3xl' : 'max-w-lg'}`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            {Icon && <Icon size={16} className="text-blue-400" />}
            <h2 className="font-bold text-sm uppercase tracking-wider text-white">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
