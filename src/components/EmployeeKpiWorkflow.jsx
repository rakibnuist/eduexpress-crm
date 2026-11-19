/* Shared Employee KPI & Workflow Tracing UI components.
   Powers:
   - /kpi (KpiWorkflow page — team monitor for managers, self-service KPI for consultants)
   - HR -> Performance tab
   - MyDay personal KPI & workflow summary */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, Check, CheckCircle2, Clock, Crown,
  ExternalLink, FolderOpen, ListChecks, LogIn, MessageSquare,
  Pencil, RefreshCw, Shield, Target, UserCheck, Users, Wallet, X, Zap
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { api } from '../api';
import Modal from './Modal';
import { useToast } from './Toast';
import { isFullAdmin } from '../lib/roles';

export const EMPLOYEE_ROLES = [
  { key: 'founder_ceo', label: 'Founder & CEO', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: 'managing_director', label: 'Managing Director', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { key: 'investor', label: 'Investor', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'consultant', label: 'Consultant', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'application_manager', label: 'Application Manager', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'marketing_manager', label: 'Marketing Manager', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { key: 'hr_manager', label: 'HR Manager', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { key: 'admin', label: 'Admin', color: 'bg-slate-100 text-slate-700 border-slate-200' },
];

export function getRoleBadges(roleString) {
  if (!roleString) return [];
  return String(roleString).split(',').map(r => r.trim()).filter(Boolean).map(r => {
    const found = EMPLOYEE_ROLES.find(opt => opt.key === r);
    return { key: r, label: found?.label || r, color: found?.color || 'bg-slate-50 text-slate-700 border-slate-200' };
  });
}

const WORKFLOW_STAGE_META = {
  complete:        { label: 'Shift Complete ✓',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  on_track:        { label: 'On Track',          cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_progress:     { label: 'Active Today',      cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  needs_attention: { label: 'Bottleneck / SLA',  cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  not_checked_in:  { label: 'Not Checked In',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const TIMELINE_CAT_META = {
  lead:        { label: 'Lead',        cls: 'bg-blue-50 text-blue-700 border-blue-200',       icon: Users },
  chat:        { label: 'Chat',        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: MessageSquare },
  task:        { label: 'Task',        cls: 'bg-violet-50 text-violet-700 border-violet-200', icon: ListChecks },
  attendance:  { label: 'Attendance',  cls: 'bg-sky-50 text-sky-700 border-sky-200',          icon: LogIn },
  log:         { label: 'Daily Log',   cls: 'bg-amber-50 text-amber-700 border-amber-200',    icon: Pencil },
  application: { label: 'Application', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: FolderOpen },
  payment:     { label: 'Payment',     cls: 'bg-green-50 text-green-700 border-green-200',    icon: Wallet },
  approval:    { label: 'Approval',    cls: 'bg-rose-50 text-rose-700 border-rose-200',       icon: Shield },
};

const ISSUE_META = {
  overdue_followup: { label: 'Overdue Follow-up', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  due_today:        { label: 'Due Today',         cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  sla_breach:       { label: 'Untouched SLA',     cls: 'bg-orange-50 text-orange-700 border-orange-200' },
};

export function ScorePill({ score }) {
  const cls = score >= 75
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : score >= 45
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-rose-50 text-rose-700 border-rose-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold border tabular-nums ${cls}`}>
      {score}/100
    </span>
  );
}

function SignalBar({ label, pct, right, color }) {
  const cls = {
    emerald: 'bg-emerald-500',
    amber:   'bg-amber-500',
    blue:    'bg-blue-500',
    violet:  'bg-violet-500',
    rose:    'bg-rose-500',
  }[color] || 'bg-slate-400';
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex justify-between text-[11px] mb-1 gap-2">
        <span className="text-slate-500 font-bold truncate">{label}</span>
        <span className="text-slate-700 font-bold whitespace-nowrap tabular-nums">{right}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${cls} rounded-full transition-all`} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}

function MiniSparkBars({ series = [] }) {
  const last14 = series.slice(-14);
  if (last14.length === 0) return null;
  const maxVal = Math.max(4, ...last14.map(d => d.totalWork));
  return (
    <div className="flex items-end gap-0.5 h-7" title="Last 14 days workflow activity (CRM actions + chat replies)">
      {last14.map(d => {
        const h = d.totalWork > 0 ? Math.max(18, Math.round((d.totalWork / maxVal) * 100)) : 8;
        const barCls = d.totalWork > 0
          ? 'bg-blue-500 hover:bg-blue-600'
          : d.isWeekend
            ? 'bg-slate-100'
            : d.hasAttendance
              ? 'bg-amber-200'
              : 'bg-slate-200';
        return (
          <div
            key={d.date}
            className={`flex-1 rounded-t-xs transition-all ${barCls}`}
            style={{ height: `${h}%` }}
            title={`${d.date}: ${d.actions} CRM actions, ${d.chatReplies} chat replies${d.hasLog ? ' · Log ✓' : ''}`}
          />
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TEAM KPI & WORKFLOW MATRIX (Manager / Admin / Founder View)
   ════════════════════════════════════════════════════════════ */
export function TeamKpiWorkflowView({ month, user, onRefreshExternal }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('matrix'); // 'matrix' | 'cards'
  const [filterStage, setFilterStage] = useState('all'); // 'all' | 'attention'
  const [pickedEmpId, setPickedEmpId] = useState(null);
  const [targetModalEmp, setTargetModalEmp] = useState(null);
  const [taskModalEmp, setTaskModalEmp] = useState(null);

  const isAdmin = isFullAdmin(user);

  const load = useCallback(() => {
    setLoading(true);
    api.employeeKpi(month)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const filteredEmployees = useMemo(() => {
    const list = data?.employees || [];
    if (filterStage === 'attention') {
      return list.filter(e => e.workflowState?.urgentCount > 0 || !e.attendance?.today?.checkedIn);
    }
    return list;
  }, [data, filterStage]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.employees.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
        <Users size={36} className="text-slate-300 mx-auto mb-3" />
        <p className="font-bold">No active employees found</p>
        <p className="text-xs text-slate-400 mt-1">Add staff in HR → Team first to track KPI and workflows.</p>
      </div>
    );
  }

  const ts = data.teamSummary || {};
  const top = data.employees[0];
  const totalBottlenecks = (ts.overdueFollowups || 0) + (ts.uncontactedSla || 0) + (ts.overdueTasks || 0);

  return (
    <div className="space-y-5">
      {/* ── LIVE WORKFLOW PULSE STRIP ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <PulseStat
          icon={<UserCheck size={16} />}
          color="emerald"
          label="Checked In Today"
          value={`${ts.checkedInToday}/${ts.activeStaff}`}
          sub={`${data.effWorking}/${data.workingDays} working days`}
        />
        <PulseStat
          icon={<Pencil size={16} />}
          color="amber"
          label="Daily Logs Today"
          value={`${ts.logsSubmittedToday}/${ts.activeStaff}`}
          sub="End-of-day reflections"
        />
        <PulseStat
          icon={<Zap size={16} />}
          color="blue"
          label="Today's Actions"
          value={ts.todayActions || 0}
          sub="CRM + Chat replies today"
        />
        <PulseStat
          icon={<AlertTriangle size={16} />}
          color={totalBottlenecks > 0 ? 'rose' : 'slate'}
          label="SLA & Overdue Alerts"
          value={totalBottlenecks}
          sub={`${ts.uncontactedSla || 0} untouched · ${ts.overdueFollowups || 0} follow-ups · ${ts.overdueTasks || 0} tasks`}
        />
        <PulseStat
          icon={<Crown size={16} />}
          color="violet"
          label="Team Avg KPI"
          value={`${ts.avgScore || 0}/100`}
          sub={`Leader: ${top?.name?.split(' ')[0] || '—'} (${top?.score || 0})`}
        />
      </div>

      {/* ── TOOLBAR ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'matrix' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Live Workflow Matrix
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'cards' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              KPI Scorecards ({data.employees.length})
            </button>
          </div>

          <button
            onClick={() => setFilterStage(f => f === 'attention' ? 'all' : 'attention')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
              filterStage === 'attention'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle size={13} />
            Needs Attention Only
          </button>
        </div>

        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin text-blue-600' : ''} />
          Refresh Trace
        </button>
      </div>

      {/* ── VIEW 1: LIVE WORKFLOW MATRIX TABLE ── */}
      {viewMode === 'matrix' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-3">1. Today Shift</th>
                  <th className="py-3.5 px-3">2. Leads & SLA</th>
                  <th className="py-3.5 px-3">3. Tasks</th>
                  <th className="py-3.5 px-3">4. Activity & Log</th>
                  <th className="py-3.5 px-3">14-Day Output</th>
                  <th className="py-3.5 px-3 text-center">KPI Score</th>
                  <th className="py-3.5 px-4 text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map(e => {
                  const stageMeta = WORKFLOW_STAGE_META[e.workflowState?.stage] || WORKFLOW_STAGE_META.on_track;
                  const urgentLeads = (e.leads?.uncontactedOverdue || 0) + (e.leads?.followupsOverdue || 0);
                  return (
                    <tr
                      key={e.id || e.emp_id}
                      onClick={() => setPickedEmpId(e.emp_id)}
                      className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-2xs">
                            {e.name?.[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-sm truncate">{e.name}</p>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {getRoleBadges(e.role).slice(0, 2).map((r, i) => (
                                <span key={i} className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${r.color}`}>
                                  {r.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Step 1: Shift / Attendance */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {e.attendance.today.checkedIn ? (
                          <div className="space-y-0.5">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                              e.attendance.today.status === 'Late'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              <Clock size={10} /> {e.attendance.today.checkIn || 'In'} ({e.attendance.today.status})
                            </span>
                            <p className="text-[10px] text-slate-400">
                              {e.attendance.attendancePct}% month ({e.attendance.present + e.attendance.late}/{e.attendance.workingDays}d)
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                              Not checked in
                            </span>
                            <p className="text-[10px] text-slate-400">
                              {e.attendance.attendancePct}% month
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Step 2: Leads & SLA */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {e.leads.totalAssigned > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {urgentLeads > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                                  ⚠️ {urgentLeads} SLA/Overdue
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  ✓ SLA Clear
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium">
                              {e.leads.activePipeline} active · {e.leads.touchedThisMonth} touched · {e.leads.fileOpened} files
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No sales leads</span>
                        )}
                      </td>

                      {/* Step 3: Tasks */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-700">{e.tasks.totalActive} open</span>
                            {e.tasks.overdue > 0 && (
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                                {e.tasks.overdue} overdue
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400">
                            {e.tasks.doneMonth} done this month ({e.tasks.completionPct}%)
                          </p>
                        </div>
                      </td>

                      {/* Step 4: Today's Output & Daily Log */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold text-blue-700">
                              {e.activity.todayEvents} today
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                              e.office_work.todayLogSubmitted
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {e.office_work.todayLogSubmitted ? 'Log ✓' : 'Log pending'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            {e.activity.total} actions + {e.activity.chatReplies} chats · {e.office_work.streak > 0 ? `🔥 ${e.office_work.streak}d streak` : `${e.office_work.logsSubmitted} logs`}
                          </p>
                        </div>
                      </td>

                      {/* 14-day mini spark bars */}
                      <td className="py-3.5 px-3 w-28">
                        <MiniSparkBars series={e.dailySeries} />
                      </td>

                      {/* KPI Score & Workflow State */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          <ScorePill score={e.score} />
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${stageMeta.cls}`}>
                            {stageMeta.label}
                          </span>
                        </div>
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={ev => ev.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setTaskModalEmp(e)}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition-colors cursor-pointer"
                            title="Assign directive / task"
                          >
                            + Task
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => setTargetModalEmp(e)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-colors cursor-pointer"
                              title="Set KPI & SLA targets"
                            >
                              <Target size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => setPickedEmpId(e.emp_id)}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
                          >
                            Trace →
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── VIEW 2: KPI SCORECARDS GRID ── */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredEmployees.map(e => (
            <EnhancedPerfCard
              key={e.id || e.emp_id}
              e={e}
              isAdmin={isAdmin}
              onInspect={() => setPickedEmpId(e.emp_id)}
              onSetTargets={() => setTargetModalEmp(e)}
              onAssignTask={() => setTaskModalEmp(e)}
            />
          ))}
        </div>
      )}

      {/* ── DEEP WORKFLOW TRACE DRAWER ── */}
      {pickedEmpId && (
        <EmployeeWorkflowDrawer
          emp_id={pickedEmpId}
          month={month}
          user={user}
          onClose={() => setPickedEmpId(null)}
          onChanged={() => { load(); onRefreshExternal?.(); }}
        />
      )}

      {/* ── TARGETS MODAL ── */}
      {targetModalEmp && (
        <Modal title={`KPI & SLA Targets — ${targetModalEmp.name}`} onClose={() => setTargetModalEmp(null)}>
          <WorkflowTargetsForm
            emp={targetModalEmp}
            month={month}
            onSave={() => { setTargetModalEmp(null); load(); onRefreshExternal?.(); }}
          />
        </Modal>
      )}

      {/* ── QUICK ASSIGN TASK MODAL ── */}
      {taskModalEmp && (
        <Modal title={`Assign Directive — ${taskModalEmp.name}`} onClose={() => setTaskModalEmp(null)}>
          <QuickAssignTaskForm
            emp={taskModalEmp}
            onSave={() => { setTaskModalEmp(null); load(); }}
          />
        </Modal>
      )}
    </div>
  );
}

function PulseStat({ icon, label, value, sub, color }) {
  const palette = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    amber:   'bg-amber-50 text-amber-600 border-amber-200',
    blue:    'bg-blue-50 text-blue-600 border-blue-200',
    rose:    'bg-rose-50 text-rose-600 border-rose-200',
    violet:  'bg-violet-50 text-violet-600 border-violet-200',
    slate:   'bg-slate-50 text-slate-600 border-slate-200',
  }[color] || 'bg-slate-50 text-slate-600 border-slate-200';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <span className={`p-1.5 rounded-lg border ${palette}`}>{icon}</span>
      </div>
      <p className={`text-2xl font-extrabold mt-2 tabular-nums ${color === 'rose' ? 'text-rose-600' : 'text-slate-800'}`}>{value}</p>
      <p className="text-[10px] text-slate-400 mt-1 truncate">{sub}</p>
    </div>
  );
}

function EnhancedPerfCard({ e, isAdmin, onInspect, onSetTargets, onAssignTask }) {
  const scoreColor = e.score >= 75 ? 'text-emerald-600' : e.score >= 45 ? 'text-amber-600' : 'text-rose-600';
  const stageMeta = WORKFLOW_STAGE_META[e.workflowState?.stage] || WORKFLOW_STAGE_META.on_track;
  const urgent = e.workflowState?.urgentCount || 0;
  const targetMonthlyWeighted = Math.max(1, (e.office_work.effWorking || 1) * (e.targets?.target_daily_actions || 12));
  const actPct = Math.min(100, Math.round((e.activity.score / targetMonthlyWeighted) * 100));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:border-blue-300 transition-all shadow-xs flex flex-col justify-between gap-4">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center flex-shrink-0 shadow-xs">
              {e.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-800 truncate">{e.name}</p>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {getRoleBadges(e.role).slice(0, 2).map((r, i) => (
                  <span key={i} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${r.color}`}>{r.label}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <p className={`text-3xl font-black ${scoreColor} leading-none tabular-nums`}>{e.score}</p>
            <span className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${stageMeta.cls}`}>
              {stageMeta.label}
            </span>
          </div>
        </div>

        {/* 4 Pillar Signal Bars */}
        <div className="space-y-2 mb-3">
          <SignalBar
            label="Attendance (25)"
            pct={e.attendance.attendancePct}
            right={`${e.attendance.present + e.attendance.late}/${e.attendance.workingDays}d · ${e.scoreBreakdown?.attendance || 0}pt`}
            color="emerald"
          />
          <SignalBar
            label="Daily Logs (15)"
            pct={e.office_work.logPct}
            right={`${e.office_work.logsSubmitted}/${e.office_work.effWorking} ${e.office_work.streak ? `· 🔥${e.office_work.streak}` : ''} · ${e.scoreBreakdown?.discipline || 0}pt`}
            color="amber"
          />
          <SignalBar
            label="Activity & Chats (35)"
            pct={actPct}
            right={`${e.activity.total} acts · ${e.activity.chatReplies} chats · ${e.scoreBreakdown?.activity || 0}pt`}
            color="blue"
          />
          <SignalBar
            label="SLA & Execution (25)"
            pct={e.leads.totalAssigned > 0 ? e.leads.slaCompliancePct : e.tasks.completionPct}
            right={`${e.leads.totalAssigned > 0 ? `SLA ${e.leads.slaCompliancePct}%` : `Tasks ${e.tasks.completionPct}%`} · ${e.scoreBreakdown?.execution || 0}pt`}
            color="violet"
          />
        </div>

        {/* 14-day workflow consistency bars */}
        <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-2.5 mb-3">
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold mb-1.5">
            <span>14-Day Daily Output</span>
            <span className="text-blue-600">{e.activity.todayEvents} actions today</span>
          </div>
          <MiniSparkBars series={e.dailySeries} />
        </div>

        {/* Metrics & Alerts strip */}
        <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
          {e.leads.totalAssigned > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
              Leads: {e.leads.totalAssigned} ({e.leads.touchedThisMonth} touched)
            </span>
          )}
          {e.leads.fileOpened > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
              Files: {e.leads.fileOpened}
            </span>
          )}
          {urgent > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
              ⚠️ {urgent} SLA/Overdue
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onAssignTask}
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
          >
            + Task
          </button>
          {isAdmin && (
            <button
              onClick={onSetTargets}
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 cursor-pointer transition-colors"
            >
              🎯 Targets
            </button>
          )}
        </div>
        <button
          onClick={onInspect}
          className="text-xs font-extrabold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
        >
          Trace Workflow →
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   DEEP WORKFLOW DRILLDOWN DRAWER
   ════════════════════════════════════════════════════════════ */
export function EmployeeWorkflowDrawer({ emp_id, month, user, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('timeline'); // 'timeline' | 'sla' | 'tasks' | 'logs'
  const [catFilter, setCatFilter] = useState('all');
  const [showTargets, setShowTargets] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);
  const toast = useToast();
  const isAdmin = isFullAdmin(user);

  const load = useCallback(() => {
    api.employeeKpiOne(emp_id, month).then(setData).catch(() => {});
  }, [emp_id, month]);

  useEffect(() => { load(); }, [load]);

  const filteredTimeline = useMemo(() => {
    const items = data?.workflowTimeline || [];
    if (catFilter === 'all') return items;
    return items.filter(i => i.category === catFilter);
  }, [data, catFilter]);

  if (!data) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs" onClick={onClose}>
        <div className="bg-white h-full w-full max-w-3xl flex items-center justify-center shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const { employee, summary, attendance, logs, tasks = [], bottleneckLeads = [], chatStats = {} } = data;

  const quickCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setCreatingTask(true);
    try {
      await api.createTask({
        title: newTaskTitle.trim(),
        assigned_to: employee.name,
        due_date: newTaskDue || null,
        priority: 'high',
        category: 'Workflow',
      });
      setNewTaskTitle('');
      setNewTaskDue('');
      toast.success(`Directive assigned to ${employee.name}`);
      load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message || 'Could not create directive');
    } finally {
      setCreatingTask(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-xs" onClick={onClose}>
      <div className="bg-white h-full w-full max-w-3xl overflow-y-auto shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Sticky Drawer Header */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-extrabold text-lg flex items-center justify-center shadow-sm">
                {employee.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-extrabold text-slate-900">{employee.name}</h3>
                  {summary && <ScorePill score={summary.score} />}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {getRoleBadges(employee.role).map((r, i) => (
                    <span key={i} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${r.color}`}>{r.label}</span>
                  ))}
                  <span className="text-xs text-slate-400 font-mono">{employee.emp_id} · {month}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && summary && (
                <button
                  onClick={() => setShowTargets(s => !s)}
                  className="px-3 py-1.5 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <Target size={13} /> Targets
                </button>
              )}
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Drawer Tabs */}
          <div className="flex gap-1.5 mt-4 overflow-x-auto pb-0.5">
            {[
              { id: 'timeline', label: `Workflow Trace (${(data.workflowTimeline || []).length})` },
              { id: 'sla',      label: `SLA & Leads (${bottleneckLeads.length})` },
              { id: 'tasks',    label: `Tasks (${tasks.length})` },
              { id: 'logs',     label: `Logs (${logs.length}) & Shift (${attendance.length})` },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  tab === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Inline Target Editor if toggled */}
        {showTargets && summary && (
          <div className="p-6 bg-indigo-50/50 border-b border-indigo-100">
            <WorkflowTargetsForm
              emp={{ ...employee, targets: summary.targets }}
              month={month}
              onSave={() => { setShowTargets(false); load(); onChanged?.(); }}
            />
          </div>
        )}

        <div className="p-6 space-y-6 flex-1">
          {/* 4-Pillar Score Breakdown Strip */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <PillarBox label="Attendance" pts={summary.scoreBreakdown?.attendance} max={25} sub={`${summary.attendance.attendancePct}% present`} color="emerald" />
              <PillarBox label="Daily Logs" pts={summary.scoreBreakdown?.discipline} max={15} sub={`${summary.office_work.logsSubmitted}/${summary.office_work.effWorking} logs`} color="amber" />
              <PillarBox label="CRM & Chats" pts={summary.scoreBreakdown?.activity} max={35} sub={`${summary.activity.todayEvents} today · ${chatStats.totalOutboundMonth || 0} chats`} color="blue" />
              <PillarBox label="SLA & Tasks" pts={summary.scoreBreakdown?.execution} max={25} sub={`SLA ${summary.leads.slaCompliancePct}% · Tasks ${summary.tasks.completionPct}%`} color="violet" />
            </div>
          )}

          {/* TAB 1: WORKFLOW TRACE */}
          {tab === 'timeline' && (
            <div className="space-y-5">
              {/* Daily Output Bar Chart */}
              {summary?.dailySeries?.length > 0 && (
                <div className="bg-slate-50/60 border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Daily Output Trend ({month})</h4>
                      <p className="text-[11px] text-slate-500">Real CRM actions + Chat Inbox replies per Dhaka calendar day</p>
                    </div>
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                      Target: {summary.targets?.target_daily_actions || 12} pts/day
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={summary.dailySeries} margin={{ left: -20, right: 8, top: 5, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={d => d.slice(8)} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 18px rgba(0,0,0,.1)', fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="actions" name="CRM Actions" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="chatReplies" name="Chat Replies" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Chronological Workflow Stream */}
              <div>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Chronological Workflow Stream</h4>
                  <div className="flex flex-wrap gap-1">
                    {['all', 'lead', 'chat', 'task', 'application', 'payment', 'attendance', 'log'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setCatFilter(cat)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize cursor-pointer border ${
                          catFilter === cat
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredTimeline.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-8 text-center border border-dashed border-slate-200 rounded-2xl">
                    No recorded workflow events in this category for {month}.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                    {filteredTimeline.map(item => {
                      const meta = TIMELINE_CAT_META[item.category] || TIMELINE_CAT_META.lead;
                      const Icon = meta.icon;
                      return (
                        <div key={item.id} className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-100 bg-white hover:bg-slate-50/70 transition-colors">
                          <span className={`p-1.5 rounded-lg border flex-shrink-0 mt-0.5 ${meta.cls}`}>
                            <Icon size={12} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold text-slate-800 capitalize truncate">{item.title}</p>
                              <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                                {item.localDate?.slice(5)} · {item.localTime || '—'}
                              </span>
                            </div>
                            {item.subtitle && (
                              <p className="text-[11px] text-slate-600 mt-0.5 break-words">{item.subtitle}</p>
                            )}
                          </div>
                          {item.lead_id && (
                            <Link to={`/leads/${item.lead_id}`} className="text-[10px] font-bold text-blue-600 hover:underline whitespace-nowrap mt-1">
                              Lead →
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SLA & LEADS */}
          {tab === 'sla' && summary && (
            <div className="space-y-5">
              {/* Target Attainment */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Sales & Pipeline Targets ({month})</h4>
                  <span className="text-xs font-bold text-slate-500">Assigned: {summary.leads.totalAssigned} leads</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                  <MiniMetric label="New This Month" value={summary.leads.newThisMonth} sub={`Target: ${summary.targets.target_leads || '—'}`} />
                  <MiniMetric label="Positive / Visit" value={`${summary.leads.positive} / ${summary.leads.officeVisited}`} sub="Active funnel" />
                  <MiniMetric label="Files Opened" value={summary.leads.fileOpened} sub={`Target: ${summary.targets.target_enrolled || '—'}`} />
                  <MiniMetric label="Month Collected" value={`৳${(summary.leads.collectedThisMonth || 0).toLocaleString()}`} sub={`Target: ৳${(summary.targets.target_revenue || 0).toLocaleString()}`} />
                </div>
              </div>

              {/* Actionable Lead Bottlenecks */}
              <div>
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-3">
                  Leads Needing Attention ({bottleneckLeads.length})
                </h4>
                {bottleneckLeads.length === 0 ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
                    <CheckCircle2 size={24} className="text-emerald-600 mx-auto mb-1" />
                    <p className="text-sm font-bold text-emerald-900">Zero SLA Breaches or Overdue Follow-ups!</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {bottleneckLeads.map(l => {
                      const im = ISSUE_META[l.issue_type] || ISSUE_META.sla_breach;
                      return (
                        <Link
                          key={l.id}
                          to={`/leads/${l.id}`}
                          className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs transition-all"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-slate-800 truncate">{l.client_name}</span>
                              <span className="font-mono text-[10px] text-slate-400">{l.lead_id}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${im.cls}`}>
                                {im.label}{l.age_hours ? ` · ${l.age_hours}h` : ''}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {l.destination || '—'} · {l.lead_status}
                              {l.next_followup ? ` · Follow-up: ${l.next_followup}` : ''}
                            </p>
                          </div>
                          <ExternalLink size={14} className="text-blue-600 flex-shrink-0" />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TASKS & DIRECTIVES */}
          {tab === 'tasks' && (
            <div className="space-y-4">
              <form onSubmit={quickCreateTask} className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder={`Assign a directive to ${employee.name}…`}
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <input
                  type="date"
                  value={newTaskDue}
                  onChange={e => setNewTaskDue(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={creatingTask || !newTaskTitle.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer whitespace-nowrap"
                >
                  {creatingTask ? 'Assigning…' : '+ Assign Directive'}
                </button>
              </form>

              {tasks.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-8 border border-dashed border-slate-200 rounded-2xl">
                  No tasks recorded for this employee in {month}.
                </p>
              ) : (
                <div className="space-y-2">
                  {tasks.map(t => (
                    <div key={t.id} className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-sm font-bold ${t.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {t.title}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Priority: <strong className="uppercase">{t.priority}</strong>
                          {t.due_date ? ` · Due: ${t.due_date}` : ''}
                          {t.assigned_by ? ` · By ${t.assigned_by}` : ''}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full capitalize ${
                        t.status === 'done'
                          ? 'bg-emerald-50 text-emerald-700'
                          : t.status === 'blocked'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-blue-50 text-blue-700'
                      }`}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: LOGS & ATTENDANCE */}
          {tab === 'logs' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-3">Daily Reflection Logs ({logs.length})</h4>
                {logs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No daily logs submitted yet this month.</p>
                ) : (
                  <div className="space-y-2">
                    {logs.map(l => (
                      <div key={l.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                        <div className="flex justify-between items-baseline mb-1">
                          <p className="font-bold text-slate-800 text-sm">{l.date}</p>
                          <p className="text-[10px] text-slate-400">submitted {l.submitted_at?.slice(0, 16)}</p>
                        </div>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                          <strong>Did:</strong> {l.accomplishments}
                        </p>
                        {l.challenges && (
                          <p className="text-xs text-slate-600 whitespace-pre-wrap mt-1">
                            <strong>Blockers:</strong> {l.challenges}
                          </p>
                        )}
                        {l.tomorrow_plan && (
                          <p className="text-xs text-slate-600 whitespace-pre-wrap mt-1">
                            <strong>Plan:</strong> {l.tomorrow_plan}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-3">Attendance ({attendance.length})</h4>
                {attendance.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No attendance logs this month.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="text-left px-3 py-2 font-bold">Date</th>
                          <th className="text-left px-3 py-2 font-bold">Status</th>
                          <th className="text-left px-3 py-2 font-bold">In</th>
                          <th className="text-left px-3 py-2 font-bold">Out</th>
                          <th className="text-right px-3 py-2 font-bold">Hours</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attendance.slice().reverse().map(a => (
                          <tr key={a.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-bold">{a.date}</td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.status === 'Late' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {a.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono">{a.check_in || '—'}</td>
                            <td className="px-3 py-2 font-mono">{a.check_out || '—'}</td>
                            <td className="px-3 py-2 text-right font-bold tabular-nums">{a.hours_worked ? `${Number(a.hours_worked).toFixed(1)}h` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PERSONAL KPI & WORKFLOW TRACKER (Self-Service for Staff)
   ════════════════════════════════════════════════════════════ */
export function PersonalKpiWorkflowPanel({ month, user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.myKpi(month).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [month]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || !data.linked || !data.summary) {
    return (
      <div className="bg-white border border-amber-200 rounded-2xl p-6 text-center text-sm text-slate-600">
        Your user account ({user?.email}) is not linked to an HR employee record yet. Ask an admin to link your employee profile in <strong>Settings → Users</strong>.
      </div>
    );
  }

  const { summary, bottleneckLeads = [], tasks = [], workflowTimeline = [], chatStats = {} } = data;
  const openTasks = tasks.filter(t => t.status !== 'done');
  const step1Done = summary.attendance.today.checkedIn;
  const step2Done = bottleneckLeads.length === 0 && summary.tasks.overdue === 0;
  const step3Done = summary.workflowState.dailyTargetPct >= 100;
  const step4Done = summary.office_work.todayLogSubmitted;

  return (
    <div className="space-y-5">
      {/* Today's 4-Step Employee Workflow Checklist */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <Activity size={16} className="text-blue-600" />
              Today's Daily Workflow Tracker ({data.today})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Complete all 4 workflow milestones every day to maximize your monthly KPI score.</p>
          </div>
          <ScorePill score={summary.score} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <WorkflowStepCard
            step="1"
            title="Shift Check-in"
            done={step1Done}
            detail={step1Done ? `Checked in at ${summary.attendance.today.checkIn}` : 'Pending clock-in'}
            to="/my-day"
            cta="Go to Check-in"
          />
          <WorkflowStepCard
            step="2"
            title="Clear Urgent Leads & Tasks"
            done={step2Done}
            detail={step2Done ? 'All SLAs & follow-ups clear ✓' : `${bottleneckLeads.length} leads + ${summary.tasks.overdue} overdue tasks`}
            to={bottleneckLeads.length > 0 ? `/leads/${bottleneckLeads[0].id}` : '/tasks'}
            cta={bottleneckLeads.length > 0 ? 'Open Top Lead' : 'Open Tasks'}
          />
          <WorkflowStepCard
            step="3"
            title="Daily CRM & Chat Activity"
            done={step3Done}
            detail={`${summary.activity.todayWeighted}/${summary.targets.target_daily_actions} weighted pts today`}
            to="/leads"
            cta="Work Leads"
          />
          <WorkflowStepCard
            step="4"
            title="End-of-Day Reflection"
            done={step4Done}
            detail={step4Done ? 'Daily log submitted ✓' : 'Submit before leaving'}
            to="/my-day"
            cta="Write Daily Log"
          />
        </div>
      </div>

      {/* 4-Pillar Score & 14-Day Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Monthly KPI Breakdown ({month})</h3>
            <span className="text-xs font-extrabold text-blue-700">{summary.score}/100</span>
          </div>
          <div className="space-y-3">
            <SignalBar label="Attendance (25 pts)" pct={summary.attendance.attendancePct} right={`${summary.scoreBreakdown.attendance}/25`} color="emerald" />
            <SignalBar label="Daily Logs (15 pts)" pct={summary.office_work.logPct} right={`${summary.scoreBreakdown.discipline}/15`} color="amber" />
            <SignalBar label="CRM & Chat Activity (35 pts)" pct={Math.min(100, Math.round((summary.activity.score / Math.max(1, summary.office_work.effWorking * summary.targets.target_daily_actions)) * 100))} right={`${summary.scoreBreakdown.activity}/35`} color="blue" />
            <SignalBar label="SLA & Task Execution (25 pts)" pct={summary.leads.totalAssigned > 0 ? summary.leads.slaCompliancePct : summary.tasks.completionPct} right={`${summary.scoreBreakdown.execution}/25`} color="violet" />
          </div>
          <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-slate-50 rounded-xl p-2">
              <p className="font-extrabold text-slate-800">{summary.leads.touchedThisMonth}</p>
              <p className="text-[10px] text-slate-500">Leads Touched</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-2">
              <p className="font-extrabold text-emerald-600">{chatStats.totalOutboundMonth || 0}</p>
              <p className="text-[10px] text-slate-500">Chat Replies</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-2">
              <p className="font-extrabold text-blue-600">{summary.leads.fileOpened}</p>
              <p className="text-[10px] text-slate-500">Files Opened</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">My Workflow Output Trend ({month})</h3>
              <p className="text-[11px] text-slate-400">Daily CRM actions + Chat Inbox replies</p>
            </div>
            <span className="text-xs font-bold text-slate-500">🔥 {summary.office_work.streak}d log streak</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={summary.dailySeries} margin={{ left: -20, right: 8, top: 5, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={d => d.slice(8)} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 18px rgba(0,0,0,.1)', fontSize: 11 }} />
              <Bar dataKey="actions" name="CRM Actions" stackId="a" fill="#3b82f6" />
              <Bar dataKey="chatReplies" name="Chat Replies" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Priority Bottlenecks + Recent Trace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center justify-between">
            <span>Priority Leads Requiring Action ({bottleneckLeads.length})</span>
            <Link to="/leads" className="text-xs text-blue-600 hover:underline">All Leads →</Link>
          </h3>
          {bottleneckLeads.length === 0 ? (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-4 font-semibold text-center">
              Great job! No overdue follow-ups or untouched SLA leads right now.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {bottleneckLeads.slice(0, 10).map(l => {
                const im = ISSUE_META[l.issue_type] || ISSUE_META.sla_breach;
                return (
                  <Link key={l.id} to={`/leads/${l.id}`} className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-100 hover:border-blue-300 bg-slate-50/40 transition-colors">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{l.client_name}</p>
                      <p className="text-[10px] text-slate-500">{l.destination || '—'} · {l.lead_id}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${im.cls}`}>
                      {im.label}{l.age_hours ? ` · ${l.age_hours}h` : ''}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center justify-between">
            <span>My Recent Workflow Trace ({openTasks.length} open tasks)</span>
            <Link to="/tasks" className="text-xs text-blue-600 hover:underline">All Tasks →</Link>
          </h3>
          {workflowTimeline.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-6 text-center">No workflow activity logged this month yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {workflowTimeline.slice(0, 15).map(item => {
                const meta = TIMELINE_CAT_META[item.category] || TIMELINE_CAT_META.lead;
                const Icon = meta.icon;
                return (
                  <div key={item.id} className="flex items-center gap-2.5 p-2 rounded-xl border border-slate-100 text-xs">
                    <span className={`p-1 rounded-md border ${meta.cls}`}><Icon size={11} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-700 capitalize truncate">{item.title}</p>
                      {item.subtitle && <p className="text-[10px] text-slate-500 truncate">{item.subtitle}</p>}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">{item.localDate?.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkflowStepCard({ step, title, done, detail, to, cta }) {
  return (
    <div className={`rounded-xl border p-3.5 flex flex-col justify-between gap-2 transition-all ${
      done ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50/60 border-slate-200'
    }`}>
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Step {step}</span>
          {done ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              <Check size={10} /> Done
            </span>
          ) : (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Pending</span>
          )}
        </div>
        <p className="text-xs font-extrabold text-slate-800">{title}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{detail}</p>
      </div>
      {!done && to && (
        <Link to={to} className="text-[11px] font-bold text-blue-600 hover:underline w-fit">
          {cta} →
        </Link>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SHARED MODALS (Targets & Quick Directive Assignment)
   ════════════════════════════════════════════════════════════ */
export function WorkflowTargetsForm({ emp, month, onSave }) {
  const t = emp.targets || {};
  const [form, setForm] = useState({
    consultant: emp.name || emp.consultant,
    month,
    target_leads: t.target_leads || emp.target_leads || '',
    target_enrolled: t.target_enrolled || emp.target_enrolled || '',
    target_revenue: t.target_revenue || emp.target_revenue || '',
    target_daily_actions: t.target_daily_actions ?? 12,
    target_followups: t.target_followups || '',
    max_sla_hours: t.max_sla_hours ?? 24,
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.setKpiTargets({
        consultant: form.consultant,
        month: form.month,
        target_leads: Number(form.target_leads) || 0,
        target_enrolled: Number(form.target_enrolled) || 0,
        target_revenue: Number(form.target_revenue) || 0,
        target_daily_actions: Math.max(1, Number(form.target_daily_actions) || 12),
        target_followups: Math.max(0, Number(form.target_followups) || 0),
        max_sla_hours: Math.max(1, Number(form.max_sla_hours) || 24),
      });
      toast.success(`KPI & Workflow targets saved for ${form.consultant}`);
      onSave?.();
    } catch (err) {
      toast.error(err.message || 'Could not save targets');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs text-slate-500">
        Configure monthly targets and workflow SLA thresholds for <strong>{form.consultant}</strong> ({month}).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          ['target_daily_actions', 'Daily Workflow Points Target', '12'],
          ['max_sla_hours',        'First-Response SLA (Hours)',   '24'],
          ['target_leads',         'Monthly New Leads Target',     '0'],
          ['target_enrolled',      'Monthly File Opens Target',    '0'],
          ['target_revenue',       'Monthly Revenue Target (৳)',   '0'],
          ['target_followups',     'Monthly Follow-ups Target',    '0'],
        ].map(([k, label, ph]) => (
          <div key={k}>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">{label}</label>
            <input
              type="number"
              min="0"
              value={form[k]}
              onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
              placeholder={ph}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl cursor-pointer"
        >
          {saving ? 'Saving…' : 'Save KPI & SLA Targets'}
        </button>
      </div>
    </form>
  );
}

function QuickAssignTaskForm({ emp, onSave }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('high');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api.createTask({
        title: title.trim(),
        details: details.trim() || null,
        assigned_to: emp.name,
        due_date: dueDate || null,
        priority,
        category: 'KPI Directive',
      });
      toast.success(`Directive assigned to ${emp.name}`);
      onSave?.();
    } catch (err) {
      toast.error(err.message || 'Could not assign directive');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">Directive Title</label>
        <input
          type="text"
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Call all untouched Meta China leads today"
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Due Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Priority</label>
          <select
            value={priority}
            onChange={e => setPriority(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white outline-none"
          >
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">Notes (Optional)</label>
        <textarea
          rows={2}
          value={details}
          onChange={e => setDetails(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none resize-none"
        />
      </div>
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl cursor-pointer"
        >
          {saving ? 'Assigning…' : 'Assign Directive'}
        </button>
      </div>
    </form>
  );
}

function PillarBox({ label, pts = 0, max, sub, color }) {
  const cls = {
    emerald: 'border-emerald-200 bg-emerald-50/50 text-emerald-700',
    amber:   'border-amber-200 bg-amber-50/50 text-amber-700',
    blue:    'border-blue-200 bg-blue-50/50 text-blue-700',
    violet:  'border-violet-200 bg-violet-50/50 text-violet-700',
  }[color] || 'border-slate-200 bg-slate-50 text-slate-700';
  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-lg font-black tabular-nums mt-0.5">{pts}/{max}</p>
      <p className="text-[10px] opacity-75 truncate">{sub}</p>
    </div>
  );
}

function MiniMetric({ label, value, sub }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-2.5">
      <p className="text-[10px] text-slate-400 font-bold uppercase">{label}</p>
      <p className="text-base font-extrabold text-slate-800 mt-0.5 tabular-nums">{value}</p>
      <p className="text-[10px] text-slate-400 truncate">{sub}</p>
    </div>
  );
}
