import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const serverSource = readFileSync(new URL('../server.js', import.meta.url), 'utf8');

test('kpi_targets workflow & SLA columns are migrated idempotently', () => {
  assert.match(serverSource, /ALTER TABLE kpi_targets ADD COLUMN target_daily_actions/);
  assert.match(serverSource, /ALTER TABLE kpi_targets ADD COLUMN target_followups/);
  assert.match(serverSource, /ALTER TABLE kpi_targets ADD COLUMN max_sla_hours/);
});

test('employee KPI & workflow routes keep proper auth guards and route ordering', () => {
  const meIndex = serverSource.indexOf("app.get('/api/employee-kpi/me'");
  const oneIndex = serverSource.indexOf("app.get('/api/employee-kpi/:emp_id'");
  assert.ok(meIndex !== -1 && oneIndex !== -1, 'Both /me and /:emp_id routes must exist');
  assert.ok(meIndex < oneIndex, '/api/employee-kpi/me must be registered before /api/employee-kpi/:emp_id');

  assert.match(
    serverSource,
    /app\.get\('\/api\/employee-kpi',\s*\(req,\s*res\)\s*=>\s*requireManagerOrAdmin\(req,\s*res/,
  );
  assert.match(
    serverSource,
    /app\.get\('\/api\/employee-kpi\/:emp_id',\s*\(req,\s*res\)\s*=>\s*requireManagerOrAdmin\(req,\s*res/,
  );
  assert.match(
    serverSource,
    /app\.put\('\/api\/kpi\/targets',\s*requireAdmin,/,
  );
});

test('personal KPI route strictly scopes to findEmployeeForUser(req.user)', () => {
  assert.match(
    serverSource,
    /app\.get\('\/api\/employee-kpi\/me',\s*\(req,\s*res\)\s*=>\s*\{\s*const emp = findEmployeeForUser\(req\.user\);/,
  );
});

test('employee KPI workflow engine tracks SLA, outbound chats, and tasks without bots', () => {
  assert.match(serverSource, /const BOT_KPI_SENDERS = new Set/);
  assert.match(serverSource, /note:\s*2/);
  assert.match(serverSource, /task_completed:\s*3/);
  assert.match(serverSource, /uncontactedOverdue/);
  assert.match(serverSource, /followupsOverdue/);
  assert.match(serverSource, /workflowTimeline/);
});
