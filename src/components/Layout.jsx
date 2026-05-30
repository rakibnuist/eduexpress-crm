import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Kanban, DollarSign,
  UserCheck, Settings, Menu, X, GraduationCap, LogOut, Eye,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '../api';

const baseNav = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/cockpit',  icon: Eye,             label: 'Cockpit',  adminOnly: true },
  { to: '/leads',    icon: Users,           label: 'All Leads' },
  { to: '/pipeline', icon: Kanban,          label: 'Pipeline' },
  { to: '/finance',  icon: DollarSign,      label: 'Finance',  adminOnly: true },
  { to: '/hr',       icon: UserCheck,       label: 'HR',       adminOnly: true },
  { to: '/settings', icon: Settings,        label: 'Settings', adminOnly: true },
];

export default function Layout({ children, user, onLogout }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const nav = baseNav.filter(n => !n.adminOnly || isAdmin);
  const pageTitle = nav.find(n => location.pathname === n.to || (n.to !== '/' && location.pathname.startsWith(n.to)))?.label || 'CRM';

  const logout = async () => {
    try { await api.logout(); } catch {}
    onLogout?.();
    navigate('/login');
  };

  const initials = (user?.name || 'A').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  // Show the brief auto-attendance message set during login (e.g. "✓ Checked in at 09:32").
  const [attMsg, setAttMsg] = useState(() => sessionStorage.getItem('att_msg'));
  useEffect(() => {
    if (!attMsg) return;
    sessionStorage.removeItem('att_msg');
    const t = setTimeout(() => setAttMsg(null), 6000);
    return () => clearTimeout(t);
  }, [attMsg]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-slate-200 flex flex-col
        transition-transform duration-200 lg:translate-x-0 lg:static
        ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>

        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-100 flex-shrink-0">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
            <GraduationCap size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-800 text-sm leading-tight">EduExpress</p>
            <p className="text-xs text-slate-400 truncate">International CRM</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`
              }>
              <Icon size={17} className="flex-shrink-0" />
              <span className="flex-1">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex-shrink-0">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-blue-700">EduExpress International</p>
            <p className="text-xs text-blue-400 mt-0.5">Student Consultancy CRM</p>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-6 gap-3 flex-shrink-0 shadow-sm">
          <button className="lg:hidden p-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            onClick={() => setOpen(o => !o)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="text-sm font-semibold text-slate-700 flex-1">{pageTitle}</h1>
          <div className="flex items-center gap-2.5">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-slate-700">{user?.name || 'User'}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.role || ''}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {initials}
            </div>
            <button onClick={logout} title="Log out"
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <LogOut size={17} />
            </button>
          </div>
        </header>

        {attMsg && (
          <div className="bg-emerald-50 border-b border-emerald-100 text-emerald-700 text-xs px-4 lg:px-6 py-2 flex items-center justify-between">
            <span>{attMsg}</span>
            <button onClick={() => setAttMsg(null)} className="text-emerald-500 hover:text-emerald-700">
              <X size={13} />
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
