# EduExpress CRM — Full Project Audit Report

**Audit Date:** 2026-01-16
**Auditor:** Agent code-review
**Project:** `/Users/a1/Desktop/webApp/crm-webapp`
**Build Status:** ✅ Passes (`vite build` succeeds, 0 ESLint errors)
**Total ESLint Warnings:** 100 (all `no-unused-vars`)

---

## 1. 🟢 Build & Lint — No Blocking Errors

| Check | Result | Notes |
|-------|--------|-------|
| `vite build` | ✅ Pass | Production bundle builds cleanly in ~3.4s |
| `eslint .` | ⚠️ 100 warnings | All are `no-unused-vars` (unused imports, variables, params). Zero hard errors. |
| `server.js` | ✅ No syntax errors | 4,430 lines, runs without parse errors |
| `sqldb.js` | ✅ No syntax errors | sql.js compatibility wrapper |

### Recommended Action
- Run a quick cleanup pass to remove the 100 unused-variable warnings (makes the project look more professional and reduces noise).

---

## 2. 🔴 Critical Security Issues

### 2.1 Hardcoded Meta Access Token in Source Code
**File:** `server.js` (line 1356)
**Severity:** 🔴 **CRITICAL**
**Snippet:**
```javascript
const newToken = 'EAAVoF1AFCwoBRl9hbdnnxIUj5nFoaIEOj0doThSY3p159jABiZApMlSQTr4IguvIBNpyC1bsHewaq1jkr57Dkn349tyd458NpwGbZBhcw3NGv3d41TVj1VnLz5SKcNFNGHZBOL091vEIBJEQyH9DLyXz3JlSeVGxKGS9ZB4WWs0VwE3W9yfLGwQMr16BsBRGBgZDZD';
```
**Impact:** This is a real, valid Facebook/Meta System User Access Token. Anyone with access to the repo can extract it and call Meta Graph API on behalf of the business.
**Fix:** Remove the token from the migration and replace with a runtime environment variable or a secure secret store. Rotate the token immediately after removing it from code.

### 2.2 Hardcoded Internal API Key
**File:** `server.js` (line 229)
**Severity:** 🟡 **Medium**
```javascript
const INTERNAL_API_KEY = 'eduexpress-n8n-2024';
```
**Impact:** Anyone who reads the source knows the internal service key. If the app is ever exposed to the internet, this bypasses auth entirely.
**Fix:** Move to `process.env.INTERNAL_API_KEY` with a fallback for local dev only.

### 2.3 Default Admin Password in Code
**File:** `server.js` (lines 1413–1414)
**Severity:** 🟡 **Medium**
```javascript
const email = process.env.ADMIN_EMAIL    || 'admin@eduexpressint.com';
const pass  = process.env.ADMIN_PASSWORD || 'ChangeMe!2026';
```
**Impact:** If the environment variables are not set, the app creates a default admin with a predictable password.
**Fix:** Ensure production environments always set `ADMIN_PASSWORD`. Consider generating a random password on first boot if no admin exists and no env var is set.

---

## 3. 🟠 SQL Injection Vulnerabilities

### 3.1 Contacts Search — Unparameterized LIKE
**File:** `server.js` (line 3593)
**Severity:** 🟠 **High**
```javascript
const where = (search && search !== 'undefined' && search !== 'null') 
  ? `WHERE name LIKE '%${search}%' OR phone LIKE '%${search}%'` 
  : '';
```
**Impact:** A malicious search string containing single quotes can break the SQL query or potentially inject data. While the route is behind auth, a consultant-level account could abuse it.
**Fix:** Use parameterized queries:
```javascript
const where = search ? "WHERE name LIKE @search OR phone LIKE @search" : '';
const params = search ? { search: `%${search}%` } : {};
```

### 3.2 Messages Pagination — Direct Integer Interpolation
**File:** `server.js` (lines 3830–3833)
**Severity:** 🟡 **Low-Medium**
```javascript
const beforeClause = before ? `AND id < ${parseInt(before)}` : '';
```
**Impact:** `parseInt` is used, so it mitigates string injection, but direct interpolation is still an anti-pattern. A non-integer value becomes `NaN` which stringifies to `"NaN"`, causing a SQL error.
**Fix:** Use parameterized query:
```javascript
const beforeClause = before ? "AND id < @before" : "";
// pass { before: parseInt(before) } as params
```

