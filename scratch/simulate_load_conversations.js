import fetch from 'node-fetch';

async function test(queryStr) {
  const r = await fetch(`https://crm.eduexpressint.com/api/public/debug-conversations-api?${queryStr}`);
  const d = await r.json();
  console.log(`Query: ${queryStr} -> total: ${d.total}, returned: ${d.conversations.length}`);
}

async function main() {
  await test('status=all');
  await test('status=open');
  await test('status=resolved');
  await test('status=archived');
  await test('status=open&channel_type=whatsapp');
  await test('status=open&channel_type=messenger');
  await test('status=all&channel_type=whatsapp');
}

main().catch(console.error);
