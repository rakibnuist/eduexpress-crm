import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { Info, AlertTriangle, Clock, Users, Globe, Tag, CreditCard, Shield, Plus, Pencil, Trash2, Mail, X, Loader2, MapPin, Save, Megaphone, StickyNote, MessageCircle, MessageSquare, RefreshCw, Key, Settings2, Wifi, Funnel, FileText, CheckCircle2, Search, GripVertical, Building, Briefcase, Lock, Bell, Database, HardDrive, Activity, Music, Upload } from 'lucide-react';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';

/* ─────────────────────────── MAIN SETTINGS PAGE ─────────────────────────── */
export default function Settings() {
  useEffect(() => { document.title = "Settings | EduExpress Core"; }, []);

  const [activeTab, setActiveTab] = useState('users');
  const [settings, setSettings] = useState(null);

  useEffect(() => { api.settings().then(setSettings); }, []);

  const reloadSettings = () => api.settings().then(setSettings);

  if (!settings) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold">Loading settings…</p>
      </div>
    </div>
  );

  const tabs = [
    { id: 'users',       label: 'Users & Access',    icon: Shield,   desc: 'Manage login accounts, roles, and permissions' },
    { id: 'company',     label: 'Company Profile',   icon: Building, desc: 'Branding, business rules, and organisation info' },
    { id: 'integration', label: 'Integrations',      icon: Globe,    desc: 'WhatsApp, Messenger, and Meta API' },
    { id: 'office',      label: 'Office & Hours',    icon: MapPin,   desc: 'Geofence, Wi-Fi, and attendance hours' },
    { id: 'reference',   label: 'Reference Lists',   icon: Tag,      desc: 'Dropdowns used across the CRM' },
    { id: 'tools',       label: 'Broadcast & Tools', icon: Megaphone,desc: 'Team broadcasts, data import, system health' },
  ];

  return (
    <div className="max-w-5xl">
      {/* ── Page Header ── */}
      <div className="flex items-start gap-4 pb-5 border-b border-slate-200 mb-0">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow flex-shrink-0">
          <Settings2 size={21} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight leading-tight">System Settings</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage users, integrations, office configuration, and reference data</p>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="border-b border-slate-200 -mb-px pt-0.5 overflow-x-auto">
        <nav className="flex min-w-max" aria-label="Settings sections">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap
                  ${isActive
                    ? 'border-blue-600 text-blue-700 bg-gradient-to-b from-blue-50/60 to-transparent'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50 hover:border-slate-200'}`}
              >
                <Icon size={15} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Tab Content ── */}
      <div className="pt-6 space-y-5">

        {/* USERS & ACCESS */}
        {activeTab === 'users' && (
          <UserManagement consultants={settings.consultants || []} />
        )}

        {/* INTEGRATIONS */}
        {activeTab === 'integration' && (
          <MetaIntegrationSettings />
        )}

        {/* OFFICE & HOURS */}
        {activeTab === 'office' && (
          <OfficeSettings />
        )}

        {/* COMPANY PROFILE */}
        {activeTab === 'company' && (
          <CompanyProfileSettings />
        )}

        {/* REFERENCE LISTS */}
        {activeTab === 'reference' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
              <Info size={16} className="flex-shrink-0 text-blue-500" />
              <span>These lists power all dropdown menus across the CRM. Changes take effect immediately for all users.</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EditableCard icon={<Users size={16} />} title="Consultants" color="violet"
                listKey="settings_consultants" items={settings.consultants || []} onSaved={reloadSettings} />
              <EditableCard icon={<Funnel size={16} />} title="Lead Sources" color="orange"
                listKey="settings_leadSources" items={settings.leadSources || []} onSaved={reloadSettings} />
              <EditableCard icon={<Tag size={16} />} title="Lead Statuses" color="sky"
                listKey="settings_leadStatuses" items={settings.leadStatuses || []} onSaved={reloadSettings} />
              <EditableCard icon={<Globe size={16} />} title="Destinations" color="emerald"
                listKey="settings_destinations" items={settings.destinations || []} onSaved={reloadSettings} />
              <EditableCard icon={<CreditCard size={16} />} title="Payment Statuses" color="rose"
                listKey="settings_paymentStatuses" items={settings.paymentStatuses || []} onSaved={reloadSettings} />
              <EditableCard icon={<Clock size={16} />} title="File Stages" color="amber"
                listKey="settings_fileStages" items={settings.fileStages || []} onSaved={reloadSettings} />
              <EditableCard icon={<CreditCard size={16} />} title="Income Categories" color="blue"
                listKey="settings_incomeCategories" items={settings.incomeCategories || []} onSaved={reloadSettings} />
              <EditableCard icon={<CreditCard size={16} />} title="Expense Categories" color="rose"
                listKey="settings_expenseCategories" items={settings.expenseCategories || []} onSaved={reloadSettings} />
            </div>

            {/* Document Templates per Destination */}
            <DocTemplateManager destinations={settings.destinations || []}
              templates={settings.docTemplates || {}} onSaved={reloadSettings} />

            {/* Roles & Designations */}
            <RolesDesignationsCard employees={settings.employees || []} />
          </div>
        )}

        {/* BROADCAST & TOOLS */}
        {activeTab === 'tools' && (
          <div className="space-y-5">
            <BroadcastManager />
            <LeadPipelineToolsCard />
            <SystemHealthCard />

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 bg-slate-50 text-slate-600">
                <Briefcase size={17} />
                <span className="font-semibold text-sm">Organisation & System</span>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  <InfoRow label="Organisation" value="EduExpress International" icon={<Building size={14} className="text-slate-400" />} />
                  <InfoRow label="Core Version" value="v2.1 · Web Edition" icon={<Activity size={14} className="text-slate-400" />} />
                  <InfoRow label="Office Wi-Fi SSID" value={settings.office_wifi_ssid || 'Not configured'} icon={<Wifi size={14} className="text-slate-400" />} />
                  <InfoRow label="Currency" value="BDT (৳) — Bangladeshi Taka" icon={<CreditCard size={14} className="text-slate-400" />} />
                  <InfoRow label="Database" value="SQLite (sql.js) · In-memory with WAL" icon={<Database size={14} className="text-slate-400" />} />
                  <InfoRow label="Data Retention" value="Finance & HR kept forever · Leads wipeable" icon={<HardDrive size={14} className="text-slate-400" />} />
                </div>
              </div>
            </div>

            <DangerZone />
          </div>
        )}

      </div>
    </div>
  );
}