### 3.3 Income/Expense Month Filter — Direct String Interpolation
**File:** `server.js` (lines 2581, 2607)
**Severity:** 🟡 **Low-Medium**
```javascript
const w = month ? `WHERE month='${month}' AND (exclude_from_cash IS NULL OR exclude_from_cash = 0)` : `...`;
```
**Impact:** `month` is user-controlled input. Single quotes inside the month string would break the query.
**Fix:** Use parameterized queries with `@month` binding.

---

## 4. 🟡 Logic & Runtime Issues

### 4.1 Misleading Indentation in Webhook Handlers
**Files:** `server.js` (lines 4006–4017, 4069–4077, 4117–4127)
**Severity:** 🟡 **Medium**
The code inside `for (const msg of val.messages || [])` has inconsistent indentation. In some places the `const waInCount = ...` and the `if (waInCount === 1)` block are indented by 8 spaces instead of 10, making them visually appear *outside* the loop when they are actually *inside* it. This is a readability/maintainability risk.

**Fix:** Re-indent the WhatsApp, Messenger, and Lead-Gen webhook handlers to 2-space or 4-space consistency.

### 4.2 `rowsWithRunning` Defined but Never Used
**File:** `server.js` (line 2687)
```javascript
const rowsWithRunning = id => events.find(e => e.id === id && e.kind === 'in') || events.find(e => e.id === id && e.kind === 'out');
```
**Impact:** Dead code. Not harmful, but confusing.
**Fix:** Remove it.

### 4.3 `seedData` and `getWelcomeMessage` Are Dead Code
**File:** `server.js` (lines 1381, 1735)
**Impact:** `seedData` is defined but never called (commented out at line 799). `getWelcomeMessage` is defined but never used. The actual welcome message is hardcoded elsewhere or pulled from `quick_replies` inline.
**Fix:** Remove both functions or add a TODO explaining why they are kept.

### 4.4 Unused `next` Parameters in Middleware
**File:** `server.js` (multiple lines: 285, 289, 303, 312, 324, 723, 2101, 2111, 2266, 2274, 2285, 2663, 2672, 2713, 2734, 2920, 2968, 2991, 3061, 3203, 3339, 4235)
**Impact:** 28 ESLint warnings. Not harmful, but clutters the lint output.
**Fix:** Replace `next` with `_next` or remove the parameter if not used.

### 4.5 `sendCAPIEvent` Called Without `await` in `POST /api/leads`
**File:** `server.js` (line 1994)
```javascript
sendCAPIEvent('Lead', lead);
```
**Impact:** If the Meta API call throws, the error becomes an unhandled promise rejection. The client will still get the lead response, but the server may log a crash or emit an unhandled rejection.
**Fix:** Add `await` or `.catch(...)` to suppress the error gracefully.

### 4.6 `sendCAPIEvent` Called Without `await` in `PUT /api/leads/:id`
**File:** `server.js` (line 2017)
```javascript
if (evtMap[lead.lead_status]) sendCAPIEvent(evtMap[lead.lead_status], lead);
```
**Fix:** Same as above — add `.catch(() => {})` or `await` with try/catch.

### 4.7 Potential Race Condition in `autoCheckIn`
**File:** `server.js` (lines 1587–1649)
**Impact:** The function queries for an existing attendance record, then inserts if none exists. Between the SELECT and INSERT, another request (e.g., from a different tab or the auto-login flow) could insert a record, causing a duplicate. However, the `UNIQUE` constraint on `attendance` is not shown in the schema, so duplicates may be allowed.
**Fix:** Add a `UNIQUE(emp_id, date)` constraint on the `attendance` table and handle the conflict gracefully.

