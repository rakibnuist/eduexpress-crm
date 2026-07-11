import express from 'express';

export default function(dependencies) {
  const router = express.Router();
  const { 
    getDb, requireAdmin, requireManagerOrAdmin, requireFinanceOrAdmin
  } = dependencies;

router.get('/admin/logs', (req, res) => {
    const db = getDb();
app.use('/api', activityRouter({ getDb: () => db, requireAdmin, requireManagerOrAdmin, userHasRole, canViewOwnLeadsOnly, isFullAdmin }));
app.use('/api', settingsRouter({ getDb: () => db, requireAdmin }));
  const apiKey = req.headers['x-api-key'] || req.query.key;
  const cookie = getCookie(req, AUTH_COOKIE);
app.use('/api', marketingRouter({
  getDb: () => db, requireAdmin, requireManagerOrAdmin, userHasRole, isFullAdmin, canViewOwnLeadsOnly, isChinaBlockedForUser, leadIsVisibleTo, logActivity, sendCAPIEvent, uploadLimiter, getConfig, PERSISTENT_HOME, nextChinaLeadId, nextLeadId, leadParams, LEAD_INSERT_SQL, LEAD_UPDATE_SQL, requireMarketing
}));
  let payload = null;
app.use('/api', financeRouter({
  getDb: () => db, requireAdmin, requireManagerOrAdmin, requireFinanceOrAdmin
}));
  try { payload = verifyToken(cookie); } catch {}
  const isAdmin = payload && payload.role === 'admin';
  if (apiKey !== 'eduexpress-n8n-2024' && !isAdmin) {
    return res.status(401).send('Unauthorized');
  }
  try {
    if (!existsSync(LOG_PATH)) return res.send('Log file is empty.');
    const content = readFileSync(LOG_PATH, 'utf8');
    const lines = content.split('\n').slice(-300).join('\n');
    res.setHeader('Content-Type', 'text/plain');
    res.send(lines);
  } catch (err) {
    res.status(500).send('Error reading log file: ' + err.message);
  }
});

router.put('/documents/:id', (req, res) => {
    const db = getDb();
  const doc = db.prepare("SELECT * FROM lead_documents WHERE id=?").get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(doc.lead_id);
  // China data isolation: block unauthorized access to China leads
  if (isChinaBlockedForUser(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to China lead records' });
  }
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });

  const { status, notes, file_url, received_on, requested_by_student } = req.body || {};
  const finalReceived = status && ['received', 'verified'].includes(status) && !doc.received_on
    ? (received_on || new Date().toISOString().slice(0, 10))
    : (received_on ?? doc.received_on);
  db.prepare(`UPDATE lead_documents SET status=COALESCE(?,status), notes=COALESCE(?,notes),
              file_url=COALESCE(?,file_url), received_on=?,
              requested_by_student=COALESCE(?,requested_by_student),
              updated_by=?, updated_at=datetime('now')
              WHERE id=?`)
    .run(status ?? null, notes ?? null, file_url ?? null, finalReceived,
         requested_by_student == null ? null : (requested_by_student ? 1 : 0),
         req.user?.name || req.user?.email || null, req.params.id);
  res.json(db.prepare("SELECT * FROM lead_documents WHERE id=?").get(req.params.id));
});

router.delete('/documents/:id', (req, res) => {
    const db = getDb();
  const doc = db.prepare("SELECT * FROM lead_documents WHERE id=?").get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(doc.lead_id);
  // China data isolation: block unauthorized access to China leads
  if (isChinaBlockedForUser(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to China lead records' });
  }
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });
  db.prepare("DELETE FROM lead_documents WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

router.get('/cockpit', (req, res) => requireManagerOrAdmin(req, res, () => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const yStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const today = buildDaySummary(todayStr);
  const yesterday = buildDaySummary(yStr);
  const alerts = buildAlerts();

  const feed = db.prepare(`SELECT * FROM activity_log ORDER BY id DESC LIMIT 100`).all();

  // Weekly trend: new leads + revenue per day for the last 7 days
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    trend.push({
      date: d,
      newLeads: db.prepare("SELECT COUNT(*) as n FROM leads WHERE date_added=? OR substr(created_at,1,10)=?").get(d, d).n,
      revenue:  db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM income WHERE date=? AND (exclude_from_cash IS NULL OR exclude_from_cash = 0)").get(d).s,
    });
  }

  res.json({ today, yesterday, alerts, feed, trend });
}));

router.get('/dashboard', (req, res) => {
    const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const user = req.user;
  const isAdmin = isFullAdmin(user) || isInvestor(user) || userHasAnyRole(user, 'application_manager', 'marketing_manager');
  const isConsultant = canViewOwnLeadsOnly(user);

  // Build WHERE clause for consultant scoping
  let leadWhere = '';
  let leadParams = [];
  if (isConsultant) {
    const meName = user.consultant_name || user.name || '';
    const meClean = meName.split(' ')[0];
    let empId = -1;
    if (user.emp_id) {
      const emp = db.prepare("SELECT id FROM employees WHERE emp_id=?").get(user.emp_id);
      if (emp) empId = emp.id;
    }
    leadWhere = `WHERE (assigned_employee_id = ? OR TRIM(LOWER(assigned_consultant)) = TRIM(LOWER(?)) OR TRIM(LOWER(assigned_consultant)) = TRIM(LOWER(?)) OR TRIM(LOWER(?)) LIKE '%' || TRIM(LOWER(assigned_consultant)) || '%' OR TRIM(LOWER(assigned_consultant)) LIKE '%' || TRIM(LOWER(?)) || '%')`;
    leadParams = [empId, meName, meClean, meName, meClean];
  }

  // China data isolation: exclude China leads from stats for unauthorized users
  const chinaExclusion = !canViewChinaData(user) ? " AND (destination != 'China' AND source != 'China')" : '';
  
  // When leadWhere is empty, we need a base WHERE clause so chinaExclusion (which starts with AND) works
  const baseWhere = leadWhere || 'WHERE 1=1';

  const scalars = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM leads ${baseWhere}${chinaExclusion}) AS total,
      (SELECT COUNT(*) FROM leads ${baseWhere} AND next_followup=?${chinaExclusion}) AS followup_today,
      (SELECT SUM(paid) FROM leads ${baseWhere}${chinaExclusion}) AS total_paid,
      (SELECT COUNT(*) FROM leads ${baseWhere} AND meta_lead_id IS NOT NULL${chinaExclusion}) AS meta_leads,
      (SELECT COUNT(*) FROM leads ${baseWhere} AND date_added=?${chinaExclusion}) AS new_today
  `).get(...leadParams, ...leadParams, today, ...leadParams, ...leadParams, ...leadParams, today);

  const convScalars = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM conversations WHERE status='open') AS open_convs,
      (SELECT SUM(unread_count) FROM conversations) AS unread_msgs
  `).get();

  const pipeline = db.prepare(`SELECT lead_status, COUNT(*) as count FROM leads ${baseWhere}${chinaExclusion} GROUP BY lead_status`).all(...leadParams);
  const recentLeads = db.prepare(`SELECT * FROM leads ${baseWhere}${chinaExclusion} ORDER BY id DESC LIMIT 5`).all(...leadParams);
  const by_source = db.prepare(`SELECT lead_source as k, COUNT(*) as n FROM leads WHERE lead_source IS NOT NULL AND lead_source!='' ${leadWhere ? 'AND ' + leadWhere.replace(/^WHERE /, '') : ''}${chinaExclusion} GROUP BY lead_source ORDER BY n DESC LIMIT 6`).all(...leadParams);
  const by_dest = db.prepare(`SELECT destination as k, COUNT(*) as n FROM leads WHERE destination IS NOT NULL AND destination!='' ${leadWhere ? 'AND ' + leadWhere.replace(/^WHERE /, '') : ''}${chinaExclusion} GROUP BY destination ORDER BY n DESC LIMIT 8`).all(...leadParams);

  res.json({
    pipeline,
    total: scalars.total,
    followupToday: scalars.followup_today,
    recentLeads,
    totalPaid: scalars.total_paid || 0,
    metaLeads: scalars.meta_leads,
    openConvs: convScalars.open_convs,
    unreadMsgs: convScalars.unread_msgs || 0,
    newToday: scalars.new_today,
    by_source,
    by_dest,
  });
});

