import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const serverSource = readFileSync(new URL('../server.js', import.meta.url), 'utf8');

test('legacy public diagnostics stay explicitly blocked', () => {
  for (const route of [
    '/diagnose-db',
    '/api/public/diag2',
    '/api/public/diag3',
    '/api/public/diag4',
    '/api/public/fix-leads-manual',
  ]) {
    assert.match(
      serverSource,
      new RegExp(`['"]${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
      `${route} should remain listed in LEGACY_BLOCKED_PATHS`,
    );
  }
});

test('dangerous diagnostics are not part of AUTH_FREE', () => {
  const authFreeMatch = serverSource.match(/const AUTH_FREE = new Set\(\[(?<body>[\s\S]*?)\]\);/);
  assert.ok(authFreeMatch?.groups?.body, 'AUTH_FREE definition should exist');

  for (const route of [
    '/diagnose-db',
    '/api/public/diag2',
    '/api/public/diag3',
    '/api/public/diag4',
    '/api/public/fix-leads-manual',
    '/api/admin/db-breakdown',
  ]) {
    assert.doesNotMatch(
      authFreeMatch.groups.body,
      new RegExp(`['"]${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
      `${route} must never bypass auth`,
    );
  }
});

test('admin database breakdown route remains admin-gated', () => {
  assert.match(
    serverSource,
    /app\.get\('\/api\/admin\/db-breakdown',\s*\(req,\s*res\)\s*=>\s*requireAdmin\(req,\s*res,\s*\(\)\s*=>\s*\{/,
  );
});

test('dangerous write and restore routes are not auth-free', () => {
  const authFreeMatch = serverSource.match(/const AUTH_FREE = new Set\(\[(?<body>[\s\S]*?)\]\);/);
  assert.ok(authFreeMatch?.groups?.body, 'AUTH_FREE definition should exist');

  for (const route of [
    '/api/admin/delete-by-page',
    '/api/import/file-updates-2026',
    '/api/admin/wipe-leads',
    '/api/health/restore',
    '/api/admin/upload-db',
  ]) {
    assert.doesNotMatch(
      authFreeMatch.groups.body,
      new RegExp(`['"]${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
      `${route} must never bypass auth`,
    );
  }
});

test('dangerous write and restore routes remain admin-gated', () => {
  const adminRoutePatterns = [
    /app\.post\('\/api\/admin\/delete-by-page',\s*\(req,\s*res\)\s*=>\s*requireAdmin\(req,\s*res,\s*\(\)\s*=>\s*\{/,
    /app\.post\('\/api\/import\/file-updates-2026',\s*\(req,\s*res\)\s*=>\s*requireAdmin\(req,\s*res,\s*\(\)\s*=>\s*\{/,
    /app\.delete\('\/api\/admin\/wipe-leads',\s*\(req,\s*res\)\s*=>\s*requireAdmin\(req,\s*res,\s*\(\)\s*=>\s*\{/,
    /app\.post\('\/api\/health\/restore',\s*express\.raw\(\{[\s\S]*?\}\),\s*\(req,\s*res\)\s*=>\s*requireAdmin\(req,\s*res,\s*\(\)\s*=>\s*\{/,
    /app\.post\('\/api\/admin\/upload-db',\s*requireAdmin,\s*\(_req,\s*res\)\s*=>\s*\{/,
  ];

  for (const pattern of adminRoutePatterns) {
    assert.match(serverSource, pattern);
  }
});

test('server source does not contain committed fallback secrets or production webhook literals', () => {
  for (const bannedLiteral of [
    'eduexpress-n8n-2024',
    'vibeacademy.cloud/webhook/eduexpress-publish',
  ]) {
    assert.doesNotMatch(
      serverSource,
      new RegExp(bannedLiteral.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `${bannedLiteral} should never be committed in server.js`,
    );
  }
});

test('marketing debug/config responses do not expose secret fragments or raw webhook URLs', () => {
  assert.doesNotMatch(serverSource, /keyPrefix:\s*llmApiKey\.slice/);
  assert.doesNotMatch(serverSource, /n8nWebhook:\s*n8nWebhook\s*\|\|\s*null/);
});

test('database download remains admin-gated and upload shortcut stays disabled', () => {
  assert.match(
    serverSource,
    /app\.get\('\/api\/admin\/download-db',\s*requireAdmin,\s*\(req,\s*res\)\s*=>\s*\{/,
  );
  assert.match(
    serverSource,
    /app\.post\('\/api\/admin\/upload-db',\s*requireAdmin,\s*\(_req,\s*res\)\s*=>\s*\{\s*res\.status\(410\)\.json\(\{ error: 'Use POST \/api\/health\/restore with an application\/octet-stream database backup\.' \}\);/s,
  );
});

test('database restore keeps validation and staged file flow', () => {
  assert.match(
    serverSource,
    /app\.post\('\/api\/health\/restore',\s*express\.raw\(\{ type: 'application\/octet-stream', limit: '100mb' \}\),\s*\(req,\s*res\)\s*=>\s*requireAdmin\(req,\s*res,\s*\(\)\s*=>\s*\{/,
  );
  assert.match(
    serverSource,
    /validateDatabaseBuffer\(req\.body,\s*\['users', 'leads', 'channels', 'conversations', 'messages'\]\);/,
  );
  assert.match(
    serverSource,
    /writeFileSync\(restoreDbPath,\s*req\.body,\s*\{ mode: 0o600 \}\);/,
  );
});

test('unexpected route errors return JSON instead of an HTML error page', () => {
  assert.match(
    serverSource,
    /app\.use\(\(error,\s*req,\s*res,\s*next\)\s*=>\s*\{[\s\S]*?res\.status\(status\)\.json\(\{ error: message \}\);[\s\S]*?\}\);/s,
  );
});

test('office config only exposes full geofence settings to admins', () => {
  assert.match(
    serverSource,
    /app\.get\('\/api\/office-config',\s*\(req,\s*res\)\s*=>\s*\{\s*const cfg = Object\.fromEntries\(OFFICE_KEYS\.map\(k => \[k, getConfig\(k\)\]\)\);\s*if \(!isFullAdmin\(req\.user\)\) \{\s*return res\.json\(\{\s*office_open_time: cfg\.office_open_time,\s*office_close_time: cfg\.office_close_time,\s*office_wifi_ssid: cfg\.office_wifi_ssid,/s,
  );
});

test('quick reply mutations remain manager-or-admin only', () => {
  for (const pattern of [
    /app\.post\('\/api\/quick-replies',\s*\(req,\s*res\)\s*=>\s*requireManagerOrAdmin\(req,\s*res,\s*\(\)\s*=>\s*\{/,
    /app\.put\('\/api\/quick-replies\/:id',\s*\(req,\s*res\)\s*=>\s*requireManagerOrAdmin\(req,\s*res,\s*\(\)\s*=>\s*\{/,
    /app\.delete\('\/api\/quick-replies\/:id',\s*\(req,\s*res\)\s*=>\s*requireManagerOrAdmin\(req,\s*res,\s*\(\)\s*=>\s*\{/,
  ]) {
    assert.match(serverSource, pattern);
  }
});

test('conversation-sensitive media and message delete routes require conversation access', () => {
  for (const pattern of [
    /app\.get\('\/api\/media\/:msgId',\s*async\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?if \(!userHasAccessToConversation\(req\.user,\s*row\.conversation_id\)\) \{\s*return res\.status\(403\)\.json\(\{ error: 'Access denied' \}\);/s,
    /app\.delete\('\/api\/messages\/:id',\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?if \(!userHasAccessToConversation\(req\.user,\s*msg\.conversation_id\)\) \{\s*return res\.status\(403\)\.json\(\{ error: 'Access denied' \}\);/s,
    /app\.post\('\/api\/conversations\/:id\/convert-to-lead',\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?if \(!userHasAccessToConversation\(req\.user,\s*req\.params\.id\)\) \{\s*return res\.status\(403\)\.json\(\{ error: 'Access denied' \}\);/s,
  ]) {
    assert.match(serverSource, pattern);
  }
});

test('conversation lead-linking enforces both conversation access and target lead visibility', () => {
  assert.match(
    serverSource,
    /app\.post\('\/api\/conversations\/:id\/convert-lead',\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?if \(!userHasAccessToConversation\(req\.user,\s*req\.params\.id\)\) \{\s*return res\.status\(403\)\.json\(\{ error: 'Access denied' \}\);[\s\S]*?if \(isChinaBlockedForUser\(lead,\s*req\.user\)\) \{\s*return res\.status\(403\)\.json\(\{ error: 'Access denied to China lead records' \}\);[\s\S]*?if \(!leadIsVisibleTo\(lead,\s*req\.user\)\) \{\s*return res\.status\(403\)\.json\(\{ error: 'Access denied to this lead record' \}\);/s,
  );
});

test('CORS and CSP stay locked down instead of reflecting arbitrary origins', () => {
  assert.match(serverSource, /app\.use\(helmet\(\{\s*contentSecurityPolicy:/s);
  assert.match(serverSource, /const configuredCorsOrigins = String\(process\.env\.CORS_ORIGINS \|\| ''\)/);
  assert.match(
    serverSource,
    /app\.use\(cors\(\{\s*origin: configuredCorsOrigins\.length \? configuredCorsOrigins : false,\s*credentials: true,\s*\}\)\);/s,
  );
  assert.doesNotMatch(serverSource, /origin:\s*true/);
  assert.doesNotMatch(serverSource, /contentSecurityPolicy:\s*false/);
});

test('emergency reset stays POST-only, header/body gated, and not query-string based', () => {
  assert.match(
    serverSource,
    /app\.post\('\/api\/auth\/emergency-reset',\s*authLimiter,\s*\(req,\s*res\)\s*=>\s*\{/,
  );
  assert.match(serverSource, /const expected = process\.env\.RESET_KEY \|\| '';/);
  assert.match(serverSource, /const provided = String\(req\.headers\['x-reset-key'\] \|\| req\.body\?\.key \|\| ''\);/);
  assert.doesNotMatch(serverSource, /app\.get\('\/api\/auth\/emergency-reset'/);
  assert.doesNotMatch(serverSource, /req\.query\.key/);
  assert.doesNotMatch(serverSource, /req\.query\.password/);
});

test('authenticated API requests re-check the current active user from the database', () => {
  assert.match(
    serverSource,
    /const currentUser = db\.prepare\(`[\s\S]*FROM users WHERE id=\? AND active=1[\s\S]*`\)\.get\(payload\.id\);/s,
  );
  assert.match(
    serverSource,
    /const roles = db\.prepare\("SELECT role FROM user_roles WHERE user_id=\?"\)\.all\(currentUser\.id\)\.map\(row => row\.role\);/,
  );
});

test('upload route stays authenticated, rate-limited, and file-type restricted', () => {
  assert.match(serverSource, /app\.use\('\/api\/upload',\s*uploadLimiter\);/);
  assert.match(serverSource, /app\.post\('\/api\/upload',\s*\(req,\s*res\)\s*=>\s*\{/);
  assert.match(serverSource, /const allowedTypes = new Map\(\[/);
  assert.match(serverSource, /if \(!allowedExtensions\?\.includes\(extension\)\) \{/);
  assert.match(serverSource, /if \(!buffer\.length \|\| buffer\.length > 10 \* 1024 \* 1024\) \{/);
  assert.match(serverSource, /const magicMatches = \{/);
  assert.doesNotMatch(serverSource, /app\.post\('\/api\/public\/client-log'/);
});

test('public uploads keep hardened static headers', () => {
  assert.match(
    serverSource,
    /app\.use\('\/uploads',\s*express\.static\(UPLOADS_DIR,\s*\{\s*setHeaders: \(res,\s*filePath\) => \{\s*res\.setHeader\('X-Content-Type-Options', 'nosniff'\);\s*res\.setHeader\('Content-Security-Policy', "default-src 'none'; sandbox"\);/s,
  );
  assert.match(
    serverSource,
    /if \(\['\.pdf', '\.doc', '\.docx', '\.txt'\]\.includes\(extname\(filePath\)\.toLowerCase\(\)\)\) \{\s*res\.setHeader\('Content-Disposition', 'attachment'\);/s,
  );
});

test('lead updates do not reapply create-time defaults when clearing fields', () => {
  assert.match(
    serverSource,
    /function leadParams\(d,\s*lead_id,\s*balance,\s*options = \{\}\) \{\s*const applyCreateDefaults = options\.applyCreateDefaults !== false;/s,
  );
  assert.match(
    serverSource,
    /lead_source: applyCreateDefaults \? \(leadSourceVal \|\| 'Manual'\) : leadSourceVal,/,
  );
  assert.match(
    serverSource,
    /lead_status: applyCreateDefaults \? \(leadStatusVal \|\| 'New Lead'\) : leadStatusVal,/,
  );
  assert.match(
    serverSource,
    /lead_market: applyCreateDefaults \? \(leadMarketVal \|\| 'Bangladesh'\) : leadMarketVal,/,
  );
  assert.match(
    serverSource,
    /lead_type: applyCreateDefaults \? \(leadTypeVal \|\| 'B2C'\) : leadTypeVal,/,
  );
  assert.match(
    serverSource,
    /const params = leadParams\(d,\s*oldLead\.lead_id,\s*balance,\s*\{ applyCreateDefaults: false \}\);/,
  );
});

test('no_response automation is scheduler-driven and based on unanswered inbound messages', () => {
  assert.match(
    serverSource,
    /case 'no_response': \{\s*\/\/ Silence-based rules are evaluated by the scheduler so they trigger\s*\/\/ after an unanswered inbound message, not immediately on message arrival\.\s*triggered = false;/s,
  );
  assert.match(
    serverSource,
    /async function processNoResponseRules\(\) \{/,
  );
  assert.match(
    serverSource,
    /SELECT c\.\*,[\s\S]*AS last_inbound_at,[\s\S]*AS last_outbound_at[\s\S]*HAVING last_inbound_at IS NOT NULL[\s\S]*datetime\(last_inbound_at\) <= datetime\('now', '-' \|\| \? \|\| ' minutes'\)[\s\S]*\(last_outbound_at IS NULL OR datetime\(last_outbound_at\) < datetime\(last_inbound_at\)\)[\s\S]*a\.event_type = 'executed' AND a\.created_at >= last_inbound_at/s,
  );
  assert.match(
    serverSource,
    /try \{ await processNoResponseRules\(\); \} catch \(e\) \{ console\.error\('\[scheduler\] no_response:', e\.message\); \}/,
  );
});

test('student portal QR route stays read-only and only works for active links', () => {
  assert.match(
    serverSource,
    /app\.get\('\/api\/leads\/:id\/qr',\s*async\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?if \(!lead\.public_enabled \|\| !lead\.public_token\) \{\s*return res\.status\(409\)\.json\(\{ error: 'Portal link is not active\.' \}\);/s,
  );
  assert.doesNotMatch(
    serverSource,
    /app\.get\('\/api\/leads\/:id\/qr',[\s\S]*?UPDATE leads SET public_token=\?, public_enabled=1 WHERE id=\?/s,
    'QR generation must not activate or mint student portal links on GET',
  );
});
