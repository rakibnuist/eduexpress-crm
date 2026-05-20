import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import LeadForm from './LeadForm';
import { Plus, Search, Trash2, Pencil, ChevronLeft, ChevronRight, Download, SlidersHorizontal, X } from 'lucide-react';

export default function Leads() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState({ leads: [], total: 0, pages: 1 });
  const [settings, setSettings] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    status: searchParams.get('status') || '',
    consultant: '',
    destination: '',
    page: 1,
  });
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef();

  const load = useCallback(() => {
    const p = { limit: 50 };
    if (filters.search) p.search = filters.search;
    if (filters.status) p.status = filters.status;
    if (filters.consultant) p.consultant = filters.consultant;
    if (filters.destination) p.destination = filters.destination;
    p.page = filters.page;
    api.leads(p).then(setData);
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.settings().then(setSettings); }, []);

  function setFilter(key, val) {
    setFilters(f => ({ ...f, [key]: val, page: 1 }));
  }

  const activeFilters = [filters.status, filters.consultant, filters.destination].filter(Boolean).length;

  async function handleDelete(id) {
    await api.deleteLead(id);
    setDeleting(null);
    load();
  }

  function exportCSV() {
    const headers = ['Lead ID', 'Name', 'Phone', 'Email', 'Destination', 'Education', 'GPA', 'English', 'Program', 'Source', 'Status', 'Consultant', 'Fee', 'Paid', 'Balance', 'Payment', 'Follow-up', 'Notes'];
    const rows = data.leads.map(l => [
      l.lead_id, l.client_name, l.phone, l.email, l.destination, l.last_education, l.gpa, l.english_score,
      l.program, l.lead_source, l.lead_status, l.assigned_consultant, l.service_fee, l.paid, l.balance,
      l.payment_status, l.next_followup, (l.notes || '').replace(/,/g, ';')
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">All Leads</h2>
          <p className="text-sm text-slate-500">{data.total.toLocaleString()} total records</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <Download size={15} /> Export
          </button>
          <button onClick={() => setModal('add')} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 shadow-sm">
            <Plus size={15} /> Add Lead
          </button>
        </div>
      </div>

      {/* Search + Filters bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input ref={searchRef}
            className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            placeholder="Search by name, phone, ID, email…"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)} />
        </div>
        <button onClick={() => setShowFilters(s => !s)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors
            ${showFilters || activeFilters ? 'border-blue-300 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <SlidersHorizontal size={15} />
          Filters {activeFilters > 0 && <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">{activeFilters}</span>}
        </button>
        {activeFilters > 0 && (
          <button onClick={() => setFilters(f => ({ ...f, status: '', consultant: '', destination: '', page: 1 }))}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500">
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Expanded filters */}
      {showFilters && settings && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap gap-2">
          <FilterSelect value={filters.status} onChange={v => setFilter('status', v)} options={settings.leadStatuses} placeholder="All Statuses" />
          <FilterSelect value={filters.consultant} onChange={v => setFilter('consultant', v)} options={settings.consultants} placeholder="All Consultants" />
          <FilterSelect value={filters.destination} onChange={v => setFilter('destination', v)} options={settings.destinations} placeholder="All Destinations" />
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                {['Lead ID', 'Client', 'Phone', 'Dest.', 'Edu.', 'GPA', 'Source', 'Status', 'Consultant', 'Fee', 'Paid', 'Balance', 'Follow-up', ''].map(h => (
                  <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.leads.map(l => (
                <tr key={l.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="py-2.5 px-3 font-mono text-xs text-blue-600 font-semibold">{l.lead_id}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-slate-800 truncate max-w-[130px]">{l.client_name}</div>
                    {l.notes && <div className="text-xs text-slate-400 truncate max-w-[130px]" title={l.notes}>{l.notes}</div>}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap text-xs">{l.phone}</td>
                  <td className="py-2.5 px-3 text-slate-600">{l.destination}</td>
                  <td className="py-2.5 px-3 text-slate-500 text-xs">{l.last_education}</td>
                  <td className="py-2.5 px-3 text-slate-500">{l.gpa ?? '—'}</td>
                  <td className="py-2.5 px-3 text-slate-500 text-xs max-w-[100px] truncate">{l.lead_source}</td>
                  <td className="py-2.5 px-3"><StatusBadge status={l.lead_status} /></td>
                  <td className="py-2.5 px-3 text-slate-500 text-xs">{l.assigned_consultant || '—'}</td>
                  <td className="py-2.5 px-3 text-right text-slate-600 text-xs tabular-nums">{l.service_fee ? '৳' + l.service_fee.toLocaleString() : '—'}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-600 text-xs tabular-nums font-medium">{l.paid ? '৳' + l.paid.toLocaleString() : '—'}</td>
                  <td className="py-2.5 px-3 text-right text-xs tabular-nums">
                    {l.balance > 0 ? <span className="text-red-500 font-medium">৳{l.balance.toLocaleString()}</span> : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 text-xs whitespace-nowrap">{l.next_followup || '—'}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setModal(l)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => setDeleting(l.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.leads.length === 0 && (
                <tr>
                  <td colSpan={14} className="py-16 text-center">
                    <p className="text-slate-400">No leads found</p>
                    <p className="text-xs text-slate-300 mt-1">Try adjusting your search or filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/40">
          <span className="text-xs text-slate-400">
            Showing {Math.min((filters.page - 1) * 50 + 1, data.total)}–{Math.min(filters.page * 50, data.total)} of {data.total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <button disabled={filters.page <= 1}
              onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs disabled:opacity-40 hover:bg-white transition-colors">
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="px-3 py-1.5 text-xs text-slate-600 font-medium">{filters.page} / {data.pages}</span>
            <button disabled={filters.page >= data.pages}
              onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs disabled:opacity-40 hover:bg-white transition-colors">
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {modal && (
        <Modal title={modal === 'add' ? '➕ Add New Lead' : `✏️ Edit Lead — ${modal.lead_id}`} onClose={() => setModal(null)} wide>
          <LeadForm lead={modal === 'add' ? null : modal} settings={settings} onSave={() => { setModal(null); load(); }} />
        </Modal>
      )}

      {deleting && (
        <Modal title="Delete Lead?" onClose={() => setDeleting(null)}>
          <p className="text-slate-600 mb-5">This lead will be permanently removed. This cannot be undone.</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setDeleting(null)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
            <button onClick={() => handleDelete(deleting)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`px-3 py-2 border rounded-lg text-sm bg-white transition-colors
        ${value ? 'border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600'}`}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