router.delete('/admin/wipe-leads', (req, res) => requireAdmin(req, res, () => {
  try {
    const wipeConversations = !!(req.body && req.body.conversations);
    const count = db.prepare("SELECT COUNT(*) as c FROM leads").get().c;

    const wipe = db.transaction(() => {
      db.prepare("DELETE FROM leads").run();                 // cascades documents + uni-apps
      db.prepare("DELETE FROM activity_log").run();          // stale KPI / performance history
      db.prepare("DELETE FROM kpi_targets").run();           // old monthly targets
      const seqTables = ['leads','lead_documents','lead_university_applications','activity_log','kpi_targets'];
      if (wipeConversations) {
        db.prepare("DELETE FROM messages").run();
        db.prepare("DELETE FROM conversations").run();
        db.prepare("DELETE FROM contacts").run();
        seqTables.push('messages','conversations','contacts');
      }
      // Reset auto-increment so IDs start fresh
      db.prepare(`DELETE FROM sqlite_sequence WHERE name IN (${seqTables.map(() => '?').join(',')})`).run(...seqTables);
    });
    wipe();

    res.json({ ok: true, deleted: count, conversationsWiped: wipeConversations });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}));

router.post('/employees/auto-link', (req, res) => {
    const db = getDb();
  const user = req.user;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

  // 1. Check if already linked
  let emp = findEmployeeForUser(user);
  if (emp) return res.json({ created: false, employee: emp });

  // 2. Generate a unique emp_id
  const prefix = 'E-';
  const maxEmp = db.prepare("SELECT MAX(CAST(SUBSTR(emp_id,3) AS INTEGER)) as m FROM employees WHERE emp_id LIKE 'E-%'").get();
  const nextNum = (maxEmp?.m || 0) + 1;
  const newEmpId = `${prefix}${String(nextNum).padStart(2, '0')}`;

  // 3. Create employee record using the user's data
  const roleLabel = user.roles?.includes('founder_ceo') ? 'admin' :
                    user.roles?.includes('managing_director') ? 'admin' :
                    user.roles?.includes('consultant') ? 'consultant' : 'manager';

  try {
    const info = db.prepare(
      `INSERT INTO employees (emp_id, name, role, email, phone, salary, active, join_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(newEmpId, user.name || user.email.split('@')[0], roleLabel, user.email, null, 0, 'Yes', new Date().toISOString().slice(0, 10));

    emp = db.prepare("SELECT * FROM employees WHERE id=?").get(info.lastInsertRowid);

    // 4. If the users table has an emp_id column, update it too (optional, best-effort)
    try {
      db.prepare("UPDATE users SET emp_id=? WHERE id=?").run(newEmpId, user.id);
    } catch (e) {
      // emp_id column may not exist on users table — that's fine, email match is enough
    }

    res.json({ created: true, employee: emp });

router.get('/employees', (req, res) => res.json(db.prepare("SELECT * FROM employees ORDER BY id").all()));
router.get('/api/employees/active', (req, res) => res.json(db.prepare("SELECT id, emp_id, name, role, email, phone, salary FROM employees WHERE active = 'Yes' OR active IS NULL OR active = '1' ORDER BY name").all()));
router.post('/api/employees', (req, res) => {
  const d = req.body;
  const info = db.prepare(`INSERT INTO employees (emp_id,name,role,email,phone,device_id,salary,active,join_date) VALUES (@emp_id,@name,@role,@email,@phone,@device_id,@salary,@active,@join_date)`).run({ ...d, salary: d.salary||0, active: d.active||'Yes', join_date: d.join_date||null });
  res.json(db.prepare("SELECT * FROM employees WHERE id=?").get(info.lastInsertRowid));
});

router.put('/employees/:id', (req, res) => {
    const db = getDb();
  const d = req.body;
  db.prepare(`UPDATE employees SET emp_id=@emp_id,name=@name,role=@role,email=@email,phone=@phone,device_id=@device_id,salary=@salary,active=@active,join_date=@join_date WHERE id=@id`).run({ ...d, id: req.params.id, salary: d.salary||0, join_date: d.join_date||null });
  res.json(db.prepare("SELECT * FROM employees WHERE id=?").get(req.params.id));
});

router.delete('/employees/:id', (req, res) => {
    const db = getDb(); db.prepare("DELETE FROM employees WHERE id=?").run(req.params.id); res.json({ ok:true }); });

router.get('/attendance', (req, res) => {
    const db = getDb();
  const { month, emp_id, date } = req.query;
  const where=[]; const params={};
  if (month)  { where.push("date LIKE @month"); params.month=`${month}%`; }
  if (emp_id) { where.push("emp_id=@emp_id");   params.emp_id=emp_id; }
  if (date)   { where.push("date=@date");        params.date=date; }
  const ws = where.length ? 'WHERE '+where.join(' AND ') : '';
  res.json(db.prepare(`SELECT * FROM attendance ${ws} ORDER BY date DESC, check_in DESC`).all(params));
});

router.post('/attendance/checkin', (req, res) => {
    const db = getDb();
  const { emp_id, date, time, device_id, ssid, source } = req.body;
  const emp = db.prepare("SELECT * FROM employees WHERE emp_id=?").get(emp_id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  const existing = db.prepare("SELECT * FROM attendance WHERE emp_id=? AND date=?").get(emp_id, date);
  if (existing) return res.status(409).json({ error: 'Already checked in', record: existing });
  const openHHMM = getConfig('office_open')||'11:00', grace = parseInt(getConfig('grace_minutes')||'30');
  const [oh,om] = openHHMM.split(':').map(Number);
  const [ch,cm] = (time||'00:00').split(':').map(Number);
  const status = (ch*60+cm) <= (oh*60+om+grace) ? 'Present' : 'Late';
  const info = db.prepare(`INSERT INTO attendance (emp_id,name,date,check_in,status,device_id,ssid,source) VALUES (?,?,?,?,?,?,?,?)`).run(emp_id, emp.name, date, time, status, device_id||emp.device_id, ssid||'', source||'manual');
  res.json(db.prepare("SELECT * FROM attendance WHERE id=?").get(info.lastInsertRowid));
});

router.put('/attendance/:id/checkout', (req, res) => {
    const db = getDb();
  const { time } = req.body;
  const rec = db.prepare("SELECT * FROM attendance WHERE id=?").get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Not found' });
  let hours_worked = null;
  if (rec.check_in && time) {
    const [ih,im] = rec.check_in.split(':').map(Number);
    const [oh,om] = time.split(':').map(Number);
    hours_worked = Math.max(0, (oh*60+om - (ih*60+im)) / 60);
  }
  db.prepare("UPDATE attendance SET check_out=?,hours_worked=? WHERE id=?").run(time, hours_worked, req.params.id);
  res.json(db.prepare("SELECT * FROM attendance WHERE id=?").get(req.params.id));
});

router.post('/attendance', (req, res) => {
    const db = getDb();
  const d = req.body;
  const emp = db.prepare("SELECT * FROM employees WHERE emp_id=?").get(d.emp_id);
  const info = db.prepare(`INSERT INTO attendance (emp_id,name,date,check_in,check_out,hours_worked,status,device_id,ssid,source,notes) VALUES (@emp_id,@name,@date,@check_in,@check_out,@hours_worked,@status,@device_id,@ssid,@source,@notes)`).run({ emp_id: d.emp_id, name: emp?.name||d.name||'', date: d.date, check_in: d.check_in||d.time, check_out: d.check_out||null, hours_worked: d.hours_worked||null, status: d.status||'Present', device_id: d.device_id||'', ssid: d.ssid||'', source: d.source||'manual', notes: d.notes||null });
  res.json(db.prepare("SELECT * FROM attendance WHERE id=?").get(info.lastInsertRowid));
});

router.put('/attendance/:id', (req, res) => {
    const db = getDb();
  const d = req.body;
  db.prepare(`UPDATE attendance SET check_in=@check_in,check_out=@check_out,hours_worked=@hours_worked,status=@status,notes=@notes WHERE id=@id`).run({ ...d, id: req.params.id });
  res.json(db.prepare("SELECT * FROM attendance WHERE id=?").get(req.params.id));
});

router.delete('/attendance/:id', (req, res) => {
    const db = getDb(); db.prepare("DELETE FROM attendance WHERE id=?").run(req.params.id); res.json({ ok:true }); });

router.get('/attendance/summary/:month', (req, res) => {
    const db = getDb();
  const { month } = req.params;
  const [y,m] = month.split('-').map(Number);
  const daysInMonth = new Date(y,m,0).getDate();
  let workingDays = 0;
  for (let d=1; d<=daysInMonth; d++) { const dow = new Date(y,m-1,d).getDay(); if (dow!==5&&dow!==6) workingDays++; }
  const employees = db.prepare("SELECT * FROM employees WHERE active='Yes'").all();
  const summary = employees.map(emp => {
    const logs = db.prepare("SELECT * FROM attendance WHERE emp_id=? AND date LIKE ?").all(emp.emp_id, `${month}%`);
    const present = logs.filter(l=>l.status==='Present').length;
    const late    = logs.filter(l=>l.status==='Late').length;
    const absent  = Math.max(0, workingDays-present-late);
    const totalHours = logs.reduce((s,l)=>s+(l.hours_worked||0),0);
    const avgCheckin = logs.filter(l=>l.check_in).map(l=>l.check_in).sort()[Math.floor(logs.length/2)]||null;
    return { ...emp, present, late, absent, workingDays, totalHours: totalHours.toFixed(1), avgCheckin, attendancePct: workingDays>0?Math.round(((present+late)/workingDays)*100):0, logs };
  });
  res.json({ summary, workingDays });
});

router.get('/kpi/:month', (req, res) => {
    const db = getDb();
  const { month } = req.params;
  const user = req.user;

  let consultants;
  if (canViewOwnLeadsOnly(user)) {
    // Consultant: only their own KPI
    const me = user.consultant_name || user.name || '';
    consultants = [me];
  } else {
    // Admin, MD, Investor, App Manager, Marketing Manager: all consultants
    consultants = db.prepare("SELECT DISTINCT assigned_consultant FROM leads WHERE assigned_consultant IS NOT NULL AND assigned_consultant != ''").all().map(r=>r.assigned_consultant);
  }

  res.json(consultants.map(c => {
    const total = db.prepare("SELECT COUNT(*) as n FROM leads WHERE assigned_consultant=?").get(c).n;
    const thisMonth = db.prepare("SELECT COUNT(*) as n FROM leads WHERE assigned_consultant=? AND (date_added LIKE ? OR created_at LIKE ?)").get(c,`${month}%`,`${month}%`).n;
    const byStatus = Object.fromEntries(db.prepare("SELECT lead_status,COUNT(*) as n FROM leads WHERE assigned_consultant=? GROUP BY lead_status").all(c).map(r=>[r.lead_status,r.n]));
    const revenue  = db.prepare("SELECT SUM(service_fee) as s FROM leads WHERE assigned_consultant=?").get(c).s||0;
    const collected= db.prepare("SELECT SUM(paid) as s FROM leads WHERE assigned_consultant=?").get(c).s||0;
    const target   = db.prepare("SELECT * FROM kpi_targets WHERE consultant=? AND month=?").get(c,month)||{};
    return { consultant:c, total, thisMonth, enrolled:byStatus['Enrolled']||0, fileOpened:byStatus['File Opened']||0, officeVisited:byStatus['Office Visited']||0, positive:byStatus['Positive']||0, notInterested:byStatus['Not Interested']||0, revenue, collected, conversionRate: total>0?((( byStatus['File Opened']||0)/total)*100).toFixed(1):0, responseRate: total>0?(((total-(byStatus['No Response']||0))/total)*100).toFixed(1):0, target_leads:target.target_leads||0, target_enrolled:target.target_enrolled||0, target_revenue:target.target_revenue||0 };
  }));
});

router.put('/kpi/targets', (req, res) => {
    const db = getDb();
  const { consultant, month, target_leads, target_enrolled, target_revenue } = req.body;
  if (!consultant || !month) return res.status(400).json({ error: 'consultant and month are required' });
  try {
    db.prepare(`INSERT INTO kpi_targets (consultant,month,target_leads,target_enrolled,target_revenue) VALUES (?,?,?,?,?) ON CONFLICT(consultant,month) DO UPDATE SET target_leads=excluded.target_leads,target_enrolled=excluded.target_enrolled,target_revenue=excluded.target_revenue`).run(consultant, month, Number(target_leads)||0, Number(target_enrolled)||0, Number(target_revenue)||0);
    const saved = db.prepare("SELECT * FROM kpi_targets WHERE consultant=? AND month=?").get(consultant, month);
    res.json({ ok: true, saved });
  } catch(e) {
    console.error('[kpi/targets]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/payroll', (req, res) => requireAdmin(req, res, () => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const wd = workingDaysInMonth(month);
  
  // Generate payroll for all active employees
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

  // Fetch all active employees' payrolls for the month
  const activeEmpNames = employees.map(e => e.name);
  const placeholders = activeEmpNames.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM payroll WHERE month=? AND name IN (${placeholders}) ORDER BY name`).all(month, ...activeEmpNames);

  // Defensive deduplication to ensure same name is never shown twice in payroll
  const seen = new Set();
  const uniqueRows = [];
  for (const r of rows) {
    const key = `${r.month}-${r.name}`;
    if (seen.has(key)) {
      db.prepare("DELETE FROM payroll WHERE id=?").run(r.id);
    } else {
      seen.add(key);
      uniqueRows.push(r);
    }
  }

  const totals = uniqueRows.reduce((a, r) => ({
    base: a.base + (r.base_salary || 0),
    bonus: a.bonus + (r.bonus || 0),
    deductions: a.deductions + (r.deductions || 0),
    net: a.net + (r.net_pay || 0),
    paid: a.paid + (r.status === 'paid' ? (r.net_pay || 0) : 0),
    pending: a.pending + (r.status !== 'paid' ? (r.net_pay || 0) : 0),
  }), { base: 0, bonus: 0, deductions: 0, net: 0, paid: 0, pending: 0 });

  res.json({ month, workingDays: wd, rows: uniqueRows, totals });
}));

// Adjust a single payroll line (bonus, deductions, status, paid_on, notes)
router.put('/api/payroll/:id', (req, res) => requireAdmin(req, res, () => {
  const cur = db.prepare("SELECT * FROM payroll WHERE id=?").get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Not found' });
  const { bonus, deductions, status, paid_on, notes, base_salary } = req.body || {};
  const base = (base_salary !== undefined ? Number(base_salary) : cur.base_salary) || 0;
  const b = (bonus      !== undefined ? Number(bonus)      : cur.bonus)      || 0;
  const d = (deductions !== undefined ? Number(deductions) : cur.deductions) || 0;
  const net = base + b - d;
  const stat = status || cur.status;
  const paidOn = (stat === 'paid') ? (paid_on || cur.paid_on || new Date().toISOString().slice(0, 10)) : null;
  db.prepare(`UPDATE payroll SET base_salary=?, bonus=?, deductions=?, net_pay=?, status=?, paid_on=?, notes=? WHERE id=?`)
    .run(base, b, d, net, stat, paidOn, notes ?? cur.notes ?? null, req.params.id);
  
  const updated = db.prepare("SELECT * FROM payroll WHERE id=?").get(req.params.id);
  if (stat === 'paid') {
    logPayrollExpense(updated);
  } else {
    db.prepare("DELETE FROM expenses WHERE category='Salary' AND paid_to=? AND reference=?")
      .run(updated.name, `Salary - ${updated.month}`);
  }
  res.json(updated);
}));

router.post('/api/payroll/:id/mark-paid', (req, res) => requireAdmin(req, res, () => {
  const cur = db.prepare("SELECT * FROM payroll WHERE id=?").get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Not found' });
  db.prepare("UPDATE payroll SET status='paid', paid_on=COALESCE(paid_on, ?) WHERE id=?")
    .run(new Date().toISOString().slice(0, 10), req.params.id);
  
  const updated = db.prepare("SELECT * FROM payroll WHERE id=?").get(req.params.id);
  logPayrollExpense(updated);
  res.json(updated);
}));

// ─────────────────────────────────────────────────────────
// EMPLOYEE PERFORMANCE — Attendance + Daily Logs + Activity
// ─────────────────────────────────────────────────────────

// Daily log — what an employee writes before they leave for the day.

// Submit (or upsert) today's log for the current user

// "Did I submit today's log?" — used by the dashboard banner

// Employee KPI dashboard — Attendance + Office Work + Activity per employee.
router.get('/api/employee-kpi', (req, res) => requireManagerOrAdmin(req, res, () => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const start = `${month}-01`;
  const endDate = new Date(y, m, 0);
  const end = endDate.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  // Working days in the month (Sun-Thu = working in Bangladesh, per existing logic)
  const daysInMonth = endDate.getDate();
  let workingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    if (dow !== 5 && dow !== 6) workingDays++;
  }
  // Effective working days so far (don't penalise for days that haven't happened yet)
  let effWorking = 0;
  const todayInMonth = today >= start && today <= end;
  const cutoff = todayInMonth ? today : end;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    if (date > cutoff) break;
    const dow = new Date(y, m - 1, d).getDay();
    if (dow !== 5 && dow !== 6) effWorking++;
  }

  const employees = db.prepare("SELECT * FROM employees WHERE active='Yes'").all();
  // Activity types we score against. Weights are intentionally simple.
  const ACT_WEIGHTS = {
    lead_created:              3,
    lead_status_changed:       2,
    lead_assigned:             1,
    lead_payment:              4,
    payment_recorded:          2,
    application_stage_changed: 3,
    uni_app_status:            3,
    reply_to_student:          2,
    note:                      1,
  };
  const ACT_GROUPS = {
    lead_work:    ['lead_created', 'lead_status_changed', 'lead_assigned'],
    payments:     ['lead_payment', 'payment_recorded'],
    application:  ['application_stage_changed', 'uni_app_status'],
    communication:['reply_to_student', 'note'],
  };

  const rows = employees.map(emp => {
    // — Attendance —
    const attLogs = db.prepare("SELECT * FROM attendance WHERE emp_id=? AND date BETWEEN ? AND ?").all(emp.emp_id, start, end);
    const present = attLogs.filter(l => l.status === 'Present').length;
    const late    = attLogs.filter(l => l.status === 'Late').length;
    const absent  = Math.max(0, effWorking - present - late);
    const hours   = attLogs.reduce((s, l) => s + (l.hours_worked || 0), 0);
    const avgIn   = attLogs.filter(l => l.check_in).map(l => l.check_in).sort()[Math.floor(attLogs.length / 2)] || null;
    const attendancePct = effWorking > 0 ? Math.round(((present + late) / effWorking) * 100) : 0;

    // — Office Work (daily logs) —
    const logs = db.prepare("SELECT date FROM daily_logs WHERE emp_id=? AND date BETWEEN ? AND ?").all(emp.emp_id, start, end);
    const logsSubmitted = logs.length;
    // Streak: count back from today (or end of month) however many consecutive days have a log
    let streak = 0;
    {
      const dates = new Set(logs.map(l => l.date));
      const d = new Date(Math.min(new Date(today).getTime(), endDate.getTime()));
      while (true) {
        const ds = d.toISOString().slice(0, 10);
        if (ds < start) break;
        const dow = d.getDay();
        if (dow !== 5 && dow !== 6) {
          if (!dates.has(ds)) break;
          streak++;
        }
        d.setDate(d.getDate() - 1);
      }
    }
    const logPct = effWorking > 0 ? Math.round((logsSubmitted / effWorking) * 100) : 0;

    // — Activity (auto-pulled from activity_log) —
    // Match by both possible identities: user account name and user_id link
    const acts = db.prepare(`
      SELECT type, COUNT(*) as n
      FROM activity_log
      WHERE substr(created_at,1,10) BETWEEN ? AND ?
        AND (actor_name = ? OR actor_user_id IN (SELECT id FROM users WHERE emp_id=? OR LOWER(email)=LOWER(?)))
      GROUP BY type`).all(start, end, emp.name, emp.emp_id, emp.email || '');
    const actByType = {}; acts.forEach(a => actByType[a.type] = a.n);
    let actScore = 0;
    Object.entries(ACT_WEIGHTS).forEach(([type, w]) => actScore += (actByType[type] || 0) * w);
    const groupTotals = Object.fromEntries(Object.entries(ACT_GROUPS).map(([g, types]) =>
      [g, types.reduce((s, t) => s + (actByType[t] || 0), 0)]
    ));
    const totalEvents = Object.values(actByType).reduce((s, n) => s + n, 0);

    // — Composite Score (0-100). Attendance 30 + Office Work 20 + Activity 50.
    // Activity is normalised against a "good day = 12 weighted points" expectation.
    const attendanceScore = Math.min(30, (attendancePct / 100) * 30);
    const logsScore       = Math.min(20, (logPct / 100) * 20);
    const targetActScore  = Math.max(1, effWorking * 12);
    const activityScore   = Math.min(50, (actScore / targetActScore) * 50);
    const score = Math.round(attendanceScore + logsScore + activityScore);

    return {
      id: emp.id,
      emp_id: emp.emp_id, name: emp.name, role: emp.role,
      attendance: { present, late, absent, workingDays: effWorking, totalHours: +hours.toFixed(1), avgCheckIn: avgIn, attendancePct },
      office_work: { logsSubmitted, logPct, streak, effWorking },
      activity:    { total: totalEvents, score: actScore, by_type: actByType, by_group: groupTotals },
      score,
    };
  }).sort((a, b) => b.score - a.score);

  res.json({ month, workingDays, effWorking, employees: rows });
}));

