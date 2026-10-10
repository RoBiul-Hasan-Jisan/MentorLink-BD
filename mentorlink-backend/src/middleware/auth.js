const firebase = require('../config/firebase');
const User = require('../models/User');
const { AppError } = require('../utils/errors');
const asyncHandler = require('../utils/asyncHandler');

// Reads the string the Firebase SDK gave the client. We never open or sign it ourselves.
async function uidFromRequest(req) {
  const [scheme, credential] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !credential) throw new AppError(401, 'UNAUTHENTICATED', 'Missing credential');
  try {
    const result = await firebase.verifyToken(credential);
    return result.uid;
  } catch {
    throw new AppError(401, 'INVALID_CREDENTIAL', 'Credential is invalid or expired');
  }
}

// Normal endpoints: user must already have a MongoDB profile. ROLE COMES FROM MONGODB.
const authenticateFirebase = asyncHandler(async (req, res, next) => {
  const uid = await uidFromRequest(req);
  const user = await User.findOne({ firebaseUid: uid });
  if (!user) throw new AppError(403, 'PROFILE_REQUIRED', 'Complete registration first');
  if (user.verificationStatus === 'rejected') throw new AppError(403, 'ACCOUNT_REJECTED', 'Account was rejected');
  req.firebaseUid = uid;
  req.user = user;
  next();
});

// Only for register-profile: a brand-new Firebase user has no MongoDB profile yet.
const authenticateFirebaseNewUser = asyncHandler(async (req, res, next) => {
  req.firebaseUid = await uidFromRequest(req);
  next();
});

// Server-side role check on every protected endpoint (never trust the app).
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError(403, 'FORBIDDEN', 'Your role cannot use this endpoint'));
  }
  next();
};

module.exports = { authenticateFirebase, authenticateFirebaseNewUser, requireRole };
