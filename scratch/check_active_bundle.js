import fetch from 'node-fetch';

async function check() {
  const url = 'https://crm.eduexpressint.com/conversations';
  const r = await fetch(url);
  const text = await r.text();
  console.log('Active bundle in html:', text.includes('index-6EkSRjiP.js') ? 'YES' : 'NO');
  if (!text.includes('index-6EkSRjiP.js')) {
    const match = text.match(/index-\w+\.js/);
    console.log('Found bundle instead:', match ? match[0] : 'None');
  }
}

check();
