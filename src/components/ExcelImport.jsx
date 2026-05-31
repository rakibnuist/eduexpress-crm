/* ExcelImport — handles two file shapes:
   1) CashFlow workbook: one sheet per month with Income + Spend tables
   2) File Updates workbook: Bangladesh / China sheets with student rows
   Parsing happens in the browser (SheetJS) so we never need multipart upload. */
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Trash2,
  X, Banknote, GraduationCap,
} from 'lucide-react';

const isLikelyMonthSheet = (name) =>
  /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(name.trim());

const MONTH_TO_NUMBER = { january:1, february:2, march:3, april:4, may:5, june:6, july:7, august:8, september:9, october:10, november:11, december:12 };

function parseAmount(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[,৳$\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function excelDateToISO(v, fallbackMonth) {
  if (!v && !fallbackMonth) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0,10);
  }
  if (fallbackMonth) return `${fallbackMonth}-15`;
  return null;
}
function yearOfFile(fname) {
  const m = fname.match(/20\d{2}/);
  return m ? parseInt(m[0]) : new Date().getFullYear();
}

/* ─── Cashflow parser ───
   Each month sheet has two side-by-side tables. Income block has columns:
   Type | Client | Reference | Amount (BDT) | Notes. Spend block: Type |
   Client | Amount (BDT) | Notes (sometimes Reference too). Header row sits
   on row 1 (0-indexed) so data starts at row 1.
*/
function parseCashflow(workbook, fileName) {
  const year = yearOfFile(fileName);
  const rows = [];
  for (const sheetName of workbook.SheetNames) {
    if (sheetName.toLowerCase() === 'final' || !isLikelyMonthSheet(sheetName)) continue;
    const monthNum = MONTH_TO_NUMBER[sheetName.toLowerCase()];
    if (!monthNum) continue;
    const month = `${year}-${String(monthNum).padStart(2, '0')}`;
    const sheet = workbook.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // Locate column indexes by header row (the second row in the sheet)
    const headerRow = aoa[1] || [];
    const idx = { incomeStart: -1, incomeType: -1, client: -1, reference: -1, amount: -1, notes: -1,
                  spendStart: -1, spendType: -1, spendClient: -1, spendAmount: -1, spendNotes: -1 };
    headerRow.forEach((cell, i) => {
      const s = String(cell || '').toLowerCase();
      if (s === 'type' && idx.incomeType === -1) idx.incomeType = i;
      else if (s === 'type' && idx.spendType === -1) idx.spendType = i;
      else if (s === 'client') {
        if (idx.client === -1) idx.client = i;
        else if (idx.spendClient === -1) idx.spendClient = i;
      }
      else if (s === 'reference' && idx.reference === -1) idx.reference = i;
      else if (s.includes('amount')) {
        if (idx.amount === -1) idx.amount = i;
        else if (idx.spendAmount === -1) idx.spendAmount = i;
      }
      else if (s === 'notes' || s === 'note') {
        if (idx.notes === -1) idx.notes = i;
        else if (idx.spendNotes === -1) idx.spendNotes = i;
      }
    });

    // Filter for the summary/totals rows that sit at the bottom of every
    // month sheet — we never want to import those as real entries because
    // they double-count the columns.
    const isSummary = (v) => {
      if (!v || typeof v !== 'string') return false;
      const s = v.trim().toLowerCase();
      return s === 'total' || s === 'total income' || s === 'total spend' ||
             s === 'total cash' || s === 'grand total' || s.startsWith('total ');
    };

    for (let r = 2; r < aoa.length; r++) {
      const row = aoa[r];
      if (!row) continue;
      // Income side
      const inType = row[idx.incomeType], inClient = row[idx.client], inAmount = parseAmount(row[idx.amount]);
      if (inAmount && (inType || inClient) && !isSummary(inType) && !isSummary(inClient)) {
        rows.push({
          kind: 'in',
          month,
          date: excelDateToISO(row[idx.notes] || null, month),
          category: inType || null,
          client_name: inClient || null,
          reference: row[idx.reference] || null,
          amount: inAmount,
          notes: typeof row[idx.notes] === 'string' && !/^\d{4}-\d{2}-\d{2}/.test(row[idx.notes]) ? row[idx.notes] : null,
        });
      }
      // Spend side
      const outType = row[idx.spendType], outClient = row[idx.spendClient], outAmount = parseAmount(row[idx.spendAmount]);
      if (outAmount && (outType || outClient) && !isSummary(outType) && !isSummary(outClient)) {
        rows.push({
          kind: 'out',
          month,
          date: excelDateToISO(row[idx.spendNotes] || null, month),
          category: outType || null,
          client_name: outClient || null,
          reference: null,
          amount: outAmount,
          notes: typeof row[idx.spendNotes] === 'string' ? row[idx.spendNotes] : null,
        });
      }
    }
  }
  return rows;
}

