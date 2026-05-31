import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import LeadForm from './LeadForm';
import { Plus, Search, Trash2, Pencil, ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { useToast } from '../components/Toast';

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

  const toast = useToast();
  async function handleDelete(id) {
    try {
      await api.deleteLead(id);
      setDeleting(null);
      load();
      toast.success('Lead deleted');
    } catch (e) { toast.error(e.message || 'Could not delete'); }
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

  const today = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const list = data.leads || [];
    const pageFee = list.reduce((acc, curr) => acc + (curr.service_fee || 0), 0);
    const pagePaid = list.reduce((acc, curr) => acc + (curr.paid || 0), 0);
    const pageBalance = list.reduce((acc, curr) => acc + (curr.balance || 0), 0);
    const dueToday = list.filter(l => l.next_followup === today).length;
    return { pageFee, pagePaid, pageBalance, dueToday };
  }, [data.leads, today]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Leads Directory</h2>
          <p className="text-sm text-slate-500">{data.total.toLocaleString()} total records in database</p>
        </div>
        <div className="flex gap-2.5">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
            <Download size={15} /> Export CSV
          </button>
          <button onClick={() => setModal('add')} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">
            <Plus size={15} /> Add Lead
          </button>
        </div>
      </div>

      {/* Page-level dynamic summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow transition-shadow">
          <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Total Fees (Page)</p>
          <p className="text-lg font-extrabold text-slate-850 leading-tight mt-1">৳{stats.pageFee.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow transition-shadow">
          <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Collected (Page)</p>
          <p className="text-lg font-extrabold text-emerald-600 leading-tight mt-1">৳{stats.pagePaid.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow transition-shadow">
          <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Balance Due (Page)</p>
          <p className="text-lg font-extrabold text-rose-500 leading-tight mt-1">৳{stats.pageBalance.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow transition-shadow">
          <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Due Follow-ups (Page)</p>
          <p className="text-lg font-extrabold text-amber-650 leading-tight mt-1">{stats.dueToday} leads</p>
        </div>
      </div>

      {/* Search + Filters bar (sticky for long tables) */}
      <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-md -mx-4 lg:-mx-6 px-4 lg:px-6 py-2 border-b border-slate-200/80">
        <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-sm flex flex-wrap gap-2.5 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input ref={searchRef}
              className="pl-10 pr-9 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all placeholder:text-slate-400"
              placeholder="Search leads by name, phone, ID, email..."
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)} />
            {filters.search && (
              <button onClick={() => setFilter('search', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-all">
                <X size={13} />
              </button>
            )}
          </div>
          {/* Inline filter dropdowns — always visible, no panel toggle */}
          {settings && (
            <div className="flex flex-wrap gap-2">
              <FilterSelect value={filters.status} onChange={v => setFilter('status', v)} options={settings.leadStatuses} placeholder="All Statuses" />
              <FilterSelect value={filters.consultant} onChange={v => setFilter('consultant', v)} options={settings.consultants} placeholder="All Consultants" />
              <FilterSelect value={filters.destination} onChange={v => setFilter('destination', v)} options={settings.destinations} placeholder="All Destinations" />
            </div>
          )}
          {(activeFilters > 0 || filters.search) && (
            <button onClick={() => setFilters({ search: '', status: '', consultant: '', destination: '', page: 1 })}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 px-3 py-2 rounded-xl hover:bg-rose-50 transition-all">
              <X size={14} /> Clear all
            </button>
          )}
        </div>

        {/* Active-filter chips — visible row showing what's currently filtering */}
        {(filters.status || filters.consultant || filters.destination || filters.search) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {filters.search && <Chip onClear={() => setFilter('search', '')}>Search: <strong>{filters.search}</strong></Chip>}
            {filters.status && <Chip onClear={() => setFilter('status', '')}>Status: <strong>{filters.status}</strong></Chip>}
            {filters.consultant && <Chip onClear={() => setFilter('consultant', '')}>Consultant: <strong>{filters.consultant}</strong></Chip>}
            {filters.destination && <Chip onClear={() => setFilter('destination', '')}>Destination: <strong>{filters.destination}</strong></Chip>}
            <span className="text-xs text-slate-400 self-center ml-1">{data.total.toLocaleString()} match{data.total === 1 ? '' : 'es'}</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                {['Lead ID', 'Client', 'Phone', 'Dest.', 'Edu.', 'GPA', 'Source', 'Status', 'Consultant', 'Fee', 'Paid', 'Balance', 'Follow-up', ''].map(h => (
                  <th key={h} className="text-left py-3.5 px-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.leads.map(l => {
                const isDueToday = l.next_followup === today;
                const isOverdue = l.next_followup && l.next_followup < today && l.lead_status !== 'Enrolled' && l.lead_status !== 'Not Interested';
                return (
                  <tr key={l.id} className="hover:bg-blue-50/40 transition-colors group cursor-pointer">
                    <td className="py-3 px-3.5 font-mono text-xs">
                      <Link to={`/leads/${l.id}`} className="text-blue-600 hover:text-blue-800 hover:underline font-bold">
                        {l.lead_id}
                      </Link>
                    </td>
                    <td className="py-3 px-3.5">
                      <Link to={`/leads/${l.id}`} className="font-bold text-slate-800 hover:text-blue-600 transition-colors truncate max-w-[150px] block">
                        {l.client_name}
                      </Link>
                      {l.notes && <div className="text-xs text-slate-400 truncate max-w-[150px] font-medium" title={l.notes}>{l.notes}</div>}
                    </td>
                    <td className="py-3 px-3.5 text-slate-500 whitespace-nowrap text-xs font-medium">{l.phone || '—'}</td>
                    <td className="py-3 px-3.5 text-slate-600 font-semibold">{l.destination || '—'}</td>
                    <td className="py-3 px-3.5 text-slate-500 text-xs font-medium">{l.last_education || '—'}</td>
                    <td className="py-3 px-3.5 text-slate-500 font-medium">{l.gpa ?? '—'}</td>
                    <td className="py-3 px-3.5 text-slate-500 text-xs max-w-[100px] truncate font-medium">{l.lead_source || '—'}</td>
                    <td className="py-3 px-3.5"><StatusBadge status={l.lead_status} /></td>
                    <td className="py-3 px-3.5 text-slate-500 text-xs font-semibold">{l.assigned_consultant || '—'}</td>
                    <td className="py-3 px-3.5 text-right text-slate-600 text-xs font-semibold tabular-nums">{l.service_fee ? '৳' + l.service_fee.toLocaleString() : '—'}</td>
                    <td className="py-3 px-3.5 text-right text-emerald-600 text-xs font-bold tabular-nums bg-emerald-50/30">{l.paid ? '৳' + l.paid.toLocaleString() : '—'}</td>
                    <td className="py-3 px-3.5 text-right text-xs font-bold tabular-nums">
                      {l.balance > 0 ? <span className="text-rose-600 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100">৳{l.balance.toLocaleString()}</span> : '—'}
                    </td>
                    <td className="py-3 px-3.5 text-xs font-bold whitespace-nowrap">
                      {isDueToday ? (
                        <span className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg flex items-center gap-1 w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" /> Today
                        </span>
                      ) : isOverdue ? (
                        <span className="px-2 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg block w-fit" title={`Overdue since ${l.next_followup}`}>
                          Overdue
                        </span>
                      ) : l.next_followup ? (
                        <span className="text-slate-500 font-medium">{l.next_followup}</span>
                      ) : (
                        <span className="text-slate-300 font-medium">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setModal(l)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => setDeleting(l.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {data.leads.length === 0 && (
                <tr>
                  <td colSpan={14} className="py-12">
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mb-2">
                        <Search size={20} />
                      </div>
                      <p className="text-slate-600 font-semibold">No leads match these filters</p>
                      <p className="text-xs text-slate-400 mt-1">Try clearing the search, status or destination filters.</p>
                      {activeFilters > 0 && (
                        <button onClick={() => setFilters({ search: '', status: '', consultant: '', destination: '', page: 1 })}
                          className="text-xs font-medium text-blue-600 hover:underline mt-2">
                          Clear filters
                        </button>
                      )}
                    </div>
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
      className={`px-3.5 py-2 border rounded-xl text-sm bg-white transition-all cursor-pointer focus:ring-2 focus:ring-blue-100
        ${value ? 'border-blue-300 text-blue-700 font-medium bg-blue-50/20' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Chip({ children, onClear }) {
  return (
    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full border border-blue-100">
      {children}
      <button onClick={onClear} className="hover:bg-blue-100 rounded-full p-0.5"><X size={11} /></button>
    </span>
  );
}
