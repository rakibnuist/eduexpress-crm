import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import Modal from '../components/Modal';
import {
  Zap, FileText, Megaphone, Tag, BarChart3,
  Plus, Pencil, Trash2, Check, X, Search, Copy, Play, Pause,
  Send, Clock, Hash, User, AlertCircle, Sparkles, TrendingUp,
  MessageSquare, Users, ArrowRight, Target, CheckCircle2, Star,
  ChevronRight, Loader2, RefreshCw, Variable, Globe, CalendarDays,
  BarChart, Activity, Timer, Flag, Wifi, WifiOff, Mail
} from 'lucide-react';
import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend
} from 'recharts';

const TABS = [
  { id: 'rules',      label: 'Automation Rules',   icon: Zap },
  { id: 'templates',  label: 'Message Templates',  icon: FileText },
  { id: 'broadcasts', label: 'Broadcast Campaigns',icon: Megaphone },
  { id: 'tags',       label: 'Contact Tags',       icon: Tag },
  { id: 'analytics',  label: 'Analytics',          icon: BarChart3 },
];

const TRIGGER_TYPES = [
  { id: 'keyword',            label: 'Keyword',            desc: 'When a message contains certain words' },
  { id: 'new_conversation',   label: 'New Conversation',   desc: 'When a new conversation starts' },
  { id: 'no_response',        label: 'No Response',        desc: 'When no agent replies within a delay' },
  { id: 'lead_status_change', label: 'Lead Status Change', desc: 'When a lead status is updated' },
  { id: 'time_based',         label: 'Time-based',         desc: 'Trigger at a scheduled time' },
];

const ACTION_TYPES = [
  { id: 'reply',            label: 'Reply',              desc: 'Send a message template' },
  { id: 'assign',           label: 'Assign to Consultant', desc: 'Assign conversation to a team member' },
  { id: 'add_tag',          label: 'Add Tag',            desc: 'Tag the contact automatically' },
  { id: 'create_lead',      label: 'Create Lead',        desc: 'Create a new CRM lead' },
  { id: 'send_webhook',     label: 'Send Webhook',       desc: 'POST to an external URL' },
];

const TEMPLATE_CATEGORIES = ['General', 'Greeting', 'Follow-up', 'Closing', 'Marketing'];
const LANGUAGES = ['English', 'Chinese', 'Bengali', 'Arabic', 'Hindi', 'Spanish'];
const TAG_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'];
const BROADCAST_SEGMENTS = [
  { id: 'all',     label: 'All Contacts' },
  { id: 'by_tag',  label: 'By Tag' },
  { id: 'by_channel', label: 'By Channel' },
  { id: 'by_status',  label: 'By Status' },
];

export default function Automation() {
  const [tab, setTab] = useState('rules');
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
          <Zap size={20} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Automation Hub</h1>
          <p className="text-xs text-slate-400">Social media automation, templates, broadcasts & analytics</p>
        </div>
      </div>

      <div className="flex gap-1 mb-5 bg-white rounded-xl border border-slate-200 p-1 w-fit overflow-x-auto shadow-sm">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
              ${tab === id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {tab === 'rules'      && <RulesTab />}
      {tab === 'templates'  && <TemplatesTab />}
      {tab === 'broadcasts' && <BroadcastsTab />}
      {tab === 'tags'       && <TagsTab />}
      {tab === 'analytics'  && <AnalyticsTab />}
    </div>
  );
}

/* ─────────────────── Tab 1: Automation Rules ─────────────────── */