// ─── REPORTS — weekly / monthly performance digest ─────────────────────────
// Comprehensive aggregation across all subsystems in one JSON response so
// the Dashboard can render the whole digest with one fetch.
function dayRangeFor(period, anchorIso) {
  const anchor = new Date(anchorIso + 'T00:00:00Z');
  const day = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (period === 'week') {
    // ISO-ish week, but office-friendly: Sun → Sat for Bangladesh weeks.
    const dow = anchor.getUTCDay(); // 0 = Sunday
    const start = day(new Date(anchor.getTime() - dow * 86400000));
    const end   = day(new Date(start.getTime() + 6 * 86400000));
    const prevStart = day(new Date(start.getTime() - 7 * 86400000));
    const prevEnd   = day(new Date(end.getTime()   - 7 * 86400000));
    return { start, end, prevStart, prevEnd, label: `${start.toISOString().slice(5,10)}–${end.toISOString().slice(5,10)}`, prevLabel: `${prevStart.toISOString().slice(5,10)}–${prevEnd.toISOString().slice(5,10)}` };
  }
  // month
  const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const end   = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
  const prevStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1));
  const prevEnd   = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 0));
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return { start, end, prevStart, prevEnd,
    label: `${monthNames[anchor.getUTCMonth()]} ${anchor.getUTCFullYear()}`,
    prevLabel: `${monthNames[prevStart.getUTCMonth()]} ${prevStart.getUTCFullYear()}`,
  };
}
function isoDate(d) { return d.toISOString().slice(0, 10); }

