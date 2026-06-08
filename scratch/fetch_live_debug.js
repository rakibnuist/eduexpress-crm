import fetch from 'node-fetch';

async function main() {
  const r = await fetch('https://crm.eduexpressint.com/api/public/debug-db');
  const d = await r.json();
  
  console.log("=== CONVERSATIONS COUNT ===", d.conversations.length);
  
  const statusCounts = {};
  const channelTypeCounts = {};
  let nullLastMessageCount = 0;
  let nonNullLastMessageCount = 0;
  
  d.conversations.forEach(c => {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    channelTypeCounts[c.channel_type] = (channelTypeCounts[c.channel_type] || 0) + 1;
    if (c.last_message_at === null || c.last_message_at === '') {
      nullLastMessageCount++;
    } else {
      nonNullLastMessageCount++;
    }
  });
  
  console.log("Status counts:", statusCounts);
  console.log("Channel type counts:", channelTypeCounts);
  console.log("NULL last_message_at count:", nullLastMessageCount);
  console.log("Non-NULL last_message_at count:", nonNullLastMessageCount);
  
  console.log("\n=== LATEST 10 CONVERSATIONS ===");
  console.log(d.conversations.slice(-10));
}

main().catch(console.error);
