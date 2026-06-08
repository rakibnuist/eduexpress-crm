import fetch from 'node-fetch';

async function main() {
  const r = await fetch('https://crm.eduexpressint.com/api/public/debug-conversations-api?status=all&limit=100');
  const d = await r.json();
  
  if (d.error) {
    console.error("Error from live server:", d.error);
    return;
  }
  
  console.log("=== SIMULATED RESPONSE ===");
  console.log("total count in query:", d.total);
  console.log("where clause used:", d.where);
  console.log("ws clause used:", d.ws);
  console.log("Returned conversations count:", d.conversations.length);
  if (d.conversations.length > 0) {
    console.log("First 3 returned conversations:");
    console.log(d.conversations.slice(0, 3));
  }
}

main().catch(console.error);