router.get('/api/reports', (req, res) => requireManagerOrAdmin(req, res, () => {
  const period = req.query.period === 'week' ? 'week' : 'month';
  const anchor = (req.query.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const range = dayRangeFor(period, anchor);
  const startStr = isoDate(range.start), endStr = isoDate(range.end);
  const prevStartStr = isoDate(range.prevStart), prevEndStr = isoDate(range.prevEnd);

  // ── Leads ──────────────────────────────────────────────────────────────
  const newLeadsRow = db.prepare(`SELECT COUNT(*) AS n FROM leads
    WHERE (date_added BETWEEN ? AND ?) OR (substr(created_at,1,10) BETWEEN ? AND ?)`).get(startStr, endStr, startStr, endStr);
  const newLeadsPrev = db.prepare(`SELECT COUNT(*) AS n FROM leads
    WHERE (date_added BETWEEN ? AND ?) OR (substr(created_at,1,10) BETWEEN ? AND ?)`).get(prevStartStr, prevEndStr, prevStartStr, prevEndStr);
  const leadsBySource = db.prepare(`SELECT COALESCE(source,'Unknown') AS k, COUNT(*) AS n FROM leads
    WHERE (date_added BETWEEN ? AND ?) OR (substr(created_at,1,10) BETWEEN ? AND ?) GROUP BY source`).all(startStr, endStr, startStr, endStr);
  const leadsByDest = db.prepare(`SELECT COALESCE(destination,'Unknown') AS k, COUNT(*) AS n FROM leads
    WHERE (date_added BETWEEN ? AND ?) OR (substr(created_at,1,10) BETWEEN ? AND ?) GROUP BY destination`).all(startStr, endStr, startStr, endStr);
  const enrolled = db.prepare(`SELECT COUNT(*) AS n FROM activity_log
    WHERE type='lead_status_changed' AND to_value='Enrolled' AND substr(created_at,1,10) BETWEEN ? AND ?`).get(startStr, endStr).n;
  const enrolledPrev = db.prepare(`SELECT COUNT(*) AS n FROM activity_log
    WHERE type='lead_status_changed' AND to_value='Enrolled' AND substr(created_at,1,10) BETWEEN ? AND ?`).get(prevStartStr, prevEndStr).n;

  // ── Applications ───────────────────────────────────────────────────────
  const stagesAdvanced = db.prepare(`SELECT to_value AS stage, COUNT(*) AS n FROM activity_log
    WHERE type='application_stage_changed' AND substr(created_at,1,10) BETWEEN ? AND ? GROUP BY to_value`).all(startStr, endStr);
  const uniMoves = db.prepare(`SELECT to_value AS status, COUNT(*) AS n FROM activity_log
    WHERE type='uni_app_status' AND substr(created_at,1,10) BETWEEN ? AND ? GROUP BY to_value`).all(startStr, endStr);

  // ── Cashflow ───────────────────────────────────────────────────────────
  const cashIn  = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s, COUNT(*) AS c FROM income   WHERE date BETWEEN ? AND ? AND (exclude_from_cash IS NULL OR exclude_from_cash = 0)`).get(startStr, endStr);
  const cashOut = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s, COUNT(*) AS c FROM expenses WHERE date BETWEEN ? AND ?`).get(startStr, endStr);
  const prevIn  = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM income   WHERE date BETWEEN ? AND ? AND (exclude_from_cash IS NULL OR exclude_from_cash = 0)`).get(prevStartStr, prevEndStr).s;
  const prevOut = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE date BETWEEN ? AND ?`).get(prevStartStr, prevEndStr).s;
  const incomeCat  = db.prepare(`SELECT COALESCE(category,'Uncategorised') AS k, SUM(amount) AS v FROM income   WHERE date BETWEEN ? AND ? AND (exclude_from_cash IS NULL OR exclude_from_cash = 0) GROUP BY category ORDER BY v DESC`).all(startStr, endStr);
  const expenseCat = db.prepare(`SELECT COALESCE(category,'Uncategorised') AS k, SUM(amount) AS v FROM expenses WHERE date BETWEEN ? AND ? GROUP BY category ORDER BY v DESC`).all(startStr, endStr);
  const topClients = db.prepare(`SELECT client_name AS k, SUM(amount) AS v FROM income WHERE date BETWEEN ? AND ? AND client_name IS NOT NULL AND (exclude_from_cash IS NULL OR exclude_from_cash = 0) GROUP BY client_name ORDER BY v DESC LIMIT 5`).all(startStr, endStr);
  // Cash position at end of period
  const initial = parseFloat(getConfig('cash_initial')) || 0;
  const priorIn  = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM income   WHERE date < ? AND (exclude_from_cash IS NULL OR exclude_from_cash = 0)`).get(startStr).s;
  const priorOut = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE date < ?`).get(startStr).s;
  const opening = initial + priorIn - priorOut;
  const closing = opening + cashIn.s - cashOut.s;

  // ── Attendance summary ─────────────────────────────────────────────────
  const activeEmps = db.prepare("SELECT COUNT(*) AS n FROM employees WHERE active='Yes'").get().n;
  const attRows = db.prepare(`SELECT emp_id, status FROM attendance WHERE date BETWEEN ? AND ?`).all(startStr, endStr);
  const presentCount = attRows.filter(r => r.status === 'Present' || r.status === 'Late').length;
  const lateCount    = attRows.filter(r => r.status === 'Late').length;
  // Working-day count in the range (Sun-Thu)
  let workingDays = 0;
  for (let d = new Date(range.start); d <= range.end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay(); if (dow !== 5 && dow !== 6) workingDays++;
  }
  const attendancePct = (activeEmps * workingDays) > 0
    ? Math.round((presentCount / (activeEmps * workingDays)) * 100) : 0;
  const dailyLogsSubmitted = db.prepare(`SELECT COUNT(*) AS n FROM daily_logs WHERE date BETWEEN ? AND ?`).get(startStr, endStr).n;

  // ── Top Performers (this period) ───────────────────────────────────────
  // Use activity-points to rank consultants by ACTOR_NAME
  const ACT_WEIGHTS = { lead_created:3, lead_status_changed:2, lead_assigned:1, lead_payment:4, payment_recorded:2, application_stage_changed:3, uni_app_status:3, reply_to_student:2, note:1 };
  const actorRows = db.prepare(`SELECT actor_name, type, COUNT(*) AS n FROM activity_log
    WHERE substr(created_at,1,10) BETWEEN ? AND ? AND actor_name IS NOT NULL AND actor_name != 'System'
    GROUP BY actor_name, type`).all(startStr, endStr);
  const byActor = {};
  actorRows.forEach(r => {
    if (!byActor[r.actor_name]) byActor[r.actor_name] = { name: r.actor_name, points: 0, events: 0, by_type: {} };
    byActor[r.actor_name].events += r.n;
    byActor[r.actor_name].points += (ACT_WEIGHTS[r.type] || 0) * r.n;
    byActor[r.actor_name].by_type[r.type] = r.n;
  });
  const topPerformers = Object.values(byActor).sort((a, b) => b.points - a.points).slice(0, 5);

  // ── Highlights — notable single events ─────────────────────────────────
  const highlights = [];
  const enrollEvents = db.prepare(`SELECT lead_name, actor_name, created_at FROM activity_log
    WHERE type='lead_status_changed' AND to_value='Enrolled' AND substr(created_at,1,10) BETWEEN ? AND ?
    ORDER BY id DESC LIMIT 3`).all(startStr, endStr);
  enrollEvents.forEach(e => highlights.push({ icon: '🎓', text: `${e.lead_name} enrolled (by ${e.actor_name})` }));

  const bigPays = db.prepare(`SELECT amount, lead_name, actor_name FROM activity_log
    WHERE type IN ('lead_payment','payment_recorded') AND substr(created_at,1,10) BETWEEN ? AND ? AND amount IS NOT NULL
    ORDER BY amount DESC LIMIT 3`).all(startStr, endStr);
  bigPays.forEach(p => highlights.push({ icon: '💰', text: `৳${Number(p.amount).toLocaleString()} payment${p.lead_name ? ` for ${p.lead_name}` : ''}${p.actor_name ? ` (by ${p.actor_name})` : ''}` }));

  const visaApprovals = db.prepare(`SELECT lead_name, actor_name FROM activity_log
    WHERE type='application_stage_changed' AND to_value='visa_approved' AND substr(created_at,1,10) BETWEEN ? AND ?
    ORDER BY id DESC LIMIT 3`).all(startStr, endStr);
  visaApprovals.forEach(v => highlights.push({ icon: '🛂', text: `${v.lead_name} visa approved (by ${v.actor_name})` }));

  const newLeadCount = db.prepare(`SELECT COUNT(*) AS n FROM leads WHERE lead_status='New Lead' AND (((date_added BETWEEN ? AND ?) OR (substr(created_at,1,10) BETWEEN ? AND ?)))`).get(startStr, endStr, startStr, endStr).n;
  const officeVisitCount = db.prepare(`SELECT COUNT(*) AS n FROM leads WHERE lead_status='Office Visited' AND (((date_added BETWEEN ? AND ?) OR (substr(created_at,1,10) BETWEEN ? AND ?)))`).get(startStr, endStr, startStr, endStr).n;
  const fileOpenCount = db.prepare(`SELECT COUNT(*) AS n FROM leads WHERE lead_status='File Opened' AND (((date_added BETWEEN ? AND ?) OR (substr(created_at,1,10) BETWEEN ? AND ?)))`).get(startStr, endStr, startStr, endStr).n;
  const positiveCount = db.prepare(`SELECT COUNT(*) AS n FROM leads WHERE lead_status='Positive' AND (((date_added BETWEEN ? AND ?) OR (substr(created_at,1,10) BETWEEN ? AND ?)))`).get(startStr, endStr, startStr, endStr).n;
  const noResponseCount = db.prepare(`SELECT COUNT(*) AS n FROM leads WHERE lead_status='No Response' AND (((date_added BETWEEN ? AND ?) OR (substr(created_at,1,10) BETWEEN ? AND ?)))`).get(startStr, endStr, startStr, endStr).n;

  const workTimeRow = db.prepare(`SELECT COALESCE(SUM(hours_worked),0) AS total_hours, COALESCE(AVG(hours_worked),0) AS avg_hours FROM attendance WHERE date BETWEEN ? AND ?`).get(startStr, endStr);

  const delta = (cur, prev) => prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);

  res.json({
    period: { type: period, start: startStr, end: endStr, label: range.label,
              previousStart: prevStartStr, previousEnd: prevEndStr, previousLabel: range.prevLabel },
    headline: {
      new_leads:    { current: newLeadsRow.n, previous: newLeadsPrev.n, delta: delta(newLeadsRow.n, newLeadsPrev.n) },
      enrolments:   { current: enrolled, previous: enrolledPrev, delta: delta(enrolled, enrolledPrev) },
      revenue:      { current: cashIn.s,  previous: prevIn,  delta: delta(cashIn.s, prevIn) },
      net_cash:     { current: cashIn.s - cashOut.s, previous: prevIn - prevOut, delta: delta(cashIn.s - cashOut.s, prevIn - prevOut) },
      attendance:   { current: attendancePct },
    },
    leads:         { 
      new: newLeadsRow.n, 
      by_source: leadsBySource, 
      by_destination: leadsByDest, 
      enrolled, 
      conversion_rate: newLeadsRow.n ? Math.round((enrolled / newLeadsRow.n) * 100) : 0,
      by_status: {
        new_lead: newLeadCount,
        office_visit: officeVisitCount,
        file_open: fileOpenCount,
        positive: positiveCount,
        no_response: noResponseCount
      }
    },
    applications:  { stages_advanced: stagesAdvanced, university_moves: uniMoves },
    cashflow:      { opening, in: cashIn.s, out: cashOut.s, net: cashIn.s - cashOut.s, closing,
                     income_by_category: incomeCat, expense_by_category: expenseCat, top_clients: topClients,
                     income_entries: cashIn.c, expense_entries: cashOut.c },
    attendance:    { active_employees: activeEmps, working_days: workingDays, attendance_pct: attendancePct,
                     late_count: lateCount, total_logs: dailyLogsSubmitted,
                     total_hours: Math.round(workTimeRow.total_hours),
                     avg_hours: Number(workTimeRow.avg_hours.toFixed(1)) },
    top_performers: topPerformers,
    highlights,
  });
}));

