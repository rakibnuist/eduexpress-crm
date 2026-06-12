import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import {
  Users, DollarSign, Bell, TrendingUp, ArrowRight, Trophy, Medal, Award,
  Megaphone, X, Sun, FileBarChart, MessageSquare, Sparkles, UserPlus, BadgeCheck,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts';

const PIPE_COLORS = {
  'New Lead':       '#38bdf8',
  'No Response':    '#94a3b8',
  'Positive':       '#34d399',
  'Office Visited': '#a78bfa',
  'File Opened':    '#60a5fa',
  'Enrolled':       '#4ade80',
  'Not Interested': '#f87171',
};

const DEST_COLORS = ['#60a5fa','#34d399','#f59e0b','#a78bfa','#f87171','#22d3ee','#fb923c','#818cf8'];

export default function Dashboard({ user }) {
  useEffect(() => { document.title = 'Dashboard | EduExpress Core'; }, []);

  const [data,       setData]       = useState(null);
  const [leaderboard,setLeaderboard]= useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [dailyLog,   setDailyLog]   = useState(null);
  const month = new Date().toISOString().slice(0, 7);
  const isAdmin = user?.role === 'admin';

  useEffect(() => { api.dailyLogsToday().then(setDailyLog).catch(() => setDailyLog(null)); }, []);

  useEffect(() => {
    const load = () => api.broadcasts().then(setBroadcasts).catch(() => {});
    load();
    const es = new EventSource('/api/events');
    es.onmessage = (e) => {
      try { const d = JSON.parse(e.data); if (d.type === 'broadcast_new') load(); } catch {}
    };
    return () => { try { es.close(); } catch {} };
  }, []);

  const dismissBroadcast = async (b) => {
    try {
      await api.dismissBroadcast(b.id);
      setBroadcasts(prev => prev.map(x => x.id === b.id ? { ...x, dismissed: 1 } : x));
    } catch {}
  };

  useEffect(() => {
    api.dashboard().then(setData);
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

  const { pipeline, total, followupToday, recentLeads, totalPaid,
          openConvs = 0, unreadMsgs = 0, newToday = 0, by_source = [], by_dest = [] } = data;
  const enrolled   = pipeline.find(p => p.lead_status === 'Enrolled')?.count || 0;
  const fileOpened = pipeline.find(p => p.lead_status === 'File Opened')?.count || 0;
  const convRate   = total > 0 ? ((fileOpened / total) * 100).toFixed(1) : 0;

  const activeBroadcasts = broadcasts.filter(b => !b.dismissed);
  const hour = new Date().getHours();
  const showDailyLogNudge = dailyLog?.linked && !dailyLog.log && hour >= 16;

  const sourceData = by_source.map(s => ({ name: s.k, value: s.n }));
  const destData   = by_dest.map(s => ({ name: s.k, value: s.n }));

  return (
    <div className="space-y-5">

      {/* End-of-day reminder */}
      {showDailyLogNudge && (
        <Link to="/my-day"
          className="block bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 hover:shadow-md transition-shadow">
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

      {/* Owner broadcasts */}
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
                <button onClick={() => dismissBroadcast(b)} className="absolute top-2 right-2 p-1 opacity-50 hover:opacity-100">
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <TrendingUp size={18} className="text-white" />
            </div>
            Dashboard
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/reports"
            className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-200 hover:bg-blue-50 transition-all">
            <FileBarChart size={13} /> Generate report
          </Link>
          <Link to="/leads"
            className="flex items-center gap-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 font-medium px-3.5 py-1.5 rounded-lg transition-colors">
            All leads <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* KPI Cards — 6 metrics in 2 rows of 3 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          icon={<Users size={18}/>}
          label="Total Leads"
          value={total.toLocaleString()}
          sub="all time"
          gradient="from-blue-500 to-blue-700"
          bg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <KpiCard
          icon={<UserPlus size={18}/>}
          label="New Today"
          value={newToday}
          sub={new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'})}
          gradient="from-sky-400 to-sky-600"
          bg="bg-sky-50"
          iconColor="text-sky-600"
        />
        <KpiCard
          icon={<BadgeCheck size={18}/>}
          label="File Opened"
          value={fileOpened}
          sub={`${convRate}% conv. rate`}
          gradient="from-emerald-500 to-emerald-700"
          bg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <KpiCard
          icon={<DollarSign size={18}/>}
          label="Collected"
          value={`৳${(totalPaid/1000).toFixed(0)}K`}
          sub="BDT total"
          gradient="from-violet-500 to-violet-700"
          bg="bg-violet-50"
          iconColor="text-violet-600"
        />
        <KpiCard
          icon={<Bell size={18}/>}
          label="Follow-ups"
          value={followupToday}
          sub={followupToday > 0 ? 'Due today!' : 'All clear'}
          gradient={followupToday > 0 ? 'from-amber-500 to-orange-600' : 'from-slate-400 to-slate-500'}
          bg={followupToday > 0 ? 'bg-amber-50' : 'bg-slate-50'}
          iconColor={followupToday > 0 ? 'text-amber-600' : 'text-slate-500'}
          urgent={followupToday > 0}
        />
        <KpiCard
          icon={<MessageSquare size={18}/>}
          label="Open Chats"
          value={openConvs}
          sub={unreadMsgs > 0 ? `${unreadMsgs} unread` : 'No unread'}
          gradient="from-rose-400 to-rose-600"
          bg="bg-rose-50"
          iconColor="text-rose-500"
          urgent={unreadMsgs > 0}
          linkTo="/inbox"
        />
      </div>

      {/* Pipeline + Destinations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Pipeline Breakdown</h3>
            <span className="text-xs text-slate-400">{total} total leads</span>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={pipeline} margin={{ top: 0, right: 8, left: -20, bottom: 42 }}>
              <XAxis dataKey="lead_status" tick={{ fontSize: 11, fill: '#94a3b8' }} angle={-28} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,.1)', fontSize: 12 }}
                cursor={{ fill: 'rgba(148,163,184,.08)' }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44}>
                {pipeline.map((e, i) => <Cell key={i} fill={PIPE_COLORS[e.lead_status] || '#94a3b8'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-3">By Destination</h3>
          {destData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={destData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}
                    label={({ name, percent }) => percent > 0.08 ? `${(percent * 100).toFixed(0)}%` : ''}
                    labelLine={false} fontSize={11}>
                    {destData.map((_, i) => <Cell key={i} fill={DEST_COLORS[i % DEST_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {destData.slice(0, 5).map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: DEST_COLORS[i % DEST_COLORS.length] }} />
                    <span className="text-slate-600 truncate flex-1">{d.name}</span>
                    <span className="font-semibold text-slate-700">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 text-center py-8">No destination data yet</p>
          )}
        </div>
      </div>

      {/* Stage quick-filter tiles */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {pipeline.map(p => (
          <Link key={p.lead_status} to={`/leads?status=${encodeURIComponent(p.lead_status)}`}
            className="bg-white border border-slate-200 rounded-xl p-3 text-center hover:border-blue-300 hover:shadow-sm transition-all group cursor-pointer">
            <div className="text-2xl font-extrabold text-slate-800 group-hover:text-blue-600 transition-colors">{p.count}</div>
            <div className="mt-1.5"><StatusBadge status={p.lead_status} /></div>
          </Link>
        ))}
      </div>

      {/* Bottom: Recent leads | Sources | Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent Leads */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Recent Leads</h3>
            <Link to="/leads" className="text-xs text-blue-600 hover:underline font-medium">View all →</Link>
          </div>
          <div className="space-y-0">
            {recentLeads.map(l => (
              <div key={l.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0 gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{l.client_name}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {isAdmin && l.phone ? (
                      <a href={`https://wa.me/${l.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                        className="text-slate-600 hover:text-emerald-600 hover:underline transition-colors inline-flex items-center gap-1 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"/>
                        {l.phone}
                      </a>
                    ) : isAdmin && l.lead_source === 'Messenger' ? (
                      <a href="https://business.facebook.com/latest/inbox/all" target="_blank" rel="noopener noreferrer"
                        className="text-slate-600 hover:text-blue-600 hover:underline transition-colors inline-flex items-center gap-1 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"/>
                        Messenger
                      </a>
                    ) : l.phone || '—'}
                    {l.destination && <><span className="text-slate-300">·</span><span>{l.destination}</span></>}
                  </p>
                </div>
                <StatusBadge status={l.lead_status} />
              </div>
            ))}
          </div>
        </div>

        {/* Top Lead Sources */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4">Top Lead Sources</h3>
          {sourceData.length > 0 ? (
            <div className="space-y-3">
              {sourceData.map((s, i) => {
                const pct = Math.round((s.value / total) * 100);
                const barColors = ['bg-blue-500','bg-emerald-500','bg-violet-500','bg-amber-500','bg-rose-500','bg-sky-500'];
                return (
                  <div key={s.name}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-700 font-medium truncate max-w-[140px]">{s.name}</span>
                      <span className="text-slate-500">{s.value} <span className="text-slate-400">({pct}%)</span></span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${barColors[i % barColors.length]} rounded-full transition-all`} style={{ width: `${Math.max(pct, 3)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-8">No source data yet</p>
          )}
        </div>

        {/* Performance Leaderboard */}
        <PerformanceLeaderboard rows={leaderboard} month={month} />
      </div>
    </div>
  );
}

/* ─── Performance Leaderboard ─────────────────────────────────────── */
function PerformanceLeaderboard({ rows, month }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Trophy size={16} className="text-amber-500"/> Top Performers · {month}
        </h3>
        <p className="text-sm text-slate-400 text-center py-6">No consultant activity this month yet</p>
      </div>
    );
  }
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  const leaderRevenue = Math.max(1, ...rows.map(r => r.revenue));
  const fmt = (n) => n >= 1000 ? `৳${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K` : `৳${Number(n).toLocaleString()}`;

  const podium = [
    { icon: Trophy, gradient: 'from-amber-400 to-amber-600',   bg: 'bg-gradient-to-br from-amber-50 to-yellow-50',  ring: 'ring-amber-200' },
    { icon: Medal,  gradient: 'from-slate-300 to-slate-500',   bg: 'bg-gradient-to-br from-slate-50 to-gray-50',    ring: 'ring-slate-200' },
    { icon: Award,  gradient: 'from-orange-300 to-orange-500', bg: 'bg-gradient-to-br from-orange-50 to-amber-50',  ring: 'ring-orange-200' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <Trophy size={16} className="text-amber-500"/> Top Performers · {month}
      </h3>
      <div className="space-y-2.5 mb-4">
        {top3.map((c, i) => {
          const p = podium[i];
          const Icon = p.icon;
          return (
            <div key={c.name} className={`flex items-center gap-3 p-3 rounded-xl ${p.bg} ring-1 ${p.ring}`}>
              <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${p.gradient} text-white flex items-center justify-center shadow flex-shrink-0`}>
                <Icon size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 justify-between">
                  <p className="font-bold text-slate-800 text-sm truncate">{c.name}</p>
                  <span className="text-[11px] text-slate-500 flex-shrink-0">{c.conversionRate}%</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-500 mt-0.5">
                  <span><strong className="text-blue-600">{c.fileOpened}</strong> files</span>
                  <span>{c.leadsThisMonth} leads</span>
                  <span className="font-semibold text-slate-700">{fmt(c.revenue)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {rest.length > 0 && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          {rest.map((c, i) => (
            <div key={c.name} className="flex items-center gap-2.5">
              <span className="w-5 text-center text-xs font-bold text-slate-400 flex-shrink-0">{i + 4}</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700 truncate">{c.name}</span>
                  <span className="text-slate-500"><strong className="text-blue-600">{c.fileOpened}</strong> · {fmt(c.revenue)}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
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

/* ─── KPI Card ─────────────────────────────────────────────────────── */
function KpiCard({ icon, label, value, sub, bg, iconColor, gradient, urgent, linkTo }) {
  const inner = (
    <div className={`relative overflow-hidden bg-white border ${urgent ? 'border-orange-200' : 'border-slate-200'} rounded-2xl p-4 flex items-start gap-3 shadow-sm hover:shadow-md transition-all group`}>
      {/* Subtle gradient accent in top-right corner */}
      <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl ${gradient} opacity-5 rounded-bl-3xl pointer-events-none`} />
      <div className={`p-2.5 rounded-xl ${bg} ${iconColor} flex-shrink-0 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide leading-none">{label}</p>
        <p className={`text-2xl font-extrabold leading-tight mt-1 ${urgent ? 'text-orange-600' : 'text-slate-800'}`}>{value}</p>
        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</p>
      </div>
      {urgent && (
        <span className="absolute top-3 right-3 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
      )}
    </div>
  );
  return linkTo ? <Link to={linkTo}>{inner}</Link> : inner;
}
