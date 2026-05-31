import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';
import {
  Users, Clock, BarChart2, Plus, Pencil, Trash2, CheckCircle,
  LogIn, LogOut, Target, TrendingUp, Award, AlertCircle, Calendar,
  DollarSign, Printer, CircleCheck, CircleDot
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, Legend, Cell,
} from 'recharts';

const curMonth = new Date().toISOString().slice(0, 7);
const today = new Date().toISOString().slice(0, 10);

export default function HR() {
  const [tab, setTab] = useState('performance');
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState([]);
  const [workingDays, setWorkingDays] = useState(0);
  const [kpis, setKpis] = useState([]);
  const [month, setMonth] = useState(curMonth);
  const [modal, setModal] = useState(null);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [empLogs, setEmpLogs] = useState([]);
  const [todayLogs, setTodayLogs] = useState([]);

  const load = useCallback(() => {
    api.employees().then(setEmployees);
    api.attendanceSummary(month).then(d => { setSummary(d.summary); setWorkingDays(d.workingDays); });
    api.kpi(month).then(setKpis);
    api.attendance({ date: today }).then(setTodayLogs);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (selectedEmp) {
      api.attendance({ emp_id: selectedEmp.emp_id, month }).then(setEmpLogs);
    }
  }, [selectedEmp, month]);

  const toast = useToast();
  const confirm = useConfirm();

  async function handleDelete(id) {
    const ok = await confirm({ title: 'Delete this employee?', tone: 'danger', confirmLabel: 'Delete' });
    if (!ok) return;
    try { await api.deleteEmployee(id); load(); toast.success('Employee removed'); }
    catch (e) { toast.error(e.message); }
  }

  async function handleCheckIn(emp) {
    const now = new Date();
    const time = now.toTimeString().slice(0, 5);
    try {
      await api.checkIn({ emp_id: emp.emp_id, date: today, time, source: 'manual' });
      load();
      toast.success(`${emp.name} checked in at ${time}`);
    } catch (e) {
      toast.error(e.message.includes('Already') ? `${emp.name} already checked in today` : e.message);
    }
  }

  async function handleCheckOut(emp) {
    const log = todayLogs.find(l => l.emp_id === emp.emp_id);
    if (!log) { toast.error('No check-in found for today'); return; }
    const now = new Date();
    const time = now.toTimeString().slice(0, 5);
    try { await api.checkOut(log.id, time); load(); toast.success(`${emp.name} checked out at ${time}`); }
    catch (e) { toast.error(e.message); }
  }

  const totalPayroll = employees.filter(e => e.active === 'Yes').reduce((s, e) => s + (e.salary || 0), 0);
  const checkedInToday = todayLogs.map(l => l.emp_id);

  const tabs = [
    { id: 'performance', label: 'Performance', icon: TrendingUp },
    { id: 'employees',   label: 'Employees',   icon: Users },
    { id: 'attendance',  label: 'Attendance',  icon: Clock },
    { id: 'payroll',     label: 'Payroll',     icon: DollarSign },
    { id: 'kpi',         label: 'Sales KPI',   icon: BarChart2 },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200/80 pb-4 mb-2">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Users size={24} className="text-blue-600" /> Human Resources & Team Payroll
          </h2>
          <p className="text-sm text-slate-500 mt-1">Manage team directories, log employee attendance sheets, calculate monthly sales commissions, and process payroll</p>
        </div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="px-3.5 py-2 border border-slate-200 rounded-xl text-sm font-semibold cursor-pointer bg-white" />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Active Staff" value={employees.filter(e => e.active === 'Yes').length} icon={<Users size={18} />} color="blue" />
        <StatCard label="Monthly Payroll" value={`৳${totalPayroll.toLocaleString()}`} icon={<Award size={18} />} color="emerald" />
        <StatCard label="Checked In Today" value={`${checkedInToday.length}/${employees.filter(e => e.active === 'Yes').length}`} icon={<LogIn size={18} />} color="violet" />
        <StatCard label="Working Days" value={workingDays} sub={month} icon={<Calendar size={18} />} color="amber" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── EMPLOYEES TAB ── */}
      {tab === 'employees' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setModal({ type: 'emp' })}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 shadow-sm">
              <Plus size={15} /> Add Employee
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {employees.map(emp => {
              const s = summary.find(s => s.emp_id === emp.emp_id);
              const isIn = checkedInToday.includes(emp.emp_id);
              const todayLog = todayLogs.find(l => l.emp_id === emp.emp_id);
              return (
                <div key={emp.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg
                        ${emp.active === 'Yes' ? 'bg-gradient-to-br from-blue-500 to-blue-700' : 'bg-slate-300'}`}>
                        {emp.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{emp.name}</p>
                        <p className="text-xs text-slate-500">{emp.role}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${emp.active === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}`}>
                      {emp.active === 'Yes' ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <InfoPill label="Emp ID" value={emp.emp_id} />
                    <InfoPill label="Salary" value={`৳${(emp.salary || 0).toLocaleString()}`} />
                    {emp.device_id && <InfoPill label="Device" value={emp.device_id} mono />}
                    {emp.join_date && <InfoPill label="Joined" value={emp.join_date} />}
                  </div>

                  {/* Today attendance status */}
                  <div className={`flex items-center justify-between p-2.5 rounded-xl mb-3 text-xs
                    ${isIn ? (todayLog?.check_out ? 'bg-slate-50 text-slate-500' : 'bg-green-50 text-green-700') : 'bg-slate-50 text-slate-400'}`}>
                    {isIn ? (
                      <span className="flex items-center gap-1.5">
                        <CheckCircle size={13} className="text-green-500" />
                        In: {todayLog?.check_in}
                        {todayLog?.check_out && <span className="ml-1 text-slate-400">· Out: {todayLog.check_out}</span>}
                        {todayLog?.hours_worked && <span className="ml-1 font-medium">({parseFloat(todayLog.hours_worked).toFixed(1)}h)</span>}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5"><AlertCircle size={13} /> Not checked in</span>
                    )}
                    {todayLog?.status && (
                      <span className={`px-1.5 py-0.5 rounded font-semibold ${todayLog.status === 'Late' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {todayLog.status}
                      </span>
                    )}
                  </div>

                  {/* Month summary bar */}
                  {s && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Attendance {month}</span>
                        <span className="font-semibold text-slate-700">{s.attendancePct}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${s.attendancePct}%` }} />
                      </div>
                      <div className="flex gap-3 text-xs mt-1.5 text-slate-400">
                        <span className="text-green-600">✓ {s.present} present</span>
                        <span className="text-amber-600">⏰ {s.late} late</span>
                        <span className="text-red-400">✗ {s.absent} absent</span>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {emp.active === 'Yes' && !isIn && (
                      <button onClick={() => handleCheckIn(emp)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700">
                        <LogIn size={13} /> Check In
                      </button>
                    )}
                    {isIn && !todayLog?.check_out && (
                      <button onClick={() => handleCheckOut(emp)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-600 text-white rounded-lg text-xs font-medium hover:bg-slate-700">
                        <LogOut size={13} /> Check Out
                      </button>
                    )}
                    <button onClick={() => { setSelectedEmp(emp); setTab('attendance'); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50">
                      <Clock size={13} /> Logs
                    </button>
                    <button onClick={() => setModal({ type: 'emp', emp })}
                      className="p-1.5 border border-slate-200 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(emp.id)}
                      className="p-1.5 border border-slate-200 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ATTENDANCE TAB ── */}
      {tab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              value={selectedEmp?.emp_id || ''} onChange={e => setSelectedEmp(employees.find(em => em.emp_id === e.target.value) || null)}>
              <option value="">— All Employees —</option>
              {employees.map(e => <option key={e.id} value={e.emp_id}>{e.name}</option>)}
            </select>
            <button onClick={() => setModal({ type: 'attn' })}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 shadow-sm ml-auto">
              <Plus size={15} /> Log Attendance
            </button>
          </div>

          {/* Summary table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="font-semibold text-slate-700 text-sm">Monthly Summary — {month}</span>
              <span className="text-xs text-slate-400">{workingDays} working days</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Employee', 'Role', 'Present', 'Late', 'Absent', 'Hours', 'Avg Check-in', 'Attendance %'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {summary.map(s => (
                    <tr key={s.id}
                      className={`hover:bg-slate-50 cursor-pointer ${selectedEmp?.emp_id === s.emp_id ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelectedEmp(s)}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {s.name?.[0]?.toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-800">{s.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{s.role}</td>
                      <td className="py-3 px-4 text-green-600 font-semibold">{s.present}</td>
                      <td className="py-3 px-4 text-amber-600 font-medium">{s.late}</td>
                      <td className="py-3 px-4 text-red-400">{s.absent}</td>
                      <td className="py-3 px-4 text-slate-600">{s.totalHours}h</td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-xs">{s.avgCheckin || '—'}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${s.attendancePct}%`, backgroundColor: s.attendancePct >= 80 ? '#22c55e' : s.attendancePct >= 60 ? '#f59e0b' : '#ef4444' }} />
                          </div>
                          <span className={`text-xs font-bold ${s.attendancePct >= 80 ? 'text-green-600' : s.attendancePct >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                            {s.attendancePct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Individual log calendar */}
          {selectedEmp && (
            <AttendanceCalendar emp={selectedEmp} month={month} logs={empLogs} onRefresh={load} />
          )}
        </div>
      )}

      {/* ── PERFORMANCE TAB ── */}
      {tab === 'performance' && (
        <Performance month={month} />
      )}

      {/* ── PAYROLL TAB ── */}
      {tab === 'payroll' && (
        <Payroll month={month} />
      )}

      {/* ── KPI TRACKER TAB ── */}
      {tab === 'kpi' && (
        <KPITracker kpis={kpis} month={month} onRefresh={load} />
      )}

      {/* ── MODALS ── */}
      {modal?.type === 'emp' && (
        <Modal title={modal.emp ? 'Edit Employee' : 'Add Employee'} onClose={() => setModal(null)}>
          <EmpForm emp={modal.emp} onSave={() => { setModal(null); load(); }} />
        </Modal>
      )}
      {modal?.type === 'attn' && (
        <Modal title="Log Attendance" onClose={() => setModal(null)}>
          <AttendanceForm employees={employees} onSave={() => { setModal(null); load(); }} />
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ATTENDANCE CALENDAR
// ─────────────────────────────────────────────
function AttendanceCalendar({ emp, month, logs, onRefresh }) {
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay(); // 0=Sun

  const logMap = {};
  logs.forEach(l => { if (l.date) logMap[l.date] = l; });

  function dayColor(dateStr) {
    const log = logMap[dateStr];
    const dow = new Date(dateStr).getDay();
    if (dow === 5 || dow === 6) return 'bg-slate-100 text-slate-300';
    if (!log) return dateStr < today ? 'bg-red-50 text-red-400 hover:bg-red-100' : 'bg-slate-50 text-slate-300';
    if (log.status === 'Present') return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200';
    if (log.status === 'Late') return 'bg-amber-100 text-amber-700 hover:bg-amber-200';
    return 'bg-slate-100 text-slate-500';
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-700">
          📅 {emp.name}'s Attendance — {month}
        </h3>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-200" />Present</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-200" />Late</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100" />Absent</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100" />Weekend</span>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`pad-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${month}-${String(day).padStart(2, '0')}`;
          const log = logMap[dateStr];
          return (
            <div key={day} className={`rounded-lg p-1.5 text-center cursor-default transition-colors ${dayColor(dateStr)}`}
              title={log ? `${log.status} · In: ${log.check_in || '?'}${log.check_out ? ` · Out: ${log.check_out}` : ''}${log.hours_worked ? ` · ${parseFloat(log.hours_worked).toFixed(1)}h` : ''}` : dateStr}>
              <div className="text-xs font-semibold">{day}</div>
              {log?.check_in && <div className="text-[9px] leading-tight opacity-70">{log.check_in}</div>}
            </div>
          );
        })}
      </div>

      {/* Daily log table */}
      {logs.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h4 className="text-sm font-semibold text-slate-600 mb-3">Daily Log</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Date', 'Check In', 'Check Out', 'Hours', 'Status', 'Source'].map(h => (
                    <th key={h} className="text-left py-2 px-2 text-slate-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.slice().reverse().map(l => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2 font-medium">{l.date}</td>
                    <td className="py-2 px-2 font-mono text-slate-600">{l.check_in || '—'}</td>
                    <td className="py-2 px-2 font-mono text-slate-600">{l.check_out || '—'}</td>
                    <td className="py-2 px-2 text-slate-600">{l.hours_worked ? parseFloat(l.hours_worked).toFixed(1) + 'h' : '—'}</td>
                    <td className="py-2 px-2">
                      <span className={`px-1.5 py-0.5 rounded font-semibold ${l.status === 'Present' ? 'bg-emerald-100 text-emerald-700' : l.status === 'Late' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-500'}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-slate-400 capitalize">{l.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// KPI TRACKER
// ─────────────────────────────────────────────
function KPITracker({ kpis, month, onRefresh }) {
  const [editTarget, setEditTarget] = useState(null);

  const chartData = kpis.map(k => ({
    name: k.consultant,
    'New Leads': k.thisMonth,
    'Office Visit': k.officeVisited,
    'File Opened': k.fileOpened,
    'Enrolled': k.enrolled,
  }));

  return (
    <div className="space-y-5">
      {/* Overview chart */}
      {kpis.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-4">Consultant Performance — {month}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ left: -10 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)' }} />
              <Legend />
              <Bar dataKey="New Leads" fill="#60a5fa" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Office Visit" fill="#a78bfa" radius={[3, 3, 0, 0]} />
              <Bar dataKey="File Opened" fill="#34d399" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Enrolled" fill="#4ade80" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {kpis.map(k => (
          <KPICard key={k.consultant} kpi={k} onSetTarget={() => setEditTarget(k)} />
        ))}
      </div>

      {editTarget && (
        <Modal title={`Set Targets — ${editTarget.consultant}`} onClose={() => setEditTarget(null)}>
          <TargetForm kpi={editTarget} month={month} onSave={() => { setEditTarget(null); onRefresh(); }} />
        </Modal>
      )}
    </div>
  );
}

function KPICard({ kpi: k, onSetTarget }) {
  const leadsProgress = k.target_leads > 0 ? Math.min(100, Math.round((k.thisMonth / k.target_leads) * 100)) : null;
  const fileOpenedProgress = k.target_enrolled > 0 ? Math.min(100, Math.round((k.fileOpened / k.target_enrolled) * 100)) : null;
  const revProgress = k.target_revenue > 0 ? Math.min(100, Math.round((k.revenue / k.target_revenue) * 100)) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
            {k.consultant?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-800">{k.consultant}</p>
            <p className="text-xs text-slate-400">{k.total} total leads</p>
          </div>
        </div>
        <button onClick={onSetTarget} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Set targets">
          <Target size={15} />
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <MiniStat label="Positive" value={k.positive} color="emerald" />
        <MiniStat label="Visited" value={k.officeVisited} color="violet" />
        <MiniStat label="Enrolled" value={k.enrolled} color="green" />
        <MiniStat label="File Open" value={k.fileOpened} color="blue" />
        <MiniStat label="Conversion" value={`${k.conversionRate}%`} color="indigo" />
        <MiniStat label="Response" value={`${k.responseRate}%`} color="sky" />
      </div>

      {/* Revenue */}
      <div className="bg-slate-50 rounded-xl p-3 mb-3">
        <div className="flex justify-between text-xs mb-0.5">
          <span className="text-slate-500">Service Fees</span>
          <span className="font-semibold text-slate-700">৳{k.revenue.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Collected</span>
          <span className="font-semibold text-emerald-600">৳{k.collected.toLocaleString()}</span>
        </div>
      </div>

      {/* Targets progress */}
      {(leadsProgress !== null || fileOpenedProgress !== null || revProgress !== null) && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Targets</p>
          {leadsProgress !== null && (
            <ProgressBar label="Leads" current={k.thisMonth} target={k.target_leads} pct={leadsProgress} color="blue" />
          )}
          {fileOpenedProgress !== null && (
            <ProgressBar label="File Opens" current={k.fileOpened} target={k.target_enrolled} pct={fileOpenedProgress} color="blue" />
          )}
          {revProgress !== null && (
            <ProgressBar label="Revenue" current={`৳${k.revenue.toLocaleString()}`} target={`৳${k.target_revenue.toLocaleString()}`} pct={revProgress} color="violet" />
          )}
        </div>
      )}

      {leadsProgress === null && (
        <button onClick={onSetTarget} className="w-full text-xs text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-1.5 py-2 border border-dashed border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
          <Target size={12} /> Set monthly targets
        </button>
      )}
    </div>
  );
}

function ProgressBar({ label, current, target, pct, color }) {
  const colors = { blue: 'bg-blue-500', green: 'bg-green-500', violet: 'bg-violet-500' };
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-600 font-medium">{current} / {target} <span className="text-slate-400">({pct}%)</span></span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colors[color]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  const bg = { emerald: 'bg-emerald-50 text-emerald-700', violet: 'bg-violet-50 text-violet-700', green: 'bg-green-50 text-green-700', blue: 'bg-blue-50 text-blue-700', indigo: 'bg-indigo-50 text-indigo-700', sky: 'bg-sky-50 text-sky-700' };
  return (
    <div className={`rounded-lg p-2 text-center ${bg[color] || 'bg-slate-50 text-slate-600'}`}>
      <div className="text-sm font-bold">{value}</div>
      <div className="text-[10px] font-medium opacity-75">{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// HELPERS / FORMS
// ─────────────────────────────────────────────
function StatCard({ label, value, icon, color, sub }) {
  const colors = { blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600', violet: 'bg-violet-50 text-violet-600', amber: 'bg-amber-50 text-amber-600' };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-800">{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

function InfoPill({ label, value, mono }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2">
      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-slate-700 font-medium truncate ${mono ? 'font-mono text-[11px]' : ''}`}>{value || '—'}</p>
    </div>
  );
}

function EmpForm({ emp, onSave }) {
  const [form, setForm] = useState(emp || { active: 'Yes' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try { if (emp) await api.updateEmployee(emp.id, form); else await api.createEmployee(form); onSave(); }
    finally { setSaving(false); }
  }
  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3">
      {[['emp_id', 'Employee ID'], ['name', 'Full Name'], ['role', 'Role'], ['email', 'Email'], ['phone', 'Phone'], ['device_id', 'Device Hostname']].map(([k, l]) => (
        <div key={k}>
          <label className="block text-xs font-medium text-slate-600 mb-1">{l}</label>
          <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none"
            value={form[k] || ''} onChange={e => set(k, e.target.value)} />
        </div>
      ))}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Monthly Salary (BDT)</label>
        <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none"
          value={form.salary || ''} onChange={e => set('salary', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Join Date</label>
        <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none"
          value={form.join_date || ''} onChange={e => set('join_date', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
        <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          value={form.active || 'Yes'} onChange={e => set('active', e.target.value)}>
          <option>Yes</option><option>No</option>
        </select>
      </div>
      <div className="col-span-2 flex justify-end pt-1">
        <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function AttendanceForm({ employees, onSave }) {
  const now = new Date();
  const [form, setForm] = useState({ emp_id: '', status: 'Present', date: today, check_in: now.toTimeString().slice(0, 5), check_out: '', source: 'manual' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try { await api.createAttendance(form); onSave(); }
    finally { setSaving(false); }
  }
  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className="block text-xs font-medium text-slate-600 mb-1">Employee *</label>
        <select required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          value={form.emp_id} onChange={e => set('emp_id', e.target.value)}>
          <option value="">— select —</option>
          {employees.map(e => <option key={e.id} value={e.emp_id}>{e.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
        <input type="date" required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.date} onChange={e => set('date', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
        <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white" value={form.status} onChange={e => set('status', e.target.value)}>
          <option>Present</option><option>Late</option><option>Absent</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Check In</label>
        <input type="time" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.check_in} onChange={e => set('check_in', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Check Out</label>
        <input type="time" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.check_out} onChange={e => set('check_out', e.target.value)} />
      </div>
      <div className="col-span-2 flex justify-end pt-1">
        <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
          {saving ? 'Saving…' : 'Log Attendance'}
        </button>
      </div>
    </form>
  );
}

function TargetForm({ kpi, month, onSave }) {
  const [form, setForm] = useState({ consultant: kpi.consultant, month, target_leads: kpi.target_leads, target_enrolled: kpi.target_enrolled, target_revenue: kpi.target_revenue });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try { await api.setKpiTargets(form); onSave(); }
    finally { setSaving(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-500">Set monthly targets for <strong>{kpi.consultant}</strong> in <strong>{month}</strong></p>
      {[['target_leads', 'Target Leads', 'number'], ['target_enrolled', 'Target File Opens', 'number'], ['target_revenue', 'Target Revenue (BDT)', 'number']].map(([k, l]) => (
        <div key={k}>
          <label className="block text-xs font-medium text-slate-600 mb-1">{l}</label>
          <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form[k] || ''} onChange={e => set(k, e.target.value)} />
        </div>
      ))}
      <div className="flex justify-end pt-1">
        <button type="submit" disabled={saving} className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-60">
          {saving ? 'Saving…' : 'Save Targets'}
        </button>
      </div>
    </form>
  );
}

/* ───────────────────────────── PAYROLL ───────────────────────────── */
function Payroll({ month }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState({}); // { id: { bonus, deductions, ... } }
  const [saving, setSaving] = useState(null);
  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(() => {
    setLoading(true);
    api.payroll(month)
      .then(d => { setData(d); setEdits({}); })
      .finally(() => setLoading(false));
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n) => `৳${Number(n || 0).toLocaleString()}`;

  const editVal = (row, field) => edits[row.id]?.[field] ?? row[field] ?? 0;
  const setVal  = (id, field, value) =>
    setEdits(e => ({ ...e, [id]: { ...(e[id] || {}), [field]: value } }));

  const saveRow = async (row) => {
    const patch = edits[row.id];
    if (!patch) return;
    setSaving(row.id);
    try { await api.updatePayroll(row.id, patch); await load(); toast.success(`${row.name}'s payroll saved`); }
    catch (e) { toast.error(e.message); }
    setSaving(null);
  };

  const markPaid = async (row) => {
    const ok = await confirm({
      title: `Mark ${row.name}'s payroll as paid?`,
      body: `${month} payroll · Net ${fmt(row.net_pay)}. This will lock the row.`,
      confirmLabel: 'Mark paid',
    });
    if (!ok) return;
    setSaving(row.id);
    try { await api.markPayrollPaid(row.id); await load(); toast.success(`${row.name}'s payroll marked paid`); }
    catch (e) { toast.error(e.message); }
    setSaving(null);
  };

  const printPayslip = (row) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const html = `<!DOCTYPE html><html><head><title>Payslip — ${row.name} — ${month}</title>
      <style>
        body{font-family:-apple-system,sans-serif;color:#0f172a;max-width:680px;margin:32px auto;padding:0 24px}
        h1{margin:0 0 4px}.muted{color:#64748b;font-size:13px}
        table{width:100%;border-collapse:collapse;margin:24px 0}
        td,th{padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:14px}
        th{background:#f8fafc;color:#475569;font-weight:600}
        .right{text-align:right}.total{font-weight:700;background:#f1f5f9}
        .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600}
        .paid{background:#dcfce7;color:#166534}.pending{background:#fef3c7;color:#92400e}
        .actions{margin-top:24px;text-align:center}.actions button{padding:8px 20px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;cursor:pointer}
        @media print{.actions{display:none}}
      </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <h1>EduExpress International</h1>
          <p class="muted">Student Consultancy · Dhaka, Bangladesh</p>
        </div>
        <div style="text-align:right">
          <strong>Payslip</strong><br>
          <span class="muted">Month: ${month}</span>
        </div>
      </div>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:18px 0">
      <table>
        <tr><th style="width:40%">Employee</th><td>${row.name || ''}</td></tr>
        <tr><th>Employee ID</th><td>${row.emp_id || ''}</td></tr>
        <tr><th>Period</th><td>${month}</td></tr>
        <tr><th>Working Days</th><td>${row.working_days} (worked ${row.days_worked})</td></tr>
        <tr><th>Status</th><td><span class="badge ${row.status === 'paid' ? 'paid' : 'pending'}">${row.status}</span>${row.paid_on ? ` on ${row.paid_on}` : ''}</td></tr>
      </table>
      <table>
        <tr><th>Description</th><th class="right">Amount (BDT)</th></tr>
        <tr><td>Base Salary</td><td class="right">${fmt(row.base_salary)}</td></tr>
        <tr><td>Bonus</td><td class="right">+ ${fmt(row.bonus)}</td></tr>
        <tr><td>Deductions</td><td class="right">− ${fmt(row.deductions)}</td></tr>
        <tr class="total"><td>Net Pay</td><td class="right">${fmt(row.net_pay)}</td></tr>
      </table>
      ${row.notes ? `<p class="muted"><strong>Notes:</strong> ${row.notes}</p>` : ''}
      <p class="muted" style="margin-top:32px">This is a system-generated payslip and does not require a signature.</p>
      <div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
      </body></html>`;
    w.document.write(html); w.document.close();
  };

  if (loading) return <div className="text-slate-400 text-center py-16">Loading payroll…</div>;
  if (!data) return null;

  const T = data.totals;
  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Payroll" value={fmt(T.net)} icon={<DollarSign size={18} />} color="emerald" />
        <StatCard label="Paid" value={fmt(T.paid)} icon={<CircleCheck size={18} />} color="blue" />
        <StatCard label="Pending" value={fmt(T.pending)} icon={<CircleDot size={18} />} color="amber" />
        <StatCard label="Bonuses" value={fmt(T.bonus)} sub={`Deductions ${fmt(T.deductions)}`} icon={<Award size={18} />} color="violet" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">Payroll for {month}</h3>
            <p className="text-xs text-slate-500">{data.rows.length} employees · {data.workingDays} working days</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/60 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-5 py-3 font-semibold">Employee</th>
                <th className="text-right px-3 py-3 font-semibold">Days</th>
                <th className="text-right px-3 py-3 font-semibold">Base</th>
                <th className="text-right px-3 py-3 font-semibold">Bonus</th>
                <th className="text-right px-3 py-3 font-semibold">Deductions</th>
                <th className="text-right px-3 py-3 font-semibold">Net Pay</th>
                <th className="text-center px-3 py-3 font-semibold">Status</th>
                <th className="text-right px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.length === 0 && (
                <tr><td colSpan="8" className="text-center text-slate-400 py-10">No active employees this month</td></tr>
              )}
              {data.rows.map(row => {
                const isPaid = row.status === 'paid';
                const dirty  = !!edits[row.id];
                return (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800">{row.name}</div>
                      <div className="text-xs text-slate-400">{row.emp_id}</div>
                    </td>
                    <td className="text-right px-3 py-3 text-slate-700">{row.days_worked}/{row.working_days}</td>
                    <td className="text-right px-3 py-3">
                      <input type="number" disabled={isPaid}
                        value={editVal(row, 'base_salary')}
                        onChange={e => setVal(row.id, 'base_salary', e.target.value)}
                        className="w-28 text-right border border-slate-200 rounded px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-400" />
                    </td>
                    <td className="text-right px-3 py-3">
                      <input type="number" disabled={isPaid}
                        value={editVal(row, 'bonus')}
                        onChange={e => setVal(row.id, 'bonus', e.target.value)}
                        className="w-24 text-right border border-slate-200 rounded px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-400" />
                    </td>
                    <td className="text-right px-3 py-3">
                      <input type="number" disabled={isPaid}
                        value={editVal(row, 'deductions')}
                        onChange={e => setVal(row.id, 'deductions', e.target.value)}
                        className="w-24 text-right border border-slate-200 rounded px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-400" />
                    </td>
                    <td className="text-right px-3 py-3 font-semibold text-slate-800">
                      {fmt((Number(editVal(row, 'base_salary')) || 0) + (Number(editVal(row, 'bonus')) || 0) - (Number(editVal(row, 'deductions')) || 0))}
                    </td>
                    <td className="text-center px-3 py-3">
                      {isPaid
                        ? <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full"><CircleCheck size={12}/> Paid</span>
                        : <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-50 text-amber-700 px-2 py-1 rounded-full"><CircleDot size={12}/> Pending</span>}
                    </td>
                    <td className="text-right px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {dirty && !isPaid && (
                          <button onClick={() => saveRow(row)} disabled={saving === row.id}
                            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
                            {saving === row.id ? 'Saving…' : 'Save'}
                          </button>
                        )}
                        {!isPaid && !dirty && (
                          <button onClick={() => markPaid(row)} disabled={saving === row.id}
                            className="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                            Mark Paid
                          </button>
                        )}
                        <button onClick={() => printPayslip(row)} title="Print payslip"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Printer size={15} />
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
    </div>
  );
}

/* ────────────────────────── PERFORMANCE ──────────────────────────
   Three-signal employee scoreboard:
     • Attendance       — from auto check-ins        (30 pts)
     • Office Work      — daily logs each employee submits (20 pts)
     • Activity (auto)  — pulled from activity_log    (50 pts)
   Click any card to drill into one employee's full month.
*/
const PERF_GROUPS = [
  { key: 'lead_work',     label: 'Lead touches',  cls: 'bg-blue-100 text-blue-700' },
  { key: 'payments',      label: 'Payments',      cls: 'bg-emerald-100 text-emerald-700' },
  { key: 'application',   label: 'Application',   cls: 'bg-violet-100 text-violet-700' },
  { key: 'communication', label: 'Messages',      cls: 'bg-amber-100 text-amber-700' },
];

function Performance({ month }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState(null); // emp_id

  const load = useCallback(() => {
    setLoading(true);
    api.employeeKpi(month).then(d => { setData(d); }).finally(() => setLoading(false));
  }, [month]);
  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <div className="text-slate-400 text-center py-16">Computing performance…</div>;
  if (!data || data.employees.length === 0) {
    return <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
      <Users size={36} className="text-slate-300 mx-auto mb-3" />
      No active employees this month.
    </div>;
  }

  const top = data.employees[0];

  return (
    <div className="space-y-4">
      {/* Hero — top performer + working-day context */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white font-bold text-lg flex items-center justify-center shadow-md">
            <Award size={22} />
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400 tracking-wide font-medium">Top performer</p>
            <p className="text-lg font-bold text-slate-800">{top.name}</p>
            <p className="text-xs text-slate-500">Score {top.score} · {top.attendance.attendancePct}% attendance · {top.office_work.logsSubmitted}/{top.office_work.effWorking} daily logs</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Calendar size={13} />
          <span>{data.effWorking}/{data.workingDays} working days completed this month</span>
        </div>
      </div>

      {/* Grid of employee cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {data.employees.map(e => (
          <PerfCard key={e.id || e.emp_id} e={e} onClick={() => setPicked(e.emp_id)} />
        ))}
      </div>

      {picked && (
        <PerfDrilldown emp_id={picked} month={month} onClose={() => setPicked(null)} />
      )}
    </div>
  );
}

function PerfCard({ e, onClick }) {
  const scoreColor = e.score >= 70 ? 'text-emerald-600' : e.score >= 40 ? 'text-amber-600' : 'text-rose-600';
  const ring       = e.score >= 70 ? 'ring-emerald-100' : e.score >= 40 ? 'ring-amber-100' : 'ring-rose-100';

  return (
    <button onClick={onClick}
      className={`text-left bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md hover:border-blue-200 transition-all ring-4 ring-transparent hover:${ring}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center flex-shrink-0">
            {e.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate">{e.name}</p>
            <p className="text-xs text-slate-400 truncate">{e.role || '—'}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-2xl font-bold ${scoreColor} leading-none`}>{e.score}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">score</p>
        </div>
      </div>

      {/* Three-signal bars */}
      <SignalRow label="Attendance" pct={e.attendance.attendancePct}
        right={`${e.attendance.present + e.attendance.late}/${e.attendance.workingDays} days · ${e.attendance.late} late`} color="emerald" />
      <SignalRow label="Daily logs" pct={e.office_work.logPct}
        right={`${e.office_work.logsSubmitted}/${e.office_work.effWorking} ${e.office_work.streak ? `· 🔥 ${e.office_work.streak}` : ''}`} color="amber" />
      <SignalRow label="Activity"   pct={Math.min(100, Math.round((e.activity.score / Math.max(1, e.office_work.effWorking * 12)) * 100))}
        right={`${e.activity.total} events`} color="blue" />

      {/* Activity group counters */}
      <div className="flex flex-wrap gap-1 mt-3">
        {PERF_GROUPS.map(g => (
          (e.activity.by_group[g.key] || 0) > 0 && (
            <span key={g.key} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${g.cls}`}>
              {g.label} · {e.activity.by_group[g.key]}
            </span>
          )
        ))}
        {e.activity.total === 0 && <span className="text-[10px] text-slate-300 italic">no system activity recorded</span>}
      </div>
    </button>
  );
}

function SignalRow({ label, pct, right, color }) {
  const cls = { emerald: 'bg-emerald-400', amber: 'bg-amber-400', blue: 'bg-blue-400' }[color] || 'bg-slate-400';
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className="text-slate-500 font-medium">{label}</span>
        <span className="text-slate-600 font-medium">{right}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${cls}`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}

function PerfDrilldown({ emp_id, month, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.employeeKpiOne(emp_id, month).then(setData); }, [emp_id, month]);
  if (!data) return null;
  const { employee, attendance, logs, activity } = data;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white h-full w-full max-w-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{employee.name}</h3>
            <p className="text-xs text-slate-500">{employee.emp_id} · {employee.role || '—'} · {month}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">✕</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Daily logs */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2"><Pencil size={14}/> Daily logs ({logs.length})</p>
            {logs.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No daily logs submitted yet this month.</p>
            ) : (
              <div className="space-y-2">
                {logs.slice(0, 10).map(l => (
                  <div key={l.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <div className="flex justify-between items-baseline mb-1">
                      <p className="font-semibold text-slate-700 text-sm">{l.date}</p>
                      <p className="text-[10px] text-slate-400">submitted {l.submitted_at?.slice(0,16)}</p>
                    </div>
                    <p className="text-xs text-slate-600 whitespace-pre-wrap"><strong>Did:</strong> {l.accomplishments}</p>
                    {l.challenges && <p className="text-xs text-slate-600 whitespace-pre-wrap mt-1"><strong>Blockers:</strong> {l.challenges}</p>}
                    {l.tomorrow_plan && <p className="text-xs text-slate-600 whitespace-pre-wrap mt-1"><strong>Tomorrow:</strong> {l.tomorrow_plan}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attendance */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2"><Clock size={14}/> Attendance ({attendance.length})</p>
            {attendance.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No attendance recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                    <tr><th className="text-left px-3 py-2 font-semibold">Date</th>
                        <th className="text-left px-3 py-2 font-semibold">Status</th>
                        <th className="text-left px-3 py-2 font-semibold">In</th>
                        <th className="text-left px-3 py-2 font-semibold">Out</th>
                        <th className="text-right px-3 py-2 font-semibold">Hours</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {attendance.slice().reverse().slice(0, 14).map(a => (
                      <tr key={a.id}>
                        <td className="px-3 py-1.5">{a.date}</td>
                        <td className="px-3 py-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${a.status === 'Late' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{a.status}</span>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11px]">{a.check_in || '—'}</td>
                        <td className="px-3 py-1.5 font-mono text-[11px]">{a.check_out || '—'}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{a.hours_worked ? `${a.hours_worked.toFixed?.(1) || a.hours_worked}h` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Activity */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2"><TrendingUp size={14}/> Activity ({activity.length})</p>
            {activity.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No CRM activity recorded for this employee.</p>
            ) : (
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {activity.map(a => (
                  <div key={a.id} className="text-xs flex items-baseline gap-2 py-1 border-b border-slate-50">
                    <span className="text-slate-400 tabular-nums">{(a.created_at || '').slice(0, 10)}</span>
                    <span className="text-slate-500 font-medium">{a.type.replace(/_/g, ' ')}</span>
                    {a.lead_name && <span className="text-slate-700 truncate">{a.lead_name}</span>}
                    {a.to_value && <span className="text-slate-400 italic truncate">→ {a.to_value}</span>}
                    {a.amount && <span className="text-emerald-600 font-semibold tabular-nums">৳{Number(a.amount).toLocaleString()}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
