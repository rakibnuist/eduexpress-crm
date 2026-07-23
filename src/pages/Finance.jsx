import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import Modal from '../components/Modal';
import {
  Plus, Trash2, Pencil, TrendingUp, TrendingDown, DollarSign,
  Wallet, ArrowDownCircle, ArrowUpCircle, Activity,
  PiggyBank, ChevronLeft, ChevronRight, Save, Settings as Cog,
  Search, Filter, ArrowUpRight, ArrowDownRight, BarChart3, Receipt, CreditCard, Landmark, LayoutDashboard, Calendar, X, Zap, Users, GraduationCap
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';

const cMonthLabel = (m) => {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return new Date(parseInt(y), parseInt(mo) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};
const cAddMonth = (m, delta) => {
  if (!m) return new Date().toISOString().slice(0, 7);
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return d.toISOString().slice(0, 7);
};

export default function Finance() {
  useEffect(() => { document.title = "Finance & Ledger Control | EduExpress Core"; }, []);

  const [tab, setTab] = useState('overview');
  const [income, setIncome] = useState({ rows: [], total: 0, sum: 0 });
  const [expenses, setExpenses] = useState({ rows: [], total: 0, sum: 0 });
  const [pnl, setPnl] = useState([]);
  const [settings, setSettings] = useState(null);
  const [modal, setModal] = useState(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [liveBalance, setLiveBalance] = useState(0);
  const [prevMonthData, setPrevMonthData] = useState({ income: 0, expenses: 0, profit: 0, balance: 0 });

  const toast = useToast();
  const confirm = useConfirm();

  function load() {
    const p = month ? { month } : {};
    api.income(p).then(res => setIncome(res || { rows: [], total: 0, sum: 0 })).catch(() => {});
    api.expenses(p).then(res => setExpenses(res || { rows: [], total: 0, sum: 0 })).catch(() => {});
    api.pnl().then(d => {
      const dataArr = Array.isArray(d) ? d : [];
      setPnl(dataArr);
      // Calculate previous month trends
      const currentMonth = month || new Date().toISOString().slice(0, 7);
      const prev = cAddMonth(currentMonth, -1);
      const prevRow = dataArr.find(r => r.month === prev);
      const curRow = dataArr.find(r => r.month === currentMonth);
      setPrevMonthData({
        income: prevRow ? (curRow?.income || 0) - prevRow.income : 0,
        expenses: prevRow ? (curRow?.expense || 0) - prevRow.expense : 0,
        profit: prevRow ? (curRow?.profit || 0) - prevRow.profit : 0,
        balance: prevRow ? (curRow?.profit || 0) - (prevRow.profit || 0) : 0,
      });
    }).catch(() => {});
    api.settings().then(setSettings).catch(() => {});

    const activeMonth = month || new Date().toISOString().slice(0, 7);
    api.cashflow(activeMonth).then(d => {
      if (d && d.totals) setLiveBalance(d.totals.closing);
    }).catch(() => {});
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [month]);

  async function handleDelete(type, id) {
    if (type === 'income') await api.deleteIncome(id);
    else await api.deleteExpense(id);
    load();
  }

  const incRows = Array.isArray(income?.rows) ? income.rows : [];
  const expRows = Array.isArray(expenses?.rows) ? expenses.rows : [];
  const pnlRows = Array.isArray(pnl) ? pnl : [];

  const incCatMap = {};
  incRows.forEach(r => { if (r?.category) incCatMap[r.category] = (incCatMap[r.category] || 0) + (r.amount || 0); });
  const expCatMap = {};
  expRows.forEach(r => { if (r?.category) expCatMap[r.category] = (expCatMap[r.category] || 0) + (r.amount || 0); });

  const topIncomeCats = Object.entries(incCatMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topExpenseCats = Object.entries(expCatMap).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const pnlWithCumulative = pnlRows.map((r, i) => ({
    ...r,
    cumulative: pnlRows.slice(0, i + 1).reduce((s, x) => s + (x.profit || 0), 0),
  }));

  const sortedPnl = [...pnlWithCumulative].sort((a, b) => (b.month || '').localeCompare(a.month || ''));

  const currentMonthLabel = month || new Date().toISOString().slice(0, 7);
  const profitMargin = (income?.sum || 0) > 0 ? (((income?.sum || 0) - (expenses?.sum || 0)) / (income?.sum || 1) * 100).toFixed(1) : '0.0';

  // Income tab filters
  const [incomeSearch, setIncomeSearch] = useState('');
  const [incomeCatFilter, setIncomeCatFilter] = useState('');
  const filteredIncome = useMemo(() => {
    return income.rows.filter(r => {
      const matchesSearch = !incomeSearch || Object.values(r).join(' ').toLowerCase().includes(incomeSearch.toLowerCase());
      const matchesCat = !incomeCatFilter || r.category === incomeCatFilter;
      return matchesSearch && matchesCat;
    });
  }, [income.rows, incomeSearch, incomeCatFilter]);
  const incomeCategories = useMemo(() => [...new Set(income.rows.map(r => r.category).filter(Boolean))], [income.rows]);
  const topIncomeCategory = topIncomeCats[0]?.[0] || '—';
  const avgIncomePerEntry = income.total > 0 ? income.sum / income.total : 0;

  // Expenses tab filters
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCatFilter, setExpenseCatFilter] = useState('');
  const filteredExpenses = useMemo(() => {
    return expenses.rows.filter(r => {
      const matchesSearch = !expenseSearch || Object.values(r).join(' ').toLowerCase().includes(expenseSearch.toLowerCase());
      const matchesCat = !expenseCatFilter || r.category === expenseCatFilter;
      return matchesSearch && matchesCat;
    });
  }, [expenses.rows, expenseSearch, expenseCatFilter]);
  const expenseCategories = useMemo(() => [...new Set(expenses.rows.map(r => r.category).filter(Boolean))], [expenses.rows]);
  const topExpenseCategory = topExpenseCats[0]?.[0] || '—';
  const avgExpensePerEntry = expenses.total > 0 ? expenses.sum / expenses.total : 0;

  // Monthly net bar data for overview
  const monthlyNetData = pnlWithCumulative.map(r => ({
    month: r.month,
    net: r.profit,
  }));

  return (
    <div className="space-y-6">
      {/* ── STRATEGIC HEADER ── */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
                <Landmark size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Financial Control Center</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  {income.total} income entries · {expenses.total} expense entries · {currentMonthLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-1 backdrop-blur-sm">
              <button onClick={() => setMonth(cAddMonth(month || currentMonthLabel, -1))}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <ChevronLeft size={15} />
              </button>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                className="px-2 py-1 text-sm font-medium text-white bg-transparent focus:outline-none cursor-pointer" />
              <button onClick={() => setMonth(cAddMonth(month || currentMonthLabel, +1))}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <ChevronRight size={15} />
              </button>
              <button onClick={() => setMonth('')}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Reset to all">
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Quick stats in header */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            <div className="rounded-xl p-3 bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownCircle size={14} className="text-emerald-400" />
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Income</span>
              </div>
              <p className="text-xl font-bold tabular-nums">{cFmt(income.sum)}</p>
              {prevMonthData.income !== 0 && (
                <p className={`text-[10px] font-medium mt-0.5 flex items-center gap-0.5 ${prevMonthData.income >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {prevMonthData.income >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                  vs prev month
                </p>
              )}
            </div>
            <div className="rounded-xl p-3 bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpCircle size={14} className="text-rose-400" />
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Expenses</span>
              </div>
              <p className="text-xl font-bold tabular-nums">{cFmt(expenses.sum)}</p>
              {prevMonthData.expenses !== 0 && (
                <p className={`text-[10px] font-medium mt-0.5 flex items-center gap-0.5 ${prevMonthData.expenses >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {prevMonthData.expenses >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                  vs prev month
                </p>
              )}
            </div>
            <div className="rounded-xl p-3 bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-blue-400" />
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Net Profit</span>
              </div>
              <p className="text-xl font-bold tabular-nums">{cFmt(income.sum - expenses.sum)}</p>
              {prevMonthData.profit !== 0 && (
                <p className={`text-[10px] font-medium mt-0.5 flex items-center gap-0.5 ${prevMonthData.profit >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                  {prevMonthData.profit >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                  vs prev month
                </p>
              )}
            </div>
            <div className="rounded-xl p-3 bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-1">
                <Wallet size={14} className="text-amber-400" />
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cash Position</span>
              </div>
              <p className="text-xl font-bold tabular-nums">{cFmt(liveBalance)}</p>
              <p className={`text-[10px] font-medium mt-0.5 ${liveBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {liveBalance >= 0 ? 'Healthy' : 'Deficit'} position
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI row (light cards below header) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <FinKpi icon={<ArrowDownCircle size={18} />} label="Total Income" value={income.sum} color="emerald" symbol="৳" />
        <FinKpi icon={<ArrowUpCircle size={18} />} label="Total Expenses" value={expenses.sum} color="rose" symbol="৳" />
        <FinKpi icon={<DollarSign size={18} />} label="Net Profit" value={income.sum - expenses.sum} color="blue" symbol="৳" />
        <FinKpi icon={<Wallet size={18} />} label="Cash Position" value={liveBalance} color={liveBalance >= 0 ? 'amber' : 'rose'} symbol="৳" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200/60 overflow-x-auto">
        {[
          ['overview', 'LayoutDashboard', 'Overview'],
          ['cashflow', 'Receipt', 'Cashflow'],
          ['income', 'ArrowDownCircle', 'Income Ledger'],
          ['expenses', 'ArrowUpCircle', 'Expense Ledger'],
          ['year', 'Calendar', 'Year View'],
          ['investors', 'Landmark', 'Investors'],
        ].map(([t, iconName, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5
              ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          {pnlWithCumulative.length > 0 ? (
            <>
              {/* Top summary strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryPill label="Total Income" value={income.sum} accent="emerald" />
                <SummaryPill label="Total Expenses" value={expenses.sum} accent="rose" />
                <SummaryPill label="Net Profit" value={income.sum - expenses.sum} accent="blue" />
                <SummaryPill label="Profit Margin" value={`${profitMargin}%`} accent="indigo" />
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setModal({ type: 'income' })}
                  className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 shadow-sm transition-colors">
                  <Plus size={14} /> Add Income
                </button>
                <button onClick={() => setModal({ type: 'expenses' })}
                  className="flex items-center gap-1.5 bg-rose-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-rose-700 shadow-sm transition-colors">
                  <Plus size={14} /> Add Expense
                </button>
                <button onClick={() => setModal({ type: 'initCash' })}
                  className="flex items-center gap-1.5 bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-800 shadow-sm transition-colors">
                  <Cog size={14} /> Set Opening Cash
                </button>
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Monthly Income vs Expenses</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={pnlWithCumulative} margin={{ left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={v => '৳' + Number(v).toLocaleString()} contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)' }} />
                      <Legend />
                      <Bar dataKey="income" fill="#34d399" name="Income" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" fill="#fca5a5" name="Expense" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Cumulative Profit</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={pnlWithCumulative} margin={{ left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={v => '৳' + Number(v).toLocaleString()} contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)' }} />
                      <Line type="monotone" dataKey="cumulative" stroke="#6366f1" strokeWidth={2.5} dot={false} name="Cumulative" />
                      <Line type="monotone" dataKey="profit" stroke="#34d399" strokeWidth={2} dot={false} name="Monthly Net" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Mini net profit bar chart */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Monthly Net Profit</h3>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={monthlyNetData} margin={{ left: -10, right: 0, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={v => '৳' + Number(v).toLocaleString()} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} />
                    <Bar dataKey="net" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                      {monthlyNetData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.net >= 0 ? '#10b981' : '#f43f5e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Category breakdown summary */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Top Income Categories</h3>
                  <div className="space-y-2">
                    {topIncomeCats.length > 0 ? topIncomeCats.map(([cat, amt], i) => (
                      <div key={cat} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                          <span className="text-sm text-slate-700 font-medium">{cat}</span>
                        </div>
                        <span className="text-sm font-bold text-emerald-600 tabular-nums">{cFmt(amt)}</span>
                      </div>
                    )) : <p className="text-sm text-slate-400 italic">No categories recorded</p>}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Top Expense Categories</h3>
                  <div className="space-y-2">
                    {topExpenseCats.length > 0 ? topExpenseCats.map(([cat, amt], i) => (
                      <div key={cat} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                          <span className="text-sm text-slate-700 font-medium">{cat}</span>
                        </div>
                        <span className="text-sm font-bold text-rose-600 tabular-nums">{cFmt(amt)}</span>
                      </div>
                    )) : <p className="text-sm text-slate-400 italic">No categories recorded</p>}
                  </div>
                </div>
              </div>

              {/* P&L table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Monthly P&L</h3>
                  <span className="text-xs text-slate-400">{sortedPnl.length} months</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/60 border-b border-slate-100">
                      <tr>
                        {['Month', 'Income', 'Expense', 'Net Balance', 'Margin', 'Cumulative'].map(h => (
                          <th key={h} className="text-left py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {sortedPnl.map((r, idx) => (
                        <tr key={r.month} className={`hover:bg-slate-50 ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                          <td className="py-2.5 px-4 font-medium text-slate-800">{r.month}</td>
                          <td className="py-2.5 px-4 text-emerald-600 font-semibold tabular-nums">{cFmt(r.income)}</td>
                          <td className="py-2.5 px-4 text-rose-500 font-semibold tabular-nums">{cFmt(r.expense)}</td>
                          <td className={`py-2.5 px-4 font-bold tabular-nums ${r.profit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                            {r.profit >= 0 ? '+' : ''}{cFmt(r.profit)}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 font-medium">{r.margin}%</td>
                          <td className="py-2.5 px-4 text-indigo-600 font-semibold tabular-nums">{cFmt(r.cumulative)}</td>
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

      {tab === 'income' && (
        <div className="space-y-4">
          {/* Income KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiPill icon={<ArrowDownCircle size={16} />} label="Total Income" value={cFmt(income.sum)} color="emerald" />
            <KpiPill icon={<Receipt size={16} />} label="Records" value={income.total} color="slate" sub={`${income.total} entries`} />
            <KpiPill icon={<BarChart3 size={16} />} label="Avg per Entry" value={cFmt(avgIncomePerEntry)} color="blue" />
            <KpiPill icon={<TrendingUp size={16} />} label="Top Category" value={topIncomeCategory} color="indigo" />
          </div>

          {/* Donut + Table */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-1">
              <DonutPanel
                title="Income by Category"
                total={income.sum}
                rows={Object.entries(incCatMap).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)}
                palette={['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#86efac', '#22c55e', '#16a34a']}
                accent="emerald"
              />
            </div>
            <div className="xl:col-span-2 space-y-3">
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search income..."
                      value={incomeSearch}
                      onChange={e => setIncomeSearch(e.target.value)}
                      className="pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none w-56"
                    />
                  </div>
                  <select
                    value={incomeCatFilter}
                    onChange={e => setIncomeCatFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                  >
                    <option value="">All Categories</option>
                    {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button onClick={() => setModal({ type: 'income' })}
                  className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 shadow-sm transition-colors">
                  <Plus size={14} /> Add Income
                </button>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/60 border-b border-slate-100">
                      <tr>
                        <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-400">#</th>
                        {['Date', 'Category', 'Lead ID', 'Client', 'Reference', 'Amount', 'Notes'].map(h => (
                          <th key={h} className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th>
                        ))}
                        <th />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredIncome.map((r, idx) => (
                        <tr key={r.id} className={`hover:bg-slate-50 group transition-colors ${idx % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
                          <td className="py-2.5 px-4 text-xs text-slate-400 font-medium">{idx + 1}</td>
                          <td className="py-2.5 px-4 text-slate-600">{r.date}</td>
                          <td className="py-2.5 px-4 text-slate-600">{r.category || '—'}</td>
                          <td className="py-2.5 px-4 text-slate-600">{r.lead_id || '—'}</td>
                          <td className="py-2.5 px-4 text-slate-600">{r.client_name || '—'}</td>
                          <td className="py-2.5 px-4 text-slate-500 text-xs">{r.reference || '—'}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-emerald-600 tabular-nums">{cFmt(r.amount)}</td>
                          <td className="py-2.5 px-4 text-slate-500 text-xs max-w-[200px] truncate">{r.notes || '—'}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setModal({ type: 'income', record: r })} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" aria-label="Edit"><Pencil size={13} /></button>
                              <button onClick={() => handleDelete('income', r.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg" aria-label="Delete"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredIncome.length === 0 && (
                        <tr><td colSpan={9} className="py-12 text-center text-slate-400">No matching records</td></tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50/60 border-t border-slate-100">
                      <tr>
                        <td colSpan={6} className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Total</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600 tabular-nums">{cFmt(filteredIncome.reduce((s, r) => s + (r.amount || 0), 0))}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'expenses' && (
        <div className="space-y-4">
          {/* Expense KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiPill icon={<ArrowUpCircle size={16} />} label="Total Expenses" value={cFmt(expenses.sum)} color="rose" />
            <KpiPill icon={<Receipt size={16} />} label="Records" value={expenses.total} color="slate" sub={`${expenses.total} entries`} />
            <KpiPill icon={<BarChart3 size={16} />} label="Avg per Entry" value={cFmt(avgExpensePerEntry)} color="blue" />
            <KpiPill icon={<TrendingDown size={16} />} label="Top Category" value={topExpenseCategory} color="indigo" />
          </div>

          {/* Donut + Table */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-1">
              <DonutPanel
                title="Expenses by Category"
                total={expenses.sum}
                rows={Object.entries(expCatMap).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)}
                palette={['#f43f5e', '#fb7185', '#fda4af', '#fecdd3', '#fee2e2', '#f87171', '#ef4444', '#dc2626', '#b91c1c']}
                accent="rose"
              />
            </div>
            <div className="xl:col-span-2 space-y-3">
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search expenses..."
                      value={expenseSearch}
                      onChange={e => setExpenseSearch(e.target.value)}
                      className="pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-rose-100 focus:border-rose-500 outline-none w-56"
                    />
                  </div>
                  <select
                    value={expenseCatFilter}
                    onChange={e => setExpenseCatFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-rose-100 focus:border-rose-500 outline-none"
                  >
                    <option value="">All Categories</option>
                    {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button onClick={() => setModal({ type: 'expenses' })}
                  className="flex items-center gap-1.5 bg-rose-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-rose-700 shadow-sm transition-colors">
                  <Plus size={14} /> Add Expense
                </button>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/60 border-b border-slate-100">
                      <tr>
                        <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-400">#</th>
                        {['Date', 'Category', 'Paid To', 'Reference', 'Amount', 'Notes'].map(h => (
                          <th key={h} className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th>
                        ))}
                        <th />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredExpenses.map((r, idx) => (
                        <tr key={r.id} className={`hover:bg-slate-50 group transition-colors ${idx % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
                          <td className="py-2.5 px-4 text-xs text-slate-400 font-medium">{idx + 1}</td>
                          <td className="py-2.5 px-4 text-slate-600">{r.date}</td>
                          <td className="py-2.5 px-4 text-slate-600">{r.category || '—'}</td>
                          <td className="py-2.5 px-4 text-slate-600">
                            <div>{r.paid_to || '—'}</div>
                            {r.student_name && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md mt-0.5">
                                <GraduationCap size={12} className="text-blue-600" />
                                {r.student_name} {r.lead_id ? `(${r.lead_id})` : ''}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 text-xs">{r.reference || '—'}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-rose-600 tabular-nums">{cFmt(r.amount)}</td>
                          <td className="py-2.5 px-4 text-slate-500 text-xs max-w-[200px] truncate">{r.notes || '—'}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setModal({ type: 'expenses', record: r })} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" aria-label="Edit"><Pencil size={13} /></button>
                              <button onClick={() => handleDelete('expenses', r.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg" aria-label="Delete"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredExpenses.length === 0 && (
                        <tr><td colSpan={8} className="py-12 text-center text-slate-400">No matching records</td></tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50/60 border-t border-slate-100">
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Total</td>
                        <td className="px-4 py-3 text-right font-bold text-rose-600 tabular-nums">{cFmt(filteredExpenses.reduce((s, r) => s + (r.amount || 0), 0))}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'cashflow' && <CashflowTab onChanged={load} settings={settings} />}
      {tab === 'year' && <YearTab />}
      {tab === 'investors' && <InvestorsTab />}

      {modal && modal.type === 'initCash' && (
        <InitialCashModal current={liveBalance} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
      {modal && modal.type !== 'initCash' && (
        <Modal title={`${modal.record ? 'Edit' : 'Add'} ${modal.type === 'income' ? 'Income' : 'Expense'}`} onClose={() => setModal(null)}>
          <FinanceForm type={modal.type} record={modal.record} settings={settings}
            onSave={(newMonth) => { setModal(null); if (newMonth) setMonth(newMonth); load(); }} />
        </Modal>
      )}
    </div>
  );
}

function SummaryPill({ label, value, accent }) {
  const accentStyles = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  };
  return (
    <div className={`rounded-2xl p-4 border shadow-sm ${accentStyles[accent] || 'bg-slate-50 text-slate-700 border-slate-100'}`}>
      <p className="text-[10px] uppercase font-bold tracking-wider opacity-60 mb-1">{label}</p>
      <p className="text-lg font-bold tabular-nums">{typeof value === 'number' ? cFmt(value) : value}</p>
    </div>
  );
}

function FinKpi({ icon, label, value, color, symbol }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-500',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  const textColors = { emerald: 'text-emerald-700', rose: 'text-rose-600', blue: 'text-blue-700', amber: 'text-amber-700' };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
      <div className={`p-3 rounded-xl ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className={`text-2xl font-bold ${textColors[color]} tabular-nums`}>{symbol}{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

function EmptyFinance({ onAdd }) {
  return (
    <div className="bg-white border border-dashed border-slate-300 rounded-2xl py-16 text-center shadow-sm">
      <DollarSign className="mx-auto text-slate-300 mb-3" size={40} />
      <p className="text-slate-500 font-medium">No finance records yet</p>
      <p className="text-slate-400 text-sm mb-4">Start by adding income or expense entries</p>
      <button onClick={onAdd} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors">
        Add First Entry
      </button>
    </div>
  );
}

function FinanceForm({ type, record, settings, onSave }) {
  const [form, setForm] = useState(record || { date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState([]);
  const cats = type === 'income' ? settings?.incomeCategories || [] : settings?.expenseCategories || [];
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    api.studentsList()
      .then(data => setStudents(data || []))
      .catch(() => {});
  }, []);

  const studentCategories = ['Visa', 'Visa Fee', 'Application Fee', 'App Fee', 'Air Ticket', 'Ticket', 'Medical', 'Service Charge', 'File Opening', 'Application Deposit', 'Tuition Fee'];
  const isStudentRelated = studentCategories.some(c => (form.category || '').toLowerCase().includes(c.toLowerCase()));

  const handleStudentSelect = (e) => {
    const val = e.target.value;
    if (!val) {
      set('student_name', '');
      set('client_name', '');
      set('lead_id', '');
      return;
    }
    const sel = students.find(s => String(s.id) === String(val) || String(s.lead_id) === String(val));
    if (sel) {
      set('student_name', sel.client_name);
      set('client_name', sel.client_name);
      set('lead_id', sel.lead_id || `L-${sel.id}`);
      if (type === 'expenses' && !form.paid_to && form.category) {
        set('paid_to', `${form.category} - ${sel.client_name}`);
      }
    }
  };

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
      onSave(form.date ? form.date.slice(0, 7) : null);
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Date *</label>
          <input type="date" required
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
            value={form.date || ''} onChange={e => set('date', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Amount (BDT) *</label>
          <input type="number" step="any" required
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none tabular-nums"
            value={form.amount || ''} onChange={e => set('amount', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Category</label>
        <select
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
          value={form.category || ''} onChange={e => set('category', e.target.value)}>
          <option value="">— select —</option>
          {cats.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Student / Application sync dropdown */}
      <div className={`p-3 rounded-xl transition-all ${isStudentRelated ? 'bg-blue-50/70 border border-blue-200' : 'bg-slate-50/60 border border-slate-200/60'}`}>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <GraduationCap size={15} className="text-blue-600" /> Student Name / Application Sync
          </label>
          {isStudentRelated && (
            <span className="text-[10px] font-bold text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full">
              Linked for {form.category}
            </span>
          )}
        </div>

        <select
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none mb-2"
          value={students.find(s => s.client_name === (form.student_name || form.client_name) || (s.lead_id && s.lead_id === form.lead_id))?.id || ''}
          onChange={handleStudentSelect}>
          <option value="">— Select Student / Application —</option>
          {students.map(s => (
            <option key={s.id} value={s.id}>
              {s.client_name} ({s.lead_id || `ID:${s.id}`}) {s.destination ? `• ${s.destination}` : ''}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Student Name</label>
            <input
              type="text"
              placeholder="e.g. Ilhan"
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
              value={form.student_name || form.client_name || ''}
              onChange={e => {
                set('student_name', e.target.value);
                set('client_name', e.target.value);
              }}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Lead / App ID</label>
            <input
              type="text"
              placeholder="e.g. L-00042"
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
              value={form.lead_id || ''}
              onChange={e => set('lead_id', e.target.value)}
            />
          </div>
        </div>
      </div>

      {type === 'expenses' && (
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Paid To</label>
          <input
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
            value={form.paid_to || ''} onChange={e => set('paid_to', e.target.value)} placeholder="e.g. Chinese VISA Center" />
        </div>
      )}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Reference</label>
        <input
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
          value={form.reference || ''} onChange={e => set('reference', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Notes</label>
        <textarea rows={2}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none resize-none"
          value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
      </div>
      <div className="flex justify-end pt-1">
        <button type="submit" disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60 shadow-sm transition-colors">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

/* ───────────────────────────── CASHFLOW TAB ───────────────────────────── */
const cFmt = (n) => `৳${Math.round(Number(n || 0)).toLocaleString()}`;

function CashflowTab({ onChanged, settings }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const [cats, setCats] = useState({ income: [], expense: [] });
  const [editing, setEditing] = useState(null);
  const [initOpen, setInitOpen] = useState(false);

  const load = useCallback(async () => {
    const d = await api.cashflow(month); setData(d);
    const c = await api.cashflowCategories(); setCats(c);
  }, [month]);
  useEffect(() => { load(); }, [load]);

  const handleSaved = () => { setEditing(null); load(); onChanged?.(); };

  if (!data) return <div className="text-slate-400 text-center py-16">Loading…</div>;
  const { opening, income, expense, totals } = data;
  const cashColor = totals.closing < 0 ? 'rose' : totals.closing < (opening * 0.5) ? 'amber' : 'emerald';

  return (
    <div className="space-y-4">
      {/* Month nav + initial-cash setter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          <button onClick={() => setMonth(cAddMonth(month, -1))}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"><ChevronLeft size={15} /></button>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="px-2 py-1 text-sm font-medium text-slate-800 bg-transparent focus:outline-none cursor-pointer" />
          <button onClick={() => setMonth(cAddMonth(month, +1))}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"><ChevronRight size={15} /></button>
          <span className="px-2 text-xs text-slate-400 font-medium">{cMonthLabel(month)}</span>
        </div>
        <button onClick={() => setInitOpen(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 shadow-sm transition-colors">
          <Cog size={13} /> Set opening cash
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiPill icon={<Wallet size={16} />} label="Opening cash" value={cFmt(opening)} color="slate" />
        <KpiPill icon={<ArrowDownCircle size={16} />} label="Money in" value={cFmt(totals.in)} color="emerald" sub={`${income.length} entries`} />
        <KpiPill icon={<ArrowUpCircle size={16} />} label="Money out" value={cFmt(totals.out)} color="rose" sub={`${expense.length} entries`} />
        <KpiPill icon={<Activity size={16} />} label="Net for month" value={cFmt(totals.net)} color={totals.net >= 0 ? 'blue' : 'rose'} />
        <KpiPill icon={<PiggyBank size={16} />} label="Closing cash" value={cFmt(totals.closing)} color={cashColor} />
      </div>

      {/* Side-by-side ledger */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <LedgerCard
          side="in" title="Income" color="emerald"
          rows={income} total={totals.in}
          onAdd={() => setEditing({ side: 'in' })}
          onEdit={row => setEditing({ side: 'in', row })}
        />
        <LedgerCard
          side="out" title="Spend" color="rose"
          rows={expense} total={totals.out}
          onAdd={() => setEditing({ side: 'out' })}
          onEdit={row => setEditing({ side: 'out', row })}
        />
      </div>

      {/* Breakdown — donuts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DonutPanel
          title="Income breakdown"
          total={totals.in}
          rows={data.by_category.income}
          palette={['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#86efac', '#22c55e', '#16a34a']}
          accent="emerald" />
        <DonutPanel
          title="Spend breakdown"
          total={totals.out}
          rows={data.by_category.expense}
          palette={['#f43f5e', '#fb7185', '#fda4af', '#fecdd3', '#fee2e2', '#f87171', '#ef4444', '#dc2626', '#b91c1c']}
          accent="rose" />
      </div>
      {data.income_by_reference.length > 0 && (
        <BreakdownPanel title="Income by reference (who closed it)" rows={data.income_by_reference} color="blue" />
      )}

      {/* Editor modal */}
      {editing && (
        <CashflowEntryModal
          side={editing.side}
          row={editing.row}
          month={month}
          categories={editing.side === 'in' ? cats.income : cats.expense}
          employees={settings?.employees || []}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Set initial cash modal */}
      {initOpen && <InitialCashModal current={opening} onClose={() => setInitOpen(false)} onSaved={() => { setInitOpen(false); load(); }} />}
    </div>
  );
}

function KpiPill({ icon, label, value, sub, color }) {
  const colors = {
    slate: 'bg-slate-50 text-slate-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-start gap-2.5 shadow-sm">
      <div className={`p-2 rounded-xl ${colors[color]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-500 font-bold">{label}</p>
        <p className="text-xl font-bold text-slate-800 leading-tight tabular-nums">{value}</p>
        {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

function LedgerCard({ side, title, rows, total, onAdd, onEdit }) {
  const tone = side === 'in'
    ? { head: 'bg-emerald-50 text-emerald-700 border-emerald-100', total: 'text-emerald-700' }
    : { head: 'bg-rose-50 text-rose-700 border-rose-100', total: 'text-rose-700' };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${tone.head}`}>
        <div className="flex items-center gap-2">
          {side === 'in' ? <ArrowDownCircle size={15} /> : <ArrowUpCircle size={15} />}
          <p className="font-semibold text-sm">{title}</p>
          <span className="text-xs font-medium opacity-70">· {rows.length} entries</span>
        </div>
        <button onClick={onAdd}
          className="flex items-center gap-1 text-xs font-medium bg-white border border-current px-2.5 py-1 rounded-xl hover:bg-current/5 shadow-sm transition-colors">
          <Plus size={12} /> Add
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/60 text-[10px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="text-left px-3 py-2 font-bold">Type</th>
              <th className="text-left px-3 py-2 font-bold">{side === 'in' ? 'Client' : 'Paid to'}</th>
              <th className="text-left px-3 py-2 font-bold">Reference</th>
              <th className="text-left px-3 py-2 font-bold">Handled by</th>
              <th className="text-right px-3 py-2 font-bold">Amount</th>
              <th className="text-right px-3 py-2 font-bold">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-slate-400 py-8 italic">No entries this month</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} onClick={() => onEdit(r)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                <td className="px-3 py-2 text-slate-700">{r.category || '—'}</td>
                <td className="px-3 py-2 text-slate-700 max-w-[160px] truncate">{r.client_name || '—'}</td>
                <td className="px-3 py-2 text-slate-500 text-xs max-w-[140px] truncate">{r.reference || '—'}</td>
                <td className="px-3 py-2 text-slate-600 text-xs max-w-[120px] truncate">
                  {r.employee_name ? (
                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                      <Users size={10} /> {r.employee_name}
                    </span>
                  ) : '—'}
                </td>
                <td className={`px-3 py-2 text-right font-semibold tabular-nums ${tone.total}`}>{cFmt(r.amount)}</td>
                <td className="px-3 py-2 text-right text-slate-500 tabular-nums text-xs">{cFmt(r.running)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50/60">
            <tr>
              <td colSpan={4} className="px-3 py-2.5 text-right text-slate-500 text-xs font-bold uppercase tracking-wide">Total</td>
              <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${tone.total}`}>{cFmt(total)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function DonutPanel({ title, total, rows, palette, accent }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <p className="font-semibold text-slate-700 text-sm mb-1">{title}</p>
        <p className="text-xs text-slate-400 italic py-8 text-center">No entries this month</p>
      </div>
    );
  }
  const top = rows.slice(0, 6).map(r => ({ name: r.name, value: r.amount }));
  const tail = rows.slice(6).reduce((s, r) => s + (r.amount || 0), 0);
  if (tail > 0) top.push({ name: 'Other', value: tail });
  const accentText = { emerald: 'text-emerald-700', rose: 'text-rose-700', blue: 'text-blue-700' }[accent] || 'text-slate-700';
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <p className="font-semibold text-slate-700 text-sm mb-3">{title}</p>
      <div className="grid grid-cols-5 gap-3 items-center">
        <div className="col-span-2 relative">
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={top} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} stroke="none" paddingAngle={1}>
                {top.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => cFmt(v)} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className={`text-base font-bold ${accentText} tabular-nums leading-tight`}>{cFmt(total)}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">total</p>
          </div>
        </div>
        <div className="col-span-3 space-y-1">
          {top.map((r, i) => (
            <div key={r.name} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: palette[i % palette.length] }} />
              <span className="text-slate-600 truncate flex-1">{r.name}</span>
              <span className="text-slate-800 font-semibold tabular-nums">{cFmt(r.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BreakdownPanel({ title, rows, color }) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map(r => r.amount));
  const bar = { emerald: 'bg-emerald-400', rose: 'bg-rose-400', blue: 'bg-blue-400' }[color] || 'bg-slate-400';
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <p className="font-semibold text-slate-700 text-sm mb-3">{title}</p>
      <div className="space-y-2">
        {rows.slice(0, 8).map(r => (
          <div key={r.name}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-600 truncate max-w-[60%]">{r.name}</span>
              <span className="text-slate-700 font-semibold tabular-nums">{cFmt(r.amount)}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${bar}`} style={{ width: `${(r.amount / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CashflowEntryModal({ side, row, month, categories, employees, onClose, onSaved }) {
  const editing = !!row;
  const todayStr = new Date().toISOString().slice(0, 10);
  const defaultDate = row?.date || (month ? `${month}-${String(new Date().getDate()).padStart(2, '0')}` : todayStr);
  const [form, setForm] = useState({
    date: defaultDate,
    category: row?.category || '',
    client_name: row?.client_name || '',
    reference: row?.reference || '',
    amount: row?.amount || '',
    notes: row?.notes || '',
    employee_id: row?.employee_id || '',
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      date: form.date,
      category: form.category || null,
      amount: Number(form.amount) || 0,
      reference: form.reference || null,
      notes: form.notes || null,
      employee_id: form.employee_id ? Number(form.employee_id) : null,
      ...(side === 'in' ? { client_name: form.client_name } : { paid_to: form.client_name }),
    };
    try {
      if (side === 'in') {
        if (editing) await api.updateIncome(row.id, payload);
        else await api.createIncome(payload);
      } else {
        if (editing) await api.updateExpense(row.id, payload);
        else await api.createExpense(payload);
      }
      onSaved(form.date ? form.date.slice(0, 7) : null);
      toast.success(editing ? 'Entry updated' : `${side === 'in' ? 'Income' : 'Spend'} added`);
    } catch (err) { toast.error(err.message || 'Could not save'); }
    setSaving(false);
  };

  const del = async () => {
    const ok = await confirm({ title: 'Delete this entry?', tone: 'danger', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      if (side === 'in') await api.deleteIncome(row.id);
      else await api.deleteExpense(row.id);
      onSaved();
      toast.info('Entry deleted');
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 rounded-t-2xl">
          <h3 className="font-bold text-slate-800">{editing ? 'Edit' : 'New'} {side === 'in' ? 'income' : 'spend'}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">✕</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Date</label>
              <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Type</label>
              <input list="cf-cats" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder={side === 'in' ? 'Service Charge' : 'Salary'}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none" />
              <datalist id="cf-cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">{side === 'in' ? 'Client / source' : 'Paid to'}</label>
            <input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
              placeholder={side === 'in' ? 'MD SAIFUL HAQUE' : 'Office Rent'}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Reference</label>
              <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                placeholder="e.g. Mukta (Rakib), Bank, Cash"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Amount (৳)</label>
              <input type="number" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none tabular-nums" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Handled by</label>
            <select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none cursor-pointer">
              <option value="">— Unassigned —</option>
              {employees.map(e => (
                <option key={e.id} value={String(e.id)}>{e.name} · {e.role || 'No role'} · EMP:{e.emp_id || '-'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none resize-none" />
          </div>
          <div className="flex items-center justify-between pt-2">
            {editing ? (
              <button type="button" onClick={del}
                className="text-xs text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors">
                <Trash2 size={12} /> Delete
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button type="submit" disabled={saving}
                className={`text-sm px-4 py-2 rounded-xl text-white disabled:opacity-60 flex items-center gap-2 shadow-sm transition-colors
                  ${side === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                <Save size={13} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function InitialCashModal({ current, onClose, onSaved }) {
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await api.setInitialCash(Number(val) || 0); onSaved(); toast.success('Opening cash updated'); }
    catch (err) { toast.error(err.message); }
    setSaving(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 rounded-t-2xl">
          <h3 className="font-bold text-slate-800">Set opening cash</h3>
          <p className="text-xs text-slate-500 mt-0.5">The cash balance you started with, before any income or expenses were recorded.</p>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <p className="text-xs text-slate-500">Current computed opening for this view: <strong>{cFmt(current)}</strong></p>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Opening cash (৳)</label>
            <input type="number" required value={val} onChange={e => setVal(e.target.value)} autoFocus
              placeholder="0"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-lg font-semibold tabular-nums bg-slate-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="text-sm px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="text-sm px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 shadow-sm transition-colors">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ───────────────────────────── YEAR TAB ───────────────────────────── */
function YearTab() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [data, setData] = useState(null);
  useEffect(() => { api.cashflowYear(year).then(setData); }, [year]);

  if (!data) return <div className="text-slate-400 text-center py-16">Loading…</div>;

  const yearIncome = data.rows.reduce((s, r) => s + (r.income || 0), 0);
  const yearExpense = data.rows.reduce((s, r) => s + (r.expense || 0), 0);
  const yearNet = yearIncome - yearExpense;

  return (
    <div className="space-y-4">
      {/* Year KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiPill icon={<Wallet size={16} />} label="Year Opening" value={cFmt(data.opening)} color="slate" />
        <KpiPill icon={<ArrowDownCircle size={16} />} label="Year Income" value={cFmt(yearIncome)} color="emerald" />
        <KpiPill icon={<ArrowUpCircle size={16} />} label="Year Expenses" value={cFmt(yearExpense)} color="rose" />
        <KpiPill icon={<PiggyBank size={16} />} label="Year Closing" value={cFmt(data.closing)} color={data.closing >= data.opening ? 'emerald' : 'amber'} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          <button onClick={() => setYear(y => y - 1)} className="p-1.5 hover:bg-slate-50 rounded-lg transition-colors" aria-label="Previous year"><ChevronLeft size={15} /></button>
          <span className="px-3 py-1 text-sm font-semibold">{data.year}</span>
          <button onClick={() => setYear(y => y + 1)} className="p-1.5 hover:bg-slate-50 rounded-lg transition-colors" aria-label="Next year"><ChevronRight size={15} /></button>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">Opening: <strong className="text-slate-800 tabular-nums">{cFmt(data.opening)}</strong></span>
          <span className="text-slate-500">→ Closing: <strong className={data.closing >= data.opening ? 'text-emerald-600' : 'text-rose-600'}>{cFmt(data.closing)}</strong></span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="text-left px-4 py-3 font-bold">Month</th>
                <th className="text-right px-4 py-3 font-bold">Opening</th>
                <th className="text-right px-4 py-3 font-bold">In</th>
                <th className="text-right px-4 py-3 font-bold">Out</th>
                <th className="text-right px-4 py-3 font-bold">Net</th>
                <th className="text-right px-4 py-3 font-bold">Closing</th>
                <th className="text-left px-4 py-3 font-bold">Cash trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.rows.map(r => {
                const max = Math.max(...data.rows.map(x => Math.abs(x.closing)), Math.abs(data.opening), 1);
                return (
                  <tr key={r.month} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{cMonthLabel(r.month)}</td>
                    <td className="px-4 py-3 text-right text-slate-500 tabular-nums">{cFmt(r.opening)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-semibold tabular-nums">{r.income ? cFmt(r.income) : <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-right text-rose-700 font-semibold tabular-nums">{r.expense ? cFmt(r.expense) : <span className="text-slate-300">—</span>}</td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${r.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{cFmt(r.net)}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-800">{cFmt(r.closing)}</td>
                    <td className="px-4 py-3">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-32">
                        <div className={`h-full rounded-full ${r.closing >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                          style={{ width: `${Math.min(100, (Math.abs(r.closing) / max) * 100)}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mini monthly net bar chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Monthly Net Profit</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data.rows} margin={{ left: -10, right: 0, top: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={m => m?.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} formatter={v => cFmt(v)} />
            <Bar dataKey="net" radius={[4, 4, 0, 0]}>
              {data.rows.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.net >= 0 ? '#10b981' : '#f43f5e'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data.rows} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={m => m?.slice(5)} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} formatter={v => cFmt(v)} />
          <Line type="monotone" dataKey="closing" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Cash position" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─────────────────────────── INVESTORS TAB ─────────────────────────── */
const PROFIT_SHARES = {
  'Abdullah Al Rakib': { pct: 45, short: 'Rakib', color: 'bg-blue-500', bar: 'bg-blue-500' },
  'Tahmid Imam': { pct: 30, short: 'Tahmid', color: 'bg-violet-500', bar: 'bg-violet-500' },
  'Sakib Al Jubaer': { pct: 25, short: 'Sakib', color: 'bg-amber-500', bar: 'bg-amber-500' }
};

function InvestorsTab() {
  const [data, setData] = useState(null);
  const [showInvestModal, setShowInvestModal] = useState(false);
  const load = () => api.cashflowInvestors().then(setData).catch(() => setData({ total: 0, contributions: [], by_person: [] }));
  useEffect(() => { load(); }, []);

  if (!data) return <div className="text-slate-400 text-center py-16">Loading…</div>;
  const max = Math.max(...data.by_person.map(p => p.amount), 1);

  return (
    <div className="space-y-4">
      {/* Dark header for investors */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
              <PiggyBank size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Investor Dashboard</h1>
              <p className="text-sm text-slate-400 mt-0.5">Capital contributions & profit sharing</p>
            </div>
          </div>
          <button
            onClick={() => setShowInvestModal(true)}
            className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-violet-700 shadow-sm transition-colors"
          >
            <Plus size={16} /> Add Investment
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 font-bold">Total capital injected</p>
          <p className="text-3xl font-bold text-slate-800 mt-1 tabular-nums">{cFmt(data.total)}</p>
          <p className="text-xs text-slate-400 mt-0.5">From {data.by_person.length} {data.by_person.length === 1 ? 'person' : 'people'} · {data.contributions.length} entries</p>
        </div>
        <button
          onClick={() => setShowInvestModal(true)}
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-violet-700 shadow-sm transition-colors"
        >
          <Plus size={16} /> Add Investment
        </button>
      </div>

      {data.by_person.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">
          <PiggyBank size={32} className="text-slate-300 mx-auto mb-2" />
          <p className="text-slate-600 font-semibold">No investor entries yet</p>
          <p className="text-xs text-slate-400 mt-1">Click <strong>Add Investment</strong> to record a partner capital contribution.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contributions breakdown */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
              <div>
                <p className="font-semibold text-slate-700 text-sm mb-3">Capital Contributions</p>
                <div className="space-y-3.5">
                  {data.by_person.map(p => {
                    const share = PROFIT_SHARES[p.name];
                    const barColor = share ? share.bar : 'bg-slate-400';
                    return (
                      <div key={p.name}>
                        <div className="flex justify-between items-center text-sm mb-1.5">
                          <span className="font-medium text-slate-700 flex items-center gap-1.5">
                            {p.name}
                            {share && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200/40">
                                {share.pct}% Share
                              </span>
                            )}
                          </span>
                          <span className="font-bold text-slate-800 tabular-nums">{cFmt(p.amount)}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${barColor} rounded-full`} style={{ width: `${(p.amount / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Profit sharing policy split */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
              <div>
                <p className="font-semibold text-slate-700 text-sm mb-1">Partnership Profit Sharing</p>
                <p className="text-[11px] text-slate-400 mb-4">Official profit distribution schedule splits net profits annually in September.</p>
                <div className="space-y-3">
                  {Object.entries(PROFIT_SHARES).map(([name, val]) => (
                    <div key={name} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-50 bg-slate-50/40">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${val.color}`} />
                        <div>
                          <p className="text-xs font-semibold text-slate-700">{name}</p>
                          <p className="text-[10px] text-slate-400 font-medium">Partner</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-slate-800">{val.pct}%</span>
                        <p className="text-[9px] text-slate-400 font-medium tracking-tight">Distribution</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-start gap-2 text-[10px] text-slate-400 leading-normal">
                <span className="text-amber-500 font-bold">ℹ</span>
                <span>Annual distributions are computed on net cash book balances at the end of the August financial ledger.</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <p className="font-semibold text-slate-700 text-sm">All contributions</p>
              <button onClick={() => setShowInvestModal(true)} className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-xl transition-colors">
                <Plus size={13} /> Add Investment
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/40 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="text-left px-4 py-2 font-bold">Date</th>
                    <th className="text-left px-4 py-2 font-bold">Investor</th>
                    <th className="text-left px-4 py-2 font-bold">Reference</th>
                    <th className="text-right px-4 py-2 font-bold">Amount</th>
                    <th className="text-left px-4 py-2 font-bold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.contributions.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-2 text-slate-500">{c.date}</td>
                      <td className="px-4 py-2 font-medium text-slate-800">{c.client_name}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs">{c.reference || '—'}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums text-violet-700">{cFmt(c.amount)}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs max-w-[300px] truncate">{c.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Add Investment Modal */}
      {showInvestModal && (
        <Modal title="Record Investment" onClose={() => setShowInvestModal(false)}>
          <InvestmentForm
            onSave={() => { setShowInvestModal(false); load(); }}
            onCancel={() => setShowInvestModal(false)}
          />
        </Modal>
      )}
    </div>
  );
}

function InvestmentForm({ onSave, onCancel }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    date: today,
    client_name: '',
    amount: '',
    reference: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const toast = useToast();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!form.client_name || !form.amount) { setErr('Investor name and amount are required'); return; }
    setSaving(true); setErr('');
    try {
      await api.createIncome({
        date: form.date,
        client_name: form.client_name,
        amount: Number(form.amount),
        category: 'Investment',
        reference: form.reference || `Investment - ${form.date}`,
        notes: form.notes,
        payment_method: 'Bank Transfer',
      });
      toast.success(`Investment of ৳${Number(form.amount).toLocaleString()} recorded for ${form.client_name}`);
      onSave(form.date ? form.date.slice(0, 7) : null);
    } catch(e) {
      setErr(e.message);
      toast.error('Failed to record investment: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  const partners = Object.keys(PROFIT_SHARES);

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs text-slate-500">This will record the investment as an income entry under category <strong className="text-slate-700">Investment</strong> and immediately reflect in the Investors dashboard.</p>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Investor / Partner *</label>
        <div className="flex gap-2 flex-wrap mb-2">
          {partners.map(p => (
            <button key={p} type="button"
              onClick={() => set('client_name', p)}
              className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all ${form.client_name === p ? 'bg-violet-600 text-white border-violet-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300'}`}>
              {p}
            </button>
          ))}
        </div>
        <input
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-violet-100 focus:border-violet-500 outline-none"
          placeholder="Or type investor name"
          value={form.client_name}
          onChange={e => set('client_name', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Date *</label>
          <input type="date" required
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-violet-100 focus:border-violet-500 outline-none"
            value={form.date} onChange={e => set('date', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Amount (BDT) *</label>
          <input type="number" min="1" required
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-violet-100 focus:border-violet-500 outline-none tabular-nums"
            placeholder="e.g. 100000"
            value={form.amount} onChange={e => set('amount', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Reference / Transaction ID</label>
        <input
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-violet-100 focus:border-violet-500 outline-none"
          placeholder="Bank transfer ref, cheque no., etc."
          value={form.reference} onChange={e => set('reference', e.target.value)} />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Notes</label>
        <textarea rows={2}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-violet-100 focus:border-violet-500 outline-none resize-none"
          placeholder="Optional note about this capital injection"
          value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">Cancel</button>
        <button type="submit" disabled={saving} className="bg-violet-600 text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-60 shadow-sm transition-colors">
          {saving ? 'Recording…' : 'Record Investment'}
        </button>
      </div>
    </form>
  );
}
