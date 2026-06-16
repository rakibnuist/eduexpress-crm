import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Modal from '../components/Modal';
import {
  Users, Clock, BarChart2, Plus, Pencil, Trash2, CheckCircle2,
  LogIn, LogOut, Target, TrendingUp, Award, AlertCircle, Calendar,
  DollarSign, Printer, CircleCheck, CircleDot, ArrowUpRight,
  Shield, Phone, Mail, Briefcase, Activity, Flame, MapPin,
  ChevronRight, X, Zap, Bookmark, BarChart3, Crown,
  Wallet, Receipt, CreditCard, BadgeCheck, Filter, Search,
  Building, UserCheck, FolderOpen
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid, PieChart, Pie, Cell, Area, AreaChart
} from 'recharts';

const curMonth = new Date().toISOString().slice(0, 7);
const today = new Date().toISOString().slice(0, 10);

const KPI_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];

export default function HR({ user }) {
  useEffect(() => { document.title = "HR & Payroll | EduExpress Core"; }, []);

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
  const [search, setSearch] = useState('');
  const [leadCounts, setLeadCounts] = useState({});

  const load = useCallback(() => {
    api.employees().then(setEmployees);
    api.attendanceSummary(month).then(d => { setSummary(d.summary); setWorkingDays(d.workingDays); });
    api.kpi(month).then(setKpis);
    api.attendance({ date: today }).then(setTodayLogs);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  // Fetch lead counts per employee whenever employees change
  useEffect(() => {
    if (!employees.length) return;
    api.leads({ limit: 2000 }).then(d => {
      const counts = {};
      (d.leads || []).forEach(l => {
        if (l.assigned_employee_id) {
          counts[l.assigned_employee_id] = (counts[l.assigned_employee_id] || 0) + 1;
        } else if (l.assigned_consultant) {
          const match = employees.find(e => e.name === l.assigned_consultant);
          if (match) counts[match.id] = (counts[match.id] || 0) + 1;
        }
      });
      setLeadCounts(counts);
    }).catch(() => setLeadCounts({}));
  }, [employees]);

  useEffect(() => {
    if (selectedEmp) {
      api.attendance({ emp_id: selectedEmp.emp_id, month }).then(setEmpLogs);
    }
  }, [selectedEmp, month]);

  const toast = useToast();
  const confirm = useConfirm();

  async function handleDelete(id) {
    const ok = await confirm({ title: 'Delete this consultant?', tone: 'danger', confirmLabel: 'Delete' });
    if (!ok) return;
    try { await api.deleteEmployee(id); load(); toast.success('Consultant removed'); }
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

  const activeEmployees = employees.filter(e => e.active === 'Yes');
  const totalPayroll = activeEmployees.reduce((s, e) => s + (e.salary || 0), 0);
  const checkedInToday = todayLogs.map(l => l.emp_id);

  const tabs = [
    { id: 'performance', label: 'Performance', icon: Crown, desc: 'Team scoreboard & analytics' },
    { id: 'employees',   label: 'Team',        icon: Users, desc: 'Consultant directory & records' },
    { id: 'attendance',  label: 'Attendance',  icon: Clock, desc: 'Monthly attendance & logs' },
    { id: 'payroll',     label: 'Payroll',     icon: DollarSign, desc: 'Salary processing & payslips' },
    { id: 'kpi',         label: 'Sales KPI',   icon: BarChart3, desc: 'Consultant targets & revenue' },
  ];

  const filteredEmployees = activeEmployees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.emp_id.toLowerCase().includes(search.toLowerCase()) ||
    (e.role || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* ── STRATEGIC HEADER ── */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
                <Building size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Human Resources & Team Payroll</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  {activeEmployees.length} active staff · {workingDays} working days · ৳{totalPayroll.toLocaleString()} monthly payroll
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                className="px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-sm font-medium cursor-pointer text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
            </div>
          </div>

          {/* Quick stats in header */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            <div className="rounded-xl p-3 bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-1">
                <Users size={14} className="text-blue-400" />
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Staff</span>
              </div>
              <p className="text-xl font-bold">{activeEmployees.length}</p>
            </div>
            <div className="rounded-xl p-3 bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-1">
                <Wallet size={14} className="text-emerald-400" />
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Monthly Payroll</span>
              </div>
              <p className="text-xl font-bold">৳{(totalPayroll / 1000).toFixed(0)}K</p>
            </div>
            <div className="rounded-xl p-3 bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-1">
                <UserCheck size={14} className="text-violet-400" />
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">In Office Today</span>
              </div>
              <p className="text-xl font-bold">{checkedInToday.length}/{activeEmployees.length}</p>
            </div>
            <div className="rounded-xl p-3 bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={14} className="text-amber-400" />
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Working Days</span>
              </div>
              <p className="text-xl font-bold">{workingDays}</p>
              <p className="text-[10px] text-slate-500">{month}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="flex gap-1 bg-slate-100/80 p-1 rounded-xl w-fit border border-slate-200/60">
        {tabs.map(({ id, label, icon: Icon, desc }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all
              ${tab === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
            <Icon size={15} className={tab === id ? 'text-blue-600' : ''} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── PERFORMANCE TAB ── */}
      {tab === 'performance' && <PerformanceTab month={month} />}

      {/* ── EMPLOYEES TAB ── */}
      {tab === 'employees' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, ID, or role..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button onClick={() => setModal({ type: 'emp' })}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors">
              <Plus size={15} /> Add Consultant
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredEmployees.map(emp => {
              const s = summary.find(s => s.emp_id === emp.emp_id);
              const isIn = checkedInToday.includes(emp.emp_id);
              const todayLog = todayLogs.find(l => l.emp_id === emp.emp_id);
              return (
                <div key={emp.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group">
                  {/* Card header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm
                        ${emp.active === 'Yes' ? 'bg-gradient-to-br from-blue-500 to-blue-700' : 'bg-slate-300'}`}>
                        {emp.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{emp.name}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {getRoleBadges(emp.role).map((r, i) => (
                            <span key={i} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${r.color}`}>
                              {r.label}
                            </span>
                          ))}
                          {getRoleBadges(emp.role).length === 0 && (
                            <span className="text-xs text-slate-400 font-medium">Staff</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider
                      ${emp.active === 'Yes' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                      {emp.active === 'Yes' ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                    <div className="bg-slate-50 rounded-xl p-2.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Consultant ID</p>
                      <p className="font-mono font-bold text-slate-700">{emp.emp_id}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Salary</p>
                      <p className="font-bold text-slate-700">৳{(emp.salary || 0).toLocaleString()}</p>
                    </div>
                    {emp.phone && (
                      <div className="bg-slate-50 rounded-xl p-2.5">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Phone</p>
                        <p className="font-bold text-slate-700">{emp.phone}</p>
                      </div>
                    )}
                    {emp.join_date && (
                      <div className="bg-slate-50 rounded-xl p-2.5">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Joined</p>
                        <p className="font-bold text-slate-700">{emp.join_date}</p>
                      </div>
                    )}
                    <div className="bg-slate-50 rounded-xl p-2.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Linked Leads</p>
                      <p className="font-bold text-slate-700">{leadCounts[emp.id] || 0}</p>
                    </div>
                  </div>

                  {/* Contact row */}
                  <div className="flex items-center gap-3 mb-4 text-xs">
                    {emp.phone && (
                      <a href={`https://wa.me/${emp.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100 transition-colors">
                        <Phone size={12} /> WhatsApp
                      </a>
                    )}
                    {emp.email && (
                      <span className="flex items-center gap-1.5 text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                        <Mail size={12} /> <span className="truncate max-w-[140px]">{emp.email}</span>
                      </span>
                    )}
                    {leadCounts[emp.id] > 0 && (
                      <Link to={`/leads?consultant=${encodeURIComponent(emp.name)}`}
                        className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100 transition-colors">
                        <FolderOpen size={12} /> {leadCounts[emp.id]} leads
                      </Link>
                    )}
                  </div>

                  {/* Today's attendance */}
                  <div className={`flex items-center justify-between p-3 rounded-xl mb-4 text-xs
                    ${isIn ? (todayLog?.check_out ? 'bg-slate-50 text-slate-500 border border-slate-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100') : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                    {isIn ? (
                      <span className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 size={13} className="text-emerald-500" />
                        In: {todayLog?.check_in}
                        {todayLog?.check_out && <span className="ml-1 font-normal text-slate-400">· Out: {todayLog.check_out}</span>}
                        {todayLog?.hours_worked && <span className="ml-1 font-normal">({parseFloat(todayLog.hours_worked).toFixed(1)}h)</span>}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5"><AlertCircle size={13} /> Not checked in</span>
                    )}
                    {todayLog?.status && (
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider
                        ${todayLog.status === 'Late' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {todayLog.status}
                      </span>
                    )}
                  </div>

                  {/* Monthly attendance bar */}
                  {s && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="font-bold text-slate-500">Attendance {month}</span>
                        <span className="font-bold text-slate-700">{s.attendancePct}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${s.attendancePct}%` }} />
                      </div>
                      <div className="flex gap-3 text-xs mt-2">
                        <span className="text-emerald-600 font-bold">✓ {s.present} present</span>
                        <span className="text-amber-600 font-bold">⏰ {s.late} late</span>
                        <span className="text-rose-400 font-bold">✗ {s.absent} absent</span>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {emp.active === 'Yes' && !isIn && (
                      <button onClick={() => handleCheckIn(emp)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors">
                        <LogIn size={13} /> Check In
                      </button>
                    )}
                    {isIn && !todayLog?.check_out && (
                      <button onClick={() => handleCheckOut(emp)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors">
                        <LogOut size={13} /> Check Out
                      </button>
                    )}
                    <button onClick={() => { setSelectedEmp(emp); setTab('attendance'); }}
                      className="flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                      <Clock size={13} /> Logs
                    </button>
                    <button onClick={() => setModal({ type: 'emp', emp })}
                      className="p-2 border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(emp.id)}
                      className="p-2 border border-slate-200 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
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
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <select className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedEmp?.emp_id || ''} onChange={e => setSelectedEmp(employees.find(em => em.emp_id === e.target.value) || null)}>
              <option value="">— All Consultants —</option>
              {employees.map(e => <option key={e.id} value={e.emp_id}>{e.name}</option>)}
            </select>
            <button onClick={() => setModal({ type: 'attn' })}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm ml-auto transition-colors">
              <Plus size={15} /> Log Attendance
            </button>
          </div>

          {/* Monthly summary table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-700">Monthly Attendance Summary</h3>
                <p className="text-xs text-slate-400 mt-0.5">{month} · {workingDays} working days</p>
              </div>
              <span className="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-full">{summary.length} consultants</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Consultant', 'Role', 'Present', 'Late', 'Absent', 'Hours', 'Avg Check-in', 'Attendance %'].map(h => (
                      <th key={h} className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {summary.map(s => (
                    <tr key={s.id}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedEmp?.emp_id === s.emp_id ? 'bg-blue-50/50' : ''}`}
                      onClick={() => setSelectedEmp(employees.find(e => e.emp_id === s.emp_id))}>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {s.name?.[0]?.toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-800">{s.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {getRoleBadges(s.role).map((r, i) => (
                            <span key={i} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${r.color}`}>
                              {r.label}
                            </span>
                          ))}
                          {getRoleBadges(s.role).length === 0 && (
                            <span className="text-xs text-slate-400 font-medium">Staff</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-emerald-600 font-bold">{s.present}</td>
                      <td className="py-3.5 px-4 text-amber-600 font-bold">{s.late}</td>
                      <td className="py-3.5 px-4 text-rose-400 font-bold">{s.absent}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-bold">{s.totalHours}h</td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-xs">{s.avgCheckin || '—'}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-24 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${s.attendancePct}%`, backgroundColor: s.attendancePct >= 80 ? '#22c55e' : s.attendancePct >= 60 ? '#f59e0b' : '#ef4444' }} />
                          </div>
                          <span className={`text-xs font-bold ${s.attendancePct >= 80 ? 'text-emerald-600' : s.attendancePct >= 60 ? 'text-amber-600' : 'text-rose-500'}`}>
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

          {selectedEmp && (
            <AttendanceCalendar emp={selectedEmp} month={month} logs={empLogs} onRefresh={load} />
          )}
        </div>
      )}

      {/* ── PAYROLL TAB ── */}
      {tab === 'payroll' && <PayrollTab month={month} />}

      {/* ── KPI TAB ── */}
      {tab === 'kpi' && <KPITab kpis={kpis} month={month} onRefresh={load} />}

      {/* ── MODALS ── */}
      {modal?.type === 'emp' && (
        <Modal title={modal.emp ? 'Edit Consultant' : 'Add Consultant'} onClose={() => setModal(null)}>
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

/* ════════════════════════════════════════════
   PERFORMANCE TAB — Team Scoreboard
   ════════════════════════════════════════════ */
function PerformanceTab({ month }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.employeeKpi(month).then(d => { setData(d); }).finally(() => setLoading(false));
  }, [month]);
  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!data || data.employees.length === 0) {
    return <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
      <Users size={36} className="text-slate-300 mx-auto mb-3" />
      <p className="font-bold">No active consultants this month</p>
      <p className="text-xs text-slate-400 mt-1">Add consultants in the Team tab first</p>
    </div>;
  }

  const top = data.employees[0];

  return (
    <div className="space-y-5">
      {/* Top performer banner */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-300/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white font-bold text-xl flex items-center justify-center shadow-lg">
              <Crown size={28} />
            </div>
            <div>
              <p className="text-xs uppercase text-amber-600 font-bold tracking-wider">Top performer</p>
              <p className="text-xl font-bold text-slate-800">{top.name}</p>
              <p className="text-xs text-slate-500 font-medium">Score {top.score} · {top.attendance.attendancePct}% attendance · {top.office_work.logsSubmitted}/{top.office_work.effWorking} daily logs</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/50 px-3 py-1.5 rounded-full border border-amber-100">
            <Calendar size={12} />
            <span>{data.effWorking}/{data.workingDays} working days completed</span>
          </div>
        </div>
      </div>

      {/* Performance grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
  const ring = e.score >= 70 ? 'ring-emerald-200' : e.score >= 40 ? 'ring-amber-200' : 'ring-rose-200';

  return (
    <button onClick={onClick}
      className={`text-left bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:border-blue-300 transition-all ring-4 ring-transparent hover:${ring} shadow-sm`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
            {e.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-800 truncate">{e.name}</p>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {getRoleBadges(e.role).map((r, i) => (
                <span key={i} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${r.color}`}>{r.label}</span>
              ))}
              {getRoleBadges(e.role).length === 0 && <span className="text-xs text-slate-400 truncate">—</span>}
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-3xl font-extrabold ${scoreColor} leading-none`}>{e.score}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-1">score</p>
        </div>
      </div>

      <SignalRow label="Attendance" pct={e.attendance.attendancePct}
        right={`${e.attendance.present + e.attendance.late}/${e.attendance.workingDays} days · ${e.attendance.late} late`} color="emerald" />
      <SignalRow label="Daily logs" pct={e.office_work.logPct}
        right={`${e.office_work.logsSubmitted}/${e.office_work.effWorking} ${e.office_work.streak ? `· 🔥 ${e.office_work.streak}` : ''}`} color="amber" />
      <SignalRow label="Activity" pct={Math.min(100, Math.round((e.activity.score / Math.max(1, e.office_work.effWorking * 12)) * 100))}
        right={`${e.activity.total} events`} color="blue" />

      <div className="flex flex-wrap gap-1.5 mt-4">
        {[
          { key: 'lead_work', label: 'Lead touches', cls: 'bg-blue-50 text-blue-700 border border-blue-100' },
          { key: 'payments', label: 'Payments', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
          { key: 'application', label: 'Applications', cls: 'bg-violet-50 text-violet-700 border border-violet-100' },
          { key: 'communication', label: 'Messages', cls: 'bg-amber-50 text-amber-700 border border-amber-100' },
        ].map(g => (
          (e.activity.by_group[g.key] || 0) > 0 && (
            <span key={g.key} className={`text-[10px] font-bold px-2 py-1 rounded-full ${g.cls}`}>
              {g.label} · {e.activity.by_group[g.key]}
            </span>
          )
        ))}
        {e.activity.total === 0 && <span className="text-[10px] text-slate-300 italic">No system activity recorded</span>}
      </div>
    </button>
  );
}

function SignalRow({ label, pct, right, color }) {
  const cls = { emerald: 'bg-emerald-400', amber: 'bg-amber-400', blue: 'bg-blue-400' }[color] || 'bg-slate-400';
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-slate-500 font-bold">{label}</span>
        <span className="text-slate-600 font-bold">{right}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${cls} rounded-full`} style={{ width: `${Math.max(2, pct)}%` }} />
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
      <div className="bg-white h-full w-full max-w-2xl overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center">
              {employee.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{employee.name}</h3>
              <div className="flex flex-wrap gap-1 mt-1">
                {getRoleBadges(employee.role).map((r, i) => (
                  <span key={i} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${r.color}`}>{r.label}</span>
                ))}
                <span className="text-xs text-slate-500">{employee.emp_id} · {month}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Daily logs */}
          <div>
            <p className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Pencil size={14} className="text-slate-400"/> Daily logs ({logs.length})</p>
            {logs.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No daily logs submitted yet this month.</p>
            ) : (
              <div className="space-y-2">
                {logs.slice(0, 10).map(l => (
                  <div key={l.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                    <div className="flex justify-between items-baseline mb-1">
                      <p className="font-bold text-slate-700 text-sm">{l.date}</p>
                      <p className="text-[10px] text-slate-400">submitted {l.submitted_at?.slice(0,16)}</p>
                    </div>
                    <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed"><strong className="text-slate-700">Did:</strong> {l.accomplishments}</p>
                    {l.challenges && <p className="text-xs text-slate-600 whitespace-pre-wrap mt-1 leading-relaxed"><strong className="text-slate-700">Blockers:</strong> {l.challenges}</p>}
                    {l.tomorrow_plan && <p className="text-xs text-slate-600 whitespace-pre-wrap mt-1 leading-relaxed"><strong className="text-slate-700">Tomorrow:</strong> {l.tomorrow_plan}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attendance */}
          <div>
            <p className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Clock size={14} className="text-slate-400"/> Attendance ({attendance.length})</p>
            {attendance.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No attendance recorded.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                    <tr><th className="text-left px-3 py-2.5 font-bold">Date</th>
                        <th className="text-left px-3 py-2.5 font-bold">Status</th>
                        <th className="text-left px-3 py-2.5 font-bold">In</th>
                        <th className="text-left px-3 py-2.5 font-bold">Out</th>
                        <th className="text-right px-3 py-2.5 font-bold">Hours</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {attendance.slice().reverse().slice(0, 14).map(a => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-bold">{a.date}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.status === 'Late' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{a.status}</span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{a.check_in || '—'}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{a.check_out || '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold">{a.hours_worked ? `${a.hours_worked.toFixed?.(1) || a.hours_worked}h` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Activity */}
          <div>
            <p className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><TrendingUp size={14} className="text-slate-400"/> Activity ({activity.length})</p>
            {activity.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No activity recorded for this consultant.</p>
            ) : (
              <div className="space-y-1 max-h-96 overflow-y-auto rounded-xl border border-slate-100 p-2">
                {activity.map(a => (
                  <div key={a.id} className="text-xs flex items-baseline gap-2 py-2 px-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-400 tabular-nums font-mono">{(a.created_at || '').slice(0, 10)}</span>
                    <span className="text-slate-500 font-bold">{a.type.replace(/_/g, ' ')}</span>
                    {a.lead_name && <span className="text-slate-700 truncate font-medium">{a.lead_name}</span>}
                    {a.to_value && <span className="text-slate-400 italic truncate">→ {a.to_value}</span>}
                    {a.amount && <span className="text-emerald-600 font-bold tabular-nums">৳{Number(a.amount).toLocaleString()}</span>}
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

/* ════════════════════════════════════════════
   ATTENDANCE CALENDAR
   ════════════════════════════════════════════ */
function AttendanceCalendar({ emp, month, logs }) {
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay();

  const logMap = {};
  logs.forEach(l => { if (l.date) logMap[l.date] = l; });

  function dayColor(dateStr) {
    const log = logMap[dateStr];
    const dow = new Date(dateStr).getDay();
    if (dow === 5 || dow === 6) return 'bg-slate-100 text-slate-300 cursor-default';
    if (!log) return dateStr < today ? 'bg-red-50 text-red-400 hover:bg-red-100' : 'bg-slate-50 text-slate-300';
    if (log.status === 'Present') return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200';
    if (log.status === 'Late') return 'bg-amber-100 text-amber-700 hover:bg-amber-200';
    return 'bg-slate-100 text-slate-500';
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-slate-700 text-lg">{emp.name}'s Attendance Calendar</h3>
          <p className="text-xs text-slate-400 mt-0.5">{month} · Click any day for details</p>
        </div>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-200" />Present</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-200" />Late</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100" />Absent</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100" />Weekend</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs font-bold text-slate-400 py-1 uppercase">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`pad-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${month}-${String(day).padStart(2, '0')}`;
          const log = logMap[dateStr];
          return (
            <div key={day} className={`rounded-lg p-2 text-center transition-colors ${dayColor(dateStr)}`}
              title={log ? `${log.status} · In: ${log.check_in || '?'}${log.check_out ? ` · Out: ${log.check_out}` : ''}${log.hours_worked ? ` · ${parseFloat(log.hours_worked).toFixed(1)}h` : ''}` : dateStr}>
              <div className="text-xs font-bold">{day}</div>
              {log?.check_in && <div className="text-[9px] leading-tight opacity-70 mt-0.5">{log.check_in}</div>}
            </div>
          );
        })}
      </div>

      {logs.length > 0 && (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <h4 className="text-sm font-bold text-slate-600 mb-3">Daily Log Details</h4>
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Date', 'Check In', 'Check Out', 'Hours', 'Status', 'Source'].map(h => (
                    <th key={h} className="text-left py-2.5 px-3 text-slate-400 font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.slice().reverse().map(l => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold">{l.date}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{l.check_in || '—'}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{l.check_out || '—'}</td>
                    <td className="py-2.5 px-3 text-slate-600 font-bold">{l.hours_worked ? parseFloat(l.hours_worked).toFixed(1) + 'h' : '—'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${l.status === 'Present' ? 'bg-emerald-100 text-emerald-700' : l.status === 'Late' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-500'}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 capitalize">{l.source}</td>
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

/* ════════════════════════════════════════════
   PAYROLL TAB
   ════════════════════════════════════════════ */
function PayrollTab({ month }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState({});
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
  const setVal = (id, field, value) =>
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
        <tr><th style="width:40%">Consultant</th><td>${row.name || ''}</td></tr>
        <tr><th>Consultant ID</th><td>${row.emp_id || ''}</td></tr>
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

  if (loading) return <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!data) return null;

  const T = data.totals;
  const paidCount = data.rows.filter(r => r.status === 'paid').length;
  const pendingCount = data.rows.length - paidCount;

  return (
    <div className="space-y-5">
      {/* Finance-themed summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600"><Wallet size={16} /></div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Payroll</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-800">{fmt(T.net)}</p>
          <p className="text-xs text-slate-400 mt-1">{data.rows.length} consultants</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600"><BadgeCheck size={16} /></div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Paid</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-800">{fmt(T.paid)}</p>
          <p className="text-xs text-emerald-600 font-bold mt-1">{paidCount} consultants processed</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600"><Receipt size={16} /></div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pending</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-800">{fmt(T.pending)}</p>
          <p className="text-xs text-amber-600 font-bold mt-1">{pendingCount} consultants awaiting</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-violet-50 rounded-xl text-violet-600"><CreditCard size={16} /></div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Bonuses</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-800">{fmt(T.bonus)}</p>
          <p className="text-xs text-slate-400 mt-1">Deductions: {fmt(T.deductions)}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Payroll Ledger</h3>
            <p className="text-xs text-slate-400 mt-0.5">{month} · {data.workingDays} working days · {data.rows.length} consultants</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">{paidCount} paid</span>
            <span className="text-xs font-bold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">{pendingCount} pending</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/60 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-5 py-3.5 font-bold">Consultant</th>
                <th className="text-right px-3 py-3.5 font-bold">Days</th>
                <th className="text-right px-3 py-3.5 font-bold">Base Salary</th>
                <th className="text-right px-3 py-3.5 font-bold">Bonus</th>
                <th className="text-right px-3 py-3.5 font-bold">Deductions</th>
                <th className="text-right px-3 py-3.5 font-bold">Net Pay</th>
                <th className="text-center px-3 py-3.5 font-bold">Status</th>
                <th className="text-right px-5 py-3.5 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.length === 0 && (
                <tr><td colSpan="8" className="text-center text-slate-400 py-10">No active consultants this month</td></tr>
              )}
              {data.rows.map(row => {
                const isPaid = row.status === 'paid';
                const dirty = !!edits[row.id];
                return (
                  <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-800">{row.name}</div>
                      <div className="text-xs text-slate-400">{row.emp_id}</div>
                    </td>
                    <td className="text-right px-3 py-3.5 text-slate-700 font-bold">{row.days_worked}/{row.working_days}</td>
                    <td className="text-right px-3 py-3.5">
                      <input type="number" disabled={isPaid}
                        value={editVal(row, 'base_salary')}
                        onChange={e => setVal(row.id, 'base_salary', e.target.value)}
                        className="w-28 text-right border border-slate-200 rounded-lg px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </td>
                    <td className="text-right px-3 py-3.5">
                      <input type="number" disabled={isPaid}
                        value={editVal(row, 'bonus')}
                        onChange={e => setVal(row.id, 'bonus', e.target.value)}
                        className="w-24 text-right border border-slate-200 rounded-lg px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </td>
                    <td className="text-right px-3 py-3.5">
                      <input type="number" disabled={isPaid}
                        value={editVal(row, 'deductions')}
                        onChange={e => setVal(row.id, 'deductions', e.target.value)}
                        className="w-24 text-right border border-slate-200 rounded-lg px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </td>
                    <td className="text-right px-3 py-3.5 font-extrabold text-slate-800">
                      {fmt((Number(editVal(row, 'base_salary')) || 0) + (Number(editVal(row, 'bonus')) || 0) - (Number(editVal(row, 'deductions')) || 0))}
                    </td>
                    <td className="text-center px-3 py-3.5">
                      {isPaid
                        ? <span className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-100"><CircleCheck size={12}/> Paid</span>
                        : <span className="inline-flex items-center gap-1 text-xs font-bold bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full border border-amber-100"><CircleDot size={12}/> Pending</span>}
                    </td>
                    <td className="text-right px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {dirty && !isPaid && (
                          <button onClick={() => saveRow(row)} disabled={saving === row.id}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors">
                            {saving === row.id ? 'Saving…' : 'Save'}
                          </button>
                        )}
                        {!isPaid && !dirty && (
                          <button onClick={() => markPaid(row)} disabled={saving === row.id}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors">
                            Mark Paid
                          </button>
                        )}
                        <button onClick={() => printPayslip(row)} title="Print payslip"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
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

/* ════════════════════════════════════════════
   KPI TRACKER TAB
   ════════════════════════════════════════════ */
function KPITab({ kpis, month, onRefresh }) {
  const [editTarget, setEditTarget] = useState(null);

  const chartData = kpis.map(k => ({
    name: k.consultant,
    'New Leads': k.thisMonth,
    'Office Visit': k.officeVisited,
    'File Opened': k.fileOpened,
    'Enrolled': k.enrolled,
  }));

  const totalRevenue = kpis.reduce((s, k) => s + (k.revenue || 0), 0);
  const totalCollected = kpis.reduce((s, k) => s + (k.collected || 0), 0);
  const totalLeads = kpis.reduce((s, k) => s + (k.thisMonth || 0), 0);
  const totalFileOpened = kpis.reduce((s, k) => s + (k.fileOpened || 0), 0);

  return (
    <div className="space-y-5">
      {/* Revenue summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-violet-50 rounded-xl text-violet-600"><DollarSign size={16} /></div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Revenue</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-800">৳{totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">{month}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600"><Wallet size={16} /></div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Collected</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-800">৳{totalCollected.toLocaleString()}</p>
          <p className="text-xs text-emerald-600 font-bold mt-1">{totalCollected > 0 && totalRevenue > 0 ? ((totalCollected / totalRevenue) * 100).toFixed(0) : 0}% of revenue</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600"><Users size={16} /></div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">New Leads</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-800">{totalLeads}</p>
          <p className="text-xs text-slate-400 mt-1">{kpis.length} consultants</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600"><FolderOpen size={16} /></div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Files Opened</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-800">{totalFileOpened}</p>
          <p className="text-xs text-slate-400 mt-1">{month}</p>
        </div>
      </div>

      {/* Overview chart */}
      {kpis.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-700 text-lg">Consultant Performance</h3>
              <p className="text-xs text-slate-400 mt-0.5">{month} · New leads vs pipeline stages</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)' }} />
              <Legend />
              <Bar dataKey="New Leads" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Office Visit" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="File Opened" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Enrolled" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-sm">
            {k.consultant?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-slate-800">{k.consultant}</p>
            <p className="text-xs text-slate-400">{k.total} total leads</p>
          </div>
        </div>
        <button onClick={onSetTarget} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Set targets" aria-label="Set targets">
          <Target size={15} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <MiniStat label="Positive" value={k.positive} color="emerald" />
        <MiniStat label="Visited" value={k.officeVisited} color="violet" />
        <MiniStat label="Enrolled" value={k.enrolled} color="amber" />
        <MiniStat label="File Open" value={k.fileOpened} color="blue" />
        <MiniStat label="Conversion" value={`${k.conversionRate}%`} color="indigo" />
        <MiniStat label="Response" value={`${k.responseRate}%`} color="sky" />
      </div>

      <div className="bg-slate-50 rounded-xl p-3 mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-500 font-bold">Revenue</span>
          <span className="font-bold text-slate-700">৳{k.revenue.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500 font-bold">Collected</span>
          <span className="font-bold text-emerald-600">৳{k.collected.toLocaleString()}</span>
        </div>
      </div>

      {(leadsProgress !== null || fileOpenedProgress !== null || revProgress !== null) && (
        <div className="space-y-2.5 border-t border-slate-100 pt-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Targets</p>
          {leadsProgress !== null && (
            <ProgressBar label="Leads" current={k.thisMonth} target={k.target_leads} pct={leadsProgress} color="blue" />
          )}
          {fileOpenedProgress !== null && (
            <ProgressBar label="File Opens" current={k.fileOpened} target={k.target_enrolled} pct={fileOpenedProgress} color="violet" />
          )}
          {revProgress !== null && (
            <ProgressBar label="Revenue" current={`৳${k.revenue.toLocaleString()}`} target={`৳${k.target_revenue.toLocaleString()}`} pct={revProgress} color="emerald" />
          )}
        </div>
      )}

      {leadsProgress === null && (
        <button onClick={onSetTarget} className="w-full text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors mt-2">
          <Target size={12} /> Set monthly targets
        </button>
      )}
    </div>
  );
}

function ProgressBar({ label, current, target, pct, color }) {
  const colors = { blue: 'bg-blue-500', emerald: 'bg-emerald-500', violet: 'bg-violet-500', amber: 'bg-amber-500' };
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500 font-bold">{label}</span>
        <span className="text-slate-700 font-bold">{current} / {target} <span className="text-slate-400 font-normal">({pct}%)</span></span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colors[color] || 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  const bg = { emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100', violet: 'bg-violet-50 text-violet-700 border-violet-100', amber: 'bg-amber-50 text-amber-700 border-amber-100', blue: 'bg-blue-50 text-blue-700 border-blue-100', indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100', sky: 'bg-sky-50 text-sky-700 border-sky-100' };
  return (
    <div className={`rounded-xl p-2 text-center border ${bg[color] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
      <div className="text-sm font-extrabold">{value}</div>
      <div className="text-[10px] font-bold opacity-70">{label}</div>
    </div>
  );
}

/* ════════════════════════════════════════════
   HELPERS / FORMS
   ════════════════════════════════════════════ */

// Available designation/role options for consultant records
const EMPLOYEE_ROLES = [
  { key: 'founder_ceo', label: 'Founder & CEO', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: 'managing_director', label: 'Managing Director', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { key: 'investor', label: 'Investor', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'consultant', label: 'Consultant', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'application_manager', label: 'Application Manager', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'marketing_manager', label: 'Marketing Manager', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { key: 'hr_manager', label: 'HR Manager', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { key: 'admin', label: 'Admin', color: 'bg-slate-100 text-slate-700 border-slate-200' },
];

function getRoleBadges(roleString) {
  if (!roleString) return [];
  return roleString.split(',').map(r => r.trim()).filter(Boolean).map(r => {
    const found = EMPLOYEE_ROLES.find(opt => opt.key === r);
    return { key: r, label: found?.label || r, color: found?.color || 'bg-slate-50 text-slate-700 border-slate-200' };
  });
}

function EmpForm({ emp, onSave }) {
  const [form, setForm] = useState(() => {
    const base = emp || { active: 'Yes' };
    // Parse role string into array for multi-select
    const roles = base.role ? base.role.split(',').map(r => r.trim()).filter(Boolean) : [];
    return { ...base, roles };
  });
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const toast = useToast();
  const dropdownRef = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleRole = (roleKey) => {
    const current = form.roles || [];
    const updated = current.includes(roleKey)
      ? current.filter(r => r !== roleKey)
      : [...current, roleKey];
    setForm(f => ({ ...f, roles: updated }));
  };

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    // Join roles back to comma-separated string for the database
    const payload = { ...form, role: (form.roles || []).join(', ') };
    delete payload.roles; // Don't send array to API
    try {
      if (emp) await api.updateEmployee(emp.id, payload);
      else await api.createEmployee(payload);
      onSave();
    } catch (e) { setErr(e.message); toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">Consultant ID</label>
        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none"
          value={form.emp_id || ''} onChange={e => set('emp_id', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">Full Name</label>
        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none"
          value={form.name || ''} onChange={e => set('name', e.target.value)} />
      </div>

      {/* Role Multi-Select */}
      <div className="col-span-2">
        <label className="block text-xs font-bold text-slate-600 mb-1">Designations / Roles</label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRoleDropdown(!showRoleDropdown)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-left flex items-center justify-between hover:border-blue-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
          >
            <div className="flex flex-wrap gap-1">
              {(form.roles || []).length === 0 ? (
                <span className="text-slate-400">Select one or more roles...</span>
              ) : (
                (form.roles || []).map(r => {
                  const opt = EMPLOYEE_ROLES.find(o => o.key === r);
                  return (
                    <span key={r} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${opt?.color || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                      {opt?.label || r}
                    </span>
                  );
                })
              )}
            </div>
            <ChevronRight size={14} className={`text-slate-400 transition-transform ${showRoleDropdown ? 'rotate-90' : ''}`} />
          </button>

          {showRoleDropdown && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg p-2 space-y-0.5">
              {EMPLOYEE_ROLES.map(opt => {
                const checked = (form.roles || []).includes(opt.key);
                return (
                  <label
                    key={opt.key}
                    className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRole(opt.key)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${opt.color}`}>{opt.label}</span>
                    <span className="text-xs text-slate-400 ml-auto">{opt.key}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">Email</label>
        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none"
          value={form.email || ''} onChange={e => set('email', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">Phone</label>
        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none"
          value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">Device Hostname</label>
        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none"
          value={form.device_id || ''} onChange={e => set('device_id', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">Monthly Salary (BDT)</label>
        <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none"
          value={form.salary || ''} onChange={e => set('salary', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">Join Date</label>
        <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none"
          value={form.join_date || ''} onChange={e => set('join_date', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">Status</label>
        <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          value={form.active || 'Yes'} onChange={e => set('active', e.target.value)}>
          <option>Yes</option><option>No</option>
        </select>
      </div>
      {err && (
        <div className="col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>
      )}
      <div className="col-span-2 flex justify-end pt-1">
        <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors">
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
        <label className="block text-xs font-bold text-slate-600 mb-1">Consultant *</label>
        <select required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          value={form.emp_id} onChange={e => set('emp_id', e.target.value)}>
          <option value="">— select —</option>
          {employees.map(e => <option key={e.id} value={e.emp_id}>{e.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">Date *</label>
        <input type="date" required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.date} onChange={e => set('date', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">Status</label>
        <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white" value={form.status} onChange={e => set('status', e.target.value)}>
          <option>Present</option><option>Late</option><option>Absent</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">Check In</label>
        <input type="time" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.check_in} onChange={e => set('check_in', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">Check Out</label>
        <input type="time" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.check_out} onChange={e => set('check_out', e.target.value)} />
      </div>
      <div className="col-span-2 flex justify-end pt-1">
        <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors">
          {saving ? 'Saving…' : 'Log Attendance'}
        </button>
      </div>
    </form>
  );
}

function TargetForm({ kpi, month, onSave }) {
  const [form, setForm] = useState({
    consultant: kpi.consultant,
    month,
    target_leads: kpi.target_leads || '',
    target_enrolled: kpi.target_enrolled || '',
    target_revenue: kpi.target_revenue || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const toast = useToast();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      await api.setKpiTargets({
        consultant: form.consultant,
        month: form.month,
        target_leads: Number(form.target_leads) || 0,
        target_enrolled: Number(form.target_enrolled) || 0,
        target_revenue: Number(form.target_revenue) || 0,
      });
      toast.success(`Targets saved for ${kpi.consultant}`);
      onSave();
    } catch(e) {
      setErr(e.message);
      toast.error('Failed to save targets: ' + e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-500">Set monthly targets for <strong>{kpi.consultant}</strong> in <strong>{month}</strong></p>
      {[['target_leads', 'Target New Leads'], ['target_enrolled', 'Target File Opens'], ['target_revenue', 'Target Revenue (BDT)']].map(([k, l]) => (
        <div key={k}>
          <label className="block text-xs font-bold text-slate-600 mb-1">{l}</label>
          <input type="number" min="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
            value={form[k]} onChange={e => set(k, e.target.value)} placeholder="0" />
        </div>
      ))}
      {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
      <div className="flex justify-end pt-1">
        <button type="submit" disabled={saving} className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 transition-colors">
          {saving ? 'Saving…' : 'Save Targets'}
        </button>
      </div>
    </form>
  );
}
