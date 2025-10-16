const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const base = `http://localhost:${process.env.PORT || 5000}`;
  try {
    // Login
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@local.test', password: process.env.ADMIN_PASSWORD || 'admin123' }),
    });
    const loginJson = await loginRes.json();
    if (!loginRes.ok) return console.error('Login failed', loginJson);
    console.log('Login success, token present:', !!loginJson.token);

    const token = loginJson.token;
    const appsRes = await fetch(`${base}/api/partners/applications`, { headers: { Authorization: `Bearer ${token}` } });
    const appsJson = await appsRes.json();
    console.log('Applications status:', appsRes.status);
    console.log('Applications:', Array.isArray(appsJson) ? `count=${appsJson.length}` : appsJson);
  } catch (err) {
    console.error('Error during test:', err);
  }
}

main();