/* ─── Application parser — Bangladesh / China sheets in File Updates 2026 ─── */
function parseApplications(workbook, fileName) {
  const rows = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (aoa.length < 2) continue;
    // Header row is usually row 0
    const header = (aoa[0] || []).map(c => String(c || '').trim().toLowerCase());
    const col = (names) => {
      for (const n of names) {
        const i = header.indexOf(n);
        if (i !== -1) return i;
      }
      return -1;
    };
    const cName        = col(['name']);
    const cRemark      = col(['remark', 'source']);
    const cNationality = col(['nationality']);
    const cPassport    = col(['passport']);
    const cIntake      = col(['intake', 'intake term']);
    const cDegree      = col(['degree']);
    const cMajor       = col(['major', 'program']);
    const cStatus      = col(['stutus','status']);
    const cNotes       = col(['notes','note']);
    const cUnis        = col(['universities','university']);
    const cReferrer    = col(['referance','reference','referrer']);
    const cDriveLink   = col(['drive link', 'drive', 'drive_link']);
    const cDeposit     = col(['deposit']);
    if (cName === -1) continue;

    // Destination guess: sheet name (Bangladesh, China, …) — used when row lacks one
    const destFromSheet = /china/i.test(sheetName) ? 'China' :
                          /malta/i.test(sheetName) ? 'Malta' :
                          /hungary/i.test(sheetName) ? 'Hungary' :
                          /greece/i.test(sheetName) ? 'Greece' :
                          /estonia/i.test(sheetName) ? 'Estonia' :
                          /bangladesh|bd/i.test(sheetName) ? null : null;
    // For 'Bangladesh' sheet, students are Bangladeshi but the study destination
    // is implied as 'China' by the workbook context (most rows in Bangladesh
    // sheet are MBBS/Bachelor heading to China).
    const studyDest = /china/i.test(sheetName) ? 'China'
                    : /malta/i.test(sheetName) ? 'Malta'
                    : 'China'; // sensible default for EduExpress workbook

    for (let r = 1; r < aoa.length; r++) {
      const row = aoa[r];
      if (!row) continue;
      const name = row[cName];
      if (!name || typeof name !== 'string' || !name.trim()) continue;

      const remark = cRemark   >= 0 ? row[cRemark] : null;
      const isAgent = remark && !/eduexpress|office|inhouse/i.test(String(remark));
      const source = remark ? (isAgent ? 'Agent' : 'In-house') : null;

      rows.push({
        client_name: name.trim(),
        nationality: cNationality >= 0 ? row[cNationality] : null,
        passport:    cPassport    >= 0 ? row[cPassport]    : null,
        intake_term: cIntake      >= 0 ? row[cIntake]      : null,
        degree:      cDegree      >= 0 ? row[cDegree]      : null,
        major:       cMajor       >= 0 ? row[cMajor]       : null,
        status:      cStatus      >= 0 ? row[cStatus]      : null,
        universities:cUnis        >= 0 ? row[cUnis]        : null,
        referrer:    cReferrer    >= 0 ? row[cReferrer]    : null,
        drive_link:  cDriveLink   >= 0 ? row[cDriveLink]   : null,
        deposit:     cDeposit     >= 0 ? parseAmount(row[cDeposit]) : null,
        notes:       cNotes       >= 0 ? row[cNotes]       : null,
        source,
        destination: studyDest,
        lead_source: 'Excel: ' + sheetName,
      });
    }
  }
  return rows;
}

