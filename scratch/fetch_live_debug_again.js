import fetch from 'node-fetch';

async function check() {
  const url = 'https://crm.eduexpressint.com/api/public/debug-conversations';
  console.log('Fetching:', url);
  try {
    const r = await fetch(url);
    const text = await r.text();
    console.log('Status:', r.status);
    console.log('Content-Type:', r.headers.get('content-type'));
    try {
      const data = JSON.parse(text);
      console.log('JSON Data:', data);
    } catch {
      console.log('Raw text:', text.slice(0, 500));
    }
  } catch (err) {
    console.error('Error fetching live debug:', err.message);
  }
}

check();
