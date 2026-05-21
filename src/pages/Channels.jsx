import { useState, useEffect } from 'react';
import { api } from '../api';
import {
  Plus, Edit2, Trash2, CheckCircle, RefreshCw,
  MessageCircle, Globe, Key, Hash, Zap,
  ChevronDown, ChevronUp, AlertTriangle, X, Save
} from 'lucide-react';

const InstagramIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
  </svg>
);

const CHANNEL_TYPES = [
  { value: 'whatsapp', label: 'WhatsApp', color: 'bg-green-500', light: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'messenger', label: 'Messenger', color: 'bg-blue-500', light: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'instagram', label: 'Instagram', color: 'bg-pink-500', light: 'bg-pink-50 text-pink-700 border-pink-200' },
];

const channelMeta = (type) => CHANNEL_TYPES.find(t => t.value === type) || CHANNEL_TYPES[0];

const ChannelIcon = ({ type, size = 16 }) => {
  if (type === 'whatsapp') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
  if (type === 'instagram') return <InstagramIcon size={size} />;
  return <MessageCircle size={size} />;
};

const emptyForm = { name: '', consultant: '', type: 'whatsapp', phone_number_id: '', waba_id: '', page_id: '', ig_account_id: '', access_token: '', webhook_verify_token: '', active: 1 };

