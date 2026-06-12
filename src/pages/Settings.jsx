import { useEffect, useState } from 'react';
import { api } from '../api';
import { Info, Wifi, Clock, Users, Globe, Tag, CreditCard, Shield, Plus, Pencil, Trash2, Mail, X, Loader2, MapPin, Save, Upload, Megaphone, StickyNote, MessageCircle, MessageSquare, RefreshCw, Key, Settings2 } from 'lucide-react';
import ExcelImport from '../components/ExcelImport';
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
    { id: 'users',       label: 'Users & Access',    icon: Shield,   desc: 'Manage login accounts and permissions' },
    { id: 'integration', label: 'Integrations',      icon: Globe,    desc: 'WhatsApp, Messenger, and Meta API' },
    { id: 'office',      label: 'Office & Hours',    icon: MapPin,   desc: 'Geofence, Wi-Fi, and attendance hours' },
    { id: 'reference',   label: 'Reference Lists',   icon: Tag,      desc: 'Dropdowns used across the CRM' },
    { id: 'tools',       label: 'Broadcast & Tools', icon: Megaphone,desc: 'Team broadcasts, data import, system info' },
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
              <EditableCard icon={<Tag size={16} />} title="Lead Statuses" color="sky"
                listKey="settings_leadStatuses" items={settings.leadStatuses || []} onSaved={reloadSettings} />
              <EditableCard icon={<Globe size={16} />} title="Destinations" color="emerald"
                listKey="settings_destinations" items={settings.destinations || []} onSaved={reloadSettings} />
              <EditableCard icon={<Wifi size={16} />} title="Lead Sources" color="orange"
                listKey="settings_leadSources" items={settings.leadSources || []} onSaved={reloadSettings} />
              <EditableCard icon={<CreditCard size={16} />} title="Payment Statuses" color="rose"
                listKey="settings_paymentStatuses" items={settings.paymentStatuses || []} onSaved={reloadSettings} />
              <EditableCard icon={<Clock size={16} />} title="File Stages" color="amber"
                listKey="settings_fileStages" items={settings.fileStages || []} onSaved={reloadSettings} />
              <EditableCard icon={<CreditCard size={16} />} title="Income Categories" color="blue"
                listKey="settings_incomeCategories" items={settings.incomeCategories || []} onSaved={reloadSettings} />
              <EditableCard icon={<CreditCard size={16} />} title="Expense Categories" color="rose"
                listKey="settings_expenseCategories" items={settings.expenseCategories || []} onSaved={reloadSettings} />
            </div>
          </div>
        )}

        {/* BROADCAST & TOOLS */}
        {activeTab === 'tools' && (
          <div className="space-y-5">
            <BroadcastManager />

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 bg-sky-50 text-sky-700">
                <Upload size={17} />
                <span className="font-semibold text-sm">Import from Excel</span>
              </div>
              <div className="p-5">
                <ExcelImport />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 bg-slate-50 text-slate-600">
                <Info size={17} />
                <span className="font-semibold text-sm">System Information</span>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  <InfoRow label="Organisation" value="EduExpress International" />
                  <InfoRow label="Core Version" value="1.0 · Web Edition" />
                  <InfoRow label="Office Wi-Fi SSID" value="EduExpress International" />
                  <InfoRow label="Currency" value="BDT (৳)" />
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function Card({ icon, title, color, children }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
    sky: 'bg-sky-50 text-sky-600 border-sky-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className={`flex items-center gap-2.5 px-5 py-3 border-b ${colors[color]}`}>
        {icon}
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className="text-slate-700 font-medium mt-0.5">{value}</p>
    </div>
  );
}

function EditableCard({ icon, title, color, listKey, items = [], onSaved }) {
  const [editing, setEditing] = useState(false);
  const [list, setList] = useState(items);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setList(items);
  }, [items]);

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
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-current hover:bg-white/30 transition-colors"
          >
            <Pencil size={11} /> Edit List
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={cancel}
              disabled={saving}
              className="text-xs px-2.5 py-1 rounded-lg border border-slate-300 text-slate-600 hover:bg-white bg-white font-medium"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold flex items-center gap-1"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {editing && (
          <form onSubmit={add} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`Add new item…`}
              className="flex-grow border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25"
            />
            <button
              type="submit"
              className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1"
            >
              <Plus size={13} /> Add
            </button>
          </form>
        )}

        <div className="flex flex-wrap gap-2">
          {list.length === 0 ? (
            <p className="text-slate-400 text-xs italic py-2">No items in the list</p>
          ) : (
            list.map((item, idx) => (
              <span
                key={item}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-all ${c.tag}`}
              >
                {item}
                {editing && (
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="p-0.5 rounded-full hover:bg-black/10 text-current/70 hover:text-current transition-colors"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))
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

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-2.5 px-5 py-3 border-b bg-indigo-50 text-indigo-600 border-indigo-100">
          <Shield size={18} />
          <span className="font-semibold text-sm flex-1">Users & Access</span>
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
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800 text-sm truncate">{u.name || u.email}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase
                        ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {u.role}
                      </span>
                      {!u.active && <span className="text-[10px] font-bold bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full uppercase">Disabled</span>}
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Mail size={11} /> {u.email}
                      {u.consultant_name && <span className="ml-1">· Maps to <strong>{u.consultant_name}</strong></span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleActive(u)} title={u.active ? 'Disable' : 'Enable'}
                      className={`text-xs px-2.5 py-1.5 rounded-lg font-medium border ${u.active ? 'text-slate-500 border-slate-200 hover:bg-slate-50' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}>
                      {u.active ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => setModal({ mode: 'edit', user: u })}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={14} /></button>
                    <button onClick={() => remove(u)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-3">
            💡 The <strong>Consultant Name</strong> on a user must match the <em>Assigned Consultant</em> field on a lead for it to appear in their inbox.
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
    role: u.role || 'consultant',
    consultant_name: u.consultant_name || '',
    emp_id: u.emp_id || '',
    password: '',
  });
  const [employees, setEmployees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => { api.employees().then(setEmployees).catch(() => {}); }, []);

  const save = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const payload = {
        name: form.name,
        role: form.role,
        consultant_name: form.role === 'consultant' ? form.consultant_name : null,
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">{editing ? 'Edit user' : 'Add user'}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X size={18} /></button>
        </div>
        <form onSubmit={save} className="p-5 space-y-3">
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
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Role</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
              <option value="consultant">Consultant — sees only their assigned leads</option>
              <option value="manager">Application Manager — manages all applications & docs (no Finance/HR/Settings)</option>
              <option value="admin">Admin — full access</option>
            </select>
          </div>
          {form.role === 'consultant' && (
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Consultant name (must match leads' assigned consultant)</label>
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
              Linked employee <span className="text-slate-400 font-normal">(enables auto check-in on login)</span>
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
            <button type="submit" disabled={saving}
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
              <p className="text-[11px] text-slate-400 mt-1">Employees opening the CRM on this network will be automatically checked in.</p>
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
                    className="absolute top-2 right-2 p-1 opacity-50 hover:opacity-100"><Trash2 size={14}/></button>
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
    try {
      const res = await api.syncChannel(channel.id);
      toast.success(`✓ Sync complete: Imported ${res.imported || 0} messages!`);
      loadData();
    } catch (e) {
      toast.error(`Sync error: ${e.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Channels List Card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-2.5 px-5 py-3 border-b bg-emerald-50 text-emerald-800 border-emerald-100">
          <Globe size={18} />
          <span className="font-semibold text-sm flex-grow">Meta Integration Channels (WhatsApp & Messenger)</span>
          <button
            onClick={() => setModal({ mode: 'add' })}
            className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={13} /> Add Channel
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-400">
            Configure integration channels to listen to WhatsApp Business Cloud API messages or Facebook Messenger DMs. 
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
                        : 'bg-gradient-to-tr from-pink-500 via-purple-500 to-orange-500'}`}>
                      {ch.type === 'whatsapp' ? <MessageCircle size={20} /> 
                        : ch.type === 'messenger' ? <MessageSquare size={20} /> 
                        : <Globe size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800 text-sm">{ch.name}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase
                          ${ch.type === 'whatsapp' ? 'bg-emerald-100 text-emerald-700' 
                            : ch.type === 'messenger' ? 'bg-blue-100 text-blue-700' 
                            : 'bg-purple-100 text-purple-700'}`}>
                          {ch.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {ch.type === 'whatsapp' ? `Phone Number ID: ${ch.phone_number_id || 'N/A'}` : `Page ID: ${ch.page_id || 'N/A'}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {ch.type === 'messenger' && (
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
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X size={18} /></button>
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