/* ─── UI component ─── */
export default function ExcelImport() {
  return (
    <div className="space-y-4">
      <ImporterCard
        title="Cashflow workbook"
        accept="CashFlow 2026.xlsx (one sheet per month)"
        icon={<Banknote size={18} />}
        parse={parseCashflow}
        submit={(rows) => api.importCashflow(rows)}
        summaryFields={['kind', 'month', 'category', 'client_name', 'reference', 'amount']}
        labels={{ kind: 'In/Out', month: 'Month', category: 'Type', client_name: 'Client/Paid to', reference: 'Reference', amount: 'Amount' }}
        renderCell={(field, val) => field === 'kind' ? (val === 'in' ? '↓ Income' : '↑ Spend') : (field === 'amount' ? `৳${Number(val||0).toLocaleString()}` : (val ?? '—'))}
      />
      <ImporterCard
        title="File Updates / Applications workbook"
        accept="File Updates 2026.xlsx (Bangladesh + China sheets)"
        icon={<GraduationCap size={18} />}
        parse={parseApplications}
        submit={(rows) => api.importApplications(rows)}
        summaryFields={['client_name', 'source', 'referrer', 'nationality', 'passport', 'degree', 'major', 'status']}
        labels={{ client_name: 'Name', source: 'Source', referrer: 'Referrer', nationality: 'Nationality', passport: 'Passport', degree: 'Degree', major: 'Major', status: 'Status' }}
      />
    </div>
  );
}

function ImporterCard({ title, accept, icon, parse, submit, summaryFields, labels, renderCell }) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleFile = async (f) => {
    if (!f) return;
    setError(''); setResult(null); setFileName(f.name);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const parsed = parse(wb, f.name);
      if (parsed.length === 0) {
        setError('No data rows found in this file — please check the sheet names and headers.');
        setRows([]);
        return;
      }
      setRows(parsed);
      setPreviewing(true);
    } catch (e) {
      setError(`Could not parse: ${e.message}`);
    }
  };

  const doImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try { setResult(await submit(rows)); setPreviewing(false); }
    catch (e) { setError(e.message); }
    setImporting(false);
  };

  const cancel = () => { setRows([]); setFileName(''); setPreviewing(false); setResult(null); setError(''); inputRef.current && (inputRef.current.value = ''); };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-slate-100 bg-slate-50/60">
        <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm">{title}</p>
          <p className="text-xs text-slate-500">{accept}</p>
        </div>
        {(fileName || result) && (
          <button onClick={cancel} className="p-1 text-slate-400 hover:text-rose-500 rounded"><X size={16}/></button>
        )}
      </div>

      <div className="p-5">
        {!previewing && !result && (
          <div onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('bg-blue-50/50'); }}
               onDragLeave={e => e.currentTarget.classList.remove('bg-blue-50/50')}
               onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('bg-blue-50/50'); handleFile(e.dataTransfer.files[0]); }}
               className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center transition-colors">
            <FileSpreadsheet size={32} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-600 mb-1">Drop your .xlsx file here</p>
            <p className="text-xs text-slate-400 mb-3">or</p>
            <button onClick={() => inputRef.current?.click()}
              className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 inline-flex items-center gap-2">
              <Upload size={14} /> Choose file
            </button>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => handleFile(e.target.files?.[0])} />
          </div>
        )}

        {previewing && rows.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-700">
                Preview: <span className="text-blue-600">{rows.length}</span> rows ready to import
                <span className="text-xs text-slate-400 ml-2">from {fileName}</span>
              </p>
              <div className="flex gap-2">
                <button onClick={cancel} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">Cancel</button>
                <button onClick={doImport} disabled={importing}
                  className="text-xs font-medium bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-1.5">
                  {importing && <Loader2 size={12} className="animate-spin" />}
                  {importing ? 'Importing…' : 'Confirm import'}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                  <tr>{summaryFields.map(f => <th key={f} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{labels[f] || f}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.slice(0, 12).map((r, i) => (
                    <tr key={i}>
                      {summaryFields.map(f => (
                        <td key={f} className="px-3 py-2 whitespace-nowrap text-slate-700 max-w-[160px] truncate">
                          {renderCell ? renderCell(f, r[f]) : (r[f] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 12 && (
              <p className="text-xs text-slate-400 text-center mt-2">+{rows.length - 12} more rows</p>
            )}
          </div>
        )}

        {result && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-800 text-sm">Import complete</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                <strong>{result.inserted}</strong> rows added
                {result.updated != null && <>, <strong>{result.updated}</strong> updated</>}
                {result.skipped > 0 && <>, <strong>{result.skipped}</strong> skipped as duplicates</>}.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-start gap-2 mt-2">
            <AlertCircle size={15} className="text-rose-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-rose-700">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
