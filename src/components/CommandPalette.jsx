/* CommandPalette — Cmd+K (or Ctrl+K) anywhere in the app.
   - Type to search across leads (by name / id / phone / passport)
   - Recognises pages by name: dashboard, cockpit, reports, my day, leads, etc.
   - ↑↓ to navigate, Enter to go.
*/
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import {
  Search, X, ArrowRight, LayoutDashboard, Eye, FileBarChart, Sun, Users,
  Plane, DollarSign, UserCheck, Settings, MessageSquare, GraduationCap,
} from 'lucide-react';

const PAGES = [
  { id: 'dashboard',    label: 'Dashboard',      to: '/',             icon: LayoutDashboard, keys: 'home dashboard' },
  { id: 'cockpit',      label: 'Cockpit',        to: '/cockpit',      icon: Eye,             keys: 'cockpit live alerts',     staffOnly: true },
  { id: 'reports',      label: 'Reports',        to: '/reports',      icon: FileBarChart,    keys: 'reports weekly monthly',  staffOnly: true },
  { id: 'my-day',       label: 'My Day',         to: '/my-day',       icon: Sun,             keys: 'my day daily log' },
  { id: 'leads',        label: 'Leads & Pipeline', to: '/leads',        icon: Users,           keys: 'leads students pipeline sales board kanban' },
  { id: 'applications', label: 'Applications',   to: '/applications', icon: Plane,           keys: 'applications kanban' },
  { id: 'finance',      label: 'Finance',        to: '/finance',      icon: DollarSign,      keys: 'finance cashflow money',  adminOnly: true },
  { id: 'hr',           label: 'HR',             to: '/hr',           icon: UserCheck,       keys: 'hr employees attendance payroll', adminOnly: true },
  { id: 'settings',     label: 'Settings',       to: '/settings',     icon: Settings,        keys: 'settings users import',   adminOnly: true },
];

export default function CommandPalette({ user }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [active, setActive]   = useState(0);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const ulRef    = useRef(null);

  // Global hotkey
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Reset state when opening
  useEffect(() => { if (open) { setTimeout(() => inputRef.current?.focus(), 0); setQuery(''); setActive(0); } }, [open]);

  const isStaff = user?.role === 'admin' || user?.role === 'manager';
  const isAdmin = user?.role === 'admin';
  const visiblePages = useMemo(() => PAGES.filter(p =>
    (!p.staffOnly || isStaff) && (!p.adminOnly || isAdmin)
  ), [isStaff, isAdmin]);

  // Search effect: debounced lead lookup + page filter
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    setActive(0);

    // No query: just show pages
    if (!q) { setResults(visiblePages.map(p => ({ kind: 'page', ...p }))); return; }

    // Filter pages instantly
    const lower = q.toLowerCase();
    const pageMatches = visiblePages
      .filter(p => p.label.toLowerCase().includes(lower) || p.keys.includes(lower))
      .map(p => ({ kind: 'page', ...p }));

    setSearching(true);
    const t = setTimeout(() => {
      api.leads({ search: q, limit: 8 })
        .then(d => {
          const leadMatches = (d.leads || []).map(l => ({
            kind: 'lead', id: l.id, lead_id: l.lead_id, name: l.client_name,
            destination: l.destination, phone: l.phone, status: l.lead_status,
          }));
          setResults([...pageMatches, ...leadMatches]);
        })
        .catch(() => setResults(pageMatches))
        .finally(() => setSearching(false));
    }, 180);

    return () => { clearTimeout(t); setSearching(false); };
  }, [query, open, visiblePages]);

  // Keep the active row in view
  useEffect(() => {
    if (!ulRef.current) return;
    const el = ulRef.current.querySelector(`[data-i="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter')   { e.preventDefault(); pick(results[active]); }
  };

  const pick = (r) => {
    if (!r) return;
    setOpen(false);
    if (r.kind === 'page') navigate(r.to);
    if (r.kind === 'lead') navigate(`/leads/${r.id}`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[105] flex items-start justify-center pt-[10vh] px-4 bg-black/40 backdrop-blur-sm"
      onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search size={18} className="text-slate-400" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKey}
            placeholder="Search leads, jump to a page…"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-slate-400" />
          {searching && <span className="text-[11px] text-slate-400">searching…</span>}
          <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={15} /></button>
        </div>

        {/* Results */}
        <ul ref={ulRef} className="max-h-[60vh] overflow-y-auto py-1.5">
          {results.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-slate-400">
              {query ? 'No matches' : 'Start typing — leads by name/id/phone, or pages by keyword'}
            </li>
          ) : results.map((r, i) => (
            <li key={r.kind + '-' + (r.id || r.to)} data-i={i}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(r)}
              className={`px-4 py-2.5 cursor-pointer flex items-center gap-3 ${i === active ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
              {r.kind === 'page' ? (
                <>
                  <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600"><r.icon size={14}/></div>
                  <span className="flex-1 text-sm text-slate-700">{r.label}</span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wide">Page</span>
                </>
              ) : (
                <>
                  <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><GraduationCap size={14}/></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{r.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      <span className="font-mono">{r.lead_id}</span>
                      {r.destination && <> · {r.destination}</>}
                      {r.phone && <> · {r.phone}</>}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400">{r.status}</span>
                </>
              )}
              {i === active && <ArrowRight size={13} className="text-blue-500" />}
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/60 flex justify-between text-[11px] text-slate-400">
          <span>↑↓ to navigate · Enter to select</span>
          <span>{navigator.platform.includes('Mac') ? '⌘ + K' : 'Ctrl + K'} anywhere</span>
        </div>
      </div>
    </div>
  );
}