### 4.8 `logPayrollExpense` Logs Activity Without a Real Actor
**File:** `server.js` (lines 2907–2913)
```javascript
logActivity({ type: 'expense_recorded', actor: { name: 'System' }, amount: row.net_pay, to: row.name, ... });
```
**Impact:** The `actor` object lacks `id` and `email`. `logActivity` references `actor?.id || null` and `actor?.name || actor?.email || 'System'`, so it falls back to `'System'`. This is fine, but the `to` field is passed as a top-level property instead of inside `details`. `logActivity` expects `to` as a parameter, but it's passed as `to: row.name` — actually looking at the function signature, `to` is a valid parameter. So this is actually correct.

### 4.9 Missing `await` in `forwardToN8N`
**File:** `server.js` (line 1744–1751)
```javascript
function forwardToN8N(data) {
  fetch(N8N_WELCOME_WEBHOOK, { ... }).catch(e => console.log(...));
  console.log(`[n8n] forwarded ...`);
}
```
**Impact:** Fire-and-forget is intentional here, but if `fetch` throws synchronously (rare), it won't be caught. The `console.log` runs immediately, before the fetch finishes. This is acceptable for a webhook forwarder.

### 4.10 `broadcast` Filter Function Uses `db` Without Guard
**File:** `server.js` (lines 1472–1485)
```javascript
function broadcastActivity(row) {
  broadcast('activity', { activity: row }, (u) => {
    if (u?.role === 'admin') return true;
    if (!row.lead_id) return false;
    const consultant = u?.consultant_name || u?.name;
    try {
      const lead = db.prepare("SELECT assigned_consultant FROM leads WHERE id=?").get(row.lead_id);
      return lead && lead.assigned_consultant === consultant;
    } catch { return false; }
  });
}
```
**Impact:** If `db` is not ready or the query fails, it silently returns `false`. This is defensive coding, but if the DB is in a bad state, the SSE broadcast may fail silently for non-admin users.
**Fix:** Acceptable as-is, but consider logging the caught error for observability.

### 4.11 `app.get('/api/events')` Sends Cookie-Based Auth but No Cookie Check for Token Refresh
**File:** `server.js` (lines 1428–1453)
**Impact:** The SSE endpoint verifies the token once at connection time. If the cookie expires while the connection is open, the client continues to receive events with stale auth. This is standard SSE behavior, but for a long-lived connection it means a user could see notifications after their session has expired.
**Fix:** Acceptable for most use cases. For higher security, add periodic re-verification inside the ping interval.

### 4.12 `importApplicationRows` Status Mapping Loses Information
**File:** `server.js` (lines 2185–2201)
```javascript
'return': 'submitted', 'returned': 'submitted',
'reject': 'documents', 'rejected': 'documents'
```
**Impact:** A returned or rejected application is mapped to `submitted` or `documents`, which is inaccurate for tracking. This may be intentional (simplified pipeline), but it loses the distinction between a returned application and an active submitted one.
**Fix:** If the intention is to keep the simplified mapping, add a code comment explaining why. Otherwise, map to distinct status values.

### 4.13 `leadParams` Does Not Validate `date_of_birth` Format
**File:** `server.js` (lines 1919–1953)
**Impact:** Any string can be passed as `date_of_birth`. Invalid dates may be stored and cause sorting/filtering issues later.
**Fix:** Add a simple regex validation `YYYY-MM-DD` or use a date parser.

### 4.14 `buildAlerts` Query May Be Slow on Large Datasets
**File:** `server.js` (lines 668–720)
**Impact:** The `idleLeads` query uses `NOT EXISTS (SELECT 1 FROM activity_log ...)` which is a correlated subquery. With thousands of leads and hundreds of thousands of activity rows, this can become very slow.
**Fix:** Add a composite index on `activity_log(lead_id, created_at)` (already exists at line 990) and an index on `leads(date_added, lead_status)`. The existing index `idx_activity_lead` covers `(lead_id)` but not `(lead_id, created_at)`. The existing index is `idx_activity_lead ON activity_log(lead_id)` — adding `created_at` to it would help.

### 4.15 `contacts` Search Endpoint Does Not Limit Search Results
**File:** `server.js` (line 3593)
**Impact:** The query has `LIMIT 100` but the `search` parameter is interpolated directly. If `search` is empty or `""`, the `where` clause becomes empty, returning all contacts. The limit of 100 caps it, but this is still a minor vector for enumeration.
**Fix:** Use parameterized queries and keep the `LIMIT 100`.

