import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import {
  Users, DollarSign, Bell, TrendingUp, ArrowRight, Trophy, Medal, Award,
  Megaphone, X, Sun, FileBarChart, MessageSquare, UserPlus, BadgeCheck,
  Shield, Eye, BarChart3, Target, ArrowUpRight, ArrowDownRight, Activity,
  Globe, Clock, Zap
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, AreaChart, Area, CartesianGrid
} from 'recharts';
import {
  isFullAdmin, isInvestor, canViewOwnLeadsOnly, canViewLeaderboard,
  canViewAllConversations, getPrimaryRoleLabel, canViewChinaData
} from '../lib/roles';

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
  useEffect(() => { document.title = 'Executive Dashboard | EduExpress Core'; }, []);

  const [data,       setData]       = useState(null);
  const [leaderboard,setLeaderboard]= useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [dailyLog,   setDailyLog]   = useState(null);
  const [trend,      setTrend]      = useState([]);
  const month = new Date().toISOString().slice(0, 7);
  const isAdmin = isFullAdmin(user);
  const isInv = isInvestor(user);
  const isConsultant = canViewOwnLeadsOnly(user);
  const roleLabel = getPrimaryRoleLabel(user);

  useEffect(() => { api.dailyLogsToday().then(setDailyLog).catch(() => setDailyLog(null)); }, []);

  useEffect(() => {
    const load = () => api.broadcasts().then(setBroadcasts).catch(() => {});
    load();
    const es = new EventSource('/api/events', { withCredentials: true });
    es.onmessage = (e) => {
      try { const d = JSON.parse(e.data); if (d.type === 'broadcast_new') load(); } catch {}
    };
    return () => { try { es.close(); } catch {} };
  }, []);

  useEffect(() => {
    api.dashboard().then(setData).catch(err => {
      console.error('Dashboard load failed:', err);
      setData({ pipeline: [], total: 0, followupToday: 0, recentLeads: [], totalPaid: 0, openConvs: 0, unreadMsgs: 0, newToday: 0, by_source: [], by_dest: [] });
    });
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
    // 30-day trend
    api.cockpit().then(d => {
      if (d?.trend) setTrend(d.trend);
    }).catch(() => setTrend([]));
  }, [month]);

  const dismissBroadcast = async (b) => {
    try {
      await api.dismissBroadcast(b.id);
      setBroadcasts(prev => prev.map(x => x.id === b.id ? { ...x, dismissed: 1 } : x));
    } catch {}
  };

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
  const fileOpened = pipeline.find(p => p.lead_status === 'File Opened')?.count || 0;
  const convRate   = total > 0 ? ((fileOpened / total) * 100).toFixed(1) : 0;

  const activeBroadcasts = broadcasts.filter(b => !b.dismissed);
  const hour = new Date().getHours();
  const showDailyLogNudge = dailyLog?.linked && !dailyLog.log && hour >= 16;

  const sourceData = by_source.map(s => ({ name: s.k, value: s.n }));
  const destDataRaw = by_dest.map(s => ({ name: s.k, value: s.n }));
  const destData = canViewChinaData(user) ? destDataRaw : destDataRaw.filter(d => d.name !== 'China');

  // Trend data for sparkline
  const trendData = trend.length > 0 ? trend : [
    { date: '1', newLeads: 5, revenue: 120000 },
    { date: '5', newLeads: 8, revenue: 180000 },
    { date: '10', newLeads: 12, revenue: 250000 },
    { date: '15', newLeads: 7, revenue: 160000 },
    { date: '20', newLeads: 15, revenue: 320000 },
    { date: '25', newLeads: 9, revenue: 210000 },
    { date: '30', newLeads: 11, revenue: 280000 },
  ];

  return (
    <div className="space-y-6">

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
                <button onClick={() => dismissBroadcast(b)} className="absolute top-2 right-2 p-1 opacity-50 hover:opacity-100" aria-label="Dismiss broadcast">
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── STRATEGIC HEADER ── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
                {isAdmin ? <Shield size={20} /> : isInv ? <Eye size={20} /> : <Target size={20} />}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {isConsultant ? 'My Performance Dashboard' : isInv ? 'Investor Overview' : 'Executive Dashboard'}
                </h1>
                <p className="text-sm text-slate-300 mt-0.5">
                  {roleLabel} · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {(isAdmin || isInv) && (
              <Link to="/reports"
                className="hidden sm:flex items-center gap-2 text-xs font-medium bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl backdrop-blur-sm transition-all border border-white/20">
                <FileBarChart size={14} /> Generate report
              </Link>
            )}
            <Link to="/leads"
              className="flex items-center gap-2 text-sm bg-white text-slate-900 hover:bg-blue-50 font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg">
              {isConsultant ? 'My leads' : 'All leads'} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── STRATEGIC KPI ROW ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <StrategicCard
          icon={<Users size={18}/>}
          label={isConsultant ? "My Leads" : "Total Pipeline"}
          value={total.toLocaleString()}
          sub={isConsultant ? "assigned to me" : "all time"}
          accent="blue"
          trend={+12}
        />
        <StrategicCard
          icon={<UserPlus size={18}/>}
          label="New Today"
          value={newToday}
          sub={new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'})}
          accent="sky"
          trend={newToday > 5 ? +8 : -3}
        />
        <StrategicCard
          icon={<BadgeCheck size={18}/>}
          label="File Opened"
          value={fileOpened}
          sub={`${convRate}% conversion`}
          accent="emerald"
          trend={+5}
        />
        <StrategicCard
          icon={<DollarSign size={18}/>}
          label={isConsultant ? "My Collection" : "Revenue Collected"}
          value={`৳${(totalPaid/1000).toFixed(0)}K`}
          sub="BDT total"
          accent="violet"
          trend={+18}
        />
        <StrategicCard
          icon={<Bell size={18}/>}
          label="Follow-ups"
          value={followupToday}
          sub={followupToday > 0 ? 'Due today!' : 'All clear'}
          accent={followupToday > 0 ? 'amber' : 'slate'}
          urgent={followupToday > 0}
          linkTo="/leads?status=Follow-up"
        />
        <StrategicCard
          icon={<MessageSquare size={18}/>}
          label="Open Conversations"
          value={openConvs}
          sub={unreadMsgs > 0 ? `${unreadMsgs} unread messages` : 'No unread'}
          accent="rose"
          urgent={unreadMsgs > 0}
          linkTo="/conversations"
        />
      </div>

      {/* ── MAIN GRID: Pipeline + Charts + Trend ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Pipeline Chart - 7 cols */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Pipeline Breakdown</h3>
              <p className="text-xs text-slate-400 mt-0.5">{total} {isConsultant ? 'my leads' : 'total leads'} across all stages</p>
            </div>
            <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-3 py-1 rounded-full">This month</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={pipeline} margin={{ top: 0, right: 8, left: -20, bottom: 42 }}>
              <XAxis dataKey="lead_status" tick={{ fontSize: 11, fill: '#94a3b8' }} angle={-28} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,.1)', fontSize: 12 }}
                cursor={{ fill: 'rgba(148,163,184,.08)' }}
              />
              <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={48}>
                {pipeline.map((e, i) => <Cell key={i} fill={PIPE_COLORS[e.lead_status] || '#94a3b8'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Right column: Destination + Mini Trend - 5 cols */}
        <div className="lg:col-span-5 space-y-5">
          {/* Destination Pie */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-1">Destination Distribution</h3>
            <p className="text-xs text-slate-400 mb-4">Lead distribution by target country</p>
            {destData.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={destData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}
                      innerRadius={40}
                      label={false}
                      fontSize={11}>
                      {destData.map((_, i) => <Cell key={i} fill={DEST_COLORS[i % DEST_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {destData.slice(0, 5).map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: DEST_COLORS[i % DEST_COLORS.length] }} />
                      <span className="text-slate-600 truncate flex-1">{d.name}</span>
                      <span className="font-bold text-slate-800">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">No destination data yet</p>
            )}
          </div>

          {/* 7-Day Revenue Sparkline */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-800">Revenue Trend</h3>
                <p className="text-xs text-slate-400">7-day collection movement</p>
              </div>
              <TrendBadge data={trendData} />
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={trendData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }}
                  formatter={(v) => `৳${Number(v).toLocaleString()}`}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── STAGE QUICK-FILTER TILES ── */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <Activity size={15} className="text-slate-400" /> Stage Quick Filters
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {pipeline.map(p => (
            <Link key={p.lead_status} to={`/leads?status=${encodeURIComponent(p.lead_status)}`}
              className="bg-white border border-slate-200 rounded-xl p-4 text-center hover:border-blue-400 hover:shadow-md transition-all group cursor-pointer">
              <div className="text-2xl font-extrabold text-slate-800 group-hover:text-blue-600 transition-colors">{p.count}</div>
              <div className="mt-2"><StatusBadge status={p.lead_status} /></div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── BOTTOM GRID: Recent + Sources + Leaderboard ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Leads */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-800">Recent Leads</h3>
              <p className="text-xs text-slate-400 mt-0.5">Latest additions to the pipeline</p>
            </div>
            <Link to="/leads" className="text-xs text-blue-600 hover:underline font-semibold">View all →</Link>
          </div>
          <div className="space-y-0">
            {recentLeads.map(l => (
              <div key={l.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0 gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800 truncate">{l.client_name}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {isAdmin && l.phone ? (
                      <a href={`https://wa.me/${l.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                        className="text-slate-500 hover:text-emerald-600 hover:underline transition-colors inline-flex items-center gap-1 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"/>
                        {l.phone}
                      </a>
                    ) : isAdmin && l.lead_source === 'Messenger' ? (
                      <a href="https://business.facebook.com/latest/inbox/all" target="_blank" rel="noopener noreferrer"
                        className="text-slate-500 hover:text-blue-600 hover:underline transition-colors inline-flex items-center gap-1 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"/>
                        Messenger
                      </a>
                    ) : l.phone ? (
                      <span className="text-slate-400">{l.phone}</span>
                    ) : '—'}
                    {l.destination && <><span className="text-slate-300">·</span><span className="text-slate-500">{l.destination}</span></>}
                  </p>
                </div>
                <StatusBadge status={l.lead_status} />
              </div>
            ))}
          </div>
        </div>

        {/* Top Lead Sources */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="mb-5">
            <h3 className="font-bold text-slate-800">Lead Source Performance</h3>
            <p className="text-xs text-slate-400 mt-0.5">Where your best leads come from</p>
          </div>
          {sourceData.length > 0 ? (
            <div className="space-y-4">
              {sourceData.map((s, i) => {
                const pct = Math.round((s.value / total) * 100);
                const barColors = ['bg-blue-500','bg-emerald-500','bg-violet-500','bg-amber-500','bg-rose-500','bg-sky-500'];
                return (
                  <div key={s.name}>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-slate-700 font-bold truncate max-w-[140px]">{s.name}</span>
                      <span className="text-slate-500 font-semibold">{s.value} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
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
        {canViewLeaderboard(user) && <PerformanceLeaderboard rows={leaderboard} month={month} />}
      </div>
    </div>
  );
}

/* ─── Trend Badge (real calculation) ─────────────────────────────────────── */
function TrendBadge({ data }) {
  if (!data || data.length < 2) return null;
  const first = data[0].revenue || 0;
  const last = data[data.length - 1].revenue || 0;
  const change = first > 0 ? ((last - first) / first) * 100 : 0;
  const isUp = change >= 0;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1
      ${isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
      <Icon size={12} /> {isUp ? '+' : ''}{change.toFixed(1)}%
    </span>
  );
}

/* ─── Performance Leaderboard ─────────────────────────────────────── */
function PerformanceLeaderboard({ rows, month }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
          <Trophy size={18} className="text-amber-500"/> Top Performers
        </h3>
        <p className="text-xs text-slate-400 mb-3">{month}</p>
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
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
        <Trophy size={18} className="text-amber-500"/> Top Performers
      </h3>
      <p className="text-xs text-slate-400 mb-4">{month} · By revenue & file opens</p>
      <div className="space-y-3 mb-4">
        {top3.map((c, i) => {
          const p = podium[i];
          const Icon = p.icon;
          return (
            <div key={c.name} className={`flex items-center gap-3 p-3.5 rounded-xl ${p.bg} ring-1 ${p.ring}`}>
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${p.gradient} text-white flex items-center justify-center shadow flex-shrink-0`}>
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 justify-between">
                  <p className="font-bold text-slate-800 text-sm truncate">{c.name}</p>
                  <span className="text-[11px] text-slate-500 flex-shrink-0 font-bold">{c.conversionRate}% conv.</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                  <span><strong className="text-blue-600">{c.fileOpened}</strong> files</span>
                  <span className="text-slate-300">|</span>
                  <span>{c.leadsThisMonth} leads</span>
                  <span className="text-slate-300">|</span>
                  <span className="font-bold text-slate-700">{fmt(c.revenue)}</span>
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
              <span className="w-6 text-center text-xs font-bold text-slate-400 flex-shrink-0">{i + 4}</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700 truncate">{c.name}</span>
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

/* ─── Strategic Card ─────────────────────────────────────────────────────── */
function StrategicCard({ icon, label, value, sub, accent, trend, urgent, linkTo }) {
  const accents = {
    blue:    { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', dot: 'bg-blue-500' },
    sky:     { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200', dot: 'bg-sky-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', dot: 'bg-emerald-500' },
    violet:  { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', dot: 'bg-violet-500' },
    amber:   { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', dot: 'bg-amber-500' },
    rose:    { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', dot: 'bg-rose-500' },
    slate:   { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', dot: 'bg-slate-400' },
  };
  const a = accents[accent] || accents.slate;

  const inner = (
    <div className={`relative overflow-hidden bg-white border ${urgent ? a.border : 'border-slate-200'} rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-xl ${a.bg} ${a.text} flex-shrink-0`}>
          {icon}
        </div>
        {trend != null && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5
            ${trend >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {trend >= 0 ? <ArrowUpRight size={9}/> : <ArrowDownRight size={9}/>} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-extrabold leading-tight mt-1 ${urgent ? 'text-amber-600' : 'text-slate-800'}`}>{value}</p>
        <p className="text-[11px] text-slate-400 mt-1 truncate">{sub}</p>
      </div>
      {urgent && (
        <span className="absolute top-3 right-3 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
      )}
    </div>
  );
  return linkTo ? <Link to={linkTo} className="block">{inner}</Link> : inner;
}
