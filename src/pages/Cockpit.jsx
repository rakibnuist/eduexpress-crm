/* Owner's Cockpit — the remote-owner landing page.
   Polls every 30s for live updates. Shows:
   - Today's pulse (attendance, leads, payments, net cash)
   - Live activity feed
   - Alert lanes (idle, unassigned, overdue, outstanding balance)
   - 7-day trend chart
   - Yesterday's recap card */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import {
  Activity, Users, AlertTriangle, Clock, DollarSign, TrendingUp,
  CheckCircle2, UserX, CalendarClock, Wallet, Eye, ArrowRight, RefreshCw,
  CircleCheck, CircleDot, UserPlus, TagIcon, Receipt, MapPin, MessageSquare,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Bar, BarChart, CartesianGrid } from 'recharts';

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
  if (s < 60)     return `${Math.floor(s)}s ago`;
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function Cockpit() {
  useEffect(() => { document.title = "Executive Cockpit | EduExpress Core"; }, []);

  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [tab, setTab] = useState('overview');

  const load = useCallback(async () => {
    setRefreshing(true);
    try { const d = await api.cockpit(); setData(d); setLastSync(new Date()); }
    catch {} finally { setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live: poll every 30s while tab is visible
  useEffect(() => {
    const tick = () => { if (!document.hidden) load(); };
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Loading cockpit…</p>
      </div>
    </div>
  );

  const { today, yesterday, alerts, feed, trend } = data;
  const visaDeadlines = alerts.visaDeadlines || [];
  const totalAlerts = alerts.idleLeads.length + alerts.unassigned.length + alerts.overdueFollowups.length + alerts.outstandingBalance.length + visaDeadlines.length;
  const totalOutstanding = alerts.outstandingBalance.reduce((s, l) => s + (l.balance || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-600 rounded-lg"><Eye size={18} className="text-white"/></div>
            Cockpit
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}<span className="text-emerald-600 font-medium">{new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' })} Dhaka</span>
          </p>
        </div>
        <button onClick={load} disabled={refreshing}
          className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all">
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          {lastSync ? `Synced ${timeAgo(lastSync.toISOString())}` : 'Refresh'}
        </button>
      </div>

      {/* Today pulse cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <PulseCard icon={<Users size={18} />} color="emerald" label="In office today"
          value={`${today.attendance.checkedIn.length}/${today.attendance.totalActive}`}
          sub={today.attendance.missing.length === 0 ? 'Everyone in ✓' : `${today.attendance.missing.length} not checked in`} />
        <PulseCard icon={<UserPlus size={18} />} color="blue" label="New leads today"
          value={today.stats.newLeads}
          sub={`Yesterday: ${yesterday.stats.newLeads}`} />
        <PulseCard icon={<CheckCircle2 size={18} />} color="violet" label="Conversions today"
          value={today.stats.conversions}
          sub={`Yesterday: ${yesterday.stats.conversions}`} />
        <PulseCard icon={<DollarSign size={18} />} color="amber" label="Money in today"
          value={fmt(today.stats.paymentsAmount)}
          sub={`${today.stats.paymentsCount} payment${today.stats.paymentsCount === 1 ? '' : 's'}`} />
        <PulseCard icon={<AlertTriangle size={18} />} color={totalAlerts > 0 ? 'rose' : 'slate'}
          label="Things to look at"
          value={totalAlerts}
          sub={totalAlerts === 0 ? 'All clear' : 'See alerts below'} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100/80 p-1 rounded-xl w-fit border border-slate-200/60">
        {[
          { id: 'overview',   label: 'Overview',          icon: Activity },
          { id: 'attendance', label: 'Attendance',         icon: Clock },
          { id: 'alerts',     label: `Alerts${totalAlerts > 0 ? ` (${totalAlerts})` : ''}`, icon: AlertTriangle },
          { id: 'feed',       label: 'Activity',           icon: TrendingUp },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
            <Icon size={14} className={tab === id ? (id === 'alerts' && totalAlerts > 0 ? 'text-rose-500' : 'text-blue-600') : ''} />
            {label}
            {id === 'alerts' && totalAlerts > 0 && tab !== 'alerts' && (
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"/>
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 7-day trend */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2"><TrendingUp size={15}/> 7-Day Lead Trend</h3>
              <span className="text-xs text-slate-400">New leads per day</span>
            </div>
            <div className="p-5">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trend} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,.1)', fontSize: 12 }}
                    cursor={{ fill: 'rgba(148,163,184,.08)' }} />
                  <Bar dataKey="newLeads" fill="#60a5fa" radius={[5, 5, 0, 0]} name="New leads" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                  <DollarSign size={12} className="text-emerald-500"/> Daily revenue
                </p>
                <ResponsiveContainer width="100%" height={70}>
                  <LineChart data={trend} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <XAxis dataKey="date" hide />
                    <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} formatter={v => fmt(v)} />
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Yesterday recap */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2"><CalendarClock size={15}/> Yesterday</h3>
              <p className="text-xs text-slate-400 mt-0.5">{yesterday.date}</p>
            </div>
            <div className="p-5 space-y-2">
              <Stat label="Attendance" value={`${yesterday.attendance.checkedIn.length}/${yesterday.attendance.totalActive}`} />
              <Stat label="New leads" value={yesterday.stats.newLeads} />
              <Stat label="Conversions" value={yesterday.stats.conversions} />
              <Stat label="Money in" value={fmt(yesterday.stats.paymentsAmount)} highlight="pos" />
              <Stat label="Money out" value={fmt(yesterday.stats.expensesAmount)} highlight="neg" />
              <div className="pt-2 mt-1 border-t border-slate-100">
                <Stat label="Net cash" value={fmt(yesterday.stats.netCash)} highlight={yesterday.stats.netCash >= 0 ? 'pos' : 'neg'} bold />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'attendance' && <AttendanceTab today={today} yesterday={yesterday} />}
      {tab === 'alerts'     && <AlertsTab alerts={alerts} visaDeadlines={visaDeadlines} totalOutstanding={totalOutstanding} />}
      {tab === 'feed'       && <FeedTab feed={feed} />}
    </div>
  );
}

/* ── pieces ─────────────────────────────────────────────────────────────── */
function PulseCard({ icon, label, value, sub, color }) {
  const gradients = {
    blue:    'from-blue-500 to-blue-700',
    emerald: 'from-emerald-500 to-emerald-700',
    violet:  'from-violet-500 to-violet-700',
    amber:   'from-amber-500 to-orange-600',
    rose:    'from-rose-500 to-rose-700',
    slate:   'from-slate-400 to-slate-500',
  };
  const icons = {
    blue:    'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet:  'bg-violet-50 text-violet-600',
    amber:   'bg-amber-50 text-amber-600',
    rose:    'bg-rose-50 text-rose-500',
    slate:   'bg-slate-50 text-slate-500',
  };
  return (
    <div className="relative overflow-hidden bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm hover:shadow-md transition-all group">
      <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl ${gradients[color] || gradients.slate} opacity-[0.06] rounded-bl-3xl pointer-events-none`}/>
      <div className={`p-2.5 rounded-xl ${icons[color]} flex-shrink-0`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-extrabold text-slate-800 leading-tight mt-0.5">{value}</p>
        <p className="text-[11px] text-slate-400 truncate mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight, bold }) {
  const colorMap = { pos: 'text-emerald-600', neg: 'text-rose-600' };
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm font-${bold ? 'extrabold' : 'semibold'} ${colorMap[highlight] || 'text-slate-800'}`}>{value}</span>
    </div>
  );
}

function AttendanceTab({ today, yesterday }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <AttendanceCard title="Today" data={today} />
      <AttendanceCard title="Yesterday" data={yesterday} />
    </div>
  );
}