### 4.16 `app.use('/uploads', express.static(UPLOADS_DIR))` — No File Type Validation
**File:** `server.js` (line 22)
**Impact:** Any file uploaded to the server is served statically. If a malicious file (e.g., HTML with JS) is uploaded, it could be served and executed in the browser context.
**Fix:** Add a file type whitelist in the `/api/upload` endpoint and serve uploads with `Content-Disposition: attachment` or from a separate domain.

### 4.17 `app.post('/api/upload')` Base64 Decode — No Size Limit Per-File
**File:** `server.js` (lines 3846–3874)
**Impact:** The global body limit is 50MB, but there's no per-file size check. A base64-encoded file can be close to 50MB raw, which is large but acceptable. However, there's no check for disk space before writing.
**Fix:** Add a max size check (e.g., 10MB) before writing to disk.

### 4.18 `syncChannelMessages` Uses `fbGet` Without Pagination Guard for `nextUrl`
**File:** `server.js` (lines 3489–3546)
**Impact:** The sync loop follows `nextUrl` from Facebook's API. If the API returns a malformed or infinite pagination chain, the loop could run forever (capped by `MAX_MESSAGES` and `convCounter` limits). The limits are in place, so this is mitigated.
**Fix:** Acceptable as-is. The `MAX_MESSAGES` cap prevents infinite loops.

---

## 5. 🟡 React Frontend Issues

### 5.1 Missing `key` Prop in `NotificationBell` Dropdown
**File:** `src/components/NotificationBell.jsx` (line 163)
```jsx
<Link key={a.id} to={a.lead_id ? `/leads?q=${encodeURIComponent(a.lead_name || '')}` : '/cockpit'} ...>
```
**Impact:** `a.id` may not be unique if multiple notifications have the same ID (unlikely but possible with deduped activity log). If `a.id` is `undefined` for any reason, React will warn about missing keys.
**Fix:** Ensure `a.id` is always present, or use a composite key: `key={a.id + '-' + i}`.

### 5.2 `Layout.jsx` useEffect Missing Dependency `toast`
**File:** `src/components/Layout.jsx` (line 86)
```javascript
useEffect(() => { ... }, [user]);
```
**ESLint Warning:** `React Hook useEffect has a missing dependency: 'toast'`
**Impact:** If the `useToast` hook returns a new `toast` function reference on re-render, the effect will use a stale `toast`. However, `useToast` typically returns a stable reference, so this is usually harmless.
**Fix:** Add `toast` to the dependency array or suppress the warning with a comment if the reference is stable.

### 5.3 `Finance.jsx` useEffect Missing Dependency `load`
**File:** `src/pages/Finance.jsx` (line 44)
```javascript
useEffect(() => { load(); }, [month]);
```
**ESLint Warning:** Missing dependency `load`.
**Impact:** `load` is defined inside the component and captures `month` from the closure. If `load` is re-created on every render, the effect runs with the latest `load` anyway because `month` is the dependency. But if `load` is memoized later, this could become a bug.
**Fix:** Wrap `load` in `useCallback` and add it to the dependency array, or inline the function body inside the effect.

### 5.4 `MyDay.jsx` useEffect Missing Dependencies
**File:** `src/pages/MyDay.jsx` (lines 73, 175)
**Impact:** Same pattern as Finance.jsx — missing `load` and `form.accomplishments` in dependency arrays.
**Fix:** Inline the effect body or add the dependencies.

### 5.5 `StudentPortal.jsx` useEffect Missing Dependency `load`
**File:** `src/pages/StudentPortal.jsx` (lines 64, 68)
**Impact:** Same pattern.
**Fix:** Add `load` to dependency array or inline.

### 5.6 `Leads.jsx` Unused Imports
**File:** `src/pages/Leads.jsx` (lines 2, 4, 11, 26)
**Impact:** `useLocation`, `StatusBadge`, `DollarSign`, `Globe`, `AlertCircle`, `CheckCircle2`, `XCircle`, `user` prop are imported but never used. This adds bundle size (though tree-shaking removes them in production) and clutters the code.
**Fix:** Remove unused imports.

