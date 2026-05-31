import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { Users, DollarSign, Bell, TrendingUp, ArrowRight, Calendar, Trophy, Medal, Award, Megaphone, X, Sun, FileBarChart, LogIn, LogOut, Wifi, Clock } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

const PIPE_COLORS = {
  'New Lead': '#38bdf8',
  'No Response': '#94a3b8',
  'Positive': '#34d399',
  'Office Visited': '#a78bfa',
  'File Opened': '#60a5fa',
  'Enrolled': '#4ade80',
  'Not Interested': '#f87171',
};

export default function Dashboard({ user }) {
  useEffect(() => { document.title = "Dashboard | EduExpress CRM"; }, []);

  const [data, setData] = useState(null);
  const [extraStats, setExtraStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [dailyLog, setDailyLog]     = useState(null); // { linked, log }
  const [attnLog, setAttnLog]       = useState(null); // today's attendance record
  const toast = useToast();
  const month = new Date().toISOString().slice(0, 7);

  const loadAttn = () => {
    if (!user?.emp_id) return;
    const today = new Date().toISOString().slice(0, 10);
    api.attendance({ emp_id: user.emp_id, date: today }).then(rows => {
      const todayLog = (rows || []).find(r => r.date === today);
      setAttnLog(todayLog || null);
    }).catch(err => console.log('Failed to fetch attendance:', err));
  };

  useEffect(() => { loadAttn(); }, [user]);

  const handleManualCheckIn = async () => {
    if (!user?.emp_id) return;
    const timeStr = new Date().toTimeString().slice(0, 5);
    const todayStr = new Date().toISOString().slice(0, 10);
    try {
      const res = await api.checkIn({
        emp_id: user.emp_id,
        date: todayStr,
        time: timeStr,
        source: 'manual'
      });
      toast.success(`Checked in successfully at ${timeStr}`);
      setAttnLog(res);
      localStorage.setItem('simulated_wifi', 'true');
      window.dispatchEvent(new Event('storage')); // trigger update in shell
    } catch (err) {
      toast.error(err.message.includes('Already') ? 'Already checked in today' : err.message);
    }
  };

  const handleManualCheckOut = async () => {
    if (!attnLog) return;
    const timeStr = new Date().toTimeString().slice(0, 5);
    try {
      const res = await api.checkOut(attnLog.id, timeStr);
      toast.success(`Checked out successfully at ${timeStr}`);
      setAttnLog(res);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Daily-log status — used for the end-of-day banner
  useEffect(() => { api.dailyLogsToday().then(setDailyLog).catch(() => setDailyLog(null)); }, []);

  // Owner broadcasts — pinned sticky notes
  useEffect(() => {
    const load = () => api.broadcasts().then(setBroadcasts).catch(() => {});
    load();
    // Refresh broadcasts when a new one arrives via SSE
    const es = new EventSource('/api/events');
    es.onmessage = (e) => {
      try { const d = JSON.parse(e.data); if (d.type === 'broadcast_new') load(); } catch {}
    };
    return () => { try { es.close(); } catch {} };
  }, []);

  const dismissBroadcast = async (b) => {
    try { await api.dismissBroadcast(b.id); setBroadcasts(prev => prev.map(x => x.id === b.id ? { ...x, dismissed: 1 } : x)); }
    catch {}
  };

  useEffect(() => {
    api.dashboard().then(setData);

    // Top sources + destinations (all-time)
    api.leads({ limit: 2000 }).then(all => {
      const leads = all.leads;
      const srcMap = {};
      leads.forEach(l => { if (l.lead_source) srcMap[l.lead_source] = (srcMap[l.lead_source] || 0) + 1; });
      const sources = Object.entries(srcMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
      const destMap = {};
      leads.forEach(l => { if (l.destination) destMap[l.destination] = (destMap[l.destination] || 0) + 1; });
      const destinations = Object.entries(destMap).map(([name, value]) => ({ name, value }));
      setExtraStats({ sources, destinations });
    });

    // Performance leaderboard — this month, ranked by file opens then revenue
    api.kpi(month).then(rows => {
      const ranked = (rows || [])
        .filter(r => r.consultant)
        .map(r => ({
          name: r.consultant,
          fileOpened: r.fileOpened || 0,
          revenue: r.revenue || 0,
          collected: r.collected || 0,
          leadsThisMonth: r.thisMonth || 0,
          conversionRate: parseFloat(r.conversionRate) || 0,
          targetEnrolled: r.target_enrolled || 0,
          targetRevenue: r.target_revenue || 0,
        }))
        .sort((a, b) => b.fileOpened - a.fileOpened || b.revenue - a.revenue);
      setLeaderboard(ranked);
    }).catch(() => setLeaderboard([]));
  }, [month]);

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Loading dashboard…</p>
      </div>
    </div>
  );

  const { pipeline, total, followupToday, recentLeads, totalPaid } = data;
  const enrolled = pipeline.find(p => p.lead_status === 'Enrolled')?.count || 0;
  const fileOpened = pipeline.find(p => p.lead_status === 'File Opened')?.count || 0;
  const convRate = total > 0 ? ((fileOpened / total) * 100).toFixed(1) : 0;

  const activeBroadcasts = broadcasts.filter(b => !b.dismissed);
  const hour = new Date().getHours();
  // Show the end-of-day nudge after 16:00 if linked employee hasn't logged today
  const showDailyLogNudge = dailyLog?.linked && !dailyLog.log && hour >= 16;

  return (
    <div className="space-y-6">
      {/* Quick Attendance Check-in Banner */}
      {user?.emp_id && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${attnLog ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <Clock size={20} className={attnLog && !attnLog.check_out ? 'animate-pulse' : ''} />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">
                {attnLog 
                  ? (attnLog.check_out ? 'Today\'s Attendance Completed ✓' : `On Duty (Checked in at ${attnLog.check_in})`)
                  : 'Attendance Status: Shift Not Started'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {attnLog 
                  ? `Logged via ${attnLog.source === 'wifi' ? `Wi-Fi Router ("${attnLog.ssid}")` : 'Manual Portal Check-in'}`
                  : 'Keep your records active by clocking in manually below or connecting to office Wi-Fi.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!attnLog && (
              <button
                onClick={handleManualCheckIn}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer select-none"
              >
                <LogIn size={13} /> Manual Check In
              </button>
            )}
            {attnLog && !attnLog.check_out && (
              <button
                onClick={handleManualCheckOut}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer select-none"
              >
                <LogOut size={13} /> Check Out & End Shift
              </button>
            )}
            {attnLog && attnLog.check_out && (
              <span className="text-xs font-bold text-slate-450 bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-xl">
                Shift Logged Successfully
              </span>
            )}
          </div>
        </div>
      )}

      {/* End-of-day reminder for staff who haven't logged */}
      {showDailyLogNudge && (
        <Link to="/my-day"
          className="block bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700"><Sun size={18}/></div>
            <div className="flex-1">
              <p className="font-semibold text-amber-900 text-sm">Don't forget to log your day</p>
              <p className="text-xs text-amber-700">Takes 60 seconds — it counts toward your performance score.</p>
            </div>
            <ArrowRight size={16} className="text-amber-700"/>
          </div>
        </Link>
      )}

      {/* Owner broadcasts — sticky notes that travel to everyone */}
      {activeBroadcasts.length > 0 && (
        <div className="space-y-2">
          {activeBroadcasts.map(b => {
            const cls = {
              amber:   'bg-amber-50 border-amber-200 text-amber-900',
              blue:    'bg-blue-50 border-blue-200 text-blue-900',
              rose:    'bg-rose-50 border-rose-200 text-rose-900',
              emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
            }[b.color] || 'bg-amber-50 border-amber-200 text-amber-900';
            return (
              <div key={b.id} className={`relative border rounded-2xl p-4 pr-10 flex items-start gap-3 ${cls}`}>
                <Megaphone size={18} className="mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm whitespace-pre-wrap font-medium">{b.message}</p>
                  <p className="text-[11px] opacity-70 mt-1">— {b.author_name}</p>
                </div>
                <button onClick={() => dismissBroadcast(b)} className="absolute top-2 right-2 p-1 opacity-50 hover:opacity-100" title="Dismiss">
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200/80 pb-4 mb-2">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <TrendingUp size={24} className="text-blue-600" /> Operational Overview & Dashboard
          </h2>
          <p className="text-sm text-slate-500 mt-1">Real-time performance indicators, key metrics, and activity recap · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/reports" className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-blue-50">
            <FileBarChart size={13} /> Generate report
          </Link>
          <Link to="/leads" className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
            View all leads <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Users size={20} />}
          label="Total Leads"
          value={total.toLocaleString()}
          sub="All time"
          color="bg-blue-50 text-blue-600"
        />
        <KpiCard
          icon={<TrendingUp size={20} />}
          label="Conversion Rate"
          value={`${convRate}%`}
          sub={`${fileOpened} files opened`}
          color="bg-emerald-50 text-emerald-600"
        />
        <KpiCard
          icon={<DollarSign size={20} />}
          label="Total Collected"
          value={`৳${(totalPaid / 1000).toFixed(0)}K`}
          sub="BDT"
          color="bg-violet-50 text-violet-600"
        />
        <KpiCard
          icon={<Bell size={20} />}
          label="Follow-ups Today"
          value={followupToday}
          sub={followupToday > 0 ? 'Action needed!' : 'All clear'}
          color={followupToday > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'}
        />
      </div>

      {/* Pipeline bar chart + pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-700 mb-4">Pipeline Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={pipeline} margin={{ top: 0, right: 8, left: -20, bottom: 40 }}>
              <XAxis dataKey="lead_status" tick={{ fontSize: 11 }} angle={-28} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)' }} />
              <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={48}>
                {pipeline.map((e, i) => <Cell key={i} fill={PIPE_COLORS[e.lead_status] || '#94a3b8'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-700 mb-2">Destinations</h3>
          {extraStats && (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={extraStats.destinations} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {extraStats.destinations.map((_, i) => (
                    <Cell key={i} fill={['#60a5fa', '#34d399', '#f59e0b'][i % 3]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Stage counters */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {pipeline.map(p => (
          <Link key={p.lead_status} to={`/leads?status=${encodeURIComponent(p.lead_status)}`}
            className="bg-white border border-slate-200 rounded-xl p-3 text-center hover:border-blue-300 hover:shadow-sm transition-all group">
            <div className="text-2xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{p.count}</div>
            <div className="mt-1"><StatusBadge status={p.lead_status} /></div>
          </Link>
        ))}
      </div>

      {/* Bottom row: Recent leads + Sources + Consultants */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent leads */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-700">Recent Leads</h3>
            <Link to="/leads" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {recentLeads.map(l => (
              <div key={l.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{l.client_name}</p>
                  <p className="text-xs text-slate-400">{l.phone} · {l.destination}</p>
                </div>
                <StatusBadge status={l.lead_status} />
              </div>
            ))}
          </div>
        </div>

        {/* Lead Sources */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-700 mb-3">Top Lead Sources</h3>
          {extraStats && (
            <div className="space-y-2.5">
              {extraStats.sources.map(s => {
                const pct = Math.round((s.value / total) * 100);
                return (
                  <div key={s.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 truncate max-w-36">{s.name}</span>
                      <span className="text-slate-500 font-medium">{s.value} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Performance Leaderboard — this month */}
        <PerformanceLeaderboard rows={leaderboard} month={month} />
      </div>
    </div>
  );
}

/* ─── Performance Leaderboard ─────────────────────────────────────────────
   Ranks consultants by enrollments (then revenue) for the current month.
   Top 3 get podium medals; everyone else lists below with a target progress bar.
*/
function PerformanceLeaderboard({ rows, month }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><Trophy size={16} className="text-amber-500"/> Top Performers · {month}</h3>
        <p className="text-sm text-slate-400 text-center py-6">No consultant activity this month yet</p>
      </div>
    );
  }
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  const leaderRevenue = Math.max(1, ...rows.map(r => r.revenue));

  const podium = [
    { icon: Trophy,  cls: 'from-amber-400 to-amber-600',  bg: 'bg-amber-50',  ring: 'ring-amber-200',  label: '1st' },
    { icon: Medal,   cls: 'from-slate-300 to-slate-500',  bg: 'bg-slate-50',  ring: 'ring-slate-200',  label: '2nd' },
    { icon: Award,   cls: 'from-orange-300 to-orange-500',bg: 'bg-orange-50', ring: 'ring-orange-200', label: '3rd' },
  ];
  const fmt = (n) => n >= 1000 ? `৳${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K` : `৳${Number(n).toLocaleString()}`;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><Trophy size={16} className="text-amber-500"/> Top Performers · {month}</h3>
      <div className="space-y-2.5 mb-4">
        {top3.map((c, i) => {
          const p = podium[i];
          const Icon = p.icon;
          return (
            <div key={c.name} className={`flex items-center gap-3 p-3 rounded-xl ${p.bg} ring-1 ${p.ring}`}>
              <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${p.cls} text-white flex items-center justify-center shadow-sm flex-shrink-0`}>
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 justify-between">
                  <p className="font-semibold text-slate-800 text-sm truncate">{c.name}</p>
                  <span className="text-xs text-slate-500 flex-shrink-0">{c.conversionRate}% conv</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                  <span><strong className="text-blue-600">{c.fileOpened}</strong> files opened</span>
                  <span>{c.leadsThisMonth} leads</span>
                  <span><strong className="text-slate-700">{fmt(c.revenue)}</strong></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {rest.length > 0 && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          {rest.map((c, i) => (
            <div key={c.name} className="flex items-center gap-3">
              <span className="w-6 text-center text-xs font-bold text-slate-400 flex-shrink-0">{i + 4}</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-700 truncate">{c.name}</span>
                  <span className="text-xs text-slate-500"><strong className="text-blue-600">{c.fileOpened}</strong> · {fmt(c.revenue)}</span>
                </div>
                <div className="h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(c.revenue / leaderRevenue) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-800 leading-tight">{value}</p>
        <p className="text-xs text-slate-400">{sub}</p>
      </div>
    </div>
  );
}