function AttendanceCard({ title, data }) {
  const { checkedIn, missing } = data.attendance;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-700">{title}</h3>
        <span className="text-xs text-slate-400">{data.date}</span>
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Checked in ({checkedIn.length})</p>
          {checkedIn.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Nobody yet</p>
          ) : (
            <div className="space-y-1.5">
              {checkedIn.map(a => (
                <div key={a.emp_id} className={`flex items-center justify-between p-2 rounded-lg text-sm
                  ${a.status === 'Late' ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <CircleCheck size={14} className={a.status === 'Late' ? 'text-amber-500 flex-shrink-0' : 'text-emerald-500 flex-shrink-0'} />
                    <span className="font-medium text-slate-700 truncate">{a.name}</span>
                    {a.status === 'Late' && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">LATE</span>}
                    {a.source?.startsWith('auto') && <span className="text-[10px] text-slate-400">auto</span>}
                  </div>
                  <div className="text-xs text-slate-500 flex-shrink-0">
                    {a.check_in}{a.check_out ? ` → ${a.check_out}` : ''}
                    {a.hours_worked ? <span className="ml-1 font-semibold">({Number(a.hours_worked).toFixed(1)}h)</span> : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {missing.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Not checked in ({missing.length})</p>
            <div className="space-y-1.5">
              {missing.map(m => (
                <div key={m.emp_id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 text-sm">
                  <CircleDot size={14} className="text-slate-400 flex-shrink-0" />
                  <span className="text-slate-600">{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AlertsTab({ alerts, visaDeadlines = [], totalOutstanding }) {
  return (
    <div className="space-y-4">
      <AlertLane title="Visa deadlines (next 30 days)" icon={<CalendarClock size={16} />} color="rose"
        subtitle="Students whose visa application deadline is approaching"
        rows={visaDeadlines}
        renderMeta={l => <span className="text-xs font-semibold text-rose-700">{l.visa_deadline}</span>}
      />
      <AlertLane title="Idle leads" icon={<Clock size={16} />} color="amber"
        subtitle="No activity in the last 5 days — possibly falling through the cracks"
        rows={alerts.idleLeads}
        renderMeta={l => <span className="text-xs text-slate-400">last touch {l.last_touch}</span>}
      />
      <AlertLane title="Unassigned" icon={<UserX size={16} />} color="rose"
        subtitle="No consultant assigned yet — pick them up before they go cold"
        rows={alerts.unassigned}
        renderMeta={l => <span className="text-xs text-slate-400">{l.lead_status}</span>}
      />
      <AlertLane title="Follow-up overdue" icon={<CalendarClock size={16} />} color="rose"
        subtitle="Consultant scheduled a follow-up that's now past due"
        rows={alerts.overdueFollowups}
        renderMeta={l => <span className="text-xs text-rose-600 font-medium">due {l.next_followup}</span>}
      />
      <AlertLane title={`Outstanding balance — ${fmt(totalOutstanding)} total`} icon={<Wallet size={16} />} color="violet"
        subtitle="Active students who still owe money"
        rows={alerts.outstandingBalance}
        renderMeta={l => <span className="text-xs font-semibold text-violet-700">{fmt(l.balance)}</span>}
      />
    </div>
  );
}

function AlertLane({ title, icon, color, subtitle, rows, renderMeta }) {
  const [open, setOpen] = useState(false);
  const palette = {
    amber:  { icon: 'bg-amber-50 text-amber-600 border-amber-100', badge: 'bg-amber-100 text-amber-700', border: 'border-amber-200' },
    rose:   { icon: 'bg-rose-50 text-rose-600 border-rose-100',    badge: 'bg-rose-100 text-rose-700',   border: 'border-rose-200' },
    violet: { icon: 'bg-violet-50 text-violet-600 border-violet-100', badge: 'bg-violet-100 text-violet-700', border: 'border-violet-200' },
  };
  const p = palette[color] || palette.amber;
  const hasItems = rows.length > 0;

  return (
    <div className={`bg-white rounded-2xl border ${hasItems ? p.border : 'border-slate-200'} overflow-hidden shadow-sm`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors text-left">
        <div className={`p-2 rounded-xl border ${p.icon} flex-shrink-0`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-800 text-sm">{title}</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${hasItems ? p.badge : 'bg-slate-100 text-slate-500'}`}>
              {rows.length}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <ArrowRight size={15} className={`text-slate-300 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-slate-100">
          {rows.length === 0 ? (
            <div className="flex items-center gap-2 justify-center py-6 text-sm text-slate-400">
              <CheckCircle2 size={16} className="text-emerald-500"/> All clear — nothing to action
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {rows.map(l => (
                <Link key={l.id} to={`/leads?q=${encodeURIComponent(l.lead_id || l.client_name)}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-blue-50/30 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate group-hover:text-blue-700 transition-colors">{l.client_name}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono">{l.lead_id}</span>
                      {l.destination && <><span className="text-slate-300">·</span><MapPin size={10} className="text-slate-300"/> {l.destination}</>}
                      {l.assigned_consultant && <><span className="text-slate-300">·</span> {l.assigned_consultant}</>}
                    </p>
                  </div>
                  {renderMeta && renderMeta(l)}
                  <ArrowRight size={13} className="text-slate-300 flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeedTab({ feed }) {
  if (!feed || feed.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <Activity size={32} className="mx-auto text-slate-200 mb-2"/>
        <p className="text-sm text-slate-400">Activity feed is empty — actions will appear here as they happen</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-700 text-sm">Live Activity Feed</h3>
          <p className="text-xs text-slate-400">Auto-refreshes every 30 seconds</p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"/>LIVE
        </span>
      </div>
      <div className="divide-y divide-slate-50 max-h-[640px] overflow-y-auto">
        {feed.map(a => <FeedItem key={a.id} a={a} />)}
      </div>
    </div>
  );
}

function FeedItem({ a }) {
  const meta = describeActivity(a);
  return (
    <div className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors group">
      <div className={`p-2 rounded-xl flex-shrink-0 ${meta.bg}`}>{meta.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 leading-snug">
          <strong className="text-slate-800 font-semibold">{a.actor_name || 'System'}</strong>{' '}
          {meta.verb}
          {a.lead_name && <Link to={`/leads?q=${encodeURIComponent(a.lead_name)}`} className="text-blue-600 hover:underline font-medium ml-1">{a.lead_name}</Link>}
          {meta.tail && <span className="text-slate-600">{meta.tail}</span>}
        </p>
        {meta.detail && <p className="text-xs text-slate-400 mt-0.5">{meta.detail}</p>}
      </div>
      <span className="text-[11px] text-slate-400 flex-shrink-0 tabular-nums">{timeAgo(a.created_at)}</span>
    </div>
  );
}

function describeActivity(a) {
  switch (a.type) {
    case 'lead_created':
      return { icon: <UserPlus size={14}/>, bg: 'bg-blue-50 text-blue-600', verb: 'added a new lead', tail: '', detail: a.details };
    case 'lead_status_changed':
      return { icon: <TagIcon size={14}/>, bg: 'bg-violet-50 text-violet-600',
        verb: 'moved', tail: ` from ${a.from_value || '—'} → ${a.to_value || '—'}` };
    case 'lead_assigned':
      return { icon: <Users size={14}/>, bg: 'bg-indigo-50 text-indigo-600',
        verb: 'assigned', tail: ` to ${a.to_value || '—'}` };
    case 'lead_payment':
      return { icon: <DollarSign size={14}/>, bg: 'bg-emerald-50 text-emerald-600',
        verb: `recorded a payment of`, tail: ` ${fmt(a.amount)}` };
    case 'payment_recorded':
      return { icon: <Receipt size={14}/>, bg: 'bg-emerald-50 text-emerald-600',
        verb: 'logged income of', tail: ` ${fmt(a.amount)}` };
    case 'expense_recorded':
      return { icon: <Receipt size={14}/>, bg: 'bg-rose-50 text-rose-600',
        verb: 'logged expense of', tail: ` ${fmt(a.amount)}` };
    case 'attendance_in':
      return { icon: <CircleCheck size={14}/>, bg: 'bg-emerald-50 text-emerald-600',
        verb: 'checked in at', tail: ` ${a.to_value}` };
    case 'user_created':
      return { icon: <UserPlus size={14}/>, bg: 'bg-slate-100 text-slate-600',
        verb: 'created a user account for', tail: ` ${a.to_value}` };
    default:
      return { icon: <Activity size={14}/>, bg: 'bg-slate-50 text-slate-500',
        verb: a.type.replace(/_/g, ' '), tail: '' };
  }
}