### 5.7 `Reports.jsx` Unused Imports
**File:** `src/pages/Reports.jsx` (lines 10, 11, 13, 21)
**Impact:** `Trophy`, `AlertCircle`, `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`, `fmtFull` are unused. The chart imports suggest a planned chart section that was never implemented.
**Fix:** Remove unused imports or implement the missing chart section.

### 5.8 `HR.jsx` Unused Recharts Imports
**File:** `src/pages/HR.jsx` (line 13)
**Impact:** `RadialBarChart`, `RadialBar`, `Cell` are imported but never used.
**Fix:** Remove them.

### 5.9 `LeadDetail.jsx` — Many Unused Imports
**File:** `src/pages/LeadDetail.jsx` (lines 13–17)
**Impact:** `MapPin`, `Calendar`, `ChevronRight`, `Clock`, `BookOpen`, `Share2`, `Copy`, `QrCode`, `RotateCw` are imported but never used. The component is 600+ lines — these may be remnants of removed features.
**Fix:** Remove unused imports.

### 5.10 `Dashboard.jsx` — `enrolled` Variable Defined but Never Used
**File:** `src/pages/Dashboard.jsx` (line 86)
```javascript
const enrolled = pipeline.find(p => p.lead_status === 'Enrolled')?.count || 0;
```
**Impact:** Dead code. The variable is computed but never rendered.
**Fix:** Remove it or use it in a KPI card.

### 5.11 `name` Variable Defined but Never Used in Dashboard
**File:** `src/pages/Dashboard.jsx` (line 256)
```javascript
const name = /* ... */;
```
**Impact:** Dead code.
**Fix:** Remove it.

### 5.12 `CommandPalette.jsx` — Unused Imports
**File:** `src/components/CommandPalette.jsx` (lines 6, 11)
**Impact:** `useCallback` and `MessageSquare` are imported but never used.
**Fix:** Remove them.

### 5.13 `ExcelImport.jsx` — Unused Imports and Variables
**File:** `src/components/ExcelImport.jsx` (lines 9, 130, 161)
**Impact:** `Trash2`, `fileName`, `destFromSheet` are unused.
**Fix:** Remove them.

### 5.14 `NotificationBell.jsx` — Unused Import
**File:** `src/components/NotificationBell.jsx` (line 9)
**Impact:** `AlertCircle` is imported but never used.
**Fix:** Remove it.

### 5.15 `Applications.jsx` — Unused Imports
**File:** `src/pages/Applications.jsx` (lines 16, 18)
**Impact:** `AlertTriangle`, `Filter`, `User` are unused.
**Fix:** Remove them.

### 5.16 `Cockpit.jsx` — Unused Imports
**File:** `src/pages/Cockpit.jsx` (lines 14, 16)
**Impact:** `MessageSquare`, `CartesianGrid` are unused.
**Fix:** Remove them.

### 5.17 `Conversations.jsx` — Unused Imports and Variables
**File:** `src/pages/Conversations.jsx` (lines 6, 30)
**Impact:** `Mail`, `setChannelFilter` are unused.
**Fix:** Remove them.

### 5.18 `Marketing.jsx` — Unused Variable
**File:** `src/pages/Marketing.jsx` (line 247)
**Impact:** `post` is defined but never used in a map callback.
**Fix:** Remove it or use `_post`.

### 5.19 `Settings.jsx` — Unused Import
**File:** `src/pages/Settings.jsx` (line 144)
**Impact:** `Card` is imported but never used.
**Fix:** Remove it.

### 5.20 `Pipeline.jsx` — Unused Import
**File:** `src/pages/Pipeline.jsx` (line 5)
**Impact:** `useRef` is imported but never used.
**Fix:** Remove it.

### 5.21 `StudentPortal.jsx` — Unused Imports
**File:** `src/pages/StudentPortal.jsx` (lines 9, 13, 14)
**Impact:** `useRef`, `Clock`, `Calendar`, `Phone`, `Heart` are unused.
**Fix:** Remove them.

---

## 6. 🟢 Configuration & Infrastructure