// Per-employee drilldown — full activity feed + daily logs for one person
router.get('/api/employee-kpi/:emp_id', (req, res) => requireManagerOrAdmin(req, res, () => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const start = `${month}-01`;
  const endDate = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5)), 0);
  const end = endDate.toISOString().slice(0, 10);
  const emp = db.prepare("SELECT * FROM employees WHERE emp_id=?").get(req.params.emp_id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const attendance = db.prepare("SELECT * FROM attendance WHERE emp_id=? AND date BETWEEN ? AND ? ORDER BY date").all(emp.emp_id, start, end);
  const logs       = db.prepare("SELECT * FROM daily_logs WHERE emp_id=? AND date BETWEEN ? AND ? ORDER BY date DESC").all(emp.emp_id, start, end);
  const activity   = db.prepare(`SELECT * FROM activity_log
    WHERE substr(created_at,1,10) BETWEEN ? AND ?
      AND (actor_name = ? OR actor_user_id IN (SELECT id FROM users WHERE emp_id=? OR LOWER(email)=LOWER(?)))
    ORDER BY id DESC LIMIT 500`).all(start, end, emp.name, emp.emp_id, emp.email || '');
  res.json({ employee: emp, month, attendance, logs, activity });
}));

// ─────────────────────────────────────────────────────────
// CHANNELS (WhatsApp accounts, Pages, IG accounts)
// ─────────────────────────────────────────────────────────




