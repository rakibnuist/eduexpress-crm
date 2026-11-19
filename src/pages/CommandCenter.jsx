import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet, Users, AlertTriangle, CheckCircle2, ChevronRight, ClipboardCheck,
  ListChecks, RefreshCw, Plus, Target, UserCheck, MessageSquare,
} from 'lucide-react';
import { api } from '../api';
import { fmtCurrency, timeAgo } from '../lib/format';

const SEVERITY = {
  critical: { dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700 border-rose-200' },
  warning:  { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  info:     { dot: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700 border-blue-200' },
};
const TYPE_LABEL = {
  expense: 'Expense', refund: 'Refund', discount: 'Fee waiver',
  document_release: 'Document release', other: 'Request',
};

const initials = (name) => (name || '?').split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join('').toUpperCase();

function dhakaNow() {
  return new Date(Date.now() + 6 * 3600 * 1000);
}
function dhakaToday() {
  return dhakaNow().toISOString().slice(0, 10);
}

export default function CommandCenter({ user }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = 'Command Center | EduExpress'; }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.ceoCommand()
      .then(setData)
      .catch(e => setError(e.message || 'Could not load today’s snapshot'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const now = dhakaNow();
  const hour = now.getUTCHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (user?.name || 'CEO').split(' ')[0];
  const dateLabel = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const timeLabel = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

  const criticalCount = useMemo(() => (data?.exceptions || []).filter(e => e.severity === 'critical').length, [data]);
  const warningCount = useMemo(() => (data?.exceptions || []).filter(e => e.severity === 'warning').length, [data]);

  if (loading && !data) return <CommandSkeleton />;
  if (error && !data) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center">
        <AlertTriangle className="mx-auto text-rose-500 mb-3" size={30} />
        <p className="font-semibold text-slate-800">Today’s snapshot is unavailable</p>
        <p className="text-sm text-slate-500 mt-1 mb-4">{error}</p>
        <button onClick={load} className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-xl">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }
  if (!data) return null;

  const { cash, pipeline, delivery, customers, team, decisions, approvals, tasks, exceptions, data_freshness: freshness } = data;
  const stale = freshness?.days_since_lead != null && freshness.days_since_lead > 3;
  const today = dhakaToday();

  const overdueTasks = (tasks || []).filter(t => t.due_date && t.due_date < today && t.status !== 'done' && t.status !== 'cancelled');
  const otherExceptions = (exceptions || []).filter(e => !['Decision', 'Execution'].includes(e.category));
  const attention = [
    ...approvals.slice(0, 3).map(a => ({
      key: `a-${a.id}`,
      severity: a.priority === 'urgent' || a.priority === 'high' ? 'critical' : 'warning',
      title: a.title,
      meta: `Approval · ${a.requested_by || 'Unknown'}${a.amount != null ? ` · ${fmtCurrency(a.amount)}` : ''} · ${timeAgo(a.created_at)}`,
      href: `/approvals?focus=${a.id}`,
      tag: TYPE_LABEL[a.type] || 'Request',
    })),
    ...overdueTasks.slice(0, 2).map(t => ({
      key: `t-${t.id}`,
      severity: 'critical',
      title: t.title,
      meta: `Task · ${t.assigned_to || 'Unassigned'} · overdue since ${t.due_date}`,
      href: `/tasks?focus=${t.id}`,
      tag: 'Task',
    })),
    ...otherExceptions.slice(0, 4).map((e, i) => ({
      key: `e-${i}`,
      severity: e.severity,
      title: e.title,
      meta: e.detail,
      href: e.href || '/reports',
      tag: e.count != null ? String(e.count) : 'Risk',
    })),
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 text-white p-5 sm:p-6 shadow-xl">
        <div className="absolute -top-28 -right-20 w-80 h-80 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Command Center
              </span>
              <span className="text-[11px] text-slate-400">{timeLabel} Dhaka</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2">{greeting}, {firstName}.</h1>
            <p className="text-sm text-slate-300 mt-1">{dateLabel} · Dhanmondi decision desk</p>
            <p className="text-xs text-slate-400 mt-2">
              {attention.length > 0 ? `${attention.length} item${attention.length === 1 ? '' : 's'} need your attention.` : 'Nothing needs your decision right now.'}
              {decisions.pending_approvals > 0 ? ` ${decisions.pending_approvals} approval${decisions.pending_approvals === 1 ? '' : 's'} waiting.` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/approvals" className="inline-flex items-center gap-1.5 bg-white text-slate-900 hover:bg-blue-50 text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl">
              <ClipboardCheck size={15} /> Approvals
              {decisions.pending_approvals > 0 && <span className="bg-rose-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">{decisions.pending_approvals}</span>}
            </Link>
            <Link to="/tasks?new=1" className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl">
              <Plus size={15} /> Assign task
            </Link>
            <button onClick={load} title="Refresh" aria-label="Refresh" className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        {stale && (
          <p className="relative mt-4 text-[11px] text-amber-200/90 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
            Data warning: the newest lead is from {freshness.last_lead} ({freshness.days_since_lead} days ago). Check lead ingestion before relying on the pipeline.
          </p>
        )}
      </section>

      {/* Four numbers only */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3.5">
        <Metric icon={<Wallet size={16} />} label="Cash recorded" value={fmtCurrency(cash.position)} sub="All recorded movements" tone={cash.position >= 0 ? 'emerald' : 'rose'} />
        <Metric icon={<Users size={16} />} label="Pipeline" value={pipeline.total.toLocaleString()} sub={`${pipeline.new_today} new today · ${pipeline.unassigned} unowned`} tone="blue" />
        <Metric icon={<ClipboardCheck size={16} />} label="Approvals waiting" value={String(decisions.pending_approvals)} sub={decisions.pending_approvals ? fmtCurrency(decisions.pending_amount) : 'Queue is clear'} tone={decisions.pending_approvals ? 'amber' : 'slate'} />
        <Metric icon={<AlertTriangle size={16} />} label="Open risks" value={String(exceptions.length)} sub={`${criticalCount} critical · ${warningCount} watch`} tone={criticalCount ? 'rose' : 'slate'} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* One combined attention queue */}
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Target size={16} /> Needs your attention</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Approvals, overdue tasks and the highest-cost risks, in one list.</p>
            </div>
            <Link to="/reports" className="text-xs font-semibold text-blue-600 flex items-center gap-1">Reports <ChevronRight size={13} /></Link>
          </div>
          {attention.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 size={28} className="mx-auto text-emerald-500" />
              <p className="text-sm font-semibold text-slate-700 mt-2">Nothing needs you right now</p>
              <p className="text-xs text-slate-400 mt-1">The approval queue, tasks and risk checks are clear.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 mt-3">
              {attention.map(item => {
                const s = SEVERITY[item.severity] || SEVERITY.info;
                return (
                  <Link key={item.key} to={item.href} className="flex items-start gap-3 py-3 hover:bg-slate-50/70 -mx-2 px-2 rounded-xl transition-colors">
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{item.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{item.meta}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${s.chip}`}>{item.tag}</span>
                    <ChevronRight size={14} className="text-slate-300 flex-shrink-0 mt-1" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Team + shortcuts */}
        <div className="xl:col-span-5 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><UserCheck size={16} /> Team today</h2>
                <p className="text-[10px] text-slate-400 mt-0.5">{team.checked_in}/{team.active_staff} checked in · {team.logs_submitted} daily logs</p>
              </div>
              <div className="flex items-center gap-3">
                <Link to="/kpi" className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-0.5">KPI Trace <ChevronRight size={13} /></Link>
                <Link to="/hr" className="text-xs font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-0.5">HR <ChevronRight size={13} /></Link>
              </div>
            </div>
            <div className="space-y-2 mt-3">
              {team.people.map(p => (
                <div key={`${p.emp_id}-${p.name}`} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-800 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">{initials(p.name)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{p.log_submitted ? 'Log submitted' : 'Log missing'}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${p.check_in ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {p.check_in || 'Not in'}
                  </span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100">
              <Mini label="New today" value={pipeline.new_today} />
              <Mini label="Applications" value={delivery.active_applications} />
              <Mini label="Unread msgs" value={customers.unread_messages} />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 mb-3">Shortcuts</h2>
            <div className="grid grid-cols-2 gap-2">
              <Shortcut to="/leads" icon={<Users size={14} />} label="Leads" />
              <Shortcut to="/applications" icon={<ListChecks size={14} />} label="Applications" />
              <Shortcut to="/finance" icon={<Wallet size={14} />} label="Finance" />
              <Shortcut to="/conversations" icon={<MessageSquare size={14} />} label="Inbox" />
            </div>
          </div>
        </div>
      </section>

      <p className="text-[10px] text-slate-400 text-center pb-2">
        Snapshot generated {timeAgo(data.generated_at)} · Figures are from the database, not forecasts.
      </p>
    </div>
  );
}

function Metric({ icon, label, value, sub, tone }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-600', blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600', rose: 'bg-rose-50 text-rose-600', slate: 'bg-slate-100 text-slate-500',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <span className={`inline-flex p-2 rounded-xl ${tones[tone] || tones.slate}`}>{icon}</span>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-3">{label}</p>
      <p className={`text-xl font-extrabold mt-0.5 tabular-nums ${tone === 'rose' ? 'text-rose-600' : 'text-slate-800'}`}>{value}</p>
      <p className="text-[10px] text-slate-400 mt-1 truncate">{sub}</p>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-800 tabular-nums">{value}</p>
    </div>
  );
}

function Shortcut({ to, icon, label }) {
  return (
    <Link to={to} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 transition-colors">
      {icon} {label}
    </Link>
  );
}

function CommandSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-48 rounded-3xl bg-slate-200" />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-slate-200" />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7 h-80 rounded-2xl bg-slate-200" />
        <div className="xl:col-span-5 h-80 rounded-2xl bg-slate-200" />
      </div>
    </div>
  );
}