### 6.1 `package.json` — Dependencies Are Up to Date
- `react`: ^19.2.6 (latest)
- `vite`: ^8.0.12 (latest)
- `tailwindcss`: ^4.3.0 (latest)
- `express`: ^5.2.1 (latest)

### 6.2 `vite.config.js` — Proxy Setup Correct
```javascript
server: { proxy: { '/api': 'http://localhost:3001', '/uploads': 'http://localhost:3001' } }
```
This correctly routes API calls to the backend during development.

### 6.3 `eslint.config.js` — Modern Flat Config
The ESLint config uses the new flat config format (`defineConfig`). It correctly separates Node.js and browser rules. However, it suppresses `react-refresh/only-export-components` which is a pragmatic choice for page components.

### 6.4 `.gitignore` — Missing Entries
**Current `.gitignore`:**
```
node_modules/
dist/
```
**Missing:**
- `crm.db` (the SQLite database should never be committed)
- `crm.db-wal` (WAL journal)
- `uploads/` (user-generated files)
- `seed_data.json` (may contain real data)
- `.jwt_secret` (sensitive secret file)
- `.env` (if one is created later)
- `.fuse_hidden*` (these are temp files from FUSE mounts)

**Fix:** Add these to `.gitignore` immediately to prevent accidental commits of sensitive data.

---

## 7. 📋 Summary — Priority Action List

| Priority | Issue | File | Effort |
|----------|-------|------|--------|
| 🔴 **P0** | Remove hardcoded Meta access token | `server.js:1356` | 10 min |
| 🔴 **P0** | Move `INTERNAL_API_KEY` to env var | `server.js:229` | 5 min |
| 🔴 **P0** | Fix SQL injection in contacts search | `server.js:3593` | 10 min |
| 🔴 **P0** | Add `crm.db`, `uploads/`, `.jwt_secret` to `.gitignore` | `.gitignore` | 2 min |
| 🟠 **P1** | Fix SQL injection in income/expense month filters | `server.js:2581,2607` | 10 min |
| 🟠 **P1** | Fix SQL injection in messages pagination | `server.js:3830` | 5 min |
| 🟠 **P1** | Add `await` or `.catch()` to `sendCAPIEvent` calls | `server.js:1994,2017` | 5 min |
| 🟠 **P1** | Clean up all 100 ESLint warnings | Multiple files | 20 min |
| 🟡 **P2** | Fix webhook indentation | `server.js:4006,4069,4117` | 10 min |
| 🟡 **P2** | Add per-file size limit to upload endpoint | `server.js:3846` | 5 min |
| 🟡 **P2** | Add `UNIQUE(emp_id, date)` to attendance | `server.js:878` | 5 min |
| 🟡 **P2** | Fix `rowsWithRunning` dead code | `server.js:2687` | 1 min |
| 🟡 **P2** | Fix missing useEffect dependencies | `Finance.jsx, MyDay.jsx, StudentPortal.jsx` | 10 min |
| 🟢 **P3** | Add file type validation to upload endpoint | `server.js:3846` | 15 min |
| 🟢 **P3** | Improve `buildAlerts` query performance | `server.js:668` | 15 min |

---

## 8. ✅ What's Working Well

1. **Build System** — Vite + React 19 + Tailwind CSS 4 is a modern, fast stack.
2. **Authentication** — JWT with HMAC-SHA256, secure cookie settings, bcrypt-like password hashing with scrypt.
3. **Database** — sql.js with WAL mode, atomic saves, and OOM recovery handling.
4. **Real-time** — SSE for live notifications and sync progress.
5. **RBAC** — Role-based access control is properly enforced server-side for consultants, managers, and admins.
6. **Geofencing & Wi-Fi** — Office location and network enforcement for attendance and login.
7. **Meta Integration** — Webhooks for WhatsApp, Messenger, Instagram, and Lead Ads with CAPI event tracking.
8. **Student Portal** — Public-facing portal with token-based access for document uploads and messaging.
9. **Code Splitting** — Route-level lazy loading with React Suspense.
10. **Error Handling** — Client-side error logging with `window.onerror` and `window.onunhandledrejection`.

---

*End of Report*
