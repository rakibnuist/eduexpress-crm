/* Daily Workspace — the end-of-day reflection page for every consultant.
   Warm, personal, sun-themed design. Focus on personal productivity.
   Logs three things: what they did today, blockers, plan for tomorrow.
   Also surfaces a quick auto-summary of what the activity feed already
   noticed they did (so they're not starting from a blank page). */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { isFullAdmin } from '../lib/roles';
import {
  Sun, Send, Clock, CheckCircle2, AlertCircle, ChevronRight, Loader2,
  Calendar, History, Sparkles, Pencil, PhoneCall, Building2, FolderOpen, XCircle, Wifi, LogIn, LogOut,
  Flame, Heart, Target, Coffee, Sunrise, Star, Zap, UserPlus, ArrowRight
} from 'lucide-react';

const todayISO = () => new Date().toISOString().slice(0, 10);
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function MyDay({ user }) {
  useEffect(() => { document.title = "Daily Workspace & Reflections | EduExpress Core"; }, []);

  const [todayInfo, setTodayInfo] = useState(null);
  const [history, setHistory]     = useState([]);
  const [autoSummary, setAuto]    = useState({ total: 0, leads: 0, positive: 0, negative: 0, visited: 0, opened: 0, notes: 0, payments: 0 });
  const [form, setForm]           = useState({ accomplishments: '', challenges: '', tomorrow_plan: '' });
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [attnLog, setAttnLog]     = useState(null);
  const [metrics, setMetrics]     = useState({ contacted: 0, followup: 0, positive: 0, negative: 0, visited: 0, opened: 0 });
  const [linking, setLinking]     = useState(false);
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [user]);
  useEffect(() => { api.dailyLogs({}).then(rs => setHistory((rs || []).slice(0, 14))).catch(() => {}); }, []);

  useEffect(() => {
    const localStart = new Date();
    localStart.setHours(0, 0, 0, 0);
    const sinceStr = localStart.toISOString().replace('T', ' ').slice(0, 19);
    api.activity({ since: sinceStr, limit: 200 })
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
  }, [autoSummary, todayInfo, form.accomplishments]);

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
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      toast.error(err.message.includes('Already') ? 'Already checked in today' : err.message);
    }
  };

  const autoLink = async () => {
    setLinking(true);
    try {
      const result = await api.autoLinkEmployee();
      if (result.created) {
        toast.success(`Consultant record created! ID: ${result.employee.emp_id}`);
        // Reload the page data so the daily workspace unlocks immediately
        load();
      } else {
        toast.info('Already linked to a consultant record.');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to create consultant record');
    } finally {
      setLinking(false);
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
      <div className="space-y-5">
        {/* Header */}
        <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-2xl p-6 border border-amber-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-300/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <p className="text-xs text-amber-700 font-bold uppercase tracking-wider mb-1">{greeting()}, {user?.name || 'Consultant'} 👋</p>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5 mt-1">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg">
                <Sunrise size={20} className="text-white" />
              </div>
              Daily Workspace
            </h1>
          </div>
        </div>

        <div className="bg-white border border-amber-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 rounded-xl text-amber-600 flex-shrink-0">
              <AlertCircle size={24} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-800">Consultant record not found</h2>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                To use Daily Workspace, attendance, and performance tracking, your user account must be linked to a HR consultant record. This happens automatically when your email matches a consultant in the system.
              </p>

              {isFullAdmin(user) ? (
                <div className="mt-4 space-y-3">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <p className="text-sm font-bold text-blue-900 mb-1">You're an admin — fix this in one click</p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Click the button below to auto-create a consultant record for yourself using your current account details. This will immediately unlock Daily Workspace, attendance, and payroll.
                    </p>
                  </div>
                  <button
                    onClick={autoLink}
                    disabled={linking}
                    className="flex items-center gap-2 text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-60 cursor-pointer"
                  >
                    {linking ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                    {linking ? 'Creating record…' : 'Auto-create Consultant Record'}
                  </button>
                  <p className="text-xs text-slate-400">
                    Or go to <Link to="/settings" className="text-blue-600 hover:underline font-semibold">Settings → Users & Access</Link> to manage manually.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <p className="text-sm font-bold text-slate-700 mb-1">What to do</p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Contact the Founder/CEO or Managing Director and ask them to link your account. They can do this in <strong>Settings → Users & Access</strong> by editing your user and setting the Linked Consultant, or by clicking "Auto-create Consultant Record" on this page.
                    </p>
                  </div>
                  <div className="text-xs text-slate-400">
                    Your email: <strong className="text-slate-600">{user?.email}</strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const alreadyLogged = !!todayInfo.log;

  return (
    <div className="space-y-6">
      {/* ── WARM PERSONAL HEADER ── */}
      <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-2xl p-6 border border-amber-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-300/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-300/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-amber-700 font-bold uppercase tracking-wider mb-1">{greeting()}, {todayInfo.emp_name || user?.name || 'Consultant'} 👋</p>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg">
                <Sunrise size={20} className="text-white" />
              </div>
              Daily Workspace
            </h1>
            <p className="text-sm text-slate-500 mt-1">Log your day, track activity, and plan tomorrow</p>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold bg-white/70 border border-amber-200/50 rounded-xl px-4 py-2.5 shadow-sm text-slate-600 backdrop-blur-sm">
            <Calendar size={14} className="text-amber-500" />
            {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* ── ACTIVITY CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <PersonalCard label="Leads Contacted" value={autoSummary?.leads || 0} sub="Unique today"
          icon={<PhoneCall size={14}/>} accent="blue" />
        <PersonalCard label="Marked Positive" value={autoSummary?.positive || 0} sub="High potential"
          icon={<CheckCircle2 size={14}/>} accent="emerald" />
        <PersonalCard label="Office Visits" value={autoSummary?.visited || 0} sub="Face-to-face"
          icon={<Building2 size={14}/>} accent="amber" />
        <PersonalCard label="Files Opened" value={autoSummary?.opened || 0} sub="Applications"
          icon={<FolderOpen size={14}/>} accent="violet" />
        <PersonalCard label="Not Interested" value={autoSummary?.negative || 0} sub="Nurtures stopped"
          icon={<XCircle size={14}/>} accent="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Auto-summary */}
          {autoSummary && autoSummary.total > 0 && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <Sparkles size={18} className="text-blue-600 flex-shrink-0 mt-0.5"/>
                <div className="flex-1">
                  <p className="text-sm font-bold text-blue-900 mb-2">What the system noticed you did today</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <WarmBadge>Touched <strong className="mx-1">{autoSummary.leads}</strong> lead{autoSummary.leads === 1 ? '' : 's'}</WarmBadge>
                    <WarmBadge>{autoSummary.total} actions</WarmBadge>
                    {autoSummary.positive > 0 && <WarmBadge>{autoSummary.positive} marked positive</WarmBadge>}
                    {autoSummary.visited > 0 && <WarmBadge>{autoSummary.visited} office visits</WarmBadge>}
                    {autoSummary.opened > 0 && <WarmBadge>{autoSummary.opened} files opened</WarmBadge>}
                    {autoSummary.notes > 0 && <WarmBadge>{autoSummary.notes} notes added</WarmBadge>}
                    {autoSummary.payments > 0 && <WarmBadge>৳{Number(autoSummary.payments).toLocaleString()} collected</WarmBadge>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Log form */}
          <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-amber-50/50 to-orange-50/50 flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Pencil size={14} className="text-slate-500"/>
                {alreadyLogged ? "Update today's log" : "Log your day before you leave"}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={autoFillLog}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer select-none"
                >
                  <Sparkles size={12} /> Auto-Fill from activity
                </button>
                {alreadyLogged && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">SUBMITTED</span>}
              </div>
            </div>

            <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">What did you accomplish today?</label>
              <textarea rows={4} required value={form.accomplishments}
                onChange={e => setForm(f => ({ ...f, accomplishments: e.target.value }))}
                placeholder="e.g. Followed up with 8 China leads, sent docs to NJTech for 2 students, met Md Sarwar in office to verify SSC/HSC…"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none" />
            </div>

            {/* Performance Metrics Grid */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Today's Metrics</p>
                <span className="text-[9px] text-slate-400">Verify or adjust</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                <MetricInput label="Leads Contacted" value={metrics.contacted} onChange={v => updateMetric('contacted', v)} icon={<PhoneCall size={13} className="text-blue-500" />} />
                <MetricInput label="Follow-ups" value={metrics.followup} onChange={v => updateMetric('followup', v)} icon={<Clock size={13} className="text-slate-500" />} />
                <MetricInput label="Marked Positive" value={metrics.positive} onChange={v => updateMetric('positive', v)} icon={<CheckCircle2 size={13} className="text-emerald-500" />} />
                <MetricInput label="Marked Negative" value={metrics.negative} onChange={v => updateMetric('negative', v)} icon={<XCircle size={13} className="text-rose-500" />} />
                <MetricInput label="Office Visits" value={metrics.visited} onChange={v => updateMetric('visited', v)} icon={<Building2 size={13} className="text-amber-500" />} />
                <MetricInput label="Files Opened" value={metrics.opened} onChange={v => updateMetric('opened', v)} icon={<FolderOpen size={13} className="text-indigo-500" />} />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Any blockers or issues?</label>
              <textarea rows={2} value={form.challenges}
                onChange={e => setForm(f => ({ ...f, challenges: e.target.value }))}
                placeholder="e.g. AHNU portal down all day · waiting for offer letter from NCWU"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none" />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Plan for tomorrow</label>
              <textarea rows={2} value={form.tomorrow_plan}
                onChange={e => setForm(f => ({ ...f, tomorrow_plan: e.target.value }))}
                placeholder="e.g. Call all 'positive' leads, finalise visa applications for Hungary cohort"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none" />
            </div>

            <div className="flex items-center justify-end gap-3">
              {saved && <span className="text-xs text-emerald-600 flex items-center gap-1.5"><CheckCircle2 size={13}/> Saved!</span>}
              <button type="submit" disabled={saving || !form.accomplishments.trim()}
                className="text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 flex items-center gap-2 font-bold transition-all shadow-sm">
                <Send size={14}/> {saving ? 'Saving…' : (alreadyLogged ? 'Update log' : 'Submit log')}
              </button>
            </div>
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
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                attnLog 
                  ? (attnLog.check_out ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700')
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
                  <span className="font-bold text-slate-400">Check-in:</span>
                  <span className="font-mono font-bold text-slate-700">{attnLog.check_in || '—'} ({attnLog.status})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-400">Check-out:</span>
                  <span className="font-mono font-bold text-slate-700">{attnLog.check_out || '—'}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200/60 pt-2 mt-1">
                  <span className="font-bold text-slate-400">Hours worked:</span>
                  <span className="font-bold text-blue-600">{attnLog.hours_worked ? `${parseFloat(attnLog.hours_worked).toFixed(1)} hrs` : 'Calculating...'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-400">Source:</span>
                  <span className="font-bold text-slate-700 capitalize flex items-center gap-1">
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
                <p className="font-bold">Shift not started today</p>
                <p className="text-[11px] text-amber-600">Click below to log your daily attendance manually.</p>
              </div>
            )}

            <div className="pt-1 flex gap-2">
              {!attnLog && (
                <button
                  onClick={handleManualCheckIn}
                  className="w-full text-xs font-bold py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogIn size={13} /> Manual Check In
                </button>
              )}
              {attnLog && !attnLog.check_out && (
                <button
                  onClick={handleManualCheckOut}
                  className="w-full text-xs font-bold py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut size={13} /> Complete & Check Out
                </button>
              )}
              {attnLog && attnLog.check_out && (
                <div className="w-full text-center text-xs py-2 bg-slate-100 text-slate-400 font-bold rounded-xl border border-slate-200">
                  ✓ Attendance closed for today
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
              <History size={14} className="text-slate-500"/>
              <p className="text-sm font-bold text-slate-700">Past 14 days</p>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-4">No previous logs yet.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {history.map(h => (
                  <details key={h.id} className="group">
                    <summary className="px-4 py-2.5 cursor-pointer text-xs flex items-center justify-between list-none hover:bg-slate-50/60 transition-colors">
                      <span className="font-bold text-slate-700">{h.date}</span>
                      <ChevronRight size={12} className="text-slate-300 transition-transform group-open:rotate-90"/>
                    </summary>
                    <div className="px-4 pb-3 pt-1 text-xs text-slate-600 space-y-1 bg-slate-50/40 border-t border-slate-100">
                      <p><strong className="text-slate-700">Did:</strong> {h.accomplishments}</p>
                      {h.challenges && <p><strong className="text-slate-700">Blockers:</strong> {h.challenges}</p>}
                      {h.tomorrow_plan && <p><strong className="text-slate-700">Tomorrow:</strong> {h.tomorrow_plan}</p>}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4">
            <p className="font-bold text-blue-900 text-sm mb-1 flex items-center gap-1.5">
              <Sparkles size={13} className="text-blue-600"/> Why this matters
            </p>
            <p className="text-xs text-blue-700/80 leading-relaxed">Your daily log feeds into your Performance Score — Attendance + Office Work + auto-tracked activity. Logging consistently builds your streak 🔥.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonalCard({ label, value, sub, icon, accent }) {
  const accents = {
    blue:    { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', icon: 'text-blue-500' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', icon: 'text-emerald-500' },
    amber:   { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', icon: 'text-amber-500' },
    violet:  { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-600', icon: 'text-violet-500' },
    rose:    { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600', icon: 'text-rose-500' },
  };
  const a = accents[accent] || accents.blue;
  return (
    <div className={`bg-white border ${a.border} rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">{label}</span>
        <div className={`p-1.5 rounded-lg ${a.bg} ${a.icon}`}>{icon}</div>
      </div>
      <p className={`text-2xl font-extrabold leading-none ${a.text}`}>{value}</p>
      <p className="text-[10px] text-slate-400 mt-1.5">{sub}</p>
    </div>
  );
}

function WarmBadge({ children }) {
  return <span className="bg-white border border-blue-200 text-blue-700 px-2.5 py-1 rounded-full font-medium text-[11px] shadow-sm">{children}</span>;
}

function MetricInput({ label, value, onChange, icon }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-200">
      <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[9px] uppercase tracking-wider truncate">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-center justify-between mt-2.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 hover:text-blue-600 active:scale-95 text-slate-600 rounded-lg text-xs font-black transition-all select-none cursor-pointer"
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
          className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 hover:text-blue-600 active:scale-95 text-slate-600 rounded-lg text-xs font-black transition-all select-none cursor-pointer"
        >
          +
        </button>
      </div>
    </div>
  );
}
