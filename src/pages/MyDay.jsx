/* MyDay — the end-of-day reflection page for every employee.
   Logs three things: what they did today, blockers, plan for tomorrow.
   Also surfaces a quick auto-summary of what the activity feed already
   noticed they did (so they're not starting from a blank page). */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../components/Toast';
import {
  Sun, Send, Clock, CheckCircle2, AlertCircle, ChevronRight, Loader2,
  Calendar, History, Sparkles, Pencil, PhoneCall, Building2, FolderOpen, XCircle, Wifi, LogIn, LogOut
} from 'lucide-react';

const todayISO = () => new Date().toISOString().slice(0, 10);
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function MyDay({ user }) {
  const [todayInfo, setTodayInfo] = useState(null);   // { linked, today, log, emp_name, emp_id }
  const [history, setHistory]     = useState([]);     // recent daily logs
  const [autoSummary, setAuto]    = useState({ total: 0, leads: 0, positive: 0, negative: 0, visited: 0, opened: 0, notes: 0, payments: 0 }); // best-effort auto activity summary
  const [form, setForm]           = useState({ accomplishments: '', challenges: '', tomorrow_plan: '' });
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [attnLog, setAttnLog]     = useState(null);   // today's attendance record
  
  // Custom metrics explicitly editable by the employee
  const [metrics, setMetrics]     = useState({ contacted: 0, followup: 0, positive: 0, negative: 0, visited: 0, opened: 0 });
  const toast = useToast();

  const loadAttn = () => {
    if (!user?.emp_id) return;
    const today = todayISO();
    api.attendance({ emp_id: user.emp_id, date: today }).then(rows => {
      const todayLog = (rows || []).find(r => r.date === today);
      setAttnLog(todayLog || null);
    }).catch(err => console.log('Failed to fetch attendance:', err));
  };

  const load = () => {
    api.dailyLogsToday().then(r => {
      setTodayInfo(r);
      if (r.log) {
        setForm({
          accomplishments: r.log.accomplishments || '',
          challenges: r.log.challenges || '',
          tomorrow_plan: r.log.tomorrow_plan || '',
        });
        if (r.log.metrics_json) {
          try {
            const m = JSON.parse(r.log.metrics_json);
            setMetrics({
              contacted: m.contacted ?? 0,
              followup: m.followup ?? 0,
              positive: m.positive ?? 0,
              negative: m.negative ?? 0,
              visited: m.visited ?? 0,
              opened: m.opened ?? 0
            });
          } catch (e) {
            console.error('Failed to parse saved metrics:', e);
          }
        }
      }
    });
    loadAttn();
  };

  useEffect(() => { load(); }, [user]);
  useEffect(() => { api.dailyLogs({}).then(rs => setHistory((rs || []).slice(0, 14))).catch(() => {}); }, []);

  // Auto-pulled activity summary — what the system already noticed they did today
  useEffect(() => {
    api.activity({ since: `${todayISO()} 00:00:00`, limit: 200 })
      .then(rows => {
        const mine = (rows || []).filter(a => 
          a.actor_user_id === user?.id || 
          a.actor_name?.toLowerCase() === user?.name?.toLowerCase() ||
          (user?.consultant_name && a.actor_name?.toLowerCase() === user.consultant_name.toLowerCase())
        );
        if (mine.length === 0) { 
          setAuto({ total: 0, leads: 0, positive: 0, negative: 0, visited: 0, opened: 0, notes: 0, payments: 0 }); 
          return; 
        }
        const by = {};
        mine.forEach(a => { by[a.type] = (by[a.type] || 0) + 1; });
        const leads = new Set(mine.filter(a => a.lead_name).map(a => a.lead_name));
        
        // Extract granular daily action metrics
        const positive = mine.filter(a => a.type === 'lead_status_changed' && a.to_value === 'Positive').length;
        const negative = mine.filter(a => a.type === 'lead_status_changed' && a.to_value === 'Not Interested').length;
        const visited = mine.filter(a => a.type === 'lead_status_changed' && a.to_value === 'Office Visited').length;
        const opened = mine.filter(a => a.type === 'lead_status_changed' && a.to_value === 'File Opened').length;
        const notes = mine.filter(a => a.type === 'lead_note_added' || a.type === 'note_added').length;

        setAuto({
          total: mine.length, 
          by, 
          leads: leads.size,
          positive,
          negative,
          visited,
          opened,
          notes,
          payments: mine.filter(a => a.type === 'payment_recorded' || a.type === 'lead_payment')
                        .reduce((s, a) => s + (a.amount || 0), 0),
        });
      })
      .catch(() => setAuto({ total: 0, leads: 0, positive: 0, negative: 0, visited: 0, opened: 0, notes: 0, payments: 0 }));
  }, [user]);

  const generateAutoAccomplishments = (summary) => {
    if (!summary || summary.total === 0) return '';
    const parts = [];
    parts.push(`Today, I followed up with and nurtured ${summary.leads} lead${summary.leads === 1 ? '' : 's'}.`);
    
    const changes = [];
    if (summary.positive > 0) changes.push(`marked ${summary.positive} prospect${summary.positive === 1 ? '' : 's'} as Positive`);
    if (summary.visited > 0) changes.push(`conducted ${summary.visited} face-to-face office consultation${summary.visited === 1 ? '' : 's'}`);
    if (summary.opened > 0) changes.push(`initiated application files for ${summary.opened} candidate${summary.opened === 1 ? '' : 's'}`);
    if (summary.notes > 0) changes.push(`logged ${summary.notes} progress notes`);
    
    if (changes.length > 0) {
      parts.push(`Specifically, I ${changes.join(', ')}.`);
    }
    
    if (summary.payments > 0) {
      parts.push(`I successfully collected ৳${Number(summary.payments).toLocaleString()} in student payments.`);
    }
    
    return parts.join(' ');
  };

  const autoFillLog = () => {
    setMetrics({
      contacted: autoSummary.leads || 0,
      followup: autoSummary.total || 0,
      positive: autoSummary.positive || 0,
      negative: autoSummary.negative || 0,
      visited: autoSummary.visited || 0,
      opened: autoSummary.opened || 0
    });
    const generated = generateAutoAccomplishments(autoSummary);
    if (generated) {
      setForm(f => ({ ...f, accomplishments: generated }));
      toast.success('Reflection form pre-populated from your today\'s activity! ⚡');
    } else {
      toast.info('No recorded activity today to auto-populate from.');
    }
  };

  // Auto pre-populate on feed load if no saved log exists yet
  useEffect(() => {
    if (todayInfo && !todayInfo.log && autoSummary && autoSummary.total > 0 && !form.accomplishments.trim()) {
      setMetrics({
        contacted: autoSummary.leads || 0,
        followup: autoSummary.total || 0,
        positive: autoSummary.positive || 0,
        negative: autoSummary.negative || 0,
        visited: autoSummary.visited || 0,
        opened: autoSummary.opened || 0
      });
      const generated = generateAutoAccomplishments(autoSummary);
      if (generated) {
        setForm(f => ({ ...f, accomplishments: generated }));
      }
    }
  }, [autoSummary, todayInfo]);

  const updateMetric = (k, v) => setMetrics(m => ({ ...m, [k]: v }));

  const handleManualCheckIn = async () => {
    if (!user?.emp_id) return;
    const timeStr = new Date().toTimeString().slice(0, 5);
    const todayStr = todayISO();
    try {
      const res = await api.checkIn({
        emp_id: user.emp_id,
        date: todayStr,
        time: timeStr,
        source: 'manual'
      });
      toast.success(`Checked in successfully at ${timeStr}`);
      setAttnLog(res);
      localStorage.setItem('simulated_wifi', 'true');
      window.dispatchEvent(new Event('storage')); // trigger update in shell
    } catch (err) {
      toast.error(err.message.includes('Already') ? 'Already checked in today' : err.message);
    }
  };

  const handleManualCheckOut = async () => {
    if (!attnLog) return;
    const timeStr = new Date().toTimeString().slice(0, 5);
    try {
      const res = await api.checkOut(attnLog.id, timeStr);
      toast.success(`Checked out successfully at ${timeStr}`);
      setAttnLog(res);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.accomplishments.trim()) return;
    setSaving(true);
    try {
      await api.submitDailyLog({ ...form, date: todayISO(), metrics });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      load();
      toast.success(todayInfo?.log ? "Today's log updated" : 'End-of-day log submitted ✓');
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  if (!todayInfo) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={28} className="text-blue-500 animate-spin" />
    </div>
  );

  if (!todayInfo.linked) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold text-amber-900">Not linked to an employee record</h2>
            <p className="text-sm text-amber-700 mt-1">
              To log your day, an admin needs to link your user account to an HR employee.
            </p>
            <p className="text-xs text-amber-700 mt-2">
              Settings → Users & Access → edit your user → set <strong>Linked employee</strong> → Save.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const alreadyLogged = !!todayInfo.log;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200/80 pb-4 mb-2">
        <div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{greeting()}, {todayInfo.emp_name || user?.name || 'Consultant'}</p>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2 mt-1">
            <Sun size={24} className="text-amber-500" /> Daily Workspace & Reflections
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Log accomplishments, track auto-summarized activity, flag blockers, and organize tomorrow's goals
          </p>
        </div>
        <div className="text-right text-xs text-slate-400 font-semibold bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-sm">
          <Calendar size={12} className="inline mr-1.5 text-slate-500" />
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Today's Activity & Performance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 mt-2">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Leads Contacted</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><PhoneCall size={14} /></div>
          </div>
          <p className="text-2xl font-black text-slate-800 leading-tight mt-2">{autoSummary?.leads || 0}</p>
          <p className="text-[10px] text-slate-400 mt-1">Unique prospects today</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Marked Positive</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><CheckCircle2 size={14} /></div>
          </div>
          <p className="text-2xl font-black text-emerald-600 leading-tight mt-2">{autoSummary?.positive || 0}</p>
          <p className="text-[10px] text-slate-400 mt-1">High potential prospects</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Office Visited</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600"><Building2 size={14} /></div>
          </div>
          <p className="text-2xl font-black text-amber-600 leading-tight mt-2">{autoSummary?.visited || 0}</p>
          <p className="text-[10px] text-slate-400 mt-1">Face-to-face consults</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Files Opened</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600"><FolderOpen size={14} /></div>
          </div>
          <p className="text-2xl font-black text-indigo-600 leading-tight mt-2">{autoSummary?.opened || 0}</p>
          <p className="text-[10px] text-slate-400 mt-1">File processes opened</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Not Interested</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600"><XCircle size={14} /></div>
          </div>
          <p className="text-2xl font-black text-rose-500 leading-tight mt-2">{autoSummary?.negative || 0}</p>
          <p className="text-[10px] text-slate-400 mt-1">Nurtures stopped</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Auto-summary */}
          {autoSummary && autoSummary.total > 0 && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <Sparkles size={18} className="text-blue-600 flex-shrink-0 mt-0.5"/>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-900 mb-1">What the system already noticed you did today</p>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <Badge>Touched <strong className="mx-1">{autoSummary.leads}</strong> lead{autoSummary.leads === 1 ? '' : 's'}</Badge>
                    <Badge>{autoSummary.total} actions</Badge>
                    {autoSummary.positive > 0 && <Badge>{autoSummary.positive} marked positive</Badge>}
                    {autoSummary.visited > 0 && <Badge>{autoSummary.visited} office visits</Badge>}
                    {autoSummary.opened > 0 && <Badge>{autoSummary.opened} files opened</Badge>}
                    {autoSummary.notes > 0 && <Badge>{autoSummary.notes} notes added</Badge>}
                    {autoSummary.payments > 0 && <Badge>৳{Number(autoSummary.payments).toLocaleString()} in payments</Badge>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Log form */}
          <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">{alreadyLogged ? 'Update today\'s log' : 'Log your day before you leave'}</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={autoFillLog}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer select-none"
                >
                  <Sparkles size={12} /> Auto-Fill reflections
                </button>
                {alreadyLogged && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">SUBMITTED</span>}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">What did you do today?</label>
              <textarea rows={4} required value={form.accomplishments}
                onChange={e => setForm(f => ({ ...f, accomplishments: e.target.value }))}
                placeholder="e.g. Followed up with 8 China leads, sent docs to NJTech for 2 students, met Md Sarwar in office to verify SSC/HSC…"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* Premium Metrics Grid */}
            <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Today's CRM Performance Metrics</p>
                <span className="text-[9px] text-slate-400 font-medium">Verify or manually adjust these numbers</span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <MetricInput label="Leads Contacted" value={metrics.contacted} onChange={v => updateMetric('contacted', v)} icon={<PhoneCall size={13} className="text-blue-500" />} />
                <MetricInput label="Follow-ups" value={metrics.followup} onChange={v => updateMetric('followup', v)} icon={<Clock size={13} className="text-slate-500" />} />
                <MetricInput label="Marked Positive" value={metrics.positive} onChange={v => updateMetric('positive', v)} icon={<CheckCircle2 size={13} className="text-emerald-500" />} />
                <MetricInput label="Marked Negative" value={metrics.negative} onChange={v => updateMetric('negative', v)} icon={<XCircle size={13} className="text-rose-505 text-rose-500" />} />
                <MetricInput label="Office Visits" value={metrics.visited} onChange={v => updateMetric('visited', v)} icon={<Building2 size={13} className="text-amber-500" />} />
                <MetricInput label="Files Opened" value={metrics.opened} onChange={v => updateMetric('opened', v)} icon={<FolderOpen size={13} className="text-indigo-500" />} />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Any blockers or issues?</label>
              <textarea rows={2} value={form.challenges}
                onChange={e => setForm(f => ({ ...f, challenges: e.target.value }))}
                placeholder="e.g. AHNU portal down all day · waiting for offer letter from NCWU"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Plan for tomorrow</label>
              <textarea rows={2} value={form.tomorrow_plan}
                onChange={e => setForm(f => ({ ...f, tomorrow_plan: e.target.value }))}
                placeholder="e.g. Call all 'positive' leads, finalise visa applications for Hungary cohort"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              {saved && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 size={13}/> Saved</span>}
              <button type="submit" disabled={saving || !form.accomplishments.trim()}
                className="text-sm bg-blue-600 text-white px-5 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 select-none cursor-pointer">
                <Send size={14}/> {saving ? 'Saving…' : (alreadyLogged ? 'Update log' : 'Submit & end day')}
              </button>
            </div>
          </form>
        </div>

        {/* Right: history & check-in */}
        <div className="space-y-4">
          {/* Office Attendance & Check-In Widget */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Clock size={16} className="text-blue-500 animate-pulse" /> Attendance Check-in
              </p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                attnLog 
                  ? (attnLog.check_out ? 'bg-slate-100 text-slate-500' : 'bg-emerald-105 bg-emerald-100 text-emerald-700')
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {attnLog 
                  ? (attnLog.check_out ? 'Completed' : 'On Duty') 
                  : 'Not checked in'}
              </span>
            </div>

            {attnLog ? (
              <div className="space-y-3 bg-slate-50 rounded-xl p-3.5 border border-slate-100 text-xs text-slate-600">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-400">Check-in:</span>
                  <span className="font-mono font-bold text-slate-700">{attnLog.check_in || '—'} ({attnLog.status})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-400">Check-out:</span>
                  <span className="font-mono font-bold text-slate-700">{attnLog.check_out || '—'}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200/60 pt-2 mt-1">
                  <span className="font-semibold text-slate-400">Hours worked:</span>
                  <span className="font-bold text-blue-600">{attnLog.hours_worked ? `${parseFloat(attnLog.hours_worked).toFixed(1)} hrs` : 'Calculating...'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-400">Source:</span>
                  <span className="font-semibold text-slate-700 capitalize flex items-center gap-1">
                    {attnLog.source === 'wifi' ? (
                      <>
                        <Wifi size={12} className="text-emerald-500 animate-pulse" />
                        Wi-Fi ({attnLog.ssid || 'Office Wifi'})
                      </>
                    ) : attnLog.source === 'auto-login' ? (
                      'Auto Login'
                    ) : (
                      'Manual Check-in'
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 text-center text-xs text-amber-800 space-y-1">
                <p className="font-semibold">Shift not started today</p>
                <p className="text-[11px] text-amber-600">Click below to log your daily attendance manually.</p>
              </div>
            )}

            <div className="pt-1 flex gap-2">
              {!attnLog && (
                <button
                  onClick={handleManualCheckIn}
                  className="w-full text-xs font-bold py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogIn size={13} /> Manual Check In
                </button>
              )}
              {attnLog && !attnLog.check_out && (
                <button
                  onClick={handleManualCheckOut}
                  className="w-full text-xs font-bold py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut size={13} /> Complete & Check Out
                </button>
              )}
              {attnLog && attnLog.check_out && (
                <div className="w-full text-center text-xs py-2 bg-slate-100 text-slate-400 font-medium rounded-xl border border-slate-200">
                  ✓ Attendance closed for today
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2"><History size={14}/> Past 14 days</p>
            {history.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No previous logs yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map(h => (
                  <details key={h.id} className="bg-slate-50 border border-slate-100 rounded-lg overflow-hidden">
                    <summary className="px-3 py-2 cursor-pointer text-xs font-medium text-slate-700 flex items-center justify-between list-none">
                      <span>{h.date}</span>
                      <ChevronRight size={12} className="text-slate-400 transition-transform group-open:rotate-90"/>
                    </summary>
                    <div className="px-3 pb-2 pt-1 text-xs text-slate-650 whitespace-pre-wrap border-t border-slate-100">
                      <p><strong>Did:</strong> {h.accomplishments}</p>
                      {h.challenges && <p className="mt-1"><strong>Blockers:</strong> {h.challenges}</p>}
                      {h.tomorrow_plan && <p className="mt-1"><strong>Tomorrow:</strong> {h.tomorrow_plan}</p>}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs text-slate-500">
            <p className="font-semibold text-slate-700 mb-1">Why this matters</p>
            <p>Your daily log feeds into the Performance Score on HR — Attendance + Office Work + auto-tracked activity. Logging consistently builds a streak 🔥.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ children }) {
  return <span className="bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full">{children}</span>;
}

function MetricInput({ label, value, onChange, icon }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between shadow-sm hover:border-slate-350 hover:shadow-md transition-all duration-200">
      <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[9px] uppercase tracking-wider truncate">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-center justify-between mt-2.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 hover:text-blue-600 active:scale-95 text-slate-650 rounded-lg text-xs font-black transition-all select-none cursor-pointer"
        >
          -
        </button>
        <input
          type="number"
          min="0"
          value={value}
          onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-12 text-center font-mono font-bold text-sm text-slate-800 focus:outline-none focus:text-blue-600 bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 hover:text-blue-600 active:scale-95 text-slate-650 rounded-lg text-xs font-black transition-all select-none cursor-pointer"
        >
          +
        </button>
      </div>
    </div>
  );
}
