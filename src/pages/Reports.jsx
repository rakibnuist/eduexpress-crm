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
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="font-semibold text-slate-700 text-sm mb-3">Daily trend — {data.period.label}</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.trend} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#e2e8f0"/>
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(period === 'week' ? 8 : 5)} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} formatter={(v, k) => k === 'newLeads' ? v : fmt(v)} />
            <Bar dataKey="newLeads" fill="#60a5fa" radius={[4,4,0,0]} name="New leads" />
            <Bar dataKey="revenue"  fill="#34d399" radius={[4,4,0,0]} name="Revenue" />
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

        <Card title="Cashflow">
          <div className="grid grid-cols-3 gap-3 mb-3">
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

        <Card title="Team performance">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Mini label="Attendance"  value={`${data.attendance.attendance_pct}%`} />
            <Mini label="Late entries" value={data.attendance.late_count} />
            <Mini label="Daily logs"   value={data.attendance.total_logs} />
          </div>
          <p className="text-xs uppercase text-slate-400 font-medium mb-1.5">Top performers</p>
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
    blue:    'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet:  'bg-violet-50 text-violet-600',
    amber:   'bg-amber-50 text-amber-600',
    rose:    'bg-rose-50 text-rose-600',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className={`p-2 rounded-lg w-fit ${palette[color]}`}>{icon}</div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium mt-2">{label}</p>
      <div className="flex items-baseline gap-2 mt-0.5">
        <p className="text-xl font-bold text-slate-800">{value}</p>
        {delta != null && (
          <span className={`text-[11px] font-semibold flex items-center ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {delta >= 0 ? <TrendingUp size={11}/> : <TrendingDown size={11}/>} {Math.abs(delta)}%
          </span>
        )}
      </div>
    </div>
  );
}
function Card({ title, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h3 className="font-semibold text-slate-700 text-sm mb-3">{title}</h3>
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
    *{box-sizing:border-box}
    body{font-family:-apple-system,Arial,sans-serif;color:#0f172a;background:#fff;margin:0;padding:32px 40px;max-width:880px;margin:0 auto}
    header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #1e3a8a;padding-bottom:14px;margin-bottom:18px}
    .logo{display:flex;align-items:center;gap:10px}
    .logo-mark{width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,#3b82f6,#1e40af);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px}
    .brand{font-weight:800;font-size:16px;letter-spacing:.2px}
    .brand-sub{font-size:11px;color:#64748b}
    .period{text-align:right}
    .period h1{margin:0;font-size:18px;color:#1e40af}
    .period p{margin:2px 0 0;font-size:11px;color:#64748b}
    h2{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a;margin:22px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
    .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:8px}
    .kpi{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px}
    .kpi .lbl{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.6px}
    .kpi .val{font-size:18px;font-weight:800;color:#0f172a;margin-top:2px}
    .kpi .delta{font-size:10px;font-weight:700;margin-top:1px}
    .delta.pos{color:#059669}.delta.neg{color:#e11d48}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .panel{border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px}
    .panel h3{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#475569}
    .row{display:flex;justify-content:space-between;font-size:12px;padding:2px 0}
    .row .v{font-weight:600;color:#1e293b}
    .pill{display:inline-block;background:#eff6ff;color:#1e40af;border-radius:999px;padding:1px 8px;font-size:10px;font-weight:700;margin-right:4px}
    ul{margin:4px 0 0 18px;padding:0;font-size:12px}
    footer{margin-top:30px;font-size:10px;color:#64748b;text-align:center;border-top:1px solid #e2e8f0;padding-top:8px}
    @media print { body{padding:24px} }
  `;
  const deltaCls = (v) => v > 0 ? 'pos' : v < 0 ? 'neg' : '';
  const arrow = (v) => v > 0 ? '↑' : v < 0 ? '↓' : '→';
  const fmt = (n) => `৳${Number(n||0).toLocaleString()}`;
  const kpi = (lbl, val, dlt) => `<div class="kpi"><div class="lbl">${lbl}</div><div class="val">${val}</div>${dlt != null ? `<div class="delta ${deltaCls(dlt)}">${arrow(dlt)} ${Math.abs(dlt)}% vs prev</div>` : ''}</div>`;
  const rowList = (rows, formatVal) => (rows && rows.length) ? rows.map(r => `<div class="row"><span>${r.name||r.k}</span><span class="v">${formatVal ? formatVal(r.value ?? r.v ?? r.n) : (r.value ?? r.v ?? r.n)}</span></div>`).join('') : '<div class="row"><em style="color:#94a3b8">No data</em></div>';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>EduExpress Report — ${d.period.label}</title><style>${css}</style></head><body>
    <header>
      <div class="logo">
        <div class="logo-mark">E</div>
        <div>
          <div class="brand">EduExpress International</div>
          <div class="brand-sub">Student Consultancy · Dhanmondi, Dhaka</div>
        </div>
      </div>
      <div class="period">
        <h1>${d.period.type === 'week' ? 'Weekly' : 'Monthly'} Report</h1>
        <p>${d.period.label} &nbsp;|&nbsp; vs ${d.period.previousLabel}</p>
      </div>
    </header>

    <div class="kpis">
      ${kpi('New leads', h.new_leads.current, h.new_leads.delta)}
      ${kpi('Enrolments', h.enrolments.current, h.enrolments.delta)}
      ${kpi('Revenue', fmt(h.revenue.current), h.revenue.delta)}
      ${kpi('Net cash', fmt(h.net_cash.current), h.net_cash.delta)}
      ${kpi('Attendance', h.attendance.current + '%')}
    </div>

    <h2>Leads</h2>
    <div class="grid2">
      <div class="panel"><h3>By source</h3>${rowList(d.leads.by_source)}</div>
      <div class="panel"><h3>By destination</h3>${rowList(d.leads.by_destination)}</div>
    </div>
    <p style="font-size:12px;margin-top:8px;color:#475569">Conversion rate <strong>${d.leads.conversion_rate}%</strong> — ${d.leads.enrolled} enrolled out of ${d.leads.new}.</p>

    <h2>Cashflow</h2>
    <div class="kpis" style="grid-template-columns:repeat(5,1fr)">
      ${kpi('Opening', fmt(d.cashflow.opening))}
      ${kpi('Money in', fmt(d.cashflow.in))}
      ${kpi('Money out', fmt(d.cashflow.out))}
      ${kpi('Net', fmt(d.cashflow.net))}
      ${kpi('Closing', fmt(d.cashflow.closing))}
    </div>
    <div class="grid2">
      <div class="panel"><h3>Top income categories</h3>${rowList(d.cashflow.income_by_category.slice(0,6), fmt)}</div>
      <div class="panel"><h3>Top spend categories</h3>${rowList(d.cashflow.expense_by_category.slice(0,6), fmt)}</div>
    </div>
    ${d.cashflow.top_clients.length ? `<div class="panel" style="margin-top:10px"><h3>Top paying clients</h3>${rowList(d.cashflow.top_clients, fmt)}</div>` : ''}

    <h2>Team</h2>
    <div class="grid2">
      <div class="panel">
        <h3>Attendance & logs</h3>
        <div class="row"><span>Attendance</span><span class="v">${d.attendance.attendance_pct}%</span></div>
        <div class="row"><span>Late entries</span><span class="v">${d.attendance.late_count}</span></div>
        <div class="row"><span>Daily logs submitted</span><span class="v">${d.attendance.total_logs}</span></div>
        <div class="row"><span>Active employees</span><span class="v">${d.attendance.active_employees}</span></div>
      </div>
      <div class="panel">
        <h3>Top performers (by activity score)</h3>
        ${d.top_performers.length === 0 ? '<div class="row"><em style="color:#94a3b8">No activity recorded</em></div>'
          : d.top_performers.map((p, i) => `<div class="row"><span>${i+1}. ${p.name}</span><span class="v">${p.points} pts · ${p.events} actions</span></div>`).join('')}
      </div>
    </div>

    ${d.highlights.length ? `<h2>Highlights</h2><div class="panel"><ul>${d.highlights.map(h => `<li>${h.icon} ${h.text}</li>`).join('')}</ul></div>` : ''}

    <footer>
      Generated ${new Date().toLocaleString('en-GB')} · EduExpress International Core
    </footer>
  </body></html>`;
}
