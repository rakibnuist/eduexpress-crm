import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8');

test('CEO operating-layer tables are migrated idempotently', () => {
  assert.match(server, /CREATE TABLE IF NOT EXISTS approval_requests/);
  assert.match(server, /CREATE TABLE IF NOT EXISTS approval_events/);
  assert.match(server, /CREATE TABLE IF NOT EXISTS management_tasks/);
});

test('CEO command snapshot is full-admin guarded', () => {
  assert.match(server, /app\.get\('\/api\/ceo\/command',\s*\(req, res\) => requireAdmin\(req, res/);
});

test('approval decisions require a written note and a non-requester approver', () => {
  assert.match(server, /if \(isRequester\) return res\.status\(409\)\.json\(\{ error: 'You cannot approve or reject your own request' \}\)/);
  assert.match(server, /if \(!note\) return res\.status\(400\)\.json\(\{ error: 'A decision note is required' \}\)/);
});

test('approval decisions are append-only events', () => {
  assert.match(server, /INSERT INTO approval_events \(approval_id,action,actor_id,actor_name,note\)/);
  assert.doesNotMatch(server, /DELETE FROM approval_events/);
});

test('task list scopes non-managers to their own work', () => {
  assert.match(server, /where\.push\('\(assigned_to=\? OR assigned_user_id=\?\)'\)/);
  assert.match(server, /req\.user\.name \|\| '', req\.user\.id/);
});

test('task completion records a completion timestamp', () => {
  assert.match(server, /if \(d\.status === 'done'\) updates\.push\("completed_at=datetime\('now'\)"\)/);
  assert.match(server, /if \(d\.status !== 'done'\) updates\.push\('completed_at=NULL'\)/);
});
