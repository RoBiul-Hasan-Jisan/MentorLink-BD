// AUTH: we write NO token code. The app sends the string the Firebase SDK gave it;
// we hand it to the Firebase Admin SDK and use only the returned uid.
const admin = require('firebase-admin');
const env = require('./env');

if (!admin.apps.length) {
  // Credentials come from GOOGLE_APPLICATION_CREDENTIALS (or the emulator host).
  admin.initializeApp({ projectId: env.FIREBASE_PROJECT_ID });
}

const getAuth = () => admin.auth();
const verifyToken = (credential) => getAuth().verifyIdToken(credential); // -> { uid, ... }
const getAuthUser = (uid) => getAuth().getUser(uid);                     // -> { email, displayName, ... }

module.exports = { getAuth, verifyToken, getAuthUser };
