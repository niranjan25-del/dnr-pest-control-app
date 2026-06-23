// scripts/testLogin.js
// Simple login tester using fetch. Prints response JSON and status.
require('dotenv').config();
(async function main() {
  const email = process.argv[2] || 'contact@dnrpestcontrol.in';
  const password = process.argv[3] || 'Nira@2000';
  try {
    const res = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    console.log('Status:', res.status);
    console.log('Body:', typeof body === 'string' ? body : JSON.stringify(body, null, 2));
  } catch (err) {
    console.error('Request failed:', err);
    process.exitCode = 1;
  }
})();
