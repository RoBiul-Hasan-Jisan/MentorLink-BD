// AUTH RULE: we write no token-parsing code. The app sends the credential the Firebase SDK gave it,
// and Firebase Admin tells us who it belongs to. Role is read from MongoDB, never from the credential.
const admin = require('firebase-admin');
const env = require('./env');

function sdk() {
  if (!admin.apps.length) admin.initializeApp(env.firebaseProjectId ? { projectId: env.firebaseProjectId } : undefined);
  return admin;
}
// Returns { uid, email }. Tests stub this function.
async function verifyCredential(credential) {
  const d = await sdk().auth().verifyIdToken(credential);
  return { uid: d.uid, email: d.email };
}
module.exports = { verifyCredential };