function RulesTab() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { mode: 'create'|'edit', rule? }
  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(() => {
    setLoading(true);
    api.automationRules().then(d => { setRules(Array.isArray(d) ? d : d.rules || []); setLoading(false); })
      .catch(e => { toast.error(e.message); setLoading(false); });
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (rule) => {
    try {
      await api.updateAutomationRule(rule.id, { ...rule, is_active: !rule.is_active });
      toast.success(rule.is_active ? 'Rule deactivated' : 'Rule activated');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Delete rule?', tone: 'danger', confirmLabel: 'Delete' });
    if (!ok) return;
    try { await api.deleteAutomationRule(id); toast.success('Rule deleted'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const handleTest = async (id) => {
    try { await api.testAutomationRule(id); toast.success('Rule test triggered'); }
    catch (e) { toast.error(e.message); }
  };

  const saveRule = async (data) => {
    try {
      if (modal.mode === 'create') {
        await api.createAutomationRule(data);
        toast.success('Rule created');
      } else {
        await api.updateAutomationRule(modal.rule.id, data);
        toast.success('Rule updated');
      }
      setModal(null);
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 font-medium">{rules.length} automation rule{rules.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors">
          <Plus size={14} /> New Rule
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2 text-slate-400">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium">Loading rules…</span>
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <Zap size={28} className="text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">No automation rules yet</p>
          <p className="text-xs text-slate-400 mt-1">Create rules to auto-reply, assign, tag, or create leads</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase tracking-wide">Trigger</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase tracking-wide">Action</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase tracking-wide">Priority</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 font-bold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rules.map(rule => (
                <tr key={rule.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-800">{rule.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{rule.description || 'No description'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 text-slate-600 font-semibold text-[10px]">
                      <Zap size={10} />
                      {TRIGGER_TYPES.find(t => t.id === rule.trigger_type)?.label || rule.trigger_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-50 text-blue-700 font-semibold text-[10px]">
                      <ArrowRight size={10} />
                      {ACTION_TYPES.find(a => a.id === rule.action_type)?.label || rule.action_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-slate-700">{rule.priority ?? 5}</span>
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(rule.priority ?? 5) * 10}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(rule)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors cursor-pointer
                        ${rule.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                      {rule.is_active ? <CheckCircle2 size={10} /> : <X size={10} />}
                      {rule.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleTest(rule.id)} title="Test rule"
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors">
                        <Play size={13} />
                      </button>
                      <button onClick={() => setModal({ mode: 'edit', rule })} title="Edit"
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(rule.id)} title="Delete"
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-600 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <RuleModal
          mode={modal.mode}
          rule={modal.rule}
          onClose={() => setModal(null)}
          onSave={saveRule}
        />
      )}
    </div>
  );
}

function RuleModal({ mode, rule, onClose, onSave }) {
  const [name, setName] = useState(rule?.name || '');
  const [triggerType, setTriggerType] = useState(rule?.trigger_type || 'keyword');
  const [keywords, setKeywords] = useState(rule?.trigger_config?.keywords?.join(', ') || '');
  const [matchType, setMatchType] = useState(rule?.trigger_config?.match_type || 'contains');
  const [delay, setDelay] = useState(rule?.trigger_config?.delay || 0);
  const [actionType, setActionType] = useState(rule?.action_type || 'reply');
  const [actionConfig, setActionConfig] = useState(rule?.action_config || { message: '', assignee: '', tag: '', webhook_url: '' });
  const [priority, setPriority] = useState(rule?.priority ?? 5);
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);
  const [templates, setTemplates] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tags, setTags] = useState([]);

  useEffect(() => {
    api.templates().then(d => setTemplates(Array.isArray(d) ? d : d.templates || [])).catch(() => {});
    api.employees().then(d => setEmployees(d || [])).catch(() => {});
    api.tags().then(d => setTags(Array.isArray(d) ? d : d.tags || [])).catch(() => {});
  }, []);

  const handleSave = () => {
    const payload = {
      name,
      trigger_type: triggerType,
      trigger_config: { keywords: keywords.split(',').map(s => s.trim()).filter(Boolean), match_type: matchType, delay: Number(delay) },
      action_type: actionType,
      action_config: actionConfig,
      priority: Number(priority),
      is_active: isActive,
    };
    onSave(payload);
  };

  return (
    <Modal title={`${mode === 'create' ? 'Create' : 'Edit'} Automation Rule`} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 font-semibold mb-1 block">Rule Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Greeting for new leads"
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 placeholder-slate-400" />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold mb-1 block">Status</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsActive(true)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                Active
              </button>
              <button onClick={() => setIsActive(false)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${!isActive ? 'bg-slate-100 text-slate-600 border border-slate-300' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                Inactive
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 font-semibold mb-1 block">Trigger Type</label>
          <div className="grid grid-cols-3 gap-2">
            {TRIGGER_TYPES.map(t => (
              <button key={t.id} onClick={() => setTriggerType(t.id)}
                className={`text-left p-2.5 rounded-xl border text-xs font-medium transition-all
                  ${triggerType === t.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                <span className="font-bold block">{t.label}</span>
                <span className="text-[10px] text-slate-400">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {triggerType === 'keyword' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 font-semibold mb-1 block">Keywords (comma-separated)</label>
              <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="hello, price, apply"
                className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 placeholder-slate-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold mb-1 block">Match Type</label>
              <select value={matchType} onChange={e => setMatchType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500">
                <option value="contains">Contains</option>
                <option value="exact">Exact</option>
              </select>
            </div>
          </div>
        )}

        {(triggerType === 'no_response' || triggerType === 'time_based') && (
          <div>
            <label className="text-xs text-slate-500 font-semibold mb-1 block">Delay (minutes)</label>
            <input type="number" value={delay} onChange={e => setDelay(e.target.value)} min={0}
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500" />
          </div>
        )}

        <div>
          <label className="text-xs text-slate-500 font-semibold mb-1 block">Action Type</label>
          <div className="grid grid-cols-3 gap-2">
            {ACTION_TYPES.map(a => (
              <button key={a.id} onClick={() => setActionType(a.id)}
                className={`text-left p-2.5 rounded-xl border text-xs font-medium transition-all
                  ${actionType === a.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                <span className="font-bold block">{a.label}</span>
                <span className="text-[10px] text-slate-400">{a.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {actionType === 'reply' && (
          <div>
            <label className="text-xs text-slate-500 font-semibold mb-1 block">Message Template</label>
            <select value={actionConfig.template_id || ''} onChange={e => setActionConfig({ ...actionConfig, template_id: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500">
              <option value="">Select a template…</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.language})</option>)}
            </select>
          </div>
        )}

        {actionType === 'assign' && (
          <div>
            <label className="text-xs text-slate-500 font-semibold mb-1 block">Assignee</label>
            <select value={actionConfig.assignee || ''} onChange={e => setActionConfig({ ...actionConfig, assignee: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500">
              <option value="">Select consultant…</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        )}

        {actionType === 'add_tag' && (
          <div>
            <label className="text-xs text-slate-500 font-semibold mb-1 block">Tag</label>
            <select value={actionConfig.tag || ''} onChange={e => setActionConfig({ ...actionConfig, tag: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500">
              <option value="">Select tag…</option>
              {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}

        {actionType === 'send_webhook' && (
          <div>
            <label className="text-xs text-slate-500 font-semibold mb-1 block">Webhook URL</label>
            <input value={actionConfig.webhook_url || ''} onChange={e => setActionConfig({ ...actionConfig, webhook_url: e.target.value })}
              placeholder="https://example.com/webhook"
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 placeholder-slate-400" />
          </div>
        )}

        <div>
          <label className="text-xs text-slate-500 font-semibold mb-1 block">Priority: {priority}</label>
          <input type="range" min={0} max={10} value={priority} onChange={e => setPriority(e.target.value)}
            className="w-full accent-blue-600" />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>Low (0)</span><span>High (10)</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm">
            {mode === 'create' ? 'Create Rule' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────── Tab 2: Message Templates ─────────────────── */

function TemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(() => {
    setLoading(true);
    api.templates().then(d => { setTemplates(Array.isArray(d) ? d : d.templates || []); setLoading(false); })
      .catch(e => { toast.error(e.message); setLoading(false); });
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Delete template?', tone: 'danger', confirmLabel: 'Delete' });
    if (!ok) return;
    try { await api.deleteTemplate(id); toast.success('Template deleted'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const saveTemplate = async (data) => {
    try {
      if (modal.mode === 'create') {
        await api.createTemplate(data);
        toast.success('Template created');
      } else {
        await api.updateTemplate(modal.template.id, data);
        toast.success('Template updated');
      }
      setModal(null);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied to clipboard'));
  };

  const filtered = templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.content.toLowerCase().includes(search.toLowerCase()));

  const categoryBadge = (cat) => {
    const map = {
      General: 'bg-slate-100 text-slate-600',
      Greeting: 'bg-emerald-100 text-emerald-700',
      'Follow-up': 'bg-blue-100 text-blue-700',
      Closing: 'bg-amber-100 text-amber-700',
      Marketing: 'bg-purple-100 text-purple-700',
    };
    return map[cat] || 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={13} />
          <input type="text" placeholder="Search templates…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200/70 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 placeholder-slate-400 shadow-sm" />
        </div>
        <button onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors">
          <Plus size={14} /> New Template
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2 text-slate-400">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium">Loading templates…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <FileText size={28} className="text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">No templates found</p>
          <p className="text-xs text-slate-400 mt-1">Create reusable message templates for automation</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(t => (
            <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${categoryBadge(t.category)}`}>{t.category || 'General'}</span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1"><Globe size={9} />{t.language || 'English'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => copyToClipboard(t.content)} title="Copy"
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors">
                    <Copy size={13} />
                  </button>
                  <button onClick={() => setModal({ mode: 'edit', template: t })} title="Edit"
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(t.id)} title="Delete"
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-600 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">{t.name}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-3 leading-relaxed">{t.content}</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-auto">
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <MessageSquare size={10} />
                  <span className="font-medium">Used {t.usage_count || 0} times</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(t.variables || []).map(v => (
                    <span key={v} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{`{{${v}}}`}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <TemplateModal
          mode={modal.mode}
          template={modal.template}
          onClose={() => setModal(null)}
          onSave={saveTemplate}
        />
      )}
    </div>
  );
}

function TemplateModal({ mode, template, onClose, onSave }) {
  const [name, setName] = useState(template?.name || '');
  const [category, setCategory] = useState(template?.category || 'General');
  const [language, setLanguage] = useState(template?.language || 'English');
  const [content, setContent] = useState(template?.content || '');
  const [variables, setVariables] = useState(template?.variables?.join(', ') || '');

  const handleSave = () => {
    const payload = {
      name,
      category,
      language,
      content,
      variables: variables.split(',').map(s => s.trim()).filter(Boolean),
    };
    onSave(payload);
  };

  const insertVar = (v) => setContent(c => c + `{{${v}}}`);

  return (
    <Modal title={`${mode === 'create' ? 'Create' : 'Edit'} Message Template`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-xs text-slate-500 font-semibold mb-1 block">Template Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Welcome Greeting"
            className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 placeholder-slate-400" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 font-semibold mb-1 block">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500">
              {TEMPLATE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold mb-1 block">Language</label>
            <select value={language} onChange={e => setLanguage(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500">
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500 font-semibold mb-1 block">Content</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={6}
            placeholder="Hello {{name}}, thank you for your interest in studying in {{destination}}. Your consultant {{consultant}} will assist you shortly."
            className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 placeholder-slate-400 resize-none" />
          <div className="flex items-center gap-1 mt-2">
            <span className="text-[10px] text-slate-400 font-medium">Insert:</span>
            {['name', 'destination', 'consultant', 'phone', 'email'].map(v => (
              <button key={v} onClick={() => insertVar(v)}
                className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-mono hover:bg-blue-100 transition-colors">
                {`{{${v}}}`}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500 font-semibold mb-1 block">Variables (comma-separated)</label>
          <input value={variables} onChange={e => setVariables(e.target.value)} placeholder="name, destination, consultant"
            className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 placeholder-slate-400" />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm">
            {mode === 'create' ? 'Create Template' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────── Tab 3: Broadcast Campaigns ─────────────────── */

function BroadcastsTab() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(() => {
    setLoading(true);
    api.broadcastCampaigns().then(d => { setBroadcasts(Array.isArray(d) ? d : d.broadcasts || []); setLoading(false); })
      .catch(e => { toast.error(e.message); setLoading(false); });
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Delete campaign?', tone: 'danger', confirmLabel: 'Delete' });
    if (!ok) return;
    try { await api.deleteBroadcastCampaign(id); toast.success('Campaign deleted'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const handleSend = async (id) => {
    const ok = await confirm({ title: 'Send campaign now?', body: 'This will immediately start sending messages to all targeted contacts.', confirmLabel: 'Send' });
    if (!ok) return;
    try { await api.sendBroadcastCampaign(id); toast.success('Campaign sending started'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const handlePause = async (id) => {
    try { await api.pauseBroadcast(id); toast.success('Campaign paused'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const handleResume = async (id) => {
    try { await api.resumeBroadcast(id); toast.success('Campaign resumed'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const saveBroadcast = async (data) => {
    try {
      await api.createBroadcastCampaign(data);
      toast.success('Campaign created');
      setModal(null);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const statusBadge = (status) => {
    const map = {
      draft:     'bg-slate-100 text-slate-600',
      scheduled: 'bg-indigo-100 text-indigo-700',
      sending:   'bg-blue-100 text-blue-700 animate-pulse',
      sent:      'bg-emerald-100 text-emerald-700',
      paused:    'bg-amber-100 text-amber-700',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 font-medium">{broadcasts.length} campaign{broadcasts.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors">
          <Plus size={14} /> New Campaign
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2 text-slate-400">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium">Loading campaigns…</span>
        </div>
      ) : broadcasts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <Megaphone size={28} className="text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">No broadcast campaigns yet</p>
          <p className="text-xs text-slate-400 mt-1">Schedule and send bulk messages to contact segments</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {broadcasts.map(b => (
            <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge(b.status)}`}>{b.status}</span>
                  {b.scheduled_at && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1"><CalendarDays size={9} />{new Date(b.scheduled_at).toLocaleDateString()}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {b.status === 'draft' && (
                    <button onClick={() => handleSend(b.id)} title="Send now"
                      className="p-1.5 hover:bg-emerald-50 rounded-lg text-slate-400 hover:text-emerald-600 transition-colors">
                      <Send size={13} />
                    </button>
                  )}
                  {b.status === 'sending' && (
                    <button onClick={() => handlePause(b.id)} title="Pause"
                      className="p-1.5 hover:bg-amber-50 rounded-lg text-slate-400 hover:text-amber-600 transition-colors">
                      <Pause size={13} />
                    </button>
                  )}
                  {b.status === 'paused' && (
                    <button onClick={() => handleResume(b.id)} title="Resume"
                      className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors">
                      <Play size={13} />
                    </button>
                  )}
                  <button onClick={() => handleDelete(b.id)} title="Delete"
                    className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">{b.name}</p>
                <p className="text-xs text-slate-500 mt-1">{b.segment_label || 'All contacts'} · {b.template_name || 'Custom message'}</p>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-700">{b.sent_count || 0}</p>
                  <p className="text-[9px] text-slate-400 font-medium">Sent</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-emerald-600">{b.delivered_count || 0}</p>
                  <p className="text-[9px] text-slate-400 font-medium">Delivered</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-rose-500">{b.failed_count || 0}</p>
                  <p className="text-[9px] text-slate-400 font-medium">Failed</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-blue-600">{b.read_count || 0}</p>
                  <p className="text-[9px] text-slate-400 font-medium">Read</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <BroadcastModal onClose={() => setModal(null)} onSave={saveBroadcast} />
      )}
    </div>
  );
}

function BroadcastModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [segment, setSegment] = useState('all');
  const [segmentValue, setSegmentValue] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [schedule, setSchedule] = useState('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [templates, setTemplates] = useState([]);
  const [tags, setTags] = useState([]);
  const [channels, setChannels] = useState([]);

  useEffect(() => {
    api.templates().then(d => setTemplates(Array.isArray(d) ? d : d.templates || [])).catch(() => {});
    api.tags().then(d => setTags(Array.isArray(d) ? d : d.tags || [])).catch(() => {});
    api.channels().then(d => setChannels(d || [])).catch(() => {});
  }, []);

  const handleSave = () => {
    const payload = {
      name,
      segment_type: segment,
      segment_value: segmentValue,
      template_id: templateId || undefined,
      custom_message: customMessage || undefined,
      schedule,
      scheduled_at: schedule === 'later' ? scheduledAt : undefined,
    };
    onSave(payload);
  };

  return (
    <Modal title="Create Broadcast Campaign" onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-xs text-slate-500 font-semibold mb-1 block">Campaign Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Summer Intake Promo"
            className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 placeholder-slate-400" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 font-semibold mb-1 block">Segment</label>
            <select value={segment} onChange={e => { setSegment(e.target.value); setSegmentValue(''); }}
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500">
              {BROADCAST_SEGMENTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold mb-1 block">Segment Value</label>
            {segment === 'by_tag' && (
              <select value={segmentValue} onChange={e => setSegmentValue(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500">
                <option value="">Select tag…</option>
                {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            {segment === 'by_channel' && (
              <select value={segmentValue} onChange={e => setSegmentValue(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500">
                <option value="">Select channel…</option>
                {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {segment === 'by_status' && (
              <select value={segmentValue} onChange={e => setSegmentValue(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500">
                <option value="">Select status…</option>
                <option value="open">Open</option>
                <option value="archived">Archived</option>
                <option value="unread">Unread</option>
              </select>
            )}
            {segment === 'all' && (
              <div className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs text-slate-400">All contacts will be targeted</div>
            )}
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500 font-semibold mb-1 block">Message Source</label>
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setTemplateId('')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${!templateId ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
              Custom Message
            </button>
            <button onClick={() => setCustomMessage('')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${templateId ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
              Use Template
            </button>
          </div>
          {templateId !== '' ? (
            <select value={templateId} onChange={e => setTemplateId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500">
              <option value="">Select template…</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          ) : (
            <textarea value={customMessage} onChange={e => setCustomMessage(e.target.value)} rows={4}
              placeholder="Type your broadcast message…"
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 placeholder-slate-400 resize-none" />
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 font-semibold mb-1 block">Schedule</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setSchedule('now')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${schedule === 'now' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                Send Now
              </button>
              <button onClick={() => setSchedule('later')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${schedule === 'later' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                Schedule Later
              </button>
            </div>
          </div>
          {schedule === 'later' && (
            <div>
              <label className="text-xs text-slate-500 font-semibold mb-1 block">Date & Time</label>
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500" />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm">
            Create Campaign
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────── Tab 4: Contact Tags ─────────────────── */

function TagsTab() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [tagContacts, setTagContacts] = useState([]);
  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(() => {
    setLoading(true);
    api.tags().then(d => { setTags(Array.isArray(d) ? d : d.tags || []); setLoading(false); })
      .catch(e => { toast.error(e.message); setLoading(false); });
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Enter a tag name'); return; }
    try { await api.createTag({ name: newName.trim(), color: newColor }); toast.success('Tag created'); setNewName(''); load(); }
    catch (e) { toast.error(e.message); }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Delete tag?', body: 'This will remove the tag from all contacts.', tone: 'danger', confirmLabel: 'Delete' });
    if (!ok) return;
    try { await api.deleteTag(id); toast.success('Tag deleted'); load(); setSelectedTag(null); }
    catch (e) { toast.error(e.message); }
  };

  const viewTagContacts = async (tag) => {
    setSelectedTag(tag);
    try {
      const d = await api.tagContacts(tag.id);
      setTagContacts(d.contacts || []);
    } catch (e) { toast.error(e.message); setTagContacts([]); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs text-slate-500 font-semibold mb-1 block">New Tag Name</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. VIP"
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 placeholder-slate-400" />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold mb-1 block">Color</label>
            <div className="flex items-center gap-1.5">
              {TAG_COLORS.map(c => (
                <button key={c} onClick={() => setNewColor(c)}
                  className={`w-6 h-6 rounded-full transition-all ${newColor === c ? 'ring-2 ring-offset-2 ring-slate-300' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <button onClick={handleCreate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors">
            <Plus size={14} /> Add Tag
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2 text-slate-400">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium">Loading tags…</span>
        </div>
      ) : tags.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <Tag size={28} className="text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">No tags yet</p>
          <p className="text-xs text-slate-400 mt-1">Create tags to organize and segment contacts</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {tags.map(t => (
            <button key={t.id} onClick={() => viewTagContacts(t)}
              className={`bg-white rounded-2xl border p-4 text-left shadow-sm hover:shadow-md transition-all flex flex-col gap-2
                ${selectedTag?.id === t.id ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: t.color }}>
                  {t.name}
                </span>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                  className="p-1 hover:bg-rose-50 rounded-lg text-slate-300 hover:text-rose-600 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Users size={12} />
                <span className="font-medium">{t.contact_count || 0} contacts</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedTag && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: selectedTag.color }}>
                {selectedTag.name}
              </span>
              <span className="text-xs text-slate-400 font-medium">{tagContacts.length} contact{tagContacts.length !== 1 ? 's' : ''}</span>
            </div>
            <button onClick={() => setSelectedTag(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><X size={13} /></button>
          </div>
          {tagContacts.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No contacts with this tag</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {tagContacts.map(c => (
                <div key={c.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold">
                      {String(c.name || 'C').split(' ').filter(Boolean).map(s => s[0]).slice(0,2).join('').toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">{c.name || 'Unknown'}</p>
                      <p className="text-[10px] text-slate-400">{c.phone || c.email || 'No contact info'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Tab 5: Analytics ─────────────────── */

function AnalyticsTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    api.automationStats().then(d => { setStats(d); setLoading(false); })
      .catch(e => { toast.error(e.message); setLoading(false); });
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-slate-400">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium">Loading analytics…</span>
      </div>
    );
  }

  const s = stats || {};
  const channelData = (s.messages_per_channel || []).map(c => ({ name: c.name, messages: c.count }));
  const triggerData = (s.triggers_over_time || []).map(t => ({ date: t.date, triggers: t.count }));
  const topRules = s.top_rules || [];

  return (
    <div className="space-y-5">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Rules Triggered Today', value: s.rules_triggered_today || 0, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'Messages Sent', value: s.messages_sent_today || 0, icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Templates Used', value: s.templates_used_today || 0, icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Active Conversations', value: s.active_conversations || 0, icon: Users, color: 'text-purple-500', bg: 'bg-purple-50' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center flex-shrink-0`}>
              <card.icon size={18} className={card.color} />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">{card.value}</p>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bar Chart: Messages per channel */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={15} className="text-blue-500" />
            <p className="text-xs font-bold text-slate-700">Messages per Channel (Last 7 Days)</p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={channelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="messages" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Line Chart: Automation triggers over time */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={15} className="text-purple-500" />
            <p className="text-xs font-bold text-slate-700">Automation Triggers Over Time</p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={triggerData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Line type="monotone" dataKey="triggers" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Top Rules */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} className="text-emerald-500" />
            <p className="text-xs font-bold text-slate-700">Top Rules by Execution</p>
          </div>
          <div className="space-y-2">
            {topRules.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No data yet</p>
            ) : topRules.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate">{r.name}</p>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (r.count / (topRules[0].count || 1)) * 100)}%` }} />
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-600">{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Average Response Time */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-2">
            <Timer size={22} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{s.avg_response_time_minutes || 0}m</p>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-1">Average Response Time</p>
          <p className="text-[10px] text-slate-400 mt-1">Per conversation over last 7 days</p>
        </div>

        {/* Resolution Rate */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-2">
            <CheckCircle2 size={22} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{s.resolution_rate ?? 0}%</p>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-1">Resolution Rate</p>
          <p className="text-[10px] text-slate-400 mt-1">Conversations archived / total</p>
        </div>
      </div>
    </div>
  );
}
