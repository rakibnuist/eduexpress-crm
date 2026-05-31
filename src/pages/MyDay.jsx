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
  Calendar, History, Sparkles, Pencil,
} from 'lucide-react';

const todayISO = () => new Date().toISOString().slice(0, 10);
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function MyDay({ user }) {
  const [todayInfo, setTodayInfo] = useState(null);   // { linked, today, log, emp_name, emp_id }
  const [history, setHistory]     = useState([]);     // recent daily logs
  const [autoSummary, setAuto]    = useState(null);   // best-effort auto activity summary
  const [form, setForm]           = useState({ accomplishments: '', challenges: '', tomorrow_plan: '' });
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  const load = () =>
    api.dailyLogsToday().then(r => {
      setTodayInfo(r);
      if (r.log) setForm({
        accomplishments: r.log.accomplishments || '',
        challenges: r.log.challenges || '',
        tomorrow_plan: r.log.tomorrow_plan || '',
      });
    });

  useEffect(() => { load(); }, []);
  useEffect(() => { api.dailyLogs({}).then(rs => setHistory((rs || []).slice(0, 14))).catch(() => {}); }, []);

  // Auto-pulled activity summary — what the system already noticed they did today
  useEffect(() => {
    api.activity({ since: `${todayISO()} 00:00:00`, limit: 200 })
      .then(rows => {
        const mine = (rows || []).filter(a => a.actor_name === user?.name || a.actor_user_id === user?.id);
        if (mine.length === 0) { setAuto({ total: 0 }); return; }
        const by = {};
        mine.forEach(a => { by[a.type] = (by[a.type] || 0) + 1; });
        const leads = new Set(mine.filter(a => a.lead_name).map(a => a.lead_name));
        setAuto({
          total: mine.length, by, leads: leads.size,
          payments: mine.filter(a => a.type === 'payment_recorded' || a.type === 'lead_payment')
                        .reduce((s, a) => s + (a.amount || 0), 0),
        });
      })
      .catch(() => setAuto({ total: 0 }));
  }, [user]);

  const toast = useToast();
  const submit = async (e) => {
    e.preventDefault();
    if (!form.accomplishments.trim()) return;
    setSaving(true);
    try {
      await api.submitDailyLog({ ...form, date: todayISO() });
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
      <div>
        <p className="text-sm text-slate-500">{greeting()}, {todayInfo.emp_name?.split(' ')[0]}</p>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Sun size={22} className="text-amber-500"/> My Day</h2>
        <p className="text-xs text-slate-400 mt-1">
          <Calendar size={11} className="inline mr-1" />
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
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
                    {(autoSummary.by.lead_status_changed || 0) > 0 && <Badge>{autoSummary.by.lead_status_changed} status changes</Badge>}
                    {(autoSummary.by.reply_to_student || 0) > 0 && <Badge>{autoSummary.by.reply_to_student} student replies</Badge>}
                    {(autoSummary.by.application_stage_changed || 0) > 0 && <Badge>{autoSummary.by.application_stage_changed} stage advances</Badge>}
                    {(autoSummary.by.uni_app_status || 0) > 0 && <Badge>{autoSummary.by.uni_app_status} uni updates</Badge>}
                    {autoSummary.payments > 0 && <Badge>৳{Number(autoSummary.payments).toLocaleString()} in payments</Badge>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Log form */}
          <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">{alreadyLogged ? 'Update today\'s log' : 'Log your day before you leave'}</h3>
              {alreadyLogged && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">SUBMITTED</span>}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">What did you do today?</label>
              <textarea rows={4} required value={form.accomplishments}
                onChange={e => setForm(f => ({ ...f, accomplishments: e.target.value }))}
                placeholder="e.g. Followed up with 8 China leads, sent docs to NJTech for 2 students, met Md Sarwar in office to verify SSC/HSC…"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
                className="text-sm bg-blue-600 text-white px-5 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
                <Send size={14}/> {saving ? 'Saving…' : (alreadyLogged ? 'Update log' : 'Submit & end day')}
              </button>
            </div>
          </form>
        </div>

        {/* Right: history */}
        <div className="space-y-4">
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
                    <div className="px-3 pb-2 pt-1 text-xs text-slate-600 whitespace-pre-wrap border-t border-slate-100">
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
