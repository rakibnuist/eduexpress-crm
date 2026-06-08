import { initDatabase } from '../sqldb.js';
import { join } from 'path';

function workingDaysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  let wd = 0;
  for (let d = 1; d <= days; d++) { const dow = new Date(y, m - 1, d).getDay(); if (dow !== 5 && dow !== 6) wd++; }
  return wd;
}

async function main() {
  const db = await initDatabase(join(process.cwd(), 'crm.db'));
  const month = '2026-05';
  const wd = workingDaysInMonth(month);

  // Auto-creates rows for active employees if missing
  const employees = db.prepare("SELECT * FROM employees WHERE active='Yes'").all();
  const ensure = db.prepare(`INSERT OR IGNORE INTO payroll
    (month, emp_id, name, base_salary, working_days, days_worked, net_pay)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const recalc = db.prepare("UPDATE payroll SET days_worked=?, working_days=? WHERE month=? AND emp_id=? AND name=?");

  for (const emp of employees) {
    const present = db.prepare("SELECT COUNT(*) as n FROM attendance WHERE emp_id=? AND date LIKE ? AND (status='Present' OR status='Late')")
      .get(emp.emp_id, `${month}%`).n;
    ensure.run(month, emp.emp_id, emp.name, emp.salary || 0, wd, present, emp.salary || 0);
    recalc.run(present, wd, month, emp.emp_id, emp.name);
  }

  const rows = db.prepare("SELECT * FROM payroll WHERE month=? ORDER BY name").all(month);
  console.log('--- PAYROLL ROWS BEFORE DEDUPLICATION ---');
  console.log(rows);

  const seen = new Set();
  const uniqueRows = [];
  for (const r of rows) {
    const key = `${r.month}-${r.name}`;
    if (seen.has(key)) {
      console.log(`Deleting duplicate: id=${r.id}, key=${key}`);
      db.prepare("DELETE FROM payroll WHERE id=?").run(r.id);
    } else {
      seen.add(key);
      uniqueRows.push(r);
    }
  }

  console.log('--- PAYROLL ROWS AFTER DEDUPLICATION ---');
  console.log(uniqueRows);
}

main().catch(console.error);
