import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Plus, Edit2, Trash2, Globe, FileText, Check, X, ExternalLink } from 'lucide-react';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';

export default function Destinations() {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    requirements: '',
    programs: '',
    fees: '',
    embassy_documents: '',
    application_processing: '',
    other_details: '',
    is_public: false
  });

  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    loadDestinations();
  }, []);

  const loadDestinations = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/destinations');
      if (!res.ok) throw new Error('Failed to fetch destinations');
      const data = await res.json();
      setDestinations(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (dest) => {
    setFormData({
      name: dest.name || '',
      requirements: dest.requirements || '',
      programs: dest.programs || '',
      fees: dest.fees || '',
      embassy_documents: dest.embassy_documents || '',
      application_processing: dest.application_processing || '',
      other_details: dest.other_details || '',
      is_public: !!dest.is_public
    });
    setEditingId(dest.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (await confirm('Are you sure you want to delete this destination? This cannot be undone.')) {
      try {
        const res = await fetch(`/api/destinations/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');
        toast.success('Destination deleted');
        loadDestinations();
      } catch (err) {
        toast.error(err.message);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/destinations/${editingId}` : '/api/destinations';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Destination saved successfully');
      setShowForm(false);
      setEditingId(null);
      loadDestinations();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Loading destinations...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Globe className="text-blue-600" />
            Destinations Hub
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage country profiles, requirements, and shareable pages.</p>
        </div>
        {!showForm && (
          <button 
            onClick={() => {
              setEditingId(null);
              setFormData({ name: '', requirements: '', programs: '', fees: '', embassy_documents: '', application_processing: '', other_details: '', is_public: false });
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={16} /> Add Destination
          </button>
        )}
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <h2 className="text-lg font-semibold text-slate-800">{editingId ? 'Edit Destination' : 'New Destination'}</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 space-y-1">
              <label className="text-sm font-medium text-slate-700">Country / Destination Name *</label>
              <input 
                type="text" required
                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. United Kingdom"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Admission Requirements</label>
              <textarea 
                rows={5}
                value={formData.requirements} onChange={e => setFormData({...formData, requirements: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="List required grades, IELTS scores, etc."
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Top Programs / Universities</label>
              <textarea 
                rows={5}
                value={formData.programs} onChange={e => setFormData({...formData, programs: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="List popular programs and universities"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Fees & Scholarships</label>
              <textarea 
                rows={5}
                value={formData.fees} onChange={e => setFormData({...formData, fees: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Tuition fees, living costs, available scholarships"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Embassy Documents</label>
              <textarea 
                rows={5}
                value={formData.embassy_documents} onChange={e => setFormData({...formData, embassy_documents: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Checklist of documents needed for visa"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Application Processing Details</label>
              <textarea 
                rows={4}
                value={formData.application_processing} onChange={e => setFormData({...formData, application_processing: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Timeline, intakes, and procedure"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Other Details / Internal Notes</label>
              <textarea 
                rows={4}
                value={formData.other_details} onChange={e => setFormData({...formData, other_details: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Any other specific notes"
              />
            </div>

            <div className="md:col-span-2 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.is_public} 
                  onChange={e => setFormData({...formData, is_public: e.target.checked})}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-800">Make this destination public (generates a shareable link for students)</span>
              </label>
              <p className="text-xs text-slate-500 ml-6 mt-1">If enabled, anyone with the link can view the requirements and details for this destination.</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <Check size={16} /> Save Destination
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {destinations.map(dest => (
            <div key={dest.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <Globe size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-lg">{dest.name}</h3>
                    {dest.is_public ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium border border-emerald-200">
                        <Check size={10} /> Public
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium border border-slate-200">
                        Internal
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-sm text-slate-500 space-y-2 flex-grow mb-4">
                <div className="flex items-center gap-2 line-clamp-1"><FileText size={14} className="text-slate-400" /> {dest.requirements ? 'Has Requirements' : 'No requirements added'}</div>
                <div className="flex items-center gap-2 line-clamp-1"><FileText size={14} className="text-slate-400" /> {dest.programs ? 'Has Programs listed' : 'No programs listed'}</div>
                <div className="flex items-center gap-2 line-clamp-1"><FileText size={14} className="text-slate-400" /> {dest.fees ? 'Fee details added' : 'No fee details'}</div>
              </div>

              <div className="flex items-center gap-2 mt-auto pt-4 border-t border-slate-100">
                <button 
                  onClick={() => handleEdit(dest)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 px-3 bg-slate-50 text-slate-600 rounded hover:bg-slate-100 transition text-sm font-medium"
                >
                  <Edit2 size={14} /> Edit
                </button>
                {dest.is_public && (
                  <a 
                    href={`/d/${dest.slug}`} 
                    target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-1 py-1.5 px-3 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition text-sm font-medium"
                    title="View public page"
                  >
                    <ExternalLink size={14} /> View
                  </a>
                )}
                <button 
                  onClick={() => handleDelete(dest.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                  title="Delete destination"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {destinations.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
              <Globe className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <h3 className="text-sm font-medium text-slate-900">No destinations found</h3>
              <p className="mt-1 text-sm text-slate-500">Get started by creating a new destination profile.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
