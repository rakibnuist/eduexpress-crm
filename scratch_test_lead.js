const req = await fetch('http://localhost:3001/api/leads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_name: 'mmmm',
    phone: '01817676762',
    nationality: 'Bangladesh',
    passport: 'A12345678',
    date_added: '2026-07-12',
    intake_term: 'September 2026',
    major: 'International Economy'
  })
});
const text = await req.text();
console.log(req.status);
console.log(text);
