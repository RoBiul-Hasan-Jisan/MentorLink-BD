// Dev helper: sign in via the Firebase REST API and print the credential for curl.
// Usage: npm run token -- student.edu@demo.mentorlink.bd 'Demo@12345'
require('dotenv').config();
const [email, password] = process.argv.slice(2);
const key = process.env.FIREBASE_WEB_API_KEY;
if (!key || !email || !password) { console.error('Usage: FIREBASE_WEB_API_KEY in .env; npm run token -- <email> <password>'); process.exit(1); }
const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const base = host ? `http://${host}/identitytoolkit.googleapis.com` : 'https://identitytoolkit.googleapis.com';
fetch(`${base}/v1/accounts:signInWithPassword?key=${key}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, returnSecureToken: true }),
}).then((r) => r.json()).then((j) => { if (j.error) throw new Error(j.error.message); console.log(j.idToken); })
  .catch((e) => { console.error(e.message); process.exit(1); });
