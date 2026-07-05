/* NotificationBell — live in-app notifications powered by SSE.
   - Subscribes to /api/events and listens for 'activity' messages.
   - Shows unread badge (vs lastSeenId persisted in localStorage per user).
   - Dropdown lists recent notifications, click an item to mark all read.
   - Triggers a desktop notification when the tab is hidden + an important
     event happens (configurable via Notification permission).
*/
import { useEffect, useRef, useState } from 'react';
import { Bell, X, CheckCircle2, UserPlus, DollarSign, Tag, Users, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { isFullAdmin } from '../lib/roles';

const LS_KEY = (uid) => `notif_seen_${uid || 'guest'}`;
const fmt = (n) => {
  const v = Number(n || 0);
  if (v >= 100000) return `৳${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)   return `৳${(v / 1000).toFixed(1)}K`;
  return `৳${v.toLocaleString()}`;
};
const timeAgo = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') ? iso : iso.replace(' ', 'T') + 'Z');
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60)    return `${Math.floor(s)}s`;
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

function describe(a) {
  switch (a.type) {
    case 'lead_created':        return { icon: <UserPlus size={14}/>, color: 'text-blue-600 bg-blue-50',
      text: <><strong>{a.actor_name}</strong> added a new lead <strong>{a.lead_name}</strong></>, important: true };
    case 'lead_status_changed': return { icon: <Tag size={14}/>, color: 'text-violet-600 bg-violet-50',
      text: <><strong>{a.actor_name}</strong> moved <strong>{a.lead_name}</strong> → {a.to_value}</>,
      important: a.to_value === 'Enrolled' || a.to_value === 'Not Interested' };
    case 'lead_assigned':       return { icon: <Users size={14}/>, color: 'text-indigo-600 bg-indigo-50',
      text: <><strong>{a.actor_name}</strong> assigned <strong>{a.lead_name}</strong> to {a.to_value || '—'}</> };
    case 'lead_payment':
    case 'payment_recorded':    return { icon: <DollarSign size={14}/>, color: 'text-emerald-600 bg-emerald-50',
      text: <><strong>{a.actor_name}</strong> recorded payment of <strong>{fmt(a.amount)}</strong>{a.lead_name ? <> for {a.lead_name}</> : null}</>, important: true };
    case 'expense_recorded':    return { icon: <DollarSign size={14}/>, color: 'text-rose-600 bg-rose-50',
      text: <><strong>{a.actor_name}</strong> logged expense of <strong>{fmt(a.amount)}</strong></> };
    case 'attendance_in':       return { icon: <CheckCircle2 size={14}/>, color: 'text-emerald-600 bg-emerald-50',
      text: <><strong>{a.actor_name}</strong> checked in at {a.to_value}</> };
    case 'user_created':        return { icon: <UserPlus size={14}/>, color: 'text-slate-600 bg-slate-100',
      text: <><strong>{a.actor_name}</strong> created an account for {a.to_value}</> };
    default:                    return { icon: <Activity size={14}/>, color: 'text-slate-500 bg-slate-50',
      text: <>{a.type.replace(/_/g, ' ')}</> };
  }
}

export default function NotificationBell({ user }) {
  const [items, setItems]   = useState([]);
  const [open, setOpen]     = useState(false);
  const [lastSeen, setLastSeen] = useState(() => parseInt(localStorage.getItem(LS_KEY(user?.id))) || 0);
  const [connected, setConnected] = useState(false);
  const wrapperRef = useRef(null);

  // Ask for desktop-notification permission once
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Load initial recent activity (last 30) so the bell isn't empty on first open
  useEffect(() => {
    api.activity({ limit: 30 }).then(rows => setItems(rows || [])).catch(() => {});
  }, []);

  // SSE — live push
  useEffect(() => {
    let es;
    let retry;
    let delay = 2000;
    const connect = () => {
      es = new EventSource('/api/events', { withCredentials: true });
      es.onopen = () => { setConnected(true); delay = 2000; };
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type !== 'activity' || !data.activity) return;
          const a = data.activity;
          setItems(prev => [a, ...prev].slice(0, 100));

          // Desktop notification when the page is in the background
          if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            const meta = describe(a);
            // Strip JSX → plain string body
            const body = typeof meta.text === 'string' ? meta.text : `${a.actor_name} · ${a.type.replace(/_/g, ' ')}${a.lead_name ? ` · ${a.lead_name}` : ''}`;
            try { new Notification('EduExpress Core', { body, icon: '/favicon.ico', tag: `act-${a.id}`, silent: !meta.important }); }
            catch {}
          }
        } catch {}
      };
      es.onerror = () => {
        setConnected(false);
        try { es.close(); } catch {}
        retry = setTimeout(connect, delay);
        delay = Math.min(delay * 1.5, 30000);
      };
    };
    connect();
    return () => { clearTimeout(retry); try { es?.close(); } catch {} };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!wrapperRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const unread = items.filter(a => a.id > lastSeen).length;

  const markAllRead = () => {
    const maxId = items[0]?.id || lastSeen;
    setLastSeen(maxId);
    localStorage.setItem(LS_KEY(user?.id), String(maxId));
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button onClick={() => { setOpen(o => !o); if (!open) markAllRead(); }}
        className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg" title="Notifications" aria-label="Notifications">
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
        <span className={`absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-slate-300'}`} title={connected ? 'Live' : 'Offline'} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[92vw] bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-800 text-sm">Notifications</p>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {connected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>

          {items.length === 0 ? (
            <div className="p-8 text-center">
              <Bell size={28} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No notifications yet</p>
              <p className="text-xs text-slate-300 mt-1">You'll see actions here as they happen</p>
            </div>
          ) : (
            <div className="max-h-[480px] overflow-y-auto divide-y divide-slate-50">
              {items.slice(0, 40).map(a => {
                const meta = describe(a);
                const isNew = a.id > lastSeen;
                return (
                  <Link key={a.id} to={a.lead_id ? `/leads?q=${encodeURIComponent(a.lead_name || '')}` : '/cockpit'}
                    onClick={() => setOpen(false)}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${isNew ? 'bg-blue-50/30' : ''}`}>
                    <div className={`p-1.5 rounded-lg flex-shrink-0 ${meta.color}`}>{meta.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 leading-snug">{meta.text}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{timeAgo(a.created_at)} ago</p>
                    </div>
                    {isNew && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />}
                  </Link>
                );
              })}
            </div>
          )}

          {isFullAdmin(user) && (
            <Link to="/cockpit" onClick={() => setOpen(false)}
              className="block text-center text-xs font-medium text-blue-600 hover:bg-blue-50 py-2.5 border-t border-slate-100">
              Open Cockpit → view full activity feed
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
