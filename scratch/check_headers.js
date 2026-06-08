import fetch from 'node-fetch';

async function check() {
  const url = 'https://crm.eduexpressint.com/conversations';
  const r = await fetch(url);
  console.log('URL:', url);
  console.log('Status:', r.status);
  console.log('Cache-Control:', r.headers.get('cache-control'));
  console.log('Pragma:', r.headers.get('pragma'));
  console.log('Expires:', r.headers.get('expires'));
}

check();
