// Login as dev admin and decode token to verify isAdmin claim
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
(async () => {
  try {
    const base = `http://localhost:${process.env.PORT || 5000}`;
    console.log('Using base:', base);
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@local.test', password: process.env.ADMIN_PASSWORD || 'admin123' }),
    });
    const body = await res.text();
    console.log('Login status:', res.status);
    let json;
    try { json = JSON.parse(body); } catch(e) { console.log('Login body (raw):', body); }
    console.log('Login response:', json);
    if (json && json.token) {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(json.token);
      console.log('Decoded token (no verify):', decoded);
      try {
        const verified = jwt.verify(json.token, process.env.JWT_SECRET);
        console.log('Verified token:', verified);
      } catch (e) {
        console.error('Token verification failed:', e.message);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
})();