function InfoRow({ label, value, icon }) {
  return (
    <div className="flex items-start gap-2">
      {icon && <div className="mt-0.5">{icon}</div>}
      <div>
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-slate-700 font-medium mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function DangerZone() {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [withConversations, setWithConversations] = useState(false);

  const handleWipeLeads = async () => {
    const ok = await confirm({
      title: 'Delete ALL Leads & Applications?',
      body: `This will permanently delete every lead, document, university application, activity log, and KPI target${withConversations ? ', PLUS all chat conversations, messages and contacts' : ''}. Finance records, consultants, attendance and payroll are kept. This cannot be undone.`,
      confirmLabel: 'Yes, delete everything',
      tone: 'danger',
    });
    if (!ok) return;
    // Second confirmation
    const sure = await confirm({
      title: 'Are you absolutely sure?',
      body: 'All student records will be gone forever.',
      confirmLabel: 'Delete permanently',
      tone: 'danger',
    });
    if (!sure) return;
    setBusy(true);
    try {
      const res = await api.wipeLeads(withConversations ? { conversations: true } : {});
      toast.success(`Deleted ${res.deleted} lead(s) and all associated records${res.conversationsWiped ? ' + all conversations' : ''}.`);
    } catch (e) {
      toast.error(e.message || 'Wipe failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-rose-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-rose-100 bg-rose-50 text-rose-700">
        <AlertTriangle size={17} />
        <span className="font-semibold text-sm">Danger Zone</span>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Delete All Leads &amp; Applications</p>
            <p className="text-xs text-slate-500 mt-0.5">Permanently removes every lead, document, university application, activity log and KPI target. Finance, consultants, attendance and payroll are never touched.</p>
            <label className="flex items-center gap-2 mt-2 text-xs text-slate-600 cursor-pointer select-none">
              <input type="checkbox" checked={withConversations} onChange={e => setWithConversations(e.target.checked)}
                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500" />
              Also wipe all chat conversations, messages &amp; contacts
              <span className="text-slate-400">(Messenger/Instagram history can be re-imported via "Sync History"; WhatsApp history cannot be recovered)</span>
            </label>
          </div>
          <button
            onClick={handleWipeLeads}
            disabled={busy}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {busy ? 'Deleting…' : 'Wipe Leads'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditableCard({ icon, title, color, listKey, items = [], onSaved }) {
  const [editing, setEditing] = useState(false);
  const [list, setList] = useState(items);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setList(items);
  }, [items]);

  const filteredList = useMemo(() => {
    if (!search.trim()) return list;
    return list.filter(item => item.toLowerCase().includes(search.toLowerCase()));
  }, [list, search]);

  const add = (e) => {
    e.preventDefault();
    const val = input.trim();
    if (!val) return;
    if (list.includes(val)) {
      toast.error('Item already exists in the list');
      return;
    }
    setList([...list, val]);
    setInput('');
  };

  const remove = (index) => {
    setList(list.filter((_, i) => i !== index));
  };

  const move = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= list.length) return;
    const newList = [...list];
    [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];
    setList(newList);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.saveSettings(listKey, list);
      toast.success(`${title} list saved`);
      setEditing(false);
      onSaved();
    } catch (e) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setList(items);
    setInput('');
    setSearch('');
    setEditing(false);
  };

  const colors = {
    blue: { header: 'bg-blue-50 text-blue-600 border-blue-100', tag: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
    violet: { header: 'bg-violet-50 text-violet-600 border-violet-100', tag: 'bg-violet-50 text-violet-700 hover:bg-violet-100' },
    sky: { header: 'bg-sky-50 text-sky-600 border-sky-100', tag: 'bg-sky-50 text-sky-700 hover:bg-sky-100' },
    emerald: { header: 'bg-emerald-50 text-emerald-600 border-emerald-100', tag: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
    orange: { header: 'bg-orange-50 text-orange-600 border-orange-100', tag: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
    rose: { header: 'bg-rose-50 text-rose-600 border-rose-100', tag: 'bg-rose-50 text-rose-700 hover:bg-rose-100' },
    amber: { header: 'bg-amber-50 text-amber-600 border-amber-100', tag: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
  };

  const c = colors[color] || colors.blue;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md">
      <div className={`flex items-center gap-2.5 px-5 py-3.5 border-b ${c.header}`}>
        {icon}
        <span className="font-semibold text-sm flex-grow">{title}</span>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 h-8 rounded-lg border border-current hover:bg-white/30 transition-colors"
          >
            <Pencil size={11} /> Edit List
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={cancel}
              disabled={saving}
              className="text-xs px-2.5 h-8 rounded-lg border border-slate-300 text-slate-600 hover:bg-white bg-white font-medium"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-xs px-3 h-8 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold flex items-center gap-1"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {editing && (
          <>
            <form onSubmit={add} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={`Add new item…`}
                className="flex-grow h-10 border border-slate-200 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              />
              <button
                type="submit"
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-4 h-10 rounded-xl flex items-center gap-1"
              >
                <Plus size={13} /> Add
              </button>
            </form>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search in list…"
                className="w-full h-10 pl-9 pr-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              />
            </div>
            <p className="text-[10px] text-slate-400">{filteredList.length} of {list.length} shown · Use arrows to reorder</p>
          </>
        )}

        <div className="flex flex-wrap gap-2">
          {filteredList.length === 0 ? (
            <p className="text-slate-400 text-xs italic py-2">{search ? 'No matching items' : 'No items in the list'}</p>
          ) : (
            filteredList.map((item, idx) => {
              const originalIndex = list.indexOf(item);
              return (
                <span
                  key={item}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-all ${c.tag}`}
                >
                  {editing && (
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => move(originalIndex, -1)} disabled={originalIndex === 0}
                        className="p-0.5 rounded hover:bg-black/10 disabled:opacity-30" title="Move up"><GripVertical size={10} className="rotate-90" /></button>
                      <button type="button" onClick={() => move(originalIndex, 1)} disabled={originalIndex >= list.length - 1}
                        className="p-0.5 rounded hover:bg-black/10 disabled:opacity-30" title="Move down"><GripVertical size={10} className="-rotate-90" /></button>
                    </div>
                  )}
                  {item}
                  {editing && (
                    <button
                      type="button"
                      onClick={() => remove(originalIndex)}
                      className="p-0.5 rounded-full hover:bg-black/10 text-current/70 hover:text-current transition-colors"
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── USER MANAGEMENT ─────────────────────────── */
function UserManagement({ consultants }) {
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState(null); // null | { mode:'add' } | { mode:'edit', user }

  const load = () => {
    setLoading(true);
    api.users().then(setUsers).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const toast = useToast();
  const confirm = useConfirm();
  const remove = async (u) => {
    const ok = await confirm({
      title: `Delete user "${u.name || u.email}"?`,
      body: 'They will lose access immediately. This cannot be undone.',
      tone: 'danger', confirmLabel: 'Delete user',
    });
    if (!ok) return;
    try { await api.deleteUser(u.id); load(); toast.success('User deleted'); }
    catch (e) { toast.error(e.message); }
  };
  const toggleActive = async (u) => {
    try { await api.updateUser(u.id, { active: u.active ? 0 : 1 }); load();
          toast.success(u.active ? `${u.name || u.email} disabled` : `${u.name || u.email} enabled`); }
    catch (e) { toast.error(e.message); }
  };

  const roleBadge = (role) => {
    const map = {
      founder_ceo: { bg: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Founder & CEO' },
      managing_director: { bg: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Managing Director' },
      investor: { bg: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Investor' },
      consultant: { bg: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Consultant' },
      application_manager: { bg: 'bg-amber-100 text-amber-700 border-amber-200', label: 'App Manager' },
      marketing_manager: { bg: 'bg-rose-100 text-rose-700 border-rose-200', label: 'Marketing Manager' },
    };
    const r = map[role] || { bg: 'bg-slate-100 text-slate-600 border-slate-200', label: role };
    return <span key={role} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${r.bg}`}>{r.label}</span>;
  };

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-2.5 px-5 py-3 border-b bg-indigo-50 text-indigo-600 border-indigo-100">
          <Shield size={18} />
          <span className="font-semibold text-sm flex-1">Users & Access</span>
          <span className="text-xs text-indigo-500 font-medium">{users.filter(u => u.active).length} active</span>
          <button onClick={() => setModal({ mode: 'add' })}
            className="flex items-center gap-1.5 text-xs font-medium bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">
            <Plus size={13} /> Add User
          </button>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="text-slate-400 text-sm py-6 text-center">Loading users…</div>
          ) : users.length === 0 ? (
            <div className="text-slate-400 text-sm py-6 text-center">No users yet</div>
          ) : (
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className={`flex items-center gap-3 p-3 rounded-xl border ${u.active ? 'border-slate-100 hover:border-slate-200' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0
                    ${u.role === 'admin' ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>
                    {(u.name || u.email).split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800 text-sm truncate">{u.name || u.email}</p>
                      <div className="flex items-center gap-1 flex-wrap">
                        {(u.roles || [u.role]).map(roleBadge)}
                      </div>
                      {!u.active && <span className="text-[10px] font-bold bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full uppercase">Disabled</span>}
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                      <Mail size={11} /> {u.email}
                      {u.consultant_name && <span className="ml-1">· Maps to <strong>{u.consultant_name}</strong></span>}
                      {u.emp_id && <span className="ml-1">· Linked consultant <strong>#{u.emp_id}</strong></span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleActive(u)} title={u.active ? 'Disable' : 'Enable'}
                      className={`text-xs px-2.5 py-1.5 rounded-lg font-medium border ${u.active ? 'text-slate-500 border-slate-200 hover:bg-slate-50' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}>
                      {u.active ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => setModal({ mode: 'edit', user: u })}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" aria-label="Edit user"><Pencil size={14} /></button>
                    <button onClick={() => remove(u)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg" aria-label="Delete user"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-3">
            💡 The <strong>Consultant Name</strong> on a user must match the <em>Assigned Consultant</em> field on a lead for it to appear in their inbox. Multi-role users get combined permissions from all assigned roles.
          </p>
        </div>
      </div>

      {modal && (
        <UserModal modal={modal} consultants={consultants}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }} />
      )}
    </>
  );
}

function UserModal({ modal, consultants, onClose, onSaved }) {
  const editing = modal.mode === 'edit';
  const u = modal.user || {};
  const [form, setForm] = useState({
    email: u.email || '',
    name: u.name || '',
    roles: u.roles || (u.role ? [u.role] : []),
    consultant_name: u.consultant_name || '',
    emp_id: u.emp_id || '',
    password: '',
  });
  const [employees, setEmployees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => { api.employees().then(setEmployees).catch(() => {}); }, []);

  const allRoles = [
    { key: 'founder_ceo', label: 'Founder & CEO', desc: 'Full access — everything including China data' },
    { key: 'managing_director', label: 'Managing Director', desc: 'Full access except China data' },
    { key: 'investor', label: 'Investor', desc: 'Read-only executive view, no chat' },
    { key: 'application_manager', label: 'Application Manager', desc: 'All applications + China data, no Finance/HR' },
    { key: 'marketing_manager', label: 'Marketing Manager', desc: 'Marketing + automation + all chats' },
    { key: 'consultant', label: 'Consultant', desc: 'Own leads only, Bangladesh pipeline' },
  ];

  const toggleRole = (roleKey) => {
    setForm(f => {
      const has = f.roles.includes(roleKey);
      const next = has ? f.roles.filter(r => r !== roleKey) : [...f.roles, roleKey];
      return { ...f, roles: next };
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const payload = {
        name: form.name,
        roles: form.roles,
        consultant_name: form.roles.includes('consultant') ? form.consultant_name : null,
        emp_id: form.emp_id || null,
      };
      if (editing) {
        if (form.password) payload.password = form.password;
        await api.updateUser(u.id, payload);
      } else {
        await api.createUser({ email: form.email, password: form.password, ...payload });
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Save failed');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-slate-800">{editing ? 'Edit user' : 'Add user'}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={save} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Email</label>
            <input type="email" required disabled={editing}
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Full name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
          </div>

          {/* Multi-role selection */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">Roles <span className="text-slate-400 font-normal">(select all that apply)</span></label>
            <div className="grid grid-cols-1 gap-2">
              {allRoles.map(r => {
                const active = form.roles.includes(r.key);
                const map = {
                  founder_ceo: 'border-purple-200 bg-purple-50 text-purple-700',
                  managing_director: 'border-indigo-200 bg-indigo-50 text-indigo-700',
                  investor: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                  application_manager: 'border-amber-200 bg-amber-50 text-amber-700',
                  marketing_manager: 'border-rose-200 bg-rose-50 text-rose-700',
                  consultant: 'border-blue-200 bg-blue-50 text-blue-700',
                };
                const cls = map[r.key] || 'border-slate-200 bg-slate-50 text-slate-600';
                return (
                  <button key={r.key} type="button" onClick={() => toggleRole(r.key)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${active ? `${cls} ring-1 ring-offset-1` : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${active ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                      {active && <CheckCircle2 size={13} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold ${active ? '' : 'text-slate-700'}`}>{r.label}</p>
                      <p className="text-[10px] text-slate-400 leading-tight">{r.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {form.roles.length === 0 && (
              <p className="text-xs text-rose-600 mt-1">Select at least one role</p>
            )}
          </div>

          {form.roles.includes('consultant') && (
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Consultant name <span className="text-slate-400 font-normal">(must match leads' assigned consultant)</span></label>
              <input list="consultants-list" value={form.consultant_name}
                onChange={e => setForm(f => ({ ...f, consultant_name: e.target.value }))}
                placeholder="e.g. Shazid Hasan"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
              <datalist id="consultants-list">
                {consultants.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">
              Linked consultant <span className="text-slate-400 font-normal">(enables auto check-in on login)</span>
            </label>
            <select value={form.emp_id} onChange={e => setForm(f => ({ ...f, emp_id: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
              <option value="">— Not linked —</option>
              {employees.filter(e => e.active === 'Yes').map(e => (
                <option key={e.id} value={e.emp_id}>{e.name} · {e.emp_id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">
              {editing ? 'New password (leave blank to keep current)' : 'Password'}
            </label>
            <input type="password" required={!editing} minLength={6}
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={editing ? '••••••••' : 'At least 6 characters'}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving || form.roles.length === 0}
              className="text-sm px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create user'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ────────────────────────── OFFICE SETTINGS ────────────────────────── */
function OfficeSettings() {
  const [cfg, setCfg]     = useState(null);
  const [form, setForm]   = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]     = useState('');

  useEffect(() => {
    api.officeConfig().then(d => { setCfg(d); setForm({
      office_open_time:  d.office_open_time  || '09:30',
      office_close_time: d.office_close_time || '18:00',
      office_lat:        d.office_lat || '',
      office_lng:        d.office_lng || '',
      office_radius_m:   d.office_radius_m || '200',
      office_wifi_ssid:  d.office_wifi_ssid || '',
    }); });
  }, []);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { setMsg('Geolocation not supported by this browser'); return; }
    setMsg('Getting location…');
    navigator.geolocation.getCurrentPosition(
      p => {
        update('office_lat', p.coords.latitude.toFixed(6));
        update('office_lng', p.coords.longitude.toFixed(6));
        setMsg(`📍 Location set (±${Math.round(p.coords.accuracy)}m). Don't forget to Save.`);
      },
      e => setMsg('Could not get location: ' + e.message),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const clearGeofence = () => {
    update('office_lat', ''); update('office_lng', '');
    setMsg('Geofence cleared — auto check-in will run from anywhere on save.');
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.saveOfficeConfig(form);
      setMsg('✓ Saved successfully');
      setTimeout(() => setMsg(''), 2500);
    } catch (err) { setMsg('Error: ' + err.message); }
    setSaving(false);
  };

  if (!cfg) return null;
  const geoEnabled = form.office_lat && form.office_lng;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-5 py-3 border-b bg-amber-50 text-amber-700 border-amber-100">
        <MapPin size={18} />
        <span className="font-semibold text-sm flex-1">Office Hours, Geofencing & Wi-Fi Attendance</span>
      </div>
      <form onSubmit={save} className="p-5 space-y-5">
        {/* Office Hours */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Office opens at</label>
            <input type="time" value={form.office_open_time} onChange={e => update('office_open_time', e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            <p className="text-[11px] text-slate-400 mt-1">Logins later than this + 15 min mark "Late".</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Office closes at</label>
            <input type="time" value={form.office_close_time} onChange={e => update('office_close_time', e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            <p className="text-[11px] text-slate-400 mt-1">Stale check-ins (still open from a previous day) get this checkout time.</p>
          </div>
        </div>

        {/* Wi-Fi SSID Config */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Wifi size={16} className="text-blue-500 animate-pulse" />
            <label className="text-sm font-semibold text-slate-700">Office Wi-Fi Auto-Attendance</label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Office Wi-Fi SSID</label>
              <input value={form.office_wifi_ssid || ''} onChange={e => update('office_wifi_ssid', e.target.value)}
                placeholder="e.g. EduExpress_Office_5G" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
              <p className="[11px] text-slate-400 mt-1">Consultants opening the CRM on this network will be automatically checked in.</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Auto Wi-Fi Attendance Status</label>
              <div className="flex items-center gap-2.5 h-[38px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600">
                <span className={`w-2 h-2 rounded-full ${form.office_wifi_ssid ? 'bg-emerald-500 animate-pulse shadow-sm shadow-emerald-400' : 'bg-slate-300'}`}></span>
                {form.office_wifi_ssid ? 'Active (Auto-checking on office connection)' : 'Inactive (Configure SSID to enable)'}
              </div>
            </div>
          </div>
        </div>

        {/* Geofence */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <label className="text-sm font-semibold text-slate-700">Office geofence</label>
              <p className="text-[11px] text-slate-400">Only auto-check-in if the login happens within this radius. Leave blank to allow from anywhere.</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${geoEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {geoEnabled ? 'Active' : 'Off'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Latitude</label>
              <input value={form.office_lat} onChange={e => update('office_lat', e.target.value)}
                placeholder="23.7806" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Longitude</label>
              <input value={form.office_lng} onChange={e => update('office_lng', e.target.value)}
                placeholder="90.4193" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Radius (m)</label>
              <input type="number" min="20" max="2000" value={form.office_radius_m} onChange={e => update('office_radius_m', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={useCurrentLocation}
              className="text-xs px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 flex items-center gap-1.5">
              <MapPin size={13} /> Use current location
            </button>
            {geoEnabled && (
              <button type="button" onClick={clearGeofence}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
                Disable geofence
              </button>
            )}
          </div>
        </div>

        {msg && <div className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">{msg}</div>}

        <div className="flex justify-end pt-1">
          <button type="submit" disabled={saving}
            className="text-sm px-5 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60 flex items-center gap-2">
            <Save size={14} /> {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─────────────────────────── BROADCAST MANAGER ─────────────────────────── */
function BroadcastManager() {
  const [items, setItems] = useState([]);
  const [text, setText]   = useState('');
  const [color, setColor] = useState('amber');
  const [posting, setPosting] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const load = () => api.broadcasts().then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const post = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    try { await api.createBroadcast({ message: text.trim(), color, pinned: 1 });
          setText(''); load(); toast.success('Broadcast posted to the whole team'); }
    catch (err) { toast.error(err.message); }
    setPosting(false);
  };

  const remove = async (id) => {
    if (!await confirm({ title: 'Delete this broadcast?', tone: 'danger', confirmLabel: 'Delete' })) return;
    try { await api.deleteBroadcast(id); load(); toast.info('Broadcast removed'); }
    catch (e) { toast.error(e.message); }
  };

  const colors = [
    { key: 'amber',   cls: 'bg-amber-50 border-amber-200 text-amber-900' },
    { key: 'blue',    cls: 'bg-blue-50 border-blue-200 text-blue-900' },
    { key: 'rose',    cls: 'bg-rose-50 border-rose-200 text-rose-900' },
    { key: 'emerald', cls: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-slate-100 bg-amber-50 text-amber-800">
        <Megaphone size={18} />
        <span className="font-semibold text-sm">Owner Broadcast</span>
        <span className="text-xs text-amber-600 ml-2">Visible to everyone on the dashboard</span>
      </div>
      <div className="p-5 space-y-3">
        <form onSubmit={post} className="space-y-2">
          <textarea rows={2} value={text} onChange={e => setText(e.target.value)}
            placeholder="e.g. Friday focus: China-Tier-1 visa interviews — clear all blockers."
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {colors.map(c => (
                <button key={c.key} type="button" onClick={() => setColor(c.key)}
                  className={`w-7 h-7 rounded-lg border-2 ${c.cls} ${color === c.key ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
                  aria-label={c.key} />
              ))}
            </div>
            <button type="submit" disabled={posting || !text.trim()}
              className="text-sm font-medium bg-amber-600 text-white px-4 py-2 rounded-xl hover:bg-amber-700 disabled:opacity-60 flex items-center gap-2">
              <StickyNote size={14} /> {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </form>

        {items.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-4">No active broadcasts</p>
        ) : (
          <div className="space-y-2">
            {items.map(b => {
              const c = colors.find(x => x.key === b.color) || colors[0];
              return (
                <div key={b.id} className={`relative p-4 rounded-xl border ${c.cls}`}>
                  <p className="text-sm whitespace-pre-wrap pr-7">{b.message}</p>
                  <p className="text-[11px] mt-2 opacity-70">— {b.author_name} · {b.created_at}</p>
                  <button onClick={() => remove(b.id)}
                    className="absolute top-2 right-2 p-1 opacity-50 hover:opacity-100" aria-label="Remove broadcast"><Trash2 size={14}/></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────── META & WHATSAPP INTEGRATIONS ────────────────────────── */
function MetaIntegrationSettings() {
  const [config, setConfig] = useState({
    page_access_token: '',
    capi_token: '',
    pixel_id: '',
    app_secret: '',
    verify_token: 'eduexpress_verify_2024',
    test_event_code: '',
  });
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const syncTimeoutRef = useRef(null); // fallback timeout to reset syncing state
  const [modal, setModal] = useState(null); // null | { mode:'add' }
  const toast = useToast();
  const confirm = useConfirm();

  const loadData = async () => {
    setLoading(true);
    try {
      const cfg = await api.getMetaConfig();
      setConfig(c => ({
        ...c,
        page_access_token: cfg.page_access_token || '',
        capi_token: cfg.capi_token || '',
        pixel_id: cfg.pixel_id || '',
        app_secret: cfg.app_secret || '',
        verify_token: cfg.verify_token || 'eduexpress_verify_2024',
        test_event_code: cfg.test_event_code || '',
      }));
      const chs = await api.channels();
      setChannels(chs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await api.saveMetaConfig(config);
      toast.success('Meta & Conversion API configuration saved successfully');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to save config');
    } finally {
      setSavingConfig(false);
    }
  };

  const removeChannel = async (channel) => {
    const ok = await confirm({
      title: `Remove integration channel "${channel.name}"?`,
      body: 'Incoming messages for this channel will no longer be captured. This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Remove Channel',
    });
    if (!ok) return;
    try {
      await api.deleteChannel(channel.id);
      toast.success('Channel removed successfully');
      loadData();
    } catch (e) {
      toast.error(e.message || 'Failed to remove channel');
    }
  };

  const syncHistory = async (channel) => {
    setSyncingId(channel.id);
    toast.info(`Starting historic conversations sync for ${channel.name}…`);
    // Fallback: auto-reset after 60s if SSE never fires (server crash, etc.)
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      setSyncingId(null);
      toast.warning(`Sync timed out for ${channel.name}. Check server logs.`);
    }, 60000);
    try {
      const res = await api.syncChannel(channel.id);
      if (res.ok && res.started) {
        toast.success(`✓ Sync started for ${res.channel || channel.name}. Watch for updates.`);
      } else if (res.imported !== undefined) {
        toast.success(`✓ Sync complete: Imported ${res.imported} messages!`);
        loadData();
      }
    } catch (e) {
      toast.error(`Sync error: ${e.message}`);
      setSyncingId(null);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    }
  };

  // SSE listener for sync progress / completion / errors
  useEffect(() => {
    const es = new EventSource('/api/events', { withCredentials: true });
    es.addEventListener('sync_done', (e) => {
      try {
        const data = JSON.parse(e.data);
        setSyncingId(prev => prev === data.channel_id ? null : prev);
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        toast.success(`Sync done for ${data.channel}: ${data.imported} messages imported, ${data.skipped} skipped`);
        loadData();
      } catch (err) { console.error('SSE sync_done error:', err); }
    });
    es.addEventListener('sync_error', (e) => {
      try {
        const data = JSON.parse(e.data);
        setSyncingId(prev => prev === data.channel_id ? null : prev);
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        toast.error(`Sync failed for ${data.channel}: ${data.error}`);
      } catch (err) { console.error('SSE sync_error error:', err); }
    });
    es.addEventListener('sync_progress', (e) => {
      try {
        const data = JSON.parse(e.data);
        toast.info(`Syncing ${data.channel}… ${data.conversations} conversations, ${data.imported} messages`, { duration: 3000 });
      } catch (err) { console.error('SSE sync_progress error:', err); }
    });
    es.onerror = (err) => { console.error('SSE error:', err); };
    return () => { es.close(); if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, []);

  return (
    <div className="space-y-5">
      {/* Channels List Card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-2.5 px-5 py-3 border-b bg-emerald-50 text-emerald-800 border-emerald-100">
          <Globe size={18} />
          <span className="font-semibold text-sm flex-grow">Meta & TikTok Integration Channels</span>
          <button
            onClick={() => setModal({ mode: 'add' })}
            className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={13} /> Add Channel
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-400">
            Configure integration channels to listen to WhatsApp Business Cloud API, Facebook Messenger, Instagram Direct, and TikTok DMs. 
            All new conversation inquiries on these channels will automatically create a <strong>"New Lead"</strong> in the pipeline instantly!
          </p>

          {loading ? (
            <div className="text-slate-400 text-sm py-6 text-center">Loading integration channels…</div>
          ) : channels.length === 0 ? (
            <div className="text-slate-400 text-sm py-8 text-center border-2 border-dashed border-slate-100 rounded-xl">
              No messaging channels configured yet. Click "Add Channel" to connect your first WhatsApp or Messenger page!
            </div>
          ) : (
            <div className="space-y-3">
              {channels.map(ch => (
                <div key={ch.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0
                      ${ch.type === 'whatsapp' ? 'bg-emerald-500 shadow-emerald-100'
                        : ch.type === 'messenger' ? 'bg-blue-500 shadow-blue-100'
                        : ch.type === 'tiktok' ? 'bg-slate-800 shadow-slate-200'
                        : 'bg-gradient-to-tr from-pink-500 via-purple-500 to-orange-500'}`}>
                      {ch.type === 'whatsapp' ? <MessageCircle size={20} />
                        : ch.type === 'messenger' ? <MessageSquare size={20} />
                        : ch.type === 'tiktok' ? <Music size={20} />
                        : <Globe size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800 text-sm">{ch.name}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase
                          ${ch.type === 'whatsapp' ? 'bg-emerald-100 text-emerald-700'
                            : ch.type === 'messenger' ? 'bg-blue-100 text-blue-700'
                            : ch.type === 'tiktok' ? 'bg-slate-100 text-slate-700'
                            : 'bg-purple-100 text-purple-700'}`}>
                          {ch.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {ch.type === 'whatsapp' ? `Phone Number ID: ${ch.phone_number_id || 'N/A'}`
                          : ch.type === 'tiktok' ? `Account: ${ch.tiktok_account_id || ch.consultant || 'N/A'}`
                          : `Page ID: ${ch.page_id || 'N/A'}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {(ch.type === 'messenger' || ch.type === 'instagram' || ch.type === 'tiktok') && (
                      <button
                        onClick={() => syncHistory(ch)}
                        disabled={syncingId !== null}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60 flex items-center gap-1"
                      >
                        {syncingId === ch.id ? (
                          <>
                            <Loader2 size={13} className="animate-spin" /> Syncing…
                          </>
                        ) : (
                          <>
                            <RefreshCw size={13} /> Sync History
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => removeChannel(ch)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      title="Remove Channel"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Meta Config Card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-2.5 px-5 py-3 border-b bg-indigo-50 text-indigo-800 border-indigo-100">
          <Settings2 size={18} />
          <span className="font-semibold text-sm">Global Meta & Conversion API Configurations</span>
        </div>
        <form onSubmit={saveConfig} className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block flex items-center gap-1">
                <Key size={12} className="text-slate-400" /> Page Access Token
              </label>
              <input
                type="password"
                value={config.page_access_token}
                onChange={e => setConfig(c => ({ ...c, page_access_token: e.target.value }))}
                placeholder="EAAGz..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
              <p className="text-[10px] text-slate-400 mt-1">Used to pull Lead Ads and sync Facebook Messenger history.</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Webhook Verify Token</label>
              <input
                type="text"
                value={config.verify_token}
                onChange={e => setConfig(c => ({ ...c, verify_token: e.target.value }))}
                placeholder="eduexpress_verify_2024"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700"
              />
              <p className="text-[10px] text-slate-400 mt-1">Match this in the Facebook Developer App Webhook setup.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-50 pt-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Facebook Pixel ID</label>
              <input
                type="text"
                value={config.pixel_id}
                onChange={e => setConfig(c => ({ ...c, pixel_id: e.target.value }))}
                placeholder="e.g. 1234567890"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Conversion API Token</label>
              <input
                type="password"
                value={config.capi_token}
                onChange={e => setConfig(c => ({ ...c, capi_token: e.target.value }))}
                placeholder="CAPI Access Token"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Pixel Test Event Code</label>
              <input
                type="text"
                value={config.test_event_code}
                onChange={e => setConfig(c => ({ ...c, test_event_code: e.target.value }))}
                placeholder="TEST12345"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono uppercase"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={savingConfig}
              className="text-sm px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-60"
            >
              {savingConfig ? 'Saving…' : 'Save Meta Configuration'}
            </button>
          </div>
        </form>
      </div>

      {/* Add Channel Modal */}
      {modal && (
        <ChannelModal
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); loadData(); }}
          verifyToken={config.verify_token}
        />
      )}
    </div>
  );
}

function ChannelModal({ onClose, onSaved, verifyToken }) {
  const [form, setForm] = useState({
    type: 'whatsapp',
    name: '',
    phone_number_id: '',
    waba_id: '',
    page_id: '',
    ig_account_id: '',
    tiktok_account_id: '',
    access_token: '',
    webhook_verify_token: verifyToken || 'eduexpress_verify_2024',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.createChannel(form);
      toast.success(`Channel "${form.name}" created successfully`);
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to create channel');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-slate-800">Add Messaging Channel</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={save} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Channel Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              >
                <option value="whatsapp">WhatsApp Cloud API</option>
                <option value="messenger">Facebook Messenger</option>
                <option value="instagram">Instagram Direct</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Friendly Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Primary WhatsApp Support"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>

          {form.type === 'whatsapp' && (
            <div className="grid grid-cols-2 gap-3 border-t border-slate-50 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Phone Number ID</label>
                <input
                  type="text"
                  required
                  value={form.phone_number_id}
                  onChange={e => setForm(f => ({ ...f, phone_number_id: e.target.value }))}
                  placeholder="e.g. 1045763..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">WhatsApp Business Account (WABA) ID</label>
                <input
                  type="text"
                  required
                  value={form.waba_id}
                  onChange={e => setForm(f => ({ ...f, waba_id: e.target.value }))}
                  placeholder="e.g. 1018590..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
          )}

          {form.type === 'messenger' && (
            <div className="border-t border-slate-50 pt-2">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Facebook Page ID</label>
              <input
                type="text"
                required
                value={form.page_id}
                onChange={e => setForm(f => ({ ...f, page_id: e.target.value }))}
                placeholder="e.g. 10928374..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono"
              />
            </div>
          )}

          {form.type === 'instagram' && (
            <div className="grid grid-cols-2 gap-3 border-t border-slate-50 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Instagram Professional Account ID</label>
                <input
                  type="text"
                  required
                  value={form.ig_account_id}
                  onChange={e => setForm(f => ({ ...f, ig_account_id: e.target.value }))}
                  placeholder="e.g. 178414..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Linked Facebook Page ID</label>
                <input
                  type="text"
                  required
                  value={form.page_id}
                  onChange={e => setForm(f => ({ ...f, page_id: e.target.value }))}
                  placeholder="e.g. 10928374..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
          )}

          {form.type === 'tiktok' && (
            <div className="grid grid-cols-2 gap-3 border-t border-slate-50 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">TikTok Account ID</label>
                <input
                  type="text"
                  required
                  value={form.tiktok_account_id}
                  onChange={e => setForm(f => ({ ...f, tiktok_account_id: e.target.value }))}
                  placeholder="e.g. @eduexpress or 1234567890"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Consultant (optional)</label>
                <input
                  type="text"
                  value={form.consultant}
                  onChange={e => setForm(f => ({ ...f, consultant: e.target.value }))}
                  placeholder="e.g. Abdullah Al Rakib"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          <div className="border-t border-slate-50 pt-2">
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Channel Access Token (leave blank to use Global Token)</label>
            <input
              type="password"
              value={form.access_token}
              onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))}
              placeholder="Defaults to Global Page Access Token if empty"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 bg-slate-50/50 -mx-5 -mb-5 px-5 py-3">
            <button type="button" onClick={onClose} className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 bg-white">Cancel</button>
            <button type="submit" disabled={saving}
              className="text-sm px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Creating…' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


/* ─────────────────────── DOCUMENT TEMPLATES ─────────────────────── */
function DocTemplateManager({ destinations, templates, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [data, setData] = useState({});
  const [newDoc, setNewDoc] = useState('');
  const [activeDest, setActiveDest] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const base = {};
    for (const dest of destinations) {
      base[dest] = templates[dest] || [];
    }
    setData(base);
    if (destinations.length > 0 && !activeDest) setActiveDest(destinations[0]);
  }, [destinations, templates]);

  const addDoc = () => {
    const val = newDoc.trim();
    if (!val || !activeDest) return;
    if (data[activeDest]?.includes(val)) { toast.error('Document already in list'); return; }
    setData(d => ({ ...d, [activeDest]: [...(d[activeDest] || []), val] }));
    setNewDoc('');
  };

  const removeDoc = (dest, index) => {
    setData(d => ({ ...d, [dest]: d[dest].filter((_, i) => i !== index) }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.saveSettings('settings_docTemplates', data);
      toast.success('Document templates saved');
      setEditing(false);
      onSaved();
    } catch (e) { toast.error(e.message || 'Failed to save'); }
    setSaving(false);
  };

  const cancel = () => {
    const base = {};
    for (const dest of destinations) base[dest] = templates[dest] || [];
    setData(base);
    setEditing(false);
    setNewDoc('');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b bg-slate-50 text-slate-700 border-slate-100">
        <FileText size={16} className="text-slate-500" />
        <span className="font-semibold text-sm flex-grow">Document Templates per Destination</span>
        {!editing ? (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 h-8 rounded-lg border border-slate-300 hover:bg-white transition-colors">
            <Pencil size={11} /> Edit
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button onClick={cancel} disabled={saving}
              className="text-xs px-2.5 h-8 rounded-lg border border-slate-300 text-slate-600 hover:bg-white bg-white font-medium">Cancel</button>
            <button onClick={save} disabled={saving}
              className="text-xs px-3 h-8 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold flex items-center gap-1">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>
      <div className="p-5 space-y-4">
        <p className="text-xs text-slate-500">Define the required document checklist for each destination. When a new application is created, these documents are auto-seeded.</p>
        {destinations.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No destinations configured. Add destinations first.</p>
        ) : (
          <div className="flex gap-4">
            {/* Destination tabs */}
            <div className="w-40 flex-shrink-0 space-y-1">
              {destinations.map(dest => (
                <button key={dest} onClick={() => setActiveDest(dest)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all ${activeDest === dest ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                  {dest}
                </button>
              ))}
            </div>
            {/* Document list for active destination */}
            <div className="flex-1 min-w-0">
              {activeDest && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">{activeDest} Required Documents</p>
                  <div className="flex flex-wrap gap-2">
                    {(data[activeDest] || []).map((doc, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 px-2.5 py-1.5 rounded-lg border border-blue-100">
                        {editing ? (
                          <>
                            {doc}
                            <button onClick={() => removeDoc(activeDest, i)} className="text-blue-400 hover:text-rose-500"><X size={12} /></button>
                          </>
                        ) : (
                          <span className="flex items-center gap-1"><CheckCircle2 size={11} /> {doc}</span>
                        )}
                      </span>
                    ))}
                    {(data[activeDest] || []).length === 0 && (
                      <p className="text-xs text-slate-400 italic">No documents configured for {activeDest}.</p>
                    )}
                  </div>
                  {editing && (
                    <form onSubmit={e => { e.preventDefault(); addDoc(); }} className="flex gap-2 mt-3">
                      <input type="text" value={newDoc} onChange={e => setNewDoc(e.target.value)}
                        placeholder={`Add document for ${activeDest}…`}
                        className="flex-grow border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25" />
                      <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700">Add</button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── COMPANY PROFILE SETTINGS ─────────────────────── */
function CompanyProfileSettings() {
  const [profile, setProfile] = useState({
    company_name: 'EduExpress International',
    tagline: 'Student Consultancy & Recruitment',
    address: 'Dhanmondi, Dhaka, Bangladesh',
    phone: '',
    email: '',
    website: '',
    currency: 'BDT',
    timezone: 'Asia/Dhaka',
    working_days: 'Sun-Thu',
    working_hours: '09:30 - 18:00',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const toast = useToast();

  useEffect(() => {
    api.settings().then(s => {
      if (s?.companyProfile) setProfile(s.companyProfile);
    }).catch(() => {});
  }, []);

  const update = (k, v) => setProfile(p => ({ ...p, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.saveSettings('settings_companyProfile', profile);
      toast.success('Company profile saved');
      setMsg('✓ Saved successfully');
      setTimeout(() => setMsg(''), 2500);
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* Business Rules Card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-2.5 px-5 py-3 border-b bg-blue-50 text-blue-700 border-blue-100">
          <Lock size={18} />
          <span className="font-semibold text-sm flex-1">Business Rules & Data Isolation</span>
          <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Active</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Globe size={14} className="text-amber-600" />
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">China Market</span>
              </div>
              <p className="text-sm text-amber-900 font-medium">Isolated Data Pipeline</p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                China applications are completely separate from the Bangladesh office. 
                Only <strong>Founder & CEO</strong> and <strong>Application Manager</strong> can access China data. 
                Managing Director and all other roles are explicitly excluded.
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} className="text-emerald-600" />
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Bangladesh Office</span>
              </div>
              <p className="text-sm text-emerald-900 font-medium">B2C + B2B Collection</p>
              <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                <strong>In-House:</strong> Online/offline marketing leads (direct).<br />
                <strong>B2B / Agent:</strong> Partner agent submissions.<br />
                All chat conversions auto-tagged to Bangladesh pipeline.
              </p>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Role Access Matrix</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {[
                { role: 'Founder & CEO', access: 'Everything + China', color: 'text-purple-700 bg-purple-50 border-purple-100' },
                { role: 'Managing Director', access: 'Everything except China', color: 'text-indigo-700 bg-indigo-50 border-indigo-100' },
                { role: 'Investor', access: 'Read-only, no chat', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
                { role: 'Application Manager', access: 'Apps + China data', color: 'text-amber-700 bg-amber-50 border-amber-100' },
                { role: 'Marketing Manager', access: 'Marketing + all chats', color: 'text-rose-700 bg-rose-50 border-rose-100' },
                { role: 'Consultant', access: 'Own leads only', color: 'text-blue-700 bg-blue-50 border-blue-100' },
              ].map(r => (
                <div key={r.role} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${r.color}`}>
                  <Shield size={12} />
                  <div>
                    <p className="font-bold">{r.role}</p>
                    <p className="text-[10px] opacity-80">{r.access}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Company Details Form */}
      <form onSubmit={save} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-2.5 px-5 py-3 border-b bg-slate-50 text-slate-700 border-slate-100">
          <Building size={18} />
          <span className="font-semibold text-sm flex-1">Organisation Details</span>
          <span className="text-xs text-slate-400">Saved locally in CRM settings</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Company Name</label>
              <input value={profile.company_name} onChange={e => update('company_name', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Tagline</label>
              <input value={profile.tagline} onChange={e => update('tagline', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Office Address</label>
              <input value={profile.address} onChange={e => update('address', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Contact Phone</label>
              <input value={profile.phone} onChange={e => update('phone', e.target.value)}
                placeholder="+880..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Contact Email</label>
              <input type="email" value={profile.email} onChange={e => update('email', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Website</label>
              <input value={profile.website} onChange={e => update('website', e.target.value)}
                placeholder="https://..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Currency</label>
              <select value={profile.currency} onChange={e => update('currency', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white">
                <option value="BDT">BDT (৳) — Bangladeshi Taka</option>
                <option value="USD">USD ($) — US Dollar</option>
                <option value="CNY">CNY (¥) — Chinese Yuan</option>
                <option value="EUR">EUR (€) — Euro</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Timezone</label>
              <select value={profile.timezone} onChange={e => update('timezone', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white">
                <option value="Asia/Dhaka">Asia/Dhaka (GMT+6)</option>
                <option value="Asia/Shanghai">Asia/Shanghai (GMT+8)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Working Days</label>
              <input value={profile.working_days} onChange={e => update('working_days', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Working Hours</label>
              <input value={profile.working_hours} onChange={e => update('working_hours', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            </div>
          </div>

          {msg && <div className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">{msg}</div>}

          <div className="flex justify-end pt-1">
            <button type="submit" disabled={saving}
              className="text-sm px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
              <Save size={14} /> {saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ─────────────────────── SYSTEM HEALTH CARD ─────────────────────── */
function SystemHealthCard() {
  const [dbSize, setDbSize] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef(null);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    fetch('/api/health/db-size', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setDbSize(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleBackup = async () => {
    try {
      const res = await fetch('/api/health/backup', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('Backup failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crm_backup_${new Date().toISOString().slice(0,10)}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Database backup downloaded');
    } catch (e) {
      toast.error('Backup failed: ' + e.message);
    }
  };

  const handleRestore = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    e.target.value = '';

    const confirmed = await confirm({
      title: 'Restore Database',
      message: 'WARNING: Restoring this backup will completely overwrite your current database. The server will restart automatically. Are you sure you want to proceed?',
      confirmText: 'Yes, Restore Now',
      danger: true
    });
    if (!confirmed) return;

    try {
      setRestoring(true);
      const buffer = await file.arrayBuffer();
      const res = await fetch('/api/health/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer,
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restore failed');
      
      toast.success(data.message);
      
      setTimeout(() => {
        window.location.reload();
      }, 5000);
      
    } catch (e) {
      toast.error('Restore failed: ' + e.message);
      setRestoring(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-5 py-3 border-b bg-emerald-50 text-emerald-700 border-emerald-100">
        <Activity size={18} />
        <span className="font-semibold text-sm flex-1">System Health</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${loading ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>
          {loading ? 'Checking…' : 'Healthy'}
        </span>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Database</p>
            <p className="text-lg font-bold text-slate-800">{dbSize ? `${(dbSize.bytes / 1024 / 1024).toFixed(1)} MB` : '—'}</p>
            <p className="text-xs text-slate-400">SQLite in-memory with WAL</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Build</p>
            <p className="text-lg font-bold text-slate-800">Vite + React 19</p>
            <p className="text-xs text-slate-400">Tailwind CSS 4 · Lucide icons</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Backups</p>
            <p className="text-lg font-bold text-slate-800">Automated</p>
            <p className="text-xs text-slate-400">Daily local backups enabled</p>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <input type="file" accept=".db" ref={fileInputRef} onChange={handleRestore} className="hidden" />
          <button onClick={handleBackup} disabled={restoring}
            className="flex items-center gap-1.5 text-xs font-medium bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50">
            <Database size={13} /> Download Backup
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={restoring}
            className="flex items-center gap-1.5 text-xs font-medium bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-xl hover:bg-red-100 shadow-sm transition-colors disabled:opacity-50">
            <Upload size={13} /> {restoring ? 'Restoring...' : 'Upload & Restore'}
          </button>
          <button onClick={() => window.open('/api/health/export-json', '_blank')} disabled={restoring}
            className="flex items-center gap-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">
            <FileText size={13} /> Export JSON
          </button>
        </div>
      </div>
    </div>
  );
}

function LeadPipelineToolsCard() {
  const toast = useToast();
  const [running, setRunning] = useState(false);

  const runCleanup = async () => {
    setRunning(true);
    try {
      const res = await api.autoCleanupLeads();
      toast.success(`Successfully cleaned up ${res.cleaned} stale leads.`);
    } catch (e) {
      toast.error('Cleanup failed: ' + e.message);
    }
    setRunning(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-5 py-3 border-b bg-indigo-50 text-indigo-700 border-indigo-100">
        <Filter size={18} />
        <span className="font-semibold text-sm flex-1">Pipeline Maintenance</span>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Auto-Cleanup Stale Leads</h4>
            <p className="text-xs text-slate-500 mt-1">Moves "New Leads" older than 3 days to "Follow-up" status automatically.</p>
          </div>
          <button 
            onClick={runCleanup} 
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {running ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Run Cleanup Now
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── ROLES & DESIGNATIONS ─────────────────────── */
function RolesDesignationsCard({ employees }) {
  const roles = useMemo(() => {
    const map = new Map();
    for (const emp of employees) {
      if (!emp.role) continue;
      const key = emp.role.toLowerCase().trim();
      if (!map.has(key)) map.set(key, { role: emp.role, count: 0, employees: [] });
      map.get(key).count++;
      map.get(key).employees.push(emp);
    }
    return Array.from(map.values());
  }, [employees]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b bg-slate-50 text-slate-700 border-slate-100">
        <Shield size={16} className="text-slate-500" />
        <span className="font-semibold text-sm flex-grow">Roles & Designations</span>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-xs text-slate-500">Active consultants and their roles across the system. These are pulled from the HR module and used in Leads, Applications, and Finance.</p>
        {employees.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No active consultants found. Add consultants in the HR module.</p>
        ) : (
          <div className="space-y-3">
            {roles.map((r, i) => (
              <div key={i} className="border border-slate-100 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{r.role}</span>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{r.count} consultant{r.count > 1 ? 's' : ''}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.employees.map(emp => (
                    <span key={emp.id} className="text-xs font-medium bg-violet-50 text-violet-700 px-2 py-1 rounded-lg border border-violet-100 flex items-center gap-1">
                      <Users size={10} /> {emp.name}
                      {emp.emp_id && <span className="text-[10px] text-violet-400 font-mono">#{emp.emp_id}</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {/* List all consultants with IDs */}
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">All Active Consultants (with IDs)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {employees.map(emp => (
                  <div key={emp.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold">
                        {emp.name?.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{emp.name}</p>
                        <p className="text-[10px] text-slate-400">{emp.role || 'No role'} · {emp.email || 'No email'}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">ID:{emp.id} · EMP:{emp.emp_id || '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
