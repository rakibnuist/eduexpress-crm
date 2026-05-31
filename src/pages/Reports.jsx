/* Reports — weekly / monthly digest for the remote owner.
   - Picks period (week / month) + anchor date
   - Renders headline cards, sections, and a printable layout
   - "Print → PDF" opens a clean white version with EduExpress branding
   - "Copy summary" puts a short text version on the clipboard for WhatsApp */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api';
import {
  FileBarChart, Printer, Copy, ChevronLeft, ChevronRight, TrendingUp,
  TrendingDown, Loader2, CheckCircle2, Trophy, Sparkles, Calendar,
  GraduationCap, Wallet, Users, AlertCircle,
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const fmt = (n) => {
  const v = Number(n || 0);
  if (v >= 100000) return `৳${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)   return `৳${(v / 1000).toFixed(1)}K`;
  return `৳${v.toLocaleString()}`;
};
const fmtFull = (n) => `৳${Math.round(Number(n || 0)).toLocaleString()}`;

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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 border-b border-slate-200/80 pb-4 mb-2">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <FileBarChart size={24} className="text-blue-600" /> Executive Digest & Performance Reports
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {data ? `${data.period.label} (vs ${data.period.previousLabel})` : 'Generating custom intelligence report...'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period toggle */}
          <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
            {['week', 'month'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`text-xs font-medium px-3 py-1.5 rounded-md ${period === p ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {p === 'week' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>
          {/* Date nav */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            <button onClick={() => setDate(shiftDate(date, period === 'week' ? -7 : -30))}
              className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg"><ChevronLeft size={15}/></button>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-2 py-1 text-sm bg-transparent focus:outline-none" />
            <button onClick={() => setDate(shiftDate(date, period === 'week' ? +7 : +30))}
              className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg"><ChevronRight size={15}/></button>
          </div>
          <button onClick={copy} disabled={!data}
            className="text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50">
            {copied ? <CheckCircle2 size={13} className="text-emerald-500"/> : <Copy size={13}/>}
            {copied ? 'Copied!' : 'Copy summary'}
          </button>
          <button onClick={print} disabled={!data}
            className="text-xs font-medium bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-50">
            <Printer size={13}/> Print / PDF
          </button>
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
function ReportBody({ data, period }) {
  const h = data.headline;
  return (
    <div className="space-y-5">
      {/* Headline cards with delta vs previous */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Headline icon={<Users size={16}/>}        label="New leads"   value={h.new_leads.current}   delta={h.new_leads.delta}   color="blue" />
        <Headline icon={<GraduationCap size={16}/>} label="Enrolments"  value={h.enrolments.current}  delta={h.enrolments.delta}  color="emerald" />
        <Headline icon={<Wallet size={16}/>}        label="Revenue"     value={fmt(h.revenue.current)} delta={h.revenue.delta}    color="violet" />
        <Headline icon={<TrendingUp size={16}/>}    label="Net cash"    value={fmt(h.net_cash.current)} delta={h.net_cash.delta}  color={h.net_cash.current >= 0 ? 'blue' : 'rose'} />
        <Headline icon={<Calendar size={16}/>}      label="Attendance"  value={`${h.attendance.current}%`} color="amber" />
      </div>

      {/* Trend chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="font-semibold text-slate-700 text-sm mb-3">Daily trend — {data.period.label}</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.trend} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.95}/>
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.3}/>
              </linearGradient>
              <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.95}/>
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.3}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={d => d.slice(period === 'week' ? 8 : 5)} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', fontSize: 11 }} 
              formatter={(v, k) => k === 'newLeads' ? [`${v} leads`, 'New leads'] : [`৳${Number(v).toLocaleString()}`, 'Revenue']} 
            />
            <Bar dataKey="newLeads" fill="url(#gradLeads)" radius={[4,4,0,0]} name="New leads" maxBarSize={30} />
            <Bar dataKey="revenue"  fill="url(#gradRevenue)" radius={[4,4,0,0]} name="Revenue" maxBarSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Leads breakdown">
          <KvList label="By source"      rows={data.leads.by_source.map(r => ({ name: r.k, value: r.n }))} />
          <KvList label="By destination" rows={data.leads.by_destination.map(r => ({ name: r.k, value: r.n }))} />
          <p className="text-xs text-slate-500 mt-2">Conversion rate <strong className="text-slate-700">{data.leads.conversion_rate}%</strong> · {data.leads.enrolled} enrolled out of {data.leads.new}</p>
        </Card>

        <Card title="Application activity">
          {data.applications.stages_advanced.length === 0
            ? <p className="text-xs text-slate-400 italic">No stage advances</p>
            : <KvList label="Stages advanced" rows={data.applications.stages_advanced.map(r => ({ name: r.stage, value: r.n }))} />}
          {data.applications.university_moves.length > 0 && (
            <KvList label="University updates" rows={data.applications.university_moves.map(r => ({ name: r.status, value: r.n }))} />
          )}
        </Card>

        <Card title="Cashflow Overview">
          <div className="grid grid-cols-5 gap-1.5 mb-3">
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

        <Card title="Partnership September Distribution Targets">
          <p className="text-[11px] text-slate-400 mb-3">Theoretical distribution of Closing Cash ({fmtFull(data.cashflow.closing)}) based on the official annual profit sharing splits:</p>
          <div className="space-y-2">
            {[
              { name: 'Abdullah Al Rakib', pct: 45, val: data.cashflow.closing * 0.45, color: 'bg-blue-500' },
              { name: 'Tahmid Imam', pct: 30, val: data.cashflow.closing * 0.30, color: 'bg-violet-500' },
              { name: 'Sakib Al Jubaer', pct: 25, val: data.cashflow.closing * 0.25, color: 'bg-amber-500' }
            ].map(p => (
              <div key={p.name} className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${p.color}`} />
                  <div>
                    <span className="font-semibold text-slate-700">{p.name}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5">{p.pct}% Share</span>
                  </div>
                </div>
                <span className="font-bold text-slate-850 tabular-nums">{fmtFull(p.val)}</span>
              </div>
            ))}
          </div>
          <div className="bg-amber-50/50 border border-amber-100/60 rounded-xl p-3 flex items-start gap-2 mt-3 text-[10px] text-slate-500 leading-normal">
            <span className="text-amber-500 font-bold">ℹ</span>
            <span>Annual profit distribution is executed in September every year, computed on net cash balances at the end of the August financial ledger.</span>
          </div>
        </Card>

        <Card title="Team performance">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Mini label="Attendance"  value={`${data.attendance.attendance_pct}%`} />
            <Mini label="Late entries" value={data.attendance.late_count} />
            <Mini label="Daily logs"   value={data.attendance.total_logs} />
          </div>
          <p className="text-xs uppercase text-slate-400 font-semibold mb-1.5">Top performers</p>
          {data.top_performers.length === 0
            ? <p className="text-xs text-slate-400 italic">No activity recorded</p>
            : <div className="space-y-1.5">
                {data.top_performers.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-2 text-xs">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
                      ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : 'bg-orange-50 text-orange-500'}`}>
                      {i + 1}
                    </span>
                    <span className="flex-1 font-medium text-slate-700 truncate">{p.name}</span>
                    <span className="text-slate-500">{p.events} actions · {p.points} pts</span>
                  </div>
                ))}
              </div>}
        </Card>
      </div>

      {/* Highlights */}
      {data.highlights.length > 0 && (
        <Card title="Highlights">
          <ul className="space-y-1.5">
            {data.highlights.map((h, i) => (
              <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                <span>{h.icon}</span><span>{h.text}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Headline({ icon, label, value, delta, color }) {
  const palette = {
    blue:    'bg-blue-50/80 text-blue-600 border border-blue-100/50',
    emerald: 'bg-emerald-50/80 text-emerald-600 border border-emerald-100/50',
    violet:  'bg-violet-50/80 text-violet-600 border border-violet-100/50',
    amber:   'bg-amber-50/80 text-amber-600 border border-amber-100/50',
    rose:    'bg-rose-50/80 text-rose-600 border border-rose-100/50',
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div className={`p-2 rounded-xl w-fit ${palette[color] || 'bg-slate-50 text-slate-600'}`}>{icon}</div>
        {delta != null && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-0.5 tracking-tight
            ${delta >= 0 
              ? 'bg-emerald-50 text-emerald-750 border-emerald-200/55' 
              : 'bg-rose-50 text-rose-750 border-rose-200/55'}`}>
            {delta >= 0 ? <TrendingUp size={10}/> : <TrendingDown size={10}/>} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{label}</p>
        <p className="text-xl font-extrabold text-slate-800 tracking-tight mt-1">{value}</p>
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <h3 className="font-bold text-slate-700 text-sm mb-3.5">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Mini({ label, value, color }) {
  const palette = {
    emerald: 'text-emerald-700',
    rose:    'text-rose-700',
    blue:    'text-blue-700',
    amber:   'text-amber-700',
  };
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{label}</p>
      <p className={`text-lg font-bold ${palette[color] || 'text-slate-800'}`}>{value}</p>
    </div>
  );
}
function KvList({ label, rows }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-1">{label}</p>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-slate-700 truncate">{r.name}</span>
            <span className="text-slate-500 font-medium tabular-nums">{r.value}</span>
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
    `💰 Net cash: ৳${Number(h.net_cash.current).toLocaleString()} ${arrow(h.net_cash.delta)}`,
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

/* ─── Printable HTML — opens in a new tab, browser → Cmd-P → save as PDF ─── */
function buildPrintableHTML(d) {
  const h = d.headline;
  const css = `
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      margin: 0;
      padding: 40px;
      line-height: 1.5;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
      border: 1px solid #e2e8f0;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-mark {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 20px;
      box-shadow: 0 4px 6px -1px rgb(37 99 235 / 0.2);
    }
    .logo-text {
      display: flex;
      flex-direction: column;
    }
    .brand {
      font-weight: 800;
      font-size: 18px;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
    .brand-sub {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
    }
    .report-meta {
      text-align: right;
    }
    .report-meta h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      color: #1e3a8a;
      letter-spacing: -0.025em;
    }
    .report-meta p {
      margin: 4px 0 0;
      font-size: 12px;
      color: #64748b;
      font-weight: 600;
    }
    h2 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #1e3a8a;
      margin: 28px 0 12px;
      padding-bottom: 6px;
      border-bottom: 2px solid #e2e8f0;
      font-weight: 800;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .kpi-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 14px;
      background: #ffffff;
    }
    .kpi-card .lbl {
      font-size: 9px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
    }
    .kpi-card .val {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 4px;
      letter-spacing: -0.025em;
    }
    .kpi-card .delta {
      font-size: 9px;
      font-weight: 700;
      margin-top: 4px;
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }
    .delta.pos { color: #059669; }
    .delta.neg { color: #e11d48; }
    
    .grid-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }
    .panel {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      background: #ffffff;
    }
    .panel h3 {
      margin: 0 0 10px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #475569;
      border-bottom: 1px dashed #e2e8f0;
      padding-bottom: 6px;
      font-weight: 700;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11.5px;
      padding: 5px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .row:last-child {
      border-bottom: none;
    }
    .row span {
      color: #475569;
      font-weight: 500;
    }
    .row .v {
      font-weight: 700;
      color: #0f172a;
    }
    
    .partner-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #f1f5f9;
      background: #f8fafc;
      margin-bottom: 6px;
      font-size: 11.5px;
    }
    .partner-card:last-child {
      margin-bottom: 0;
    }
    .partner-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .partner-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .dot-rakib { background-color: #2563eb; }
    .dot-tahmid { background-color: #7c3aed; }
    .dot-sakib { background-color: #d97706; }
    
    .partner-name {
      font-weight: 600;
      color: #334155;
    }
    .partner-share {
      font-size: 9px;
      color: #64748b;
      margin-left: 6px;
      font-weight: 600;
      background: #e2e8f0;
      padding: 1px 5px;
      border-radius: 9999px;
    }
    .partner-val {
      font-weight: 850;
      color: #0f172a;
    }
    .info-box {
      background-color: #fffbeb;
      border: 1px solid #fef3c7;
      color: #b45309;
      border-radius: 8px;
      padding: 10px 12px;
      margin-top: 10px;
      font-size: 9.5px;
      line-height: 1.4;
      display: flex;
      gap: 6px;
    }
    .info-icon { font-weight: 800; flex-shrink: 0; }
    
    ul {
      margin: 6px 0 0 16px;
      padding: 0;
      font-size: 11.5px;
      color: #334155;
    }
    li {
      margin-bottom: 4px;
    }
    footer {
      margin-top: 40px;
      font-size: 10px;
      color: #64748b;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      font-weight: 500;
    }
    
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .container {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
      .panel {
        page-break-inside: avoid;
      }
      .kpi-card {
        page-break-inside: avoid;
      }
    }
  `;

  const deltaCls = (v) => v > 0 ? 'pos' : v < 0 ? 'neg' : '';
  const arrow = (v) => v > 0 ? '↑' : v < 0 ? '↓' : '→';
  const fmt = (n) => `৳${Number(n || 0).toLocaleString()}`;
  const fmtFull = (n) => `৳${Math.round(Number(n || 0)).toLocaleString()}`;
  
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
  <title>EduExpress Executive Digest — ${d.period.label}</title>
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
        <p>${d.period.label} &nbsp;|&nbsp; Comparative Analytics</p>
      </div>
    </header>

    <div class="kpi-grid">
      ${kpi('New leads', h.new_leads.current, h.new_leads.delta)}
      ${kpi('Enrolments', h.enrolments.current, h.enrolments.delta)}
      ${kpi('Revenue', fmt(h.revenue.current), h.revenue.delta)}
      ${kpi('Net cash', fmt(h.net_cash.current), h.net_cash.delta)}
      ${kpi('Attendance', h.attendance.current + '%')}
    </div>

    <h2>Leads & Conversions Analysis</h2>
    <div class="grid-2col">
      <div class="panel">
        <h3>By Source (Market Segment)</h3>
        ${rowList(d.leads.by_source)}
      </div>
      <div class="panel">
        <h3>By Destination (University Target)</h3>
        ${rowList(d.leads.by_destination)}
      </div>
    </div>
    <p style="font-size:11px; margin-top:-6px; margin-bottom: 20px; color:#475569; text-align: right; font-weight: 500;">
      Corporate Conversion Rate: <strong style="color: #0f172a;">${d.leads.conversion_rate}%</strong> · Enrolled: <strong>${d.leads.enrolled}</strong> out of ${d.leads.new} new acquisitions
    </p>

    <h2>Financial Position & Cashflow</h2>
    <div class="kpi-grid">
      ${kpi('Opening Bal', fmt(d.cashflow.opening))}
      ${kpi('Money In', fmt(d.cashflow.in))}
      ${kpi('Money Out', fmt(d.cashflow.out))}
      ${kpi('Net Flow', fmt(d.cashflow.net))}
      ${kpi('Closing Cash', fmt(d.cashflow.closing))}
    </div>

    <div class="grid-2col">
      <div class="panel">
        <h3>Top Revenue Streams</h3>
        ${rowList(d.cashflow.income_by_category.slice(0, 5), fmt)}
      </div>
      <div class="panel">
        <h3>Top Operating Expenses</h3>
        ${rowList(d.cashflow.expense_by_category.slice(0, 5), fmt)}
      </div>
    </div>

    <h2>Partnership Profit Projections & Distributions</h2>
    <div class="grid-2col">
      <div class="panel">
        <h3>Partnership September Distribution Targets</h3>
        <div class="partner-card">
          <div class="partner-info">
            <div class="partner-dot dot-rakib"></div>
            <span class="partner-name">Abdullah Al Rakib</span>
            <span class="partner-share">45% Split</span>
          </div>
          <span class="partner-val">${fmtFull(d.cashflow.closing * 0.45)}</span>
        </div>
        <div class="partner-card">
          <div class="partner-info">
            <div class="partner-dot dot-tahmid"></div>
            <span class="partner-name">Tahmid Imam</span>
            <span class="partner-share">30% Split</span>
          </div>
          <span class="partner-val">${fmtFull(d.cashflow.closing * 0.30)}</span>
        </div>
        <div class="partner-card">
          <div class="partner-info">
            <div class="partner-dot dot-sakib"></div>
            <span class="partner-name">Sakib Al Jubaer</span>
            <span class="partner-share">25% Split</span>
          </div>
          <span class="partner-val">${fmtFull(d.cashflow.closing * 0.25)}</span>
        </div>
        <div class="info-box">
          <span class="info-icon">ℹ</span>
          <span>Projections are computed dynamically on the current Closing Cash balance of ${fmtFull(d.cashflow.closing)}. Annual profit distributions are officially processed in September.</span>
        </div>
      </div>
      
      <div class="panel">
        <h3>Top Direct Revenue Accounts</h3>
        ${d.cashflow.top_clients.length 
          ? rowList(d.cashflow.top_clients.slice(0, 5), fmt)
          : '<div class="row"><em style="color:#94a3b8">No single-client records found</em></div>'}
      </div>
    </div>

    <h2>Operations, Teams & Recruitment Advances</h2>
    <div class="grid-2col">
      <div class="panel">
        <h3>Staff Attendance & Logs Activity</h3>
        <div class="row"><span>Monthly Attendance Average</span><span class="v">${d.attendance.attendance_pct}%</span></div>
        <div class="row"><span>Late Check-in Occurrences</span><span class="v">${d.attendance.late_count}</span></div>
        <div class="row"><span>Daily Worklogs Submitted</span><span class="v">${d.attendance.total_logs}</span></div>
        <div class="row"><span>Active Personnel in Period</span><span class="v">${d.attendance.active_employees}</span></div>
      </div>
      <div class="panel">
        <h3>Top Performance Standings (by Work Score)</h3>
        ${d.top_performers.length === 0 
          ? '<div class="row"><em style="color:#94a3b8">No employee activity recorded in this period</em></div>'
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