// Track in-flight syncs so a channel can't be synced twice at once.
const activeSyncs = new Set();

// Helper to resolve dynamic Page Access Token using System User token if needed
async function resolvePageAccessToken(pageId, configuredToken) {
  if (!pageId || !configuredToken) return configuredToken;
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=access_token&access_token=${configuredToken}`);
    const data = await res.json();
    if (data.access_token) {
      console.log(`[facebook] Dynamically resolved Page Access Token for Page ID: ${pageId}`);
      return data.access_token;
    } else if (data.error) {
      console.warn(`[facebook] Token resolution API returned error for Page ID ${pageId}: ${data.error.message}`);
    }
  } catch (err) {
    console.error(`[facebook] Network error resolving Page Access Token for Page ID ${pageId}:`, err.message);
  }
  return configuredToken;
}

// Helper to sync channel name & avatar from Graph API
async function syncChannelMetadata(channelId) {
  const channel = db.prepare("SELECT * FROM channels WHERE id=?").get(channelId);
  if (!channel) return;
  let token = channel.access_token || getConfig('page_access_token');
  if (!token) return;

  if (channel.type === 'messenger' || channel.type === 'instagram') {
    const pageId = channel.page_id;
    if (!pageId) return;
    try {
      const effectiveToken = await resolvePageAccessToken(pageId, token);
      const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=name,picture.type(large)&access_token=${effectiveToken}`);
      const data = await res.json();
      if (data.name) {
        const avatarUrl = data.picture?.data?.url || null;
        db.prepare("UPDATE channels SET name = ?, avatar_url = ? WHERE id = ?").run(data.name, avatarUrl, channelId);
        console.log(`[channel-metadata] Updated messenger/instagram channel ${channelId} (${data.name}) avatar: ${avatarUrl ? 'yes' : 'no'}`);
      }
    } catch (err) {
      console.warn(`[channel-metadata] Error syncing messenger/instagram channel ${channelId}:`, err.message);
    }
  } else if (channel.type === 'whatsapp') {
    const phoneId = channel.phone_number_id;
    if (!phoneId) return;
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/whatsapp_business_profile?fields=profile_picture_url&access_token=${token}`);
      const data = await res.json();
      const avatarUrl = data.data?.[0]?.profile_picture_url || null;
      if (avatarUrl) {
        db.prepare("UPDATE channels SET avatar_url = ? WHERE id = ?").run(avatarUrl, channelId);
        console.log(`[channel-metadata] Updated WhatsApp channel ${channelId} avatar: yes`);
      }
    } catch (err) {
      console.warn(`[channel-metadata] Error syncing WhatsApp channel ${channelId}:`, err.message);
    }
  }
}

// Helper to sync historical messages from Facebook/Instagram Page Channel
async function syncChannelMessages(channelId, months = 6, maxConvs = 100) {
  const channel = db.prepare("SELECT * FROM channels WHERE id=?").get(channelId);
  if (!channel) return { imported: 0, skipped: 0 };
  if (channel.type === 'tiktok') {
    console.log(`[sync] Skipping TikTok channel ${channel.name} (id=${channelId}) — sync not yet supported`);
    return { imported: 0, skipped: 0, reason: 'tiktok_not_supported' };
  }
  if (channel.type !== 'messenger' && channel.type !== 'instagram') return { imported: 0, skipped: 0 };

  // Fallback: use global page_access_token if channel-level token is missing
  let token = channel.access_token || getConfig('page_access_token');
  if (!token) {
    console.error(`[sync] No access token for channel ${channel.name} (id=${channelId})`);
    return { imported: 0, skipped: 0 };
  }

  const pageId = channel.page_id;
  if (!pageId) {
    console.error(`[sync] No page_id for channel ${channel.name} (id=${channelId}) — cannot call conversations API`);
    return { imported: 0, skipped: 0 };
  }

  // Dynamically resolve the Page Access Token from the configured token (e.g. System User token)
  token = await resolvePageAccessToken(pageId, token);

  const since   = Math.floor(Date.now() / 1000) - (months * 30 * 24 * 3600);

  const MAX_MESSAGES = 5000;
  let imported = 0, skipped = 0, conversations = 0;

  async function fbGet(url, label = 'FB API') {
    const r = await fetch(url);
    const d = await r.json();
    if (d.error) {
      console.error(`[sync] ${label} error: code=${d.error.code} subcode=${d.error.error_subcode} msg=${d.error.message}`);
      throw new Error(`${label}: ${d.error.message}`);
    }
    if (!d.data) {
      console.warn(`[sync] ${label} returned no data field. Response keys: ${Object.keys(d).join(', ')}`);
    }
    // Log first item for debugging when data is empty or suspicious
    if (Array.isArray(d.data) && d.data.length > 0) {
      console.log(`[sync] ${label}: ${d.data.length} items, first id=${d.data[0]?.id}, updated=${d.data[0]?.updated_time || d.data[0]?.created_time}`);
    } else if (Array.isArray(d.data)) {
      console.log(`[sync] ${label}: 0 items returned`);
    }
    return { items: d.data || [], nextUrl: d.paging?.next || null };
  }

  const stmtInsertMsg = db.prepare(
    `INSERT OR IGNORE INTO messages
       (conversation_id, direction, type, content, media_url, wa_message_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'delivered', ?)`
  );
  const stmtConvUpdate = db.prepare(
    `UPDATE conversations SET last_message=?, last_message_at=?
     WHERE id=? AND (last_message_at IS NULL OR last_message_at < ?)`
  );
  const stmtIncrementUnread = db.prepare(
    `UPDATE conversations SET unread_count = unread_count + 1 WHERE id=?`
  );

  const insertBatch = db.transaction((rows, conv) => {
    let added = 0;
    for (let i = 0; i < rows.length; i++) {
      const msg = rows[i];
      const fromPage = String(msg.from?.id) === String(pageId);

      let content, type = 'text', mediaUrl = null;
      const att = msg.attachments?.data?.[0];
      if (msg.message) {
        content = msg.message;
      } else if (msg.sticker) {
        content = '😊 Sticker'; type = 'sticker'; mediaUrl = msg.sticker;
      } else if (att) {
        const mime = att.mime_type || '';
        mediaUrl = att.image_data?.url || att.video_data?.url || att.file_url || null;
        if (mime.startsWith('image'))      { content = '📷 Photo';      type = 'image'; }
        else if (mime.startsWith('video')) { content = '🎥 Video';      type = 'video'; }
        else if (mime.startsWith('audio')) { content = '🎵 Audio';      type = 'audio'; }
        else                               { content = `📎 ${att.name || 'File'}`; type = 'file'; }
      } else {
        content = '[message]';
      }

      const createdAt = msg.created_time
        ? new Date(msg.created_time).toISOString().replace('T', ' ').slice(0, 19)
        : null;

      try {
        const result = stmtInsertMsg.run(
          conv.id, fromPage ? 'out' : 'in', type, content, mediaUrl, msg.id, createdAt
        );
        if (result.changes > 0) {
          added++;
          if (createdAt) stmtConvUpdate.run(content, createdAt, conv.id, createdAt);
          if (!fromPage) stmtIncrementUnread.run(conv.id);
        } else if (i === 0) {
          console.log(`[sync] insertBatch: msg.id=${msg.id} skipped (changes=0, likely duplicate wa_message_id)`);
        }
      } catch (insertErr) {
        console.error(`[sync] insertBatch error: msg.id=${msg.id}`, insertErr.message);
        // Log first insert error only to avoid console spam
        if (i === 0) console.error(`[sync] First insert error details:`, insertErr);
      }
    }
    return added;
  });

  if (db.pauseSave) db.pauseSave();
  let convCounter = 0;

  const cutoffMs = since * 1000;
  const toSqlTime = (t) => t ? new Date(t).toISOString().replace('T', ' ').slice(0, 19) : null;

  // Determine platform parameter for filtering
  const platform = channel.type === 'instagram' ? 'instagram' : 'messenger';

  try {
    let convUrl = `https://graph.facebook.com/v19.0/${pageId}/conversations`
      + `?platform=${platform}`
      + `&fields=updated_time,participants,snippet`
      + `&limit=50&access_token=${token}`;

    console.log(`[sync] Starting ${channel.name} (${platform}) pageId=${pageId} token=${token.slice(0,14)}...`);

    let stop = false;
    while (convUrl && !stop && imported + skipped < MAX_MESSAGES && conversations < maxConvs) {
      const { items: fbConvs, nextUrl } = await fbGet(convUrl, 'conversations');
      console.log(`[sync] Got ${fbConvs.length} conversations from FB`);
      convUrl = nextUrl;

      for (const fbConv of fbConvs) {
        if (imported + skipped >= MAX_MESSAGES || conversations >= maxConvs) { stop = true; break; }

        if (fbConv.snippet) {
          const s = fbConv.snippet.toLowerCase();
          if (s.includes('commented on') || s.includes('কমেন্ট করেছেন') || s.includes('created this chat') || s.includes('চ্যাটটি তৈরি করেছে')) {
            console.log(`[sync] Skipping comment-reply conversation: "${fbConv.snippet}"`);
            continue;
          }
        }

        const updatedMs = fbConv.updated_time ? new Date(fbConv.updated_time).getTime() : 0;
        if (updatedMs && updatedMs < cutoffMs) { stop = true; break; }

        conversations++;
        const other = (fbConv.participants?.data || []).find(p => String(p.id) !== String(pageId));
        if (!other) continue;

        let avatar = null;
        try {
          const pr = await fetch(`https://graph.facebook.com/v19.0/${other.id}?fields=profile_pic,name&access_token=${token}`);
          const pd = await pr.json();
          if (!pd.error) avatar = pd.profile_pic || null;
          if (pd.name) other.name = pd.name;
        } catch {}

        const contact = upsertContact({ name: other.name || 'Messenger User', messenger_id: other.id, avatar_url: avatar });
        const conv    = upsertConversation(contact.id, channel.id, 'messenger');

        const convTime = toSqlTime(fbConv.updated_time);
        if (convTime) {
          db.prepare(`UPDATE conversations SET last_message=COALESCE(@snip,last_message), last_message_at=@t
                      WHERE id=@id AND (last_message_at IS NULL OR last_message_at < @t)`)
            .run({ snip: fbConv.snippet || null, t: convTime, id: conv.id });
        }

        let msgUrl = `https://graph.facebook.com/v19.0/${fbConv.id}/messages`
          + `?fields=message,from,created_time,sticker,attachments{mime_type,name,image_data,video_data,file_url}`
          + `&limit=25&access_token=${token}`;
        let convMsgCount = 0;

        while (msgUrl && imported + skipped < MAX_MESSAGES && convMsgCount < 50) {
          const { items: msgs, nextUrl: nextMsgUrl } = await fbGet(msgUrl, 'messages');
          msgUrl = nextMsgUrl;
          if (msgs.length === 0) break;

          const oldest = msgs[msgs.length - 1]?.created_time;
          const added = insertBatch(msgs, conv);
          imported += added;
          skipped  += msgs.length - added;
          convMsgCount += msgs.length;
          console.log(`[sync] conv ${conv.id}: ${msgs.length} msgs, ${added} added, ${msgs.length - added} skipped`);
          if (oldest && new Date(oldest).getTime() < cutoffMs) break;
        }

        if (++convCounter % 10 === 0 && db.resumeSave && db.pauseSave) {
          db.resumeSave();
          db.pauseSave();
          broadcast('sync_progress', { channel_id: channel.id, channel: channel.name, conversations, imported });
        }
      }
    }

    const capped = (imported + skipped >= MAX_MESSAGES);
    console.log(`[sync] ${channel.name}: ${conversations} convs, ${imported} imported, ${skipped} skipped${capped ? ' (capped)' : ''}`);
    broadcast('sync_done', { channel_id: channel.id, channel: channel.name, imported, skipped, conversations, capped });
    return { imported, skipped, conversations, capped };

  } catch (e) {
    console.error('[sync] error:', e.message);
    broadcast('sync_error', { channel_id: channel.id, channel: channel.name, error: e.message, imported, conversations });
    throw e;
  } finally {
    if (db.resumeSave) db.resumeSave();
  }
}

