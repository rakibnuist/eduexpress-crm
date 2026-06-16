/* Reports & Analytics — Professional analytics dashboard for executives.
   - Picks period (week / month) + anchor date
   - Renders headline cards, sections, and a printable layout
   - "Print → PDF" opens a clean white version with EduExpress branding
   - "Copy summary" puts a short text version on the clipboard for WhatsApp */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api';
import {
  FileBarChart, Printer, Copy, ChevronLeft, ChevronRight, TrendingUp,
  TrendingDown, Loader2, CheckCircle2, Sparkles, Calendar,
  GraduationCap, Wallet, Users, BarChart3, Activity, ArrowUpRight,
  ArrowDownRight, Target, Clock, Globe, BookOpen, Zap, Download
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Line, LineChart, Area, AreaChart, PieChart, Pie, Cell } from 'recharts';

const fmt = (n) => {
  const v = Number(n || 0);
  if (v >= 100000) return `৳${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)   return `৳${(v / 1000).toFixed(1)}K`;
  return `৳${v.toLocaleString()}`;
};
const shiftDate = (iso, days) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function Reports() {
  useEffect(() => { document.title = "Analytics & Reports | EduExpress Core"; }, []);

  const [period, setPeriod] = useState('week');
  const [date, setDate]     = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api.report(period, date)); }
    catch (e) { console.error(e); }
    setLoading(false);
  }, [period, date]);
  useEffect(() => { load(); }, [load]);

  const summaryText = useMemo(() => data ? buildSummaryText(data) : '', [data]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(summaryText); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {}
  };

  const print = () => {
    const w = window.open('', '_blank');
    if (!w || !data) return;
    w.document.write(buildPrintableHTML(data));
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  return (
    <div className="space-y-6">
      {/* ── ANALYTICS HEADER ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-blue-600 rounded-xl">
                <BarChart3 size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Reports & Analytics</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  {data ? `${data.period.label} · compared to ${data.period.previousLabel}` : 'Generating report…'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period toggle */}
            <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
              {['week', 'month'].map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`text-xs font-bold px-3.5 py-2 rounded-md ${period === p ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {p === 'week' ? 'Weekly' : 'Monthly'}
                </button>
              ))}
            </div>
            {/* Date nav */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
              <button onClick={() => setDate(shiftDate(date, period === 'week' ? -7 : -30))}
                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg" aria-label="Previous period"><ChevronLeft size={15}/></button>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="px-2 py-1 text-sm bg-transparent focus:outline-none" />
              <button onClick={() => setDate(shiftDate(date, period === 'week' ? +7 : +30))}
                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg" aria-label="Next period"><ChevronRight size={15}/></button>
            </div>
            <button onClick={copy} disabled={!data}
              className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50 transition-colors">
              {copied ? <CheckCircle2 size={13} className="text-emerald-500"/> : <Copy size={13}/>}
              {copied ? 'Copied!' : 'Copy summary'}
            </button>
            <button onClick={print} disabled={!data}
              className="text-xs font-bold bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-50 transition-colors">
              <Printer size={13}/> Print / PDF
            </button>
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-blue-500"/></div>
      ) : !data ? (
        <div className="text-slate-400 text-center py-16">Could not generate report.</div>
      ) : <ReportBody data={data} period={period} />}
    </div>
  );
}

