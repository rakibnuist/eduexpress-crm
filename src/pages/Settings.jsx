import { useEffect, useState } from 'react';
import { api } from '../api';
import { Info, Wifi, Clock, Users, Globe, Tag, CreditCard } from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState(null);

  useEffect(() => { api.settings().then(setSettings); }, []);

  if (!settings) return <div className="text-slate-400 text-center py-16">Loading…</div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
        <p className="text-sm text-slate-500">Reference lists used across the CRM</p>
      </div>

      {/* Office Info */}
      <Card icon={<Info size={18} />} title="Office Info" color="blue">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <InfoRow label="Organisation" value="EduExpress International" />
          <InfoRow label="CRM Version" value="1.0 · Web Edition" />
          <InfoRow label="Office SSID" value="EduExpress International" />
          <InfoRow label="Currency" value="BDT (৳)" />
        </div>
      </Card>

      {/* Consultants */}
      <Card icon={<Users size={18} />} title="Consultants" color="violet">
        <TagList items={settings.consultants} color="violet" />
      </Card>

      {/* Lead Statuses */}
      <Card icon={<Tag size={18} />} title="Lead Statuses" color="sky">
        <TagList items={settings.leadStatuses} color="sky" />
      </Card>

      {/* Destinations */}
      <Card icon={<Globe size={18} />} title="Destinations" color="emerald">
        <TagList items={settings.destinations} color="emerald" />
      </Card>

      {/* Lead Sources */}
      <Card icon={<Wifi size={18} />} title="Lead Sources" color="orange">
        <TagList items={settings.leadSources} color="orange" />
      </Card>

      {/* Payment Statuses */}
      <Card icon={<CreditCard size={18} />} title="Payment Statuses" color="rose">
        <TagList items={settings.paymentStatuses} color="rose" />
      </Card>

      {/* File Stages */}
      <Card icon={<Clock size={18} />} title="File Stages" color="amber">
        <TagList items={settings.fileStages} color="amber" />
      </Card>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-700">
        <strong>Note:</strong> To modify these lists, edit the <code className="bg-blue-100 px-1 rounded">settings</code> object in <code className="bg-blue-100 px-1 rounded">server.js</code> and restart the server.
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

function TagList({ items, color }) {
  const bg = {
    violet: 'bg-violet-100 text-violet-700', sky: 'bg-sky-100 text-sky-700',
    emerald: 'bg-emerald-100 text-emerald-700', orange: 'bg-orange-100 text-orange-700',
    rose: 'bg-rose-100 text-rose-700', amber: 'bg-amber-100 text-amber-700',
  };
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(item => (
        <span key={item} className={`px-3 py-1 rounded-full text-sm font-medium ${bg[color] || 'bg-slate-100 text-slate-600'}`}>
          {item}
        </span>
      ))}
    </div>
  );
}
