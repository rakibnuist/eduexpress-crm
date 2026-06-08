import fetch from 'node-fetch';

async function check() {
  const url = 'https://crm.eduexpressint.com/client-errors.json';
  console.log('Fetching:', url);
  try {
    const r = await fetch(url);
    if (r.status === 404) {
      console.log('No client errors logged yet (404).');
      return;
    }
    const text = await r.text();
    console.log('Status:', r.status);
    try {
      const data = JSON.parse(text);
      console.log('Client Errors:');
      console.log(JSON.stringify(data, null, 2));
    } catch {
      console.log('Raw response:', text.slice(0, 500));
    }
  } catch (err) {
    console.error('Error fetching client errors:', err.message);
  }
}

check();