// ─── Sync historical messages from a Messenger / Instagram channel ───────────
// Runs in the BACKGROUND and responds immediately — a long sync would otherwise
// exceed nginx's gateway timeout (504). Progress streams over SSE; the inbox
// polling picks up new conversations as they're imported.

// ─────────────────────────────────────────────────────────
// CONTACTS
// ─────────────────────────────────────────────────────────
router.get('/api/contacts', (req, res) => {
  const { search } = req.query;
  const params = {};
  let where = '';
  if (search && search !== 'undefined' && search !== 'null') {
    where = 'WHERE contacts.name LIKE @search OR contacts.phone LIKE @search';
    params.search = `%${search}%`;
  }
  res.json(db.prepare(`SELECT contacts.*, leads.lead_status, leads.lead_id as crm_lead_id, leads.destination FROM contacts LEFT JOIN leads ON leads.id=contacts.lead_id ${where} ORDER BY contacts.id DESC LIMIT 100`).all(params));
});

router.put('/api/contacts/:id', (req, res) => {
  const d = req.body;
  db.prepare(`UPDATE contacts SET name=@name,phone=@phone,email=@email,lead_id=@lead_id WHERE id=@id`).run({ ...d, id: req.params.id });
  res.json(db.prepare("SELECT * FROM contacts WHERE id=?").get(req.params.id));
});

// ─────────────────────────────────────────────────────────
// CONVERSATIONS
// ─────────────────────────────────────────────────────────
const CONV_SELECT = `
  SELECT conversations.*,
    contacts.name  AS contact_name,
    contacts.phone AS contact_phone,
    contacts.avatar_url AS contact_avatar,
    contacts.wa_id, contacts.messenger_id, contacts.instagram_id, contacts.tiktok_id,
    contacts.lead_id AS contact_lead_id,
    channels.name  AS channel_name,
    channels.type  AS channel_type,
    channels.color AS channel_color,
    channels.consultant AS channel_consultant,
    channels.phone_number_id,
    leads.lead_id AS lead_id,
    leads.lead_status,
    leads.destination AS lead_destination,
    leads.assigned_consultant AS lead_assigned_consultant,
    employees.name AS lead_employee_name,
    leads.assigned_employee_id AS lead_assigned_employee_id,
    (SELECT direction FROM messages WHERE conversation_id = conversations.id ORDER BY created_at DESC, id DESC LIMIT 1) AS last_message_direction,
    (SELECT status FROM messages WHERE conversation_id = conversations.id ORDER BY created_at DESC, id DESC LIMIT 1) AS last_message_status,
    (SELECT COUNT(*) FROM messages WHERE conversation_id = conversations.id AND direction = 'out') AS outbound_count
  FROM conversations
  LEFT JOIN contacts  ON contacts.id  = conversations.contact_id
  LEFT JOIN channels  ON channels.id  = conversations.channel_id
  LEFT JOIN leads   ON leads.id     = conversations.lead_id
  LEFT JOIN employees ON employees.id = leads.assigned_employee_id
`;