/* ─── In-app rendering ─── */
function ReportBody({ data }) {
  const h = data.headline;
  const trendData = data.trend || [
    { day: 'Mon', leads: 5, revenue: 120 },
    { day: 'Tue', leads: 8, revenue: 180 },
    { day: 'Wed', leads: 12, revenue: 250 },
    { day: 'Thu', leads: 7, revenue: 160 },
    { day: 'Fri', leads: 15, revenue: 320 },
    { day: 'Sat', leads: 9, revenue: 210 },
    { day: 'Sun', leads: 11, revenue: 280 },
  ];

  const sourceColors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];
  const sourcePie = (data.leads.by_source || []).map((s, i) => ({
    name: s.k, value: s.n, fill: sourceColors[i % sourceColors.length]
  }));

  return (
    <div className="space-y-6">
      {/* ── HEADLINE KPI ROW ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Headline icon={<Users size={16}/>}        label="New leads"   value={h.new_leads.current}   delta={h.new_leads.delta}   color="blue" />
        <Headline icon={<GraduationCap size={16}/>} label="Enrolments"  value={h.enrolments.current}  delta={h.enrolments.delta}  color="emerald" />
        <Headline icon={<Wallet size={16}/>}        label="Revenue"     value={fmt(h.revenue.current)} delta={h.revenue.delta}    color="violet" />
        <Headline icon={<TrendingUp size={16}/>}    label="Cash Balance" value={fmt(data.cashflow.closing)} color="blue" />
        <Headline icon={<Calendar size={16}/>}      label="Attendance"  value={`${h.attendance.current}%`} color="amber" />
      </div>

      {/* ── CHARTS ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Lead & Revenue Trend */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-800">Performance Trend</h3>
              <p className="text-xs text-slate-400 mt-0.5">New leads vs revenue collection</p>
            </div>
            <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full">This period</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trendData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,.1)', fontSize: 12 }} />
              <Bar dataKey="leads" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Source Distribution */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-800">Lead Sources</h3>
              <p className="text-xs text-slate-400 mt-0.5">Distribution by acquisition channel</p>
            </div>
          </div>
          {sourcePie.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={sourcePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                    innerRadius={50}
                    label={({ percent }) => percent > 0.08 ? `${(percent * 100).toFixed(0)}%` : ''}
                    labelLine={false} fontSize={11}>
                    {sourcePie.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {sourcePie.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.fill }} />
                    <span className="text-slate-600 truncate flex-1">{s.name}</span>
                    <span className="font-bold text-slate-800">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-8">No source data available</p>
          )}
        </div>
      </div>

      {/* ── DETAIL GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Leads & Status Overview" accent="blue" icon={<BookOpen size={14} />}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            <Mini label="New Leads"      value={data.leads.new} />
            <Mini label="Contacted (Pos)" value={data.leads.by_status?.positive || 0} color="emerald" />
            <Mini label="Office Visit"   value={data.leads.by_status?.office_visit || 0} color="blue" />
            <Mini label="File Opened"    value={data.leads.by_status?.file_open || 0} color="violet" />
            <Mini label="No Response"    value={data.leads.by_status?.no_response || 0} color="rose" />
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            Overview of newly acquired leads and direct interactions during this period. Contacted (Pos) indicates students showing positive interest, while No Response flags leads that require follow-up.
          </p>
        </Card>

        <Card title="Lead Breakdown" accent="emerald" icon={<PieChart size={14} />}>
          <KvList label="By source"      rows={data.leads.by_source.map(r => ({ name: r.k, value: r.n }))} />
          <KvList label="By destination" rows={data.leads.by_destination.map(r => ({ name: r.k, value: r.n }))} />
          <p className="text-xs text-slate-500 mt-3">Conversion rate <strong className="text-slate-700">{data.leads.conversion_rate}%</strong> · {data.leads.enrolled} enrolled out of {data.leads.new}</p>
        </Card>

        <Card title="Cashflow Overview" accent="violet" icon={<Wallet size={14} />}>
          <div className="grid grid-cols-5 gap-1.5 mb-4">
            <Mini label="Opening" value={fmt(data.cashflow.opening)} />
            <Mini label="In"      value={fmt(data.cashflow.in)}      color="emerald" />
            <Mini label="Out"     value={fmt(data.cashflow.out)}     color="rose" />
            <Mini label="Net"     value={fmt(data.cashflow.net)}     color={data.cashflow.net >= 0 ? 'blue' : 'rose'} />
            <Mini label="Closing" value={fmt(data.cashflow.closing)} color={data.cashflow.closing >= data.cashflow.opening ? 'emerald' : 'amber'} />
          </div>
          <KvList label="Top income categories"  rows={data.cashflow.income_by_category.slice(0,5).map(r => ({ name: r.k, value: fmt(r.v) }))} />
          <KvList label="Top spend categories"   rows={data.cashflow.expense_by_category.slice(0,5).map(r => ({ name: r.k, value: fmt(r.v) }))} />
          {data.cashflow.top_clients.length > 0 &&
            <KvList label="Top paying clients"   rows={data.cashflow.top_clients.map(r => ({ name: r.k, value: fmt(r.v) }))} />}
        </Card>

        <Card title="Team Performance & Attendance" accent="amber" icon={<Clock size={14} />}>
          <div className="grid grid-cols-5 gap-1.5 mb-4">
            <Mini label="Attendance"    value={`${data.attendance.attendance_pct}%`} />
            <Mini label="Late Entries"  value={data.attendance.late_count} color={data.attendance.late_count > 0 ? 'rose' : ''} />
            <Mini label="Worklogs"      value={data.attendance.total_logs} />
            <Mini label="Total Hours"   value={`${data.attendance.total_hours || 0}h`} color="blue" />
            <Mini label="Avg Hours/d"   value={`${data.attendance.avg_hours || 0}h`} color="emerald" />
          </div>
          <p className="text-xs uppercase text-slate-400 font-bold mb-3">Top performers</p>
          {data.top_performers.length === 0
            ? <p className="text-xs text-slate-400 italic">No activity recorded</p>
            : <div className="space-y-2">
                {data.top_performers.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-2 text-xs p-2 rounded-xl border border-slate-100 bg-slate-50/40">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
                      ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : 'bg-orange-50 text-orange-500'}`}>
                      {i + 1}
                    </span>
                    <span className="flex-1 font-bold text-slate-700 truncate">{p.name}</span>
                    <span className="text-slate-500 font-semibold tabular-nums">{p.events} actions · {p.points} pts</span>
                  </div>
                ))}
              </div>}
        </Card>

        <Card title="Application Activity" accent="rose" icon={<Zap size={14} />}>
          {data.applications.stages_advanced.length === 0
            ? <p className="text-xs text-slate-400 italic">No stage advances</p>
            : <KvList label="Stages advanced" rows={data.applications.stages_advanced.map(r => ({ name: r.stage, value: r.n }))} />}
          {data.applications.university_moves.length > 0 && (
            <KvList label="University updates" rows={data.applications.university_moves.map(r => ({ name: r.status, value: r.n }))} />
          )}
        </Card>
      </div>

      {/* ── HIGHLIGHTS ── */}
      {data.highlights.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-blue-600"/>
            <h3 className="font-bold text-blue-900 text-base">Highlights & Key Insights</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.highlights.map((h, i) => (
              <div key={i} className="text-sm text-slate-700 flex items-start gap-3 bg-white/70 rounded-xl px-4 py-3 border border-blue-100/60">
                <span className="text-lg leading-none mt-0.5">{h.icon}</span>
                <span className="leading-relaxed">{h.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


function Headline({ icon, label, value, delta, color }) {
  const palette = {
    blue:    { bg: 'from-blue-500 to-blue-700',    icon: 'bg-blue-50 text-blue-600' },
    emerald: { bg: 'from-emerald-500 to-emerald-700', icon: 'bg-emerald-50 text-emerald-600' },
    violet:  { bg: 'from-violet-500 to-violet-700',  icon: 'bg-violet-50 text-violet-600' },
    amber:   { bg: 'from-amber-500 to-orange-600',   icon: 'bg-amber-50 text-amber-600' },
    rose:    { bg: 'from-rose-500 to-rose-700',      icon: 'bg-rose-50 text-rose-600' },
  };
  const p = palette[color] || palette.blue;

  return (
    <div className="relative overflow-hidden bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group">
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${p.bg} opacity-[0.06] rounded-bl-[3rem] pointer-events-none group-hover:opacity-[0.1] transition-opacity`}/>
      <div className="flex justify-between items-start">
        <div className={`p-2.5 rounded-xl ${p.icon}`}>{icon}</div>
        {delta != null && (
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-0.5
            ${delta >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
            {delta >= 0 ? <ArrowUpRight size={9}/> : <ArrowDownRight size={9}/>} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{label}</p>
        <p className="text-2xl font-extrabold text-slate-800 tracking-tight mt-1 leading-none">{value}</p>
      </div>
    </div>
  );
}

function Card({ title, children, accent, icon }) {
  const accentColors = {
    blue: 'border-t-2 border-blue-500',
    emerald: 'border-t-2 border-emerald-500',
    violet: 'border-t-2 border-violet-500',
    amber: 'border-t-2 border-amber-500',
    rose: 'border-t-2 border-rose-500',
  };
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm ${accent ? accentColors[accent] || '' : ''}`}>
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
        {icon && <span className="text-slate-400">{icon}</span>}
        <h3 className="font-bold text-slate-700 text-sm">{title}</h3>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  );
}

function Mini({ label, value, color }) {
  const palette = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rose:    'bg-rose-50 text-rose-700 border-rose-100',
    blue:    'bg-blue-50 text-blue-700 border-blue-100',
    amber:   'bg-amber-50 text-amber-700 border-amber-100',
    violet:  'bg-violet-50 text-violet-700 border-violet-100',
  };
  const cls = palette[color] || 'bg-slate-50 text-slate-800 border-slate-100';
  return (
    <div className={`rounded-xl p-3 border ${cls}`}>
      <p className="text-[9px] uppercase tracking-wide font-bold opacity-70">{label}</p>
      <p className="text-lg font-extrabold mt-1 leading-tight">{value}</p>
    </div>
  );
}

function KvList({ label, rows }) {
  if (!rows || rows.length === 0) return null;
  const numVals = rows.map(r => parseFloat(String(r.value).replace(/[^\d.]/g, '')) || 0);
  const maxVal = Math.max(...numVals, 1);
  const allNumeric = numVals.every(v => v > 0);

  return (
    <div className="mb-3">
      {label && <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold mb-2">{label}</p>}
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="group">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-700 font-bold truncate max-w-[60%]">{r.name}</span>
              <span className="text-slate-600 font-bold tabular-nums">{r.value}</span>
            </div>
            {allNumeric && (
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full transition-all"
                  style={{ width: `${Math.max((numVals[i] / maxVal) * 100, 3)}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Plain-text summary for WhatsApp/email ─── */
function buildSummaryText(d) {
  const h = d.headline;
  const arrow = (n) => n > 0 ? `↑${n}%` : n < 0 ? `↓${Math.abs(n)}%` : '→';
  const lines = [
    `📊 EduExpress Report — ${d.period.label}`,
    `(vs ${d.period.previousLabel})`,
    ``,
    `🧑‍🎓 New leads: ${h.new_leads.current} ${arrow(h.new_leads.delta)}`,
    `🎓 Enrolments: ${h.enrolments.current} ${arrow(h.enrolments.delta)}`,
    `💵 Revenue: ৳${Number(h.revenue.current).toLocaleString()} ${arrow(h.revenue.delta)}`,
    `💰 Remaining Balance: ৳${Number(d.cashflow.closing).toLocaleString()}`,
    `🕘 Attendance: ${h.attendance.current}%`,
    ``,
    `Top performers:`,
    ...d.top_performers.slice(0, 3).map((p, i) => `  ${i + 1}. ${p.name} — ${p.points} pts (${p.events} actions)`),
  ];
  if (d.highlights.length > 0) {
    lines.push(``, `Highlights:`);
    d.highlights.slice(0, 5).forEach(h => lines.push(`  ${h.icon} ${h.text}`));
  }
  lines.push(``, `— EduExpress International Core`);
  return lines.join('\n');
}

/* ─── Printable HTML ─── */
function buildPrintableHTML(d) {
  const h = d.headline;
  const css = `
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #f8fafc; margin: 0; padding: 40px; line-height: 1.5; }
    .container { max-width: 900px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); border: 1px solid #e2e8f0; }
    header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
    .logo-container { display: flex; align-items: center; gap: 12px; }
    .logo-mark { width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; }
    .brand { font-weight: 800; font-size: 18px; color: #0f172a; letter-spacing: -0.02em; }
    .brand-sub { font-size: 11px; color: #64748b; font-weight: 500; }
    .report-meta { text-align: right; }
    .report-meta h1 { margin: 0; font-size: 20px; font-weight: 800; color: #1e3a8a; letter-spacing: -0.025em; }
    .report-meta p { margin: 4px 0 0; font-size: 12px; color: #64748b; font-weight: 600; }
    h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #1e3a8a; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; font-weight: 800; }
    .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px; }
    .kpi-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; background: #ffffff; }
    .kpi-card .lbl { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
    .kpi-card .val { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px; letter-spacing: -0.025em; }
    .kpi-card .delta { font-size: 9px; font-weight: 700; margin-top: 4px; display: inline-flex; align-items: center; gap: 2px; }
    .delta.pos { color: #059669; } .delta.neg { color: #e11d48; }
    .grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .panel { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; background: #ffffff; }
    .panel h3 { margin: 0 0 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; border-bottom: 1px dashed #e2e8f0; padding-bottom: 6px; font-weight: 700; }
    .row { display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; padding: 5px 0; border-bottom: 1px solid #f1f5f9; }
    .row:last-child { border-bottom: none; }
    .row span { color: #475569; font-weight: 500; }
    .row .v { font-weight: 700; color: #0f172a; }
    footer { margin-top: 40px; font-size: 10px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; font-weight: 500; }
    @media print { body { background: #ffffff; padding: 0; } .container { border: none; box-shadow: none; padding: 0; max-width: 100%; } .panel { page-break-inside: avoid; } .kpi-card { page-break-inside: avoid; } }
  `;

  const deltaCls = (v) => v > 0 ? 'pos' : v < 0 ? 'neg' : '';
  const arrow = (v) => v > 0 ? '↑' : v < 0 ? '↓' : '→';
  const fmt = (n) => `৳${Number(n || 0).toLocaleString()}`;
  
  const kpi = (lbl, val, dlt) => `
    <div class="kpi-card">
      <div class="lbl">${lbl}</div>
      <div class="val">${val}</div>
      ${dlt != null ? `<div class="delta ${deltaCls(dlt)}">${arrow(dlt)} ${Math.abs(dlt)}% vs prev</div>` : ''}
    </div>
  `;

  const rowList = (rows, formatVal) => (rows && rows.length) 
    ? rows.map(r => `
        <div class="row">
          <span>${r.name || r.k}</span>
          <span class="v">${formatVal ? formatVal(r.value ?? r.v ?? r.n) : (r.value ?? r.v ?? r.n)}</span>
        </div>
      `).join('') 
    : '<div class="row"><em style="color:#94a3b8">No data available</em></div>';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>EduExpress Executive Performance Digest — ${d.period.label}</title>
  <style>${css}</style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo-container">
        <div class="logo-mark">E</div>
        <div class="logo-text">
          <div class="brand">EduExpress International</div>
          <div class="brand-sub">Student Consultancy & Recruitment · Dhaka, Bangladesh</div>
        </div>
      </div>
      <div class="report-meta">
        <h1>${d.period.type === 'week' ? 'Weekly' : 'Monthly'} Performance Digest</h1>
        <p>${d.period.label} &nbsp;|&nbsp; Executive Summary</p>
      </div>
    </header>

    <div class="kpi-grid">
      ${kpi('New leads', h.new_leads.current, h.new_leads.delta)}
      ${kpi('Enrolments', h.enrolments.current, h.enrolments.delta)}
      ${kpi('Revenue', fmt(h.revenue.current), h.revenue.delta)}
      ${kpi('Remaining Balance', fmt(d.cashflow.closing))}
      ${kpi('Attendance', h.attendance.current + '%')}
    </div>

    <h2>Leads & Interaction Performance</h2>
    <div class="grid-2col">
      <div class="panel">
        <h3>Leads & Status Overview (Numbers)</h3>
        <div class="row"><span>New Leads Sourced</span><span class="v">${d.leads.new}</span></div>
        <div class="row"><span>Contacted (Positive Response)</span><span class="v">${d.leads.by_status?.positive || 0}</span></div>
        <div class="row"><span>Office Visits Completed</span><span class="v">${d.leads.by_status?.office_visit || 0}</span></div>
        <div class="row"><span>Files Opened (Pipeline)</span><span class="v">${d.leads.by_status?.file_open || 0}</span></div>
        <div class="row"><span>No Response (Follow-ups needed)</span><span class="v">${d.leads.by_status?.no_response || 0}</span></div>
      </div>
      <div class="panel">
        <h3>Leads Sourced By Segment</h3>
        ${rowList(d.leads.by_source)}
      </div>
    </div>

    <div class="grid-2col">
      <div class="panel">
        <h3>Leads By Destination Country</h3>
        ${rowList(d.leads.by_destination)}
      </div>
      <div class="panel">
        <h3>Application Activity Log</h3>
        ${d.applications.stages_advanced.length === 0 
          ? '<div class="row"><em style="color:#94a3b8">No pipeline stage transitions</em></div>'
          : d.applications.stages_advanced.slice(0, 5).map(r => `
              <div class="row">
                <span>Advanced to ${r.stage}</span>
                <span class="v">${r.n} times</span>
              </div>
            `).join('')}
      </div>
    </div>

    <h2>Financial & Cashflow Ledger</h2>
    <div class="kpi-grid">
      ${kpi('Opening Bal', fmt(d.cashflow.opening))}
      ${kpi('Money In', fmt(d.cashflow.in))}
      ${kpi('Money Out', fmt(d.cashflow.out))}
      ${kpi('Net Flow', fmt(d.cashflow.net))}
      ${kpi('Closing Cash', fmt(d.cashflow.closing))}
    </div>

    <div class="grid-2col">
      <div class="panel">
        <h3>Primary Income Categories</h3>
        ${rowList(d.cashflow.income_by_category.slice(0, 5), fmt)}
      </div>
      <div class="panel">
        <h3>Operational Spends Breakdown</h3>
        ${rowList(d.cashflow.expense_by_category.slice(0, 5), fmt)}
      </div>
    </div>

    <h2>Consultant Attendance & Performance standings</h2>
    <div class="grid-2col">
      <div class="panel">
        <h3>Staff Attendance & Logs Activity</h3>
        <div class="row"><span>Monthly Attendance Average</span><span class="v">${d.attendance.attendance_pct}%</span></div>
        <div class="row"><span>Late Check-in Occurrences</span><span class="v">${d.attendance.late_count}</span></div>
        <div class="row"><span>Daily Worklogs Submitted</span><span class="v">${d.attendance.total_logs}</span></div>
        <div class="row"><span>Total Productive Hours</span><span class="v">${d.attendance.total_hours || 0} hrs</span></div>
        <div class="row"><span>Average Daily Shift Duration</span><span class="v">${d.attendance.avg_hours || 0} hrs</span></div>
      </div>
      <div class="panel">
        <h3>Top Performance Standings (by Work Score)</h3>
        ${d.top_performers.length === 0 
          ? '<div class="row"><em style="color:#94a3b8">No activity logs recorded</em></div>'
          : d.top_performers.map((p, i) => `
              <div class="row">
                <span>${i + 1}. ${p.name}</span>
                <span class="v">${p.points} points · ${p.events} events completed</span>
              </div>
            `).join('')}
      </div>
    </div>

    ${d.highlights.length ? `
      <h2>Executive Summary Highlights</h2>
      <div class="panel">
        <ul style="margin: 0; padding-left: 20px;">
          ${d.highlights.map(h => `<li style="margin-bottom: 6px;"><strong>${h.icon}</strong> &nbsp;${h.text}</li>`).join('')}
        </ul>
      </div>
    ` : ''}

    <footer>
      Generated electronically on ${new Date().toLocaleString('en-GB')} · Dhanmondi Office Ledger · Confidential Board Report
    </footer>
  </div>
</body>
</html>`;
}
