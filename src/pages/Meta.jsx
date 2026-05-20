import { useEffect, useState } from 'react';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import {
  Zap, Webhook, BarChart2, Settings, CheckCircle2, XCircle,
  Copy, RefreshCw, ExternalLink, AlertTriangle, Info, Send,
  Megaphone,
} from 'lucide-react';

export default function Meta() {
  const [tab, setTab] = useState('setup');
  const [config, setConfig] = useState({});
  const [stats, setStats] = useState(null);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [form, setForm] = useState({});

  function load() {
    api.metaConfig().then(d => { setConfig(d); setForm(d); });
    api.metaStats().then(setStats);
  }

  useEffect(() => { load(); }, []);

  async function saveConfig(e) {
    e.preventDefault();
    await api.saveMetaConfig(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    load();
  }

  async function testCapi(eventName) {
    setTesting(eventName);
    setTestResult(null);
    try {
      const result = await api.testCapi(eventName);
      setTestResult({ ok: !result.error && !result.skipped, data: result });
    } finally {
      setTesting(null);
    }
  }

  const webhookUrl = `${window.location.protocol}//${window.location.hostname}:3001/webhook/meta`;
  const verifyToken = config.verify_token || 'eduexpress_verify_2024';

  function copy(text) {
    navigator.clipboard.writeText(text);
  }

  const tabs = [
    { id: 'setup', label: 'Setup & Config', icon: Settings },
    { id: 'webhook', label: 'Webhook', icon: Webhook },
    { id: 'capi', label: 'CAPI', icon: Zap },
    { id: 'leads', label: 'Meta Leads', icon: BarChart2 },
  ];

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">f</span>
          Meta Integration
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">Facebook & Instagram Lead Ads · Conversions API (CAPI)</p>
      </div>

      {/* Status banner */}
      <StatusBanner config={config} stats={stats} />

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── SETUP TAB ── */}
      {tab === 'setup' && (
        <div className="space-y-4">
          <ConfigCard title="How to connect Meta Lead Ads" variant="info">
            <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
              <li>Go to <a href="https://developers.facebook.com" target="_blank" className="text-blue-600 hover:underline">developers.facebook.com</a> → create/select your App</li>
              <li>Add the <strong>Lead Ads</strong> product to your app</li>
              <li>Get your <strong>Page Access Token</strong> (permanent) from Graph API Explorer</li>
              <li>Subscribe your webhook URL to the <strong>leadgen</strong> field on your Page</li>
              <li>For CAPI: create a Pixel, get the <strong>Conversions API access token</strong> from Events Manager</li>
              <li>Fill in the credentials below and click Save</li>
            </ol>
          </ConfigCard>

          <form onSubmit={saveConfig} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
            <h3 className="font-semibold text-slate-700">API Credentials</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ConfigField label="Page Access Token" field="page_access_token" form={form} setForm={setForm}
                placeholder="EAA..." type="password" help="Long-lived token from Graph API Explorer" />
              <ConfigField label="App Secret" field="app_secret" form={form} setForm={setForm}
                placeholder="your_app_secret" type="password" help="From App Dashboard → Settings → Basic" />
              <ConfigField label="Meta Pixel ID" field="pixel_id" form={form} setForm={setForm}
                placeholder="123456789012345" help="From Events Manager → Pixel" />
              <ConfigField label="CAPI Access Token" field="capi_token" form={form} setForm={setForm}
                placeholder="EAA..." type="password" help="From Events Manager → Settings → Conversions API" />
              <ConfigField label="Webhook Verify Token" field="verify_token" form={form} setForm={setForm}
                placeholder="eduexpress_verify_2024" help="A secret string you choose — enter same in Meta webhook settings" />
              <ConfigField label="Test Event Code" field="test_event_code" form={form} setForm={setForm}
                placeholder="TEST12345" help="Optional — from Events Manager Test Events tab" />
            </div>

            <h3 className="font-semibold text-slate-700 pt-2 border-t border-slate-100">Office Attendance Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <ConfigField label="Office Open Time" field="office_open" form={form} setForm={setForm}
                placeholder="11:00" type="time" help="Used to calculate late arrivals" />
              <ConfigField label="Grace Period (minutes)" field="grace_minutes" form={form} setForm={setForm}
                placeholder="30" type="number" help="Minutes after open time before marking Late" />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">
                Save Configuration
              </button>
              {saved && (
                <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                  <CheckCircle2 size={16} /> Saved!
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ── WEBHOOK TAB ── */}
      {tab === 'webhook' && (
        <div className="space-y-4">
          <ConfigCard title="Step-by-step: Connect Lead Ads Webhook" variant="info">
            <ol className="text-sm text-slate-600 space-y-1.5 list-decimal list-inside">
              <li>Go to your Facebook App → <strong>Webhooks</strong> product</li>
              <li>Click <strong>Add Subscription</strong> → choose <strong>Page</strong></li>
              <li>Paste the <strong>Callback URL</strong> and <strong>Verify Token</strong> below</li>
              <li>Check the <strong>leadgen</strong> field → Save</li>
              <li>Go to your <strong>Page</strong> → Subscribed Apps → subscribe your app</li>
              <li>Test by submitting a test lead from Meta's Lead Ads testing tool</li>
            </ol>
          </ConfigCard>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <CopyField label="Webhook Callback URL" value={webhookUrl} onCopy={() => copy(webhookUrl)} />
            <CopyField label="Verify Token" value={verifyToken} onCopy={() => copy(verifyToken)} />

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-1">Important: Server must be publicly accessible</p>
                <p>Meta cannot reach <code className="bg-amber-100 px-1 rounded">localhost</code>. Use <a href="https://ngrok.com" target="_blank" className="underline">ngrok</a> for testing:</p>
                <code className="block bg-amber-100 mt-2 px-3 py-1.5 rounded-lg text-xs font-mono">ngrok http 3001</code>
                <p className="mt-1">Then use <code className="bg-amber-100 px-1 rounded">https://xxxx.ngrok-free.app/webhook/meta</code> as the callback URL.</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-slate-700 mb-2">What happens when a lead comes in:</p>
              <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600">
                {['Meta Form Submitted', '→', 'Webhook POST received', '→', 'Lead fetched from Graph API', '→', 'Saved to CRM', '→', 'CAPI "Lead" event fired'].map((s, i) => (
                  <span key={i} className={s === '→' ? 'text-slate-300 font-bold' : 'bg-white border border-slate-200 px-2 py-1 rounded-lg'}>{s}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Recent webhook logs */}
          {stats?.recent?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-700 mb-3">Recent Meta Leads ({stats.total})</h3>
              <div className="space-y-2">
                {stats.recent.map(l => (
                  <div key={l.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <span className="font-medium text-sm text-slate-800">{l.client_name}</span>
                      <span className="text-xs text-slate-400 ml-2">{l.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-mono">{l.meta_campaign || 'Unknown Campaign'}</span>
                      <StatusBadge status={l.lead_status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CAPI TAB ── */}
      {tab === 'capi' && (
        <div className="space-y-4">
          <ConfigCard title="Conversions API (CAPI)" variant="info">
            <p className="text-sm text-slate-600 mb-2">
              CAPI sends server-side events to Meta to improve ad targeting and measurement — without relying on browser pixels. Events fire automatically when lead status changes:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              {[['New Lead', 'Lead'], ['Positive', 'Lead'], ['Office Visited', 'Schedule'], ['File Opened', 'InitiateCheckout'], ['Enrolled', 'Purchase']].map(([crm, meta]) => (
                <div key={crm} className="bg-white border border-slate-200 rounded-lg p-2.5 text-center">
                  <p className="text-xs font-semibold text-slate-700">{crm}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">↓</p>
                  <p className="text-xs text-blue-600 font-semibold">{meta}</p>
                </div>
              ))}
            </div>
          </ConfigCard>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-slate-700 mb-4">Test CAPI Events</h3>
            <p className="text-sm text-slate-500 mb-4">Send test events to verify your Pixel ID and access token are correct. Check results in Meta Events Manager → Test Events tab.</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {['Lead', 'Schedule', 'InitiateCheckout', 'Purchase', 'ViewContent'].map(evt => (
                <button key={evt} onClick={() => testCapi(evt)} disabled={!!testing}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 border rounded-xl text-sm font-medium transition-all
                    ${testing === evt ? 'bg-blue-50 border-blue-300 text-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}>
                  {testing === evt ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  {evt}
                </button>
              ))}
            </div>

            {testResult && (
              <div className={`p-4 rounded-xl border text-sm ${testResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                <div className="flex items-center gap-2 mb-2 font-semibold">
                  {testResult.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  {testResult.ok ? 'Event sent successfully' : 'Event failed'}
                </div>
                <pre className="text-xs overflow-x-auto bg-white/60 rounded-lg p-2">{JSON.stringify(testResult.data, null, 2)}</pre>
              </div>
            )}

            {!config.pixel_id && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-2 text-sm text-amber-800">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                <span>Pixel ID and CAPI token are not configured. Go to the <button onClick={() => setTab('setup')} className="underline font-medium">Setup tab</button> to add them.</span>
              </div>
            )}
          </div>

          {/* CAPI event log */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-slate-700 mb-2">Auto-fired Events</h3>
            <p className="text-sm text-slate-500">Events are fired automatically on every lead status change. Check the Node.js server console for real-time logs.</p>
            <div className="mt-3 bg-slate-900 rounded-xl p-4 text-xs font-mono text-slate-300 space-y-1">
              <p><span className="text-green-400">✓</span> CAPI → Lead <span className="text-slate-500">event_time=... events_received=1</span></p>
              <p><span className="text-green-400">✓</span> CAPI → Schedule <span className="text-slate-500">fbc=... fbp=...</span></p>
              <p><span className="text-slate-500"># Events also appear in Meta Events Manager → Test Events</span></p>
            </div>
          </div>
        </div>
      )}

      {/* ── META LEADS TAB ── */}
      {tab === 'leads' && (
        <div className="space-y-4">
          {stats ? (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MiniKpiCard label="Total Meta Leads" value={stats.total} color="blue" />
                {stats.byStatus.map(s => (
                  <MiniKpiCard key={s.lead_status} label={s.lead_status} value={s.c} color="slate" />
                ))}
              </div>

              {/* By campaign */}
              {stats.byCampaign.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-700 mb-3">Leads by Campaign</h3>
                  <div className="space-y-3">
                    {stats.byCampaign.map(c => {
                      const pct = stats.total > 0 ? Math.round((c.c / stats.total) * 100) : 0;
                      return (
                        <div key={c.meta_campaign}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-700 font-medium truncate max-w-xs">{c.meta_campaign}</span>
                            <span className="text-slate-500">{c.c} leads ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent leads table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <span className="font-semibold text-slate-700 text-sm">Recent Meta Leads</span>
                  <a href="/leads?source=meta" className="text-xs text-blue-600 hover:underline">View all →</a>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        {['Lead ID', 'Name', 'Phone', 'Campaign', 'Form ID', 'Status', 'Date'].map(h => (
                          <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {stats.recent.map(l => (
                        <tr key={l.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono text-xs text-blue-600">{l.lead_id}</td>
                          <td className="py-2.5 px-4 font-medium">{l.client_name}</td>
                          <td className="py-2.5 px-4 text-slate-500 text-xs">{l.phone || '—'}</td>
                          <td className="py-2.5 px-4 text-xs text-slate-500 max-w-[140px] truncate">{l.meta_campaign || '—'}</td>
                          <td className="py-2.5 px-4 font-mono text-xs text-slate-400">{l.meta_form_id?.slice(0, 12) || '—'}…</td>
                          <td className="py-2.5 px-4"><StatusBadge status={l.lead_status} /></td>
                          <td className="py-2.5 px-4 text-xs text-slate-400">{l.date_added}</td>
                        </tr>
                      ))}
                      {stats.recent.length === 0 && (
                        <tr><td colSpan={7} className="py-12 text-center">
                          <p className="text-slate-400">No Meta leads yet</p>
                          <p className="text-xs text-slate-300 mt-1">Set up your webhook to start receiving leads automatically</p>
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-400">Loading…</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────
function StatusBanner({ config, stats }) {
  const hasToken = config.page_access_token;
  const hasPixel = config.pixel_id;
  const hasCapi = config.capi_token;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatusPill label="Webhook" ok={!!hasToken} detail={hasToken ? 'Token configured' : 'Not configured'} />
      <StatusPill label="Meta Pixel" ok={!!hasPixel} detail={hasPixel ? config.pixel_id : 'Not configured'} />
      <StatusPill label="CAPI" ok={!!hasCapi} detail={hasCapi ? 'Token configured' : 'Not configured'} />
    </div>
  );
}

function StatusPill({ label, ok, detail }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${ok ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
      {ok ? <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" /> : <XCircle size={18} className="text-slate-300 flex-shrink-0" />}
      <div>
        <p className={`text-sm font-semibold ${ok ? 'text-emerald-800' : 'text-slate-500'}`}>{label}</p>
        <p className="text-xs text-slate-400 truncate max-w-[180px]">{detail}</p>
      </div>
    </div>
  );
}

function ConfigCard({ title, children, variant }) {
  return (
    <div className={`rounded-2xl border p-5 ${variant === 'info' ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center gap-2 mb-3">
        <Info size={16} className="text-blue-600" />
        <h3 className="font-semibold text-slate-700 text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ConfigField({ label, field, form, setForm, placeholder, type = 'text', help }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none font-mono"
        value={form[field] || ''}
        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
        placeholder={placeholder}
        autoComplete="off"
      />
      {help && <p className="text-xs text-slate-400 mt-1">{help}</p>}
    </div>
  );
}

function CopyField({ label, value, onCopy }) {
  const [copied, setCopied] = useState(false);
  function handle() {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-slate-900 text-green-400 px-3 py-2 rounded-lg text-xs font-mono break-all">{value}</code>
        <button onClick={handle} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-shrink-0
          ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

function MiniKpiCard({ label, value, color }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}
