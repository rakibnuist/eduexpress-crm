import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import { Users, DollarSign, Bell, TrendingUp, ArrowRight, Calendar } from 'lucide-react';
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

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [extraStats, setExtraStats] = useState(null);

  useEffect(() => {
    api.dashboard().then(setData);
    // Extra: top sources, destination breakdown
    Promise.all([
      api.leads({ limit: 2000 }),
    ]).then(([all]) => {
      const leads = all.leads;
      // Source breakdown
      const srcMap = {};
      leads.forEach(l => { if (l.lead_source) srcMap[l.lead_source] = (srcMap[l.lead_source] || 0) + 1; });
      const sources = Object.entries(srcMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
      // Destination
      const destMap = {};
      leads.forEach(l => { if (l.destination) destMap[l.destination] = (destMap[l.destination] || 0) + 1; });
      const destinations = Object.entries(destMap).map(([name, value]) => ({ name, value }));
      // Consultant leaderboard
      const conMap = {};
      leads.forEach(l => { if (l.assigned_consultant) conMap[l.assigned_consultant] = (conMap[l.assigned_consultant] || 0) + 1; });
      const consultants = Object.entries(conMap).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
      setExtraStats({ sources, destinations, consultants });
    });
  }, []);

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
  const convRate = total > 0 ? ((enrolled / total) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Live Dashboard</h2>
          <p className="text-sm text-slate-500 mt-0.5">EduExpress International CRM · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <Link to="/leads" className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
          View all leads <ArrowRight size={15} />
        </Link>
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
          sub={`${enrolled} enrolled`}
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

        {/* Consultant Leaderboard */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-700 mb-3">Consultant Leads</h3>
          {extraStats && (
            <div className="space-y-2">
              {extraStats.consultants.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                    ${i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-slate-100 text-slate-600' : 'bg-orange-50 text-orange-500'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700 truncate">{c.name}</span>
                      <span className="text-slate-500">{c.count}</span>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(c.count / extraStats.consultants[0].count) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
