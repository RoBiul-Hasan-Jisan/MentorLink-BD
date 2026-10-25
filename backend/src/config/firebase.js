// AUTH RULE: we write no token-parsing code. The app sends the credential the Firebase SDK gave it,
// and Firebase Admin tells us who it belongs to. Role is read from MongoDB, never from the credential.
// firebase-admin v12+ uses the modular API (getApps / getAuth / getMessaging), not `admin.auth()`.
const fs = require('fs');
const path = require('path');
const { initializeApp, getApps, getApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getMessaging } = require('firebase-admin/messaging');
const env = require('./env');

// Uses backend/serviceAccount.json (or GOOGLE_APPLICATION_CREDENTIALS) when present. Verifying a sign-in only needs
// the project id; creating users (seed:demo) and sending push need the service account.
function app() {
  if (getApps().length) return getApp();
  const file = path.join(__dirname, '..', '..', 'serviceAccount.json');
  const opts = env.firebaseProjectId ? { projectId: env.firebaseProjectId } : {};
  if (fs.existsSync(file)) opts.credential = cert(JSON.parse(fs.readFileSync(file, 'utf8')));
  return initializeApp(opts);
}
const sdk = () => ({ auth: () => getAuth(app()), messaging: () => getMessaging(app()) });
// Returns { uid, email }. Tests stub this function.
async function verifyCredential(credential) {
  const d = await sdk().auth().verifyIdToken(credential);
  return { uid: d.uid, email: d.email };
}
// Best-effort push through Firebase Cloud Messaging. Never throws: a failed push must not break a request.
async function sendPush(tokens, title, body) {
  if (!tokens || !tokens.length || process.env.NODE_ENV === 'test') return;
  try { await sdk().messaging().sendEachForMulticast({ tokens, notification: { title, body } }); } catch (e) { console.warn('push failed:', e.message); }
}
module.exports = { verifyCredential, sendPush };
