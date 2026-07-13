import fetch from 'node-fetch';

async function test() {
  const payload = {
    destination: 'Bangladesh',
    phone: '01891983098',
    client_name: 'Ahona Jahan'
  };

  try {
    const res = await fetch('http://localhost:5000/api/conversations/491/convert-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Body:", text);
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

test();
