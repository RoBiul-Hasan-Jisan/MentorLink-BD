// AUTH RULES
// - No JWT code of our own. The credential from the Firebase SDK is an opaque string for us.
// - Firebase Admin tells us the uid. The ROLE always comes from MongoDB, never from the request.
const { unauthorized, forbidden } = require('../utils/httpError');
const { User } = require('../models');

function readCredential(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

// verify(credential) -> { uid, email }. Injected so tests can run without Firebase.
function makeAuth(verify) {
  // Firebase identity only (used for sign-up, before a MongoDB profile exists).
  async function firebaseOnly(req, _res, next) {
    const credential = readCredential(req);
    if (!credential) throw unauthorized();
    try {
      req.firebase = await verify(credential);
    } catch {
      throw unauthorized('Your sign-in is not valid. Please sign in again.');
    }
    next();
  }

  // Firebase identity + MongoDB user (the normal case).
  async function authenticate(req, res, next) {
    await firebaseOnly(req, res, async () => {});
    const user = await User.findOne({ firebaseUid: req.firebase.uid });
    if (!user) throw forbidden('Finish your profile first.');
    if (user.deletedAt) throw forbidden('This account was deleted.');
    req.user = user;
    next();
  }

  return { firebaseOnly, authenticate };
}

// Role check on the SERVER for every endpoint.
const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) throw forbidden();
  next();
};

module.exports = { makeAuth, requireRole, readCredential };