export default function Channels() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [syncing, setSyncing] = useState(null); // channel id being synced
  const [syncOpen, setSyncOpen] = useState(null); // channel id with dropdown open

  const load = () => {
    setLoading(true);
    api.channels().then(d => { setChannels(d); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const syncChannel = async (ch, months = 6) => {
    setSyncing(ch.id);
    try {
      const result = await api.syncChannel(ch.id, months);
      showToast(`✅ ${result.channel}: ${result.imported} new messages from ${result.conversations} conversations imported (${result.skipped} already existed)`);
    } catch (e) {
      showToast(e.message || 'Sync failed — check your access token permissions', 'error');
    }
    setSyncing(null);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (ch) => {
    setEditing(ch.id);
    setForm({ ...ch, access_token: ch.access_token || '' });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) return showToast('Channel name is required', 'error');
    if (!form.access_token.trim()) return showToast('Access token is required', 'error');
    setSaving(true);
    try {
      if (editing) await api.updateChannel(editing, form);
      else await api.createChannel(form);
      showToast(editing ? 'Channel updated' : 'Channel added');
      setShowForm(false);
      load();
    } catch (e) {
      showToast(e.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.deleteChannel(id);
      showToast('Channel removed');
      setDeleteConfirm(null);
      load();
    } catch (e) {
      showToast('Failed to delete', 'error');
    }
  };

  const toggleActive = async (ch) => {
    try {
      await api.updateChannel(ch.id, { ...ch, active: ch.active ? 0 : 1 });
      load();
    } catch {}
  };

  const byType = (type) => channels.filter(c => c.type === type);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transition-all
          ${toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Messaging Channels</h2>
          <p className="text-sm text-slate-500 mt-0.5">Connect WhatsApp, Messenger & Instagram accounts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <RefreshCw size={16} />
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
            <Plus size={16} /> Add Channel
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {CHANNEL_TYPES.map(ct => {
          const list = byType(ct.value);
          const active = list.filter(c => c.active).length;
          return (
            <div key={ct.value} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 ${ct.color} rounded-xl flex items-center justify-center text-white`}>
                  <ChannelIcon type={ct.value} size={17} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{ct.label}</p>
                  <p className="text-xs text-slate-400">{list.length} account{list.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 bg-green-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-green-600">{active}</p>
                  <p className="text-xs text-green-500">Active</p>
                </div>
                <div className="flex-1 bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-slate-500">{list.length - active}</p>
                  <p className="text-xs text-slate-400">Inactive</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Channel list */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <RefreshCw size={24} className="animate-spin text-blue-400 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">Loading channels...</p>
        </div>
      ) : channels.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageCircle size={24} className="text-slate-400" />
          </div>
          <p className="text-slate-700 font-semibold mb-1">No channels yet</p>
          <p className="text-slate-400 text-sm mb-4">Add your first WhatsApp, Messenger, or Instagram account</p>
          <button onClick={openAdd} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
            Add Channel
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map(ch => {
            const meta = channelMeta(ch.type);
            const expanded = expandedId === ch.id;
            return (
              <div key={ch.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <div className={`w-10 h-10 ${meta.color} rounded-xl flex items-center justify-center text-white flex-shrink-0`}>
                    <ChannelIcon type={ch.type} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-slate-800 text-sm">{ch.name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.light}`}>{meta.label}</span>
                      {ch.consultant && (
                        <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                          {ch.consultant}
                        </span>
                      )}
                      {ch.active ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span>Active
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {ch.type === 'whatsapp' && `Phone ID: ${ch.phone_number_id || '—'}`}
                      {ch.type === 'messenger' && `Page ID: ${ch.page_id || '—'}`}
                      {ch.type === 'instagram' && `IG Account: ${ch.ig_account_id || '—'}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Sync history — Messenger & Instagram only */}
                    {(ch.type === 'messenger' || ch.type === 'instagram') && (
                      <div className="relative">
                        <button
                          disabled={syncing === ch.id}
                          onClick={() => setSyncOpen(syncOpen === ch.id ? null : ch.id)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border text-indigo-600 border-indigo-200 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed">
                          <RefreshCw size={13} className={syncing === ch.id ? 'animate-spin' : ''} />
                          {syncing === ch.id ? 'Syncing…' : 'Sync History'}
                          <ChevronDown size={11} className={syncOpen === ch.id ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        </button>
                        {syncOpen === ch.id && syncing !== ch.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setSyncOpen(null)} />
                            <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-20 min-w-[160px] py-1">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 pt-2 pb-1">Import last…</p>
                              {[1, 3, 6, 12].map(m => (
                                <button key={m} onClick={() => { setSyncOpen(null); syncChannel(ch, m); }}
                                  className="block w-full text-left text-xs px-3 py-2 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 transition-colors">
                                  {m === 1 ? '1 month' : `${m} months`}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    <button onClick={() => toggleActive(ch)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border
                        ${ch.active ? 'text-slate-500 border-slate-200 hover:bg-slate-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}>
                      {ch.active ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => openEdit(ch)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => setDeleteConfirm(ch.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={15} />
                    </button>
                    <button onClick={() => setExpandedId(expanded ? null : ch.id)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                      {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-slate-100 px-4 py-4 bg-slate-50 grid grid-cols-2 gap-3">
                    {ch.phone_number_id && <InfoRow label="Phone Number ID" value={ch.phone_number_id} icon={<Hash size={13}/>} />}
                    {ch.waba_id && <InfoRow label="WABA ID" value={ch.waba_id} icon={<Hash size={13}/>} />}
                    {ch.page_id && <InfoRow label="Page ID" value={ch.page_id} icon={<Globe size={13}/>} />}
                    {ch.ig_account_id && <InfoRow label="IG Account ID" value={ch.ig_account_id} icon={<InstagramIcon size={13}/>} />}
                    <InfoRow label="Access Token" value={ch.access_token || '••••••••'} icon={<Key size={13}/>} masked />
                    {ch.webhook_verify_token && <InfoRow label="Verify Token" value={ch.webhook_verify_token} icon={<Zap size={13}/>} />}
                  </div>
                )}

                {deleteConfirm === ch.id && (
                  <div className="border-t border-red-100 bg-red-50 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-700 text-sm">
                      <AlertTriangle size={15} />
                      <span>Delete <strong>{ch.name}</strong>? This cannot be undone.</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-white transition-colors">Cancel</button>
                      <button onClick={() => remove(ch.id)} className="px-3 py-1.5 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors">Delete</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Webhook setup guide */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-6">
        <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2"><Zap size={16}/> Webhook Setup</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white/70 rounded-xl p-3">
            <p className="font-semibold text-slate-700 mb-1">1. Callback URL</p>
            <code className="text-xs bg-slate-100 px-2 py-1 rounded block break-all text-blue-700">
              https://your-domain.com/webhook/meta
            </code>
          </div>
          <div className="bg-white/70 rounded-xl p-3">
            <p className="font-semibold text-slate-700 mb-1">2. Subscribed Fields</p>
            <p className="text-slate-500 text-xs">messages, message_deliveries, messaging_postbacks, leadgen</p>
          </div>
          <div className="bg-white/70 rounded-xl p-3">
            <p className="font-semibold text-slate-700 mb-1">3. Verify Token</p>
            <p className="text-slate-500 text-xs">Set in Meta Developer Console → matches your channel verify token</p>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">{editing ? 'Edit Channel' : 'Add Channel'}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
            </div>
            <div className="p-5 space-y-4">
              <FormField label="Channel Name *" placeholder="e.g. EduExpress WhatsApp Main">
                <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. UK Team WhatsApp" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </FormField>

              <FormField label="Consultant / Owner" hint="Which consultant manages this account">
                <input value={form.consultant} onChange={e => setForm(f => ({...f, consultant: e.target.value}))} placeholder="e.g. Rakib Ahmed" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </FormField>

              <FormField label="Platform *">
                <div className="grid grid-cols-3 gap-2">
                  {CHANNEL_TYPES.map(ct => (
                    <button key={ct.value} onClick={() => setForm(f => ({...f, type: ct.value}))}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-sm font-medium transition-all
                        ${form.type === ct.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                      <ChannelIcon type={ct.value} size={20} />
                      {ct.label}
                    </button>
                  ))}
                </div>
              </FormField>

              {form.type === 'whatsapp' && <>
                <FormField label="Phone Number ID" hint="From WhatsApp Business API app settings">
                  <input value={form.phone_number_id} onChange={e => setForm(f => ({...f, phone_number_id: e.target.value}))} placeholder="123456789012345" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                </FormField>
                <FormField label="WABA ID" hint="WhatsApp Business Account ID">
                  <input value={form.waba_id} onChange={e => setForm(f => ({...f, waba_id: e.target.value}))} placeholder="987654321098765" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                </FormField>
              </>}

              {form.type === 'messenger' && (
                <FormField label="Page ID" hint="Facebook Page numeric ID">
                  <input value={form.page_id} onChange={e => setForm(f => ({...f, page_id: e.target.value}))} placeholder="123456789012" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                </FormField>
              )}

              {form.type === 'instagram' && <>
                <FormField label="Instagram Account ID">
                  <input value={form.ig_account_id} onChange={e => setForm(f => ({...f, ig_account_id: e.target.value}))} placeholder="17841400000000" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                </FormField>
                <FormField label="Page ID" hint="Connected Facebook Page ID">
                  <input value={form.page_id} onChange={e => setForm(f => ({...f, page_id: e.target.value}))} placeholder="123456789012" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                </FormField>
              </>}

              <FormField label="Access Token *" hint="Page / System User Access Token">
                <input type="password" value={form.access_token} onChange={e => setForm(f => ({...f, access_token: e.target.value}))} placeholder="EAABwzLixnjY..." className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
              </FormField>

              <FormField label="Webhook Verify Token" hint="Secret string used for webhook verification">
                <input value={form.webhook_verify_token} onChange={e => setForm(f => ({...f, webhook_verify_token: e.target.value}))} placeholder="my_secret_verify_token" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
              </FormField>

              <div className="flex items-center gap-3 pt-1">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={!!form.active} onChange={e => setForm(f => ({...f, active: e.target.checked ? 1 : 0}))} className="sr-only peer" />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:bg-blue-500 peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                </label>
                <span className="text-sm text-slate-700 font-medium">Active</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors">
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Saving…' : (editing ? 'Update' : 'Add Channel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}
        {hint && <span className="ml-1 font-normal text-slate-400">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function InfoRow({ label, value, icon, masked }) {
  return (
    <div className="bg-white rounded-xl p-3 border border-slate-100">
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">{icon}{label}</div>
      <p className="text-xs font-mono text-slate-700 truncate">{masked ? '••••••••••••' : value}</p>
    </div>
  );
}
