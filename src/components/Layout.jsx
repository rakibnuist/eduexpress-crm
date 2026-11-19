import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, DollarSign,
  UserCheck, Settings, Menu, X, GraduationCap, LogOut, Eye, Plane, Sun, Activity, FileBarChart, Search, Wifi, WifiOff, MessageSquare, Megaphone, Zap, PlusCircle, Globe, MousePointerClick,
  Command, ClipboardCheck, ListChecks
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '../api';
import { useToast } from './Toast';
import NotificationBell from './NotificationBell';
import { getNavForUser, getPrimaryRoleLabel, getPrimaryRoleBadgeClass, NAV_GROUPS, isFullAdmin } from '../lib/roles';

// Icon map for dynamic nav generation
const ICON_MAP = {
  LayoutDashboard,
  Command,
  Eye,
  FileBarChart,
  Sun,
  Activity,
  Users,
  Plane,
  PlusCircle,
  MessageSquare,
  Megaphone,
  Zap,
  DollarSign,
  UserCheck,
  Settings,
  Globe,
  MousePointerClick,
  ClipboardCheck,
  ListChecks,
};

export default function Layout({ children, user, onLogout }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Generate navigation dynamically from user's roles (exclude action-only items)
  const nav = getNavForUser(user)
    .filter(item => !item.isAction)
    .map(item => ({
      ...item,
      icon: ICON_MAP[item.icon] || LayoutDashboard,
    }));

  const pageTitle = nav.find(n => location.pathname === n.to || (n.to !== '/' && location.pathname.startsWith(n.to)))?.label || 'EduExpress Command';

  // Grouped navigation keeps daily work, growth, control and admin separate.
  const groupedNav = NAV_GROUPS
    .map(group => ({ group, items: nav.filter(item => item.group === group) }))
    .filter(g => g.items.length > 0);

  const [badges, setBadges] = useState({ approvals: 0, tasks: 0, overdueTasks: 0 });
  useEffect(() => {
    if (!isFullAdmin(user)) return;
    let alive = true;
    api.ceoBadges()
      .then(b => { if (alive) setBadges(b || { approvals: 0, tasks: 0, overdueTasks: 0 }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [user, location.pathname]);

  const logout = async () => {
    try { await api.logout(); } catch {}
    onLogout?.();
    navigate('/login');
  };

  const initials = (user?.name || 'A').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  const roleLabel = getPrimaryRoleLabel(user);
  const roleBadgeClass = getPrimaryRoleBadgeClass(user);

  const [attMsg, setAttMsg] = useState(() => sessionStorage.getItem('att_msg'));
  const [wifiSSID, setWifiSSID] = useState(null);
  const [wifiConfigured, setWifiConfigured] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (!attMsg) return;
    sessionStorage.removeItem('att_msg');
    const t = setTimeout(() => setAttMsg(null), 6000);
    return () => clearTimeout(t);
  }, [attMsg]);

  useEffect(() => {
    if (!user?.emp_id) return;

    api.officeConfig().then(cfg => {
      const ssid = cfg.office_wifi_ssid;
      if (ssid) {
        setWifiConfigured(ssid);
        
        const isSimulated = localStorage.getItem('simulated_wifi') !== 'false';
        if (isSimulated) {
          setWifiSSID(ssid);

          const now = new Date();
          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const timeStr = now.toTimeString().slice(0, 5);
          const checkinKey = `wifi_checkin_${user.emp_id}_${todayStr}`;

          // Only try once per browser session and never when the login flow
          // already produced an attendance message. This keeps page reloads
          // from firing a duplicate check-in request (and a 409) each time.
          if (sessionStorage.getItem(checkinKey)) return;
          sessionStorage.setItem(checkinKey, '1');
          if (sessionStorage.getItem('att_msg')) return;

          api.attendance({ date: todayStr, emp_id: user.emp_id })
            .then(rows => {
              if (Array.isArray(rows) && rows.length > 0) return; // already checked in today
              return api.checkIn({
                emp_id: user.emp_id,
                date: todayStr,
                time: timeStr,
                ssid: ssid,
                source: 'wifi'
              }).then(res => {
                setAttMsg(`✓ Automatically checked in via Office Wi-Fi: "${ssid}" at ${res.check_in} (${res.status})`);
              });
            })
            .catch(err => {
              if (!/already checked in/i.test(err.message || '')) {
                console.warn('[Auto-WiFi] Check-in skipped:', err.message);
              }
            });
        }
      }
    }).catch(err => console.error('Failed to load office config:', err));
  }, [user, toast]);

  const toggleWifiSimulation = () => {
    if (wifiSSID) {
      setWifiSSID(null);
      localStorage.setItem('simulated_wifi', 'false');
      toast.info('Disconnected from simulated Office Wi-Fi network');
    } else if (wifiConfigured) {
      setWifiSSID(wifiConfigured);
      localStorage.setItem('simulated_wifi', 'true');
      toast.success(`Connected to Office Wi-Fi: "${wifiConfigured}"`);
      
      const todayStr = new Date().toISOString().slice(0, 10);
      const timeStr = new Date().toTimeString().slice(0, 5);
      api.checkIn({
        emp_id: user.emp_id,
        date: todayStr,
        time: timeStr,
        ssid: wifiConfigured,
        source: 'wifi'
      }).then(res => {
        toast.success(`⚡ Auto Wi-Fi Attendance: Checked in via "${wifiConfigured}"`);
        setAttMsg(`✓ Automatically checked in via Office Wi-Fi: "${wifiConfigured}" at ${res.check_in} (${res.status})`);
      }).catch(err => {
        toast.info(err.message.includes('Already') ? 'Already checked in today' : err.message);
      });
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      {/* Sidebar spacer for desktop to prevent layout shift */}
      <div className="hidden lg:block lg:w-16 lg:flex-shrink-0 transition-all duration-300" />

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-slate-200 flex flex-col group
        transition-all duration-300 ease-in-out lg:translate-x-0 lg:w-16 lg:hover:w-60 lg:hover:shadow-2xl lg:absolute
        ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>

        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-100 flex-shrink-0 lg:px-3.5 lg:group-hover:px-5 transition-all duration-300">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
            <GraduationCap size={18} className="text-white" />
          </div>
          <div className="min-w-0 transition-all duration-300 lg:opacity-0 lg:w-0 lg:group-hover:opacity-100 overflow-hidden whitespace-nowrap">
            <p className="font-bold text-slate-800 text-sm leading-tight">EduExpress</p>
            <p className="text-xs text-slate-400 truncate">Remote Command</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-3 overflow-y-auto lg:px-2 lg:group-hover:px-3 transition-all duration-300">
          {groupedNav.map(({ group, items }, gi) => (
            <div key={group} className={gi > 0 ? 'mt-2.5' : ''}>
              <p className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 whitespace-nowrap
                transition-all duration-300 lg:px-2.5 lg:group-hover:px-3 lg:opacity-0 lg:h-0 lg:pt-0 lg:pb-0 lg:overflow-hidden
                lg:group-hover:opacity-100 lg:group-hover:h-auto lg:group-hover:pt-2 lg:group-hover:pb-1">
                {group}
              </p>
              <div className="space-y-0.5">
                {items.map(({ to, icon: Icon, label, badgeKey }) => {
                  const badge = badgeKey ? Number(badges[badgeKey] || 0) : 0;
                  return (
                    <NavLink key={to + label} to={to} end={to === '/'}
                      onClick={() => setOpen(false)}
                      title={label}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all lg:px-2.5 lg:group-hover:px-3
                        ${isActive
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`
                      }>
                      <span className="relative flex-shrink-0">
                        <Icon size={17} />
                        {badge > 0 && (
                          <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white">
                            {badge > 99 ? '99+' : badge}
                          </span>
                        )}
                      </span>
                      <span className="flex-1 transition-all duration-300 lg:opacity-0 lg:w-0 lg:group-hover:opacity-100 overflow-hidden whitespace-nowrap">{label}</span>
                      {badge > 0 && (
                        <span className="hidden lg:group-hover:inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer — current user pill */}
        <div className="p-3 border-t border-slate-100 flex-shrink-0 lg:p-1.5 lg:group-hover:p-3 transition-all duration-300">
          <div className="bg-slate-50 hover:bg-slate-100 rounded-xl p-2.5 flex items-center gap-2.5 transition-all duration-300 lg:p-1 lg:group-hover:p-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-xs">
              {initials}
            </div>
            <div className="min-w-0 flex-1 transition-all duration-300 lg:opacity-0 lg:w-0 lg:group-hover:opacity-100 overflow-hidden whitespace-nowrap">
              <p className="text-xs font-semibold text-slate-800 truncate">{user?.name || 'User'}</p>
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${roleBadgeClass}`}>{roleLabel}</span>
                <span className="text-[10px] text-slate-400 truncate">{user?.email}</span>
              </div>
            </div>
            <button onClick={logout} title="Log out" aria-label="Log out"
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0 lg:opacity-0 lg:w-0 lg:group-hover:opacity-100 lg:group-hover:w-auto overflow-hidden">
              <LogOut size={14} />
            </button>
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
            onClick={() => setOpen(o => !o)}
            aria-label={open ? "Close menu" : "Open menu"}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="text-sm font-semibold text-slate-700 flex-1 truncate">{pageTitle}</h1>
          <div className="flex items-center gap-2.5">
            {/* Quick search — opens the command palette */}
            <button
              onClick={() => {
                const isMac = navigator.platform.includes('Mac');
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: isMac, ctrlKey: !isMac, bubbles: true }));
              }}
              title="Search (⌘K)"
              className="hidden sm:flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
              <Search size={13} />
              <span className="hidden lg:inline">Search</span>
              <kbd className="hidden lg:inline text-[10px] font-mono bg-slate-100 text-slate-500 px-1 rounded">⌘K</kbd>
            </button>
            <NotificationBell user={user} />

            {/* Auto Wi-Fi Attendance Indicator & Simulator */}
            {wifiConfigured && (
              <button
                onClick={toggleWifiSimulation}
                title={
                  wifiSSID 
                    ? `Connected to Office Wi-Fi "${wifiSSID}". Attendance active. Click to disconnect simulated network.`
                    : `Office Wi-Fi configured ("${wifiConfigured}"). Click to simulate network connection for auto-attendance.`
                }
                className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 ${
                  wifiSSID
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="relative flex h-1.5 w-1.5 flex-shrink-0">
                  {wifiSSID && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${wifiSSID ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                </div>
                {wifiSSID ? <Wifi size={13} className="animate-pulse text-emerald-600" /> : <WifiOff size={13} />}
                <span className="max-w-[100px] truncate hidden sm:inline">
                  {wifiSSID ? wifiSSID : 'Not connected'}
                </span>
              </button>
            )}

            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-slate-700">{user?.name || 'User'}</p>
              <p className="text-xs text-slate-400 capitalize">{roleLabel}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {initials}
            </div>
            <button onClick={logout} title="Log out" aria-label="Log out"
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <LogOut size={17} />
            </button>
          </div>
        </header>

        {attMsg && (
          <div className="bg-emerald-50 border-b border-emerald-100 text-emerald-700 text-xs px-4 lg:px-6 py-2 flex items-center justify-between">
            <span>{attMsg}</span>
            <button onClick={() => setAttMsg(null)} className="text-emerald-500 hover:text-emerald-700" aria-label="Dismiss message">
              <X size={13} />
            </button>
          </div>
        )}

        <main className={`flex-1 ${location.pathname.startsWith('/conversations') ? 'flex flex-col overflow-hidden' : 'overflow-y-auto p-4 lg:p-6'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}