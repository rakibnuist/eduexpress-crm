import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, DollarSign,
  UserCheck, Settings, Menu, X, GraduationCap, LogOut, Eye, Plane, Sun, FileBarChart, Search, Wifi, WifiOff, MessageSquare, Megaphone, Zap, Moon, PlusCircle, Globe
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '../api';
import { useToast } from './Toast';
import { useDarkMode } from '../hooks/useDarkMode';
import NotificationBell from './NotificationBell';
import { getNavForUser, getPrimaryRoleLabel, getPrimaryRoleBadgeClass } from '../lib/roles';

// Icon map for dynamic nav generation
const ICON_MAP = {
  LayoutDashboard,
  Eye,
  FileBarChart,
  Sun,
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
};

export default function Layout({ children, user, onLogout }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggle } = useDarkMode();

  // Generate navigation dynamically from user's roles (exclude action-only items)
  const nav = getNavForUser(user)
    .filter(item => !item.isAction)
    .map(item => ({
      ...item,
      icon: ICON_MAP[item.icon] || LayoutDashboard,
    }));

  const pageTitle = nav.find(n => location.pathname === n.to || (n.to !== '/' && location.pathname.startsWith(n.to)))?.label || 'Core';

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
          
          const todayStr = new Date().toISOString().slice(0, 10);
          const timeStr = new Date().toTimeString().slice(0, 5);
          
          api.checkIn({
            emp_id: user.emp_id,
            date: todayStr,
            time: timeStr,
            ssid: ssid,
            source: 'wifi'
          }).then(res => {
            toast.success(`⚡ Auto Wi-Fi Attendance: Checked in via "${ssid}"`);
            setAttMsg(`✓ Automatically checked in via Office Wi-Fi: "${ssid}" at ${res.check_in} (${res.status})`);
          }).catch(err => {
            console.log('[Auto-WiFi] Status:', err.message);
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
            <p className="text-xs text-slate-400 truncate">International Core</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto lg:px-2 lg:group-hover:px-3 transition-all duration-300">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all lg:px-2.5 lg:group-hover:px-3
                ${isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`
              }>
              <Icon size={17} className="flex-shrink-0" />
              <span className="flex-1 transition-all duration-300 lg:opacity-0 lg:w-0 lg:group-hover:opacity-100 overflow-hidden whitespace-nowrap">{label}</span>
            </NavLink>
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

            {/* Dark Mode Toggle */}
            <button
              onClick={toggle}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Auto Wi-Fi Attendance Indicator & Simulator */}
            {wifiConfigured && (
              <button
                onClick={toggleWifiSimulation}
                title={
                  wifiSSID 
                    ? `Connected to Office Wi-Fi "${wifiSSID}". Attendance active. Click to disconnect simulated network.`
                    : `Office Wi-Fi configured ("${wifiConfigured}"). Click to simulate network connection for auto-attendance.`
                }
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 ${
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

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}