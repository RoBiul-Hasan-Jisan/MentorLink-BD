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
// `unreadCount` becomes the number on the app icon (like Kick's red "4"); `data` lets a tap open the right screen.
async function sendPush(tokens, title, body, unreadCount, data, userId) {
  if (!tokens || !tokens.length || process.env.NODE_ENV === 'test') return;
  try {
    const count = Number.isFinite(unreadCount) && unreadCount > 0 ? Math.min(unreadCount, 99) : undefined;
    const out = await sdk().messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { ...(data || {}), ...(count ? { unreadCount: String(count) } : {}) },
      android: {
        priority: 'high',
        notification: { channelId: 'mentorlink_alerts', ...(count ? { notificationCount: count } : {}) },
      },
      apns: { payload: { aps: { sound: 'default', ...(count ? { badge: count } : {}) } } },
    });
    // A phone that uninstalled the app or reset its token will never accept pushes again: forget it, so the list does not grow forever.
    const dead = tokens.filter((_t, i) => { const e = out.responses[i] && out.responses[i].error; return e && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(e.code); });
    if (dead.length && userId) await require('../models').User.updateOne({ _id: userId }, { $pull: { deviceTokens: { $in: dead } } });
  } catch (e) { console.warn('push failed:', e.message); }
}
// Best-effort: remove the Firebase sign-in when a user deletes their data.
async function deleteFirebaseUser(uid) {
  if (process.env.NODE_ENV === 'test') return;
  try { await sdk().auth().deleteUser(uid); } catch (e) { console.warn('firebase delete failed:', e.message); }
}
// Admin sets a new sign-in email and/or password for a user, and signs them out everywhere. Throws on failure so the admin sees it.
// Passwords are never read back: Firebase stores only a hash, so nobody (not even an admin) can look one up.
async function adminUpdateFirebaseUser(uid, { email, password }) {
  if (process.env.NODE_ENV === 'test') return;
  const patch = {};
  if (email) { patch.email = email; patch.emailVerified = false; }
  if (password) patch.password = password;
  await sdk().auth().updateUser(uid, patch);
  await sdk().auth().revokeRefreshTokens(uid);
}
module.exports = { verifyCredential, sendPush, deleteFirebaseUser, adminUpdateFirebaseUser };