// Convert conversation contact into a CRM lead (creating new lead or linking to existing)

// ─────────────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────────────

// File upload endpoint for base64 encoded media attachments
router.post('/api/upload', (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) {
      return res.status(400).json({ error: 'name and data (base64) are required' });
    }
    // Clean filename
    const cleanName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${Date.now()}_${cleanName}`;
    const filePath = join(UPLOADS_DIR, filename);

    // Decode base64
    const buffer = Buffer.from(data, 'base64');
    writeFileSync(filePath, buffer);

    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/uploads/${filename}`;

    res.json({
      url: fileUrl,
      relativeUrl: `/uploads/${filename}`,
      name: filename
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Send message

// ─────────────────────────────────────────────────────────
// QUICK REPLIES
// ─────────────────────────────────────────────────────────
router.get('/api/quick-replies', (req, res) => res.json(db.prepare("SELECT * FROM quick_replies ORDER BY category, title").all()));
router.post('/api/quick-replies', (req, res) => {
  const { title, content, category } = req.body;
  const info = db.prepare("INSERT INTO quick_replies (title,content,category) VALUES (?,?,?)").run(title, content, category||null);
  res.json(db.prepare("SELECT * FROM quick_replies WHERE id=?").get(info.lastInsertRowid));
});
router.put('/api/quick-replies/:id', (req, res) => {
  const { title, content, category } = req.body;
  db.prepare("UPDATE quick_replies SET title=?,content=?,category=? WHERE id=?").run(title, content, category||null, req.params.id);
  res.json(db.prepare("SELECT * FROM quick_replies WHERE id=?").get(req.params.id));
});
router.delete('/api/quick-replies/:id', (req, res) => { db.prepare("DELETE FROM quick_replies WHERE id=?").run(req.params.id); res.json({ ok:true }); });

// ─────────────────────────────────────────────────────────
// WEBSITE LEAD INGESTION WEBHOOK (public)
// ─────────────────────────────────────────────────────────
router.post('/api/webhook/website-lead', async (req, res) => {
  try {
    const { name, phone, email, destination, source, referrer, message, page_url } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    const lead_id = nextLeadId();
    let assigned_consultant = null;
    let leadSource = 'Website';
    let actualSource = source || null;
    let actualDestination = destination || null;

    if (source === 'China') {
      assigned_consultant = 'Abdullah Al Rakib';
      actualDestination = actualDestination || 'China';
    } else if (source === 'Bangladesh Office') {
      assigned_consultant = 'Taj Ahmed';
      actualDestination = actualDestination || 'Bangladesh';
      actualSource = actualSource || 'In-House';
    } else if (source === 'B2B') {
      assigned_consultant = 'Tahmid Imam';
      actualDestination = actualDestination || 'Bangladesh';
      actualSource = actualSource || 'B2B';
    }

    const params = leadParams({
      client_name: name,
      phone: phone || null,
      email: email || null,
      destination: actualDestination,
      lead_source: leadSource,
      source: actualSource,
      referrer: referrer || null,
      assigned_consultant,
      notes: message || null,
      event_source_url: page_url || null,
    }, lead_id, 0);

    const info = db.prepare(LEAD_INSERT_SQL).run(params);
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(info.lastInsertRowid);

    sendCAPIEvent('Lead', { ...lead, event_source_url: page_url || undefined }).catch(() => {});
    logActivity({ type: 'lead_created', actor: { name: 'Website Webhook' }, lead, details: { source: leadSource, destination: lead.destination, assigned_consultant: lead.assigned_consultant } });
    broadcast('new_lead', { lead });

    res.json({ success: true, lead_id: lead.id });
  } catch (e) {
    console.error('[website-lead] webhook error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────
// META WEBHOOK — WhatsApp + Messenger + Instagram + Lead Ads + TikTok placeholder
// ─────────────────────────────────────────────────────────
router.get('/webhook/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode !== 'subscribe') return res.sendStatus(403);
  // Accept: global config token, any channel's verify token, or common defaults
  const globalToken = getConfig('verify_token') || '';
  const defaults = ['eduexpress2024', 'eduexpress_verify_2024', 'eduexpress', 'verify_token'];
  const channelTokens = db.prepare("SELECT webhook_verify_token FROM channels").all().map(r => r.webhook_verify_token).filter(Boolean);
  const allTokens = [globalToken, ...defaults, ...channelTokens].filter(Boolean);
  if (allTokens.includes(token)) {
    console.log('✅ Meta webhook verified with token:', token);
    return res.status(200).send(challenge);
  }
  console.log('❌ Webhook verify failed. Got:', token, '| Expected one of:', allTokens);
  res.sendStatus(403);
});

router.get('/templates', (req, res) => requireManagerOrAdmin(req, res, () => {
  const rows = db.prepare("SELECT * FROM message_templates ORDER BY category, usage_count DESC, id DESC").all();
  res.json(rows.map(r => {
    try { r.variables = r.variables ? JSON.parse(r.variables) : []; } catch (e) { r.variables = []; }
    return r;
  }));
}));

router.post('/templates', (req, res) => {
    const db = getDb();
  const { name, category, language, content, variables, approved } = req.body || {};
  if (!name || !content) return res.status(400).json({ error: 'name and content are required' });
  const info = db.prepare(`INSERT INTO message_templates (name, category, language, content, variables, approved)
    VALUES (?,?,?,?,?,?)`).run(name, category || 'general', language || 'en', content, variables ? JSON.stringify(variables) : null, approved ?? 0);
  const r = db.prepare("SELECT * FROM message_templates WHERE id=?").get(info.lastInsertRowid);
  try { r.variables = r.variables ? JSON.parse(r.variables) : []; } catch (e) { r.variables = []; }
  res.json(r);
});

router.put('/templates/:id', (req, res) => {
    const db = getDb();
  const { name, category, language, content, variables, approved } = req.body || {};
  const cur = db.prepare("SELECT * FROM message_templates WHERE id=?").get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Not found' });
  db.prepare(`UPDATE message_templates SET name=COALESCE(?,name), category=COALESCE(?,category), language=COALESCE(?,language), content=COALESCE(?,content), variables=COALESCE(?,variables), approved=COALESCE(?,approved) WHERE id=?`)
    .run(name ?? null, category ?? null, language ?? null, content ?? null, variables ? JSON.stringify(variables) : null, approved ?? null, req.params.id);
  const r = db.prepare("SELECT * FROM message_templates WHERE id=?").get(req.params.id);
  try { r.variables = r.variables ? JSON.parse(r.variables) : []; } catch (e) { r.variables = []; }
  res.json(r);
});

router.delete('/templates/:id', (req, res) => {
    const db = getDb();
  db.prepare("DELETE FROM message_templates WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

router.get('/tags', (req, res) => requireManagerOrAdmin(req, res, () => {
  const rows = db.prepare("SELECT * FROM contact_tags ORDER BY name").all();
  const counts = db.prepare("SELECT tag_id, COUNT(*) as c FROM contact_tag_assignments GROUP BY tag_id").all();
  const countMap = Object.fromEntries(counts.map(c => [c.tag_id, c.c]));
  res.json(rows.map(r => ({ ...r, contact_count: countMap[r.id] || 0 })));
}));

router.post('/tags', (req, res) => requireAdmin(req, res, () => {
  const { name, color } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const info = db.prepare("INSERT INTO contact_tags (name, color) VALUES (?,?)").run(name, color || '#3b82f6');
    res.json(db.prepare("SELECT * FROM contact_tags WHERE id=?").get(info.lastInsertRowid));
  } catch (e) {
    res.status(400).json({ error: e.message.includes('UNIQUE') ? 'Tag name already exists' : e.message });
  }
}));

router.delete('/tags/:id', (req, res) => requireAdmin(req, res, () => {
  db.prepare("DELETE FROM contact_tags WHERE id=?").run(req.params.id);
  res.json({ ok: true });
}));

router.get('/tags/:id/contacts', (req, res) => requireAdmin(req, res, () => {
  const contacts = db.prepare(`
    SELECT c.* FROM contacts c
    JOIN contact_tag_assignments cta ON cta.contact_id = c.id
    WHERE cta.tag_id = ?
  `).all(req.params.id);
  res.json({ contacts });
}));

  return router;
}
