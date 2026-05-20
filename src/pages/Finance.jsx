import { useEffect, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';
import { Plus, Trash2, Pencil, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line, CartesianGrid,
} from 'recharts';

export default function Finance() {
  const [tab, setTab] = useState('overview');
  const [income, setIncome] = useState({ rows: [], total: 0, sum: 0 });
  const [expenses, setExpenses] = useState({ rows: [], total: 0, sum: 0 });
  const [pnl, setPnl] = useState([]);
  const [settings, setSettings] = useState(null);
  const [modal, setModal] = useState(null);
  const [month, setMonth] = useState('');

  function load() {
    const p = month ? { month } : {};
    api.income(p).then(setIncome);
    api.expenses(p).then(setExpenses);
    api.pnl().then(setPnl);
    api.settings().then(setSettings);
  }

  useEffect(() => { load(); }, [month]);

  async function handleDelete(type, id) {
    if (type === 'income') await api.deleteIncome(id);
    else await api.deleteExpense(id);
    load();
  }

  const profit = income.sum - expenses.sum;
  const margin = income.sum > 0 ? ((profit / income.sum) * 100).toFixed(1) : 0;

  // Category breakdown for current view
  const incCatMap = {};
  income.rows.forEach(r => { if (r.category) incCatMap[r.category] = (incCatMap[r.category] || 0) + r.amount; });
  const expCatMap = {};
  expenses.rows.forEach(r => { if (r.category) expCatMap[r.category] = (expCatMap[r.category] || 0) + r.amount; });

  const pnlWithCumulative = pnl.map((r, i) => ({
    ...r,
    cumulative: pnl.slice(0, i + 1).reduce((s, x) => s + x.profit, 0),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Finance</h2>
          <p className="text-sm text-slate-500">Income, expenses & profit overview</p>
        </div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FinKpi icon={<TrendingUp size={20} />} label="Total Income" value={income.sum} color="emerald" symbol="৳" />
        <FinKpi icon={<TrendingDown size={20} />} label="Total Expenses" value={expenses.sum} color="red" symbol="৳" />
        <FinKpi icon={<DollarSign size={20} />} label={`Net Profit${margin > 0 ? ` (${margin}% margin)` : ''}`} value={profit} color={profit >= 0 ? 'blue' : 'red'} symbol="৳" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl w-fit">
        {[['overview', '📊 Overview'], ['income', '💰 Income'], ['expenses', '💸 Expenses']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
              ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {pnlWithCumulative.length > 0 ? (
            <>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-700 mb-4">Monthly Income vs Expenses</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={pnlWithCumulative} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => '৳' + v.toLocaleString()} contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)' }} />
                    <Legend />
                    <Bar dataKey="income" fill="#34d399" name="Income" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" fill="#fca5a5" name="Expense" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-700 mb-4">Cumulative Profit</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={pnlWithCumulative} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => '৳' + v.toLocaleString()} contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)' }} />
                    <Line type="monotone" dataKey="cumulative" stroke="#6366f1" strokeWidth={2.5} dot={false} name="Cumulative" />
                    <Line type="monotone" dataKey="profit" stroke="#34d399" strokeWidth={2} dot={false} name="Monthly Profit" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* P&L table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 font-semibold text-slate-700 text-sm">Monthly P&L</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        {['Month', 'Income', 'Expense', 'Net Profit', 'Margin', 'Cumulative'].map(h => (
                          <th key={h} className="text-left py-2.5 px-4 text-xs text-slate-500 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {pnlWithCumulative.map(r => (
                        <tr key={r.month} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-medium">{r.month}</td>
                          <td className="py-2.5 px-4 text-emerald-600 font-medium">৳{r.income.toLocaleString()}</td>
                          <td className="py-2.5 px-4 text-red-500">৳{r.expense.toLocaleString()}</td>
                          <td className={`py-2.5 px-4 font-semibold ${r.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {r.profit >= 0 ? '+' : ''}৳{r.profit.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500">{r.margin}%</td>
                          <td className="py-2.5 px-4 text-indigo-600 font-medium">৳{r.cumulative.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <EmptyFinance onAdd={() => { setTab('income'); setModal({ type: 'income' }); }} />
          )}
        </div>
      )}

      {/* Income tab */}
      {tab === 'income' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">{income.total} records · Total: <strong className="text-emerald-600">৳{income.sum.toLocaleString()}</strong></p>
            <button onClick={() => setModal({ type: 'income' })}
              className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 shadow-sm">
              <Plus size={15} /> Add Income
            </button>
          </div>
          <LedgerTable
            rows={income.rows}
            cols={['date', 'category', 'lead_id', 'client_name', 'reference', 'amount', 'notes']}
            headers={['Date', 'Category', 'Lead ID', 'Client', 'Reference', 'Amount (BDT)', 'Notes']}
            amountCol="amount"
            onEdit={r => setModal({ type: 'income', record: r })}
            onDelete={id => handleDelete('income', id)} />
        </div>
      )}

      {/* Expenses tab */}
      {tab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">{expenses.total} records · Total: <strong className="text-red-500">৳{expenses.sum.toLocaleString()}</strong></p>
            <button onClick={() => setModal({ type: 'expenses' })}
              className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 shadow-sm">
              <Plus size={15} /> Add Expense
            </button>
          </div>
          <LedgerTable
            rows={expenses.rows}
            cols={['date', 'category', 'paid_to', 'reference', 'amount', 'notes']}
            headers={['Date', 'Category', 'Paid To', 'Reference', 'Amount (BDT)', 'Notes']}
            amountCol="amount"
            onEdit={r => setModal({ type: 'expenses', record: r })}
            onDelete={id => handleDelete('expenses', id)} />
        </div>
      )}

      {modal && (
        <Modal title={`${modal.record ? 'Edit' : 'Add'} ${modal.type === 'income' ? 'Income' : 'Expense'}`} onClose={() => setModal(null)}>
          <FinanceForm type={modal.type} record={modal.record} settings={settings}
            onSave={() => { setModal(null); load(); }} />
        </Modal>
      )}
    </div>
  );
}

function FinKpi({ icon, label, value, color, symbol }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-500',
    blue: 'bg-blue-50 text-blue-600',
  };
  const textColors = { emerald: 'text-emerald-700', red: 'text-red-600', blue: 'text-blue-700' };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className={`text-2xl font-bold ${textColors[color]}`}>{symbol}{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

function LedgerTable({ rows, cols, headers, amountCol, onEdit, onDelete }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {headers.map(h => <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500">{h}</th>)}
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 group transition-colors">
                {cols.map(c => (
                  <td key={c} className={`py-2.5 px-4 ${c === amountCol ? 'text-right font-semibold text-slate-800 tabular-nums' : 'text-slate-600'}`}>
                    {c === amountCol ? '৳' + (r[c] || 0).toLocaleString() : r[c] || '—'}
                  </td>
                ))}
                <td className="py-2.5 px-3">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(r)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={13} /></button>
                    <button onClick={() => onDelete(r.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={headers.length + 1} className="py-12 text-center text-slate-400">No records yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyFinance({ onAdd }) {
  return (
    <div className="bg-white border border-dashed border-slate-300 rounded-2xl py-16 text-center">
      <DollarSign className="mx-auto text-slate-300 mb-3" size={40} />
      <p className="text-slate-500 font-medium">No finance records yet</p>
      <p className="text-slate-400 text-sm mb-4">Start by adding income or expense entries</p>
      <button onClick={onAdd} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700">
        Add First Entry
      </button>
    </div>
  );
}

function FinanceForm({ type, record, settings, onSave }) {
  const [form, setForm] = useState(record || { date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const cats = type === 'income' ? settings?.incomeCategories || [] : settings?.expenseCategories || [];
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try {
      if (record) {
        if (type === 'income') await api.updateIncome(record.id, form);
        else await api.updateExpense(record.id, form);
      } else {
        if (type === 'income') await api.createIncome(form);
        else await api.createExpense(form);
      }
      onSave();
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
          <input type="date" required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none"
            value={form.date || ''} onChange={e => set('date', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Amount (BDT) *</label>
          <input type="number" step="any" required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none"
            value={form.amount || ''} onChange={e => set('amount', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
        <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none"
          value={form.category || ''} onChange={e => set('category', e.target.value)}>
          <option value="">— select —</option>
          {cats.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      {type === 'income' && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Lead ID</label>
          <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.lead_id || ''} onChange={e => set('lead_id', e.target.value)} placeholder="L-00001" />
        </div>
      )}
      {type === 'expenses' && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Paid To</label>
          <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.paid_to || ''} onChange={e => set('paid_to', e.target.value)} />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Reference</label>
        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.reference || ''} onChange={e => set('reference', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
      </div>
      <div className="flex justify-end pt-1">
        <button type="submit" disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60 shadow-sm">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
