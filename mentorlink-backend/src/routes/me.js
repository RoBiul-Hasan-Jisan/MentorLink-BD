const router = require('express').Router();
const { z } = require('zod');
const { authenticateFirebase } = require('../middleware/auth');
const privacyGuard = require('../middleware/privacyGuard');
const University = require('../models/University');
const asyncHandler = require('../utils/asyncHandler');

function serializeMe(user, uni) {
  return {
    id: String(user._id), email: user.email, displayName: user.displayName, role: user.role,
    universityId: user.universityId ? String(user.universityId) : null,
    university: uni ? { id: String(uni._id), name: uni.name, shortName: uni.shortName, city: uni.city } : null,
    department: user.department || null, batchYear: user.batchYear || null,
    language: user.language, verificationStatus: user.verificationStatus,
    showInDirectory: user.showInDirectory, lowDataMode: user.lowDataMode,
  };
}

router.use(authenticateFirebase, privacyGuard);

router.get('/', asyncHandler(async (req, res) => {
  const uni = req.user.universityId ? await University.findById(req.user.universityId) : null;
  res.json({ user: serializeMe(req.user, uni) });
}));

router.patch('/privacy', asyncHandler(async (req, res) => {
  const { showInDirectory } = z.object({ showInDirectory: z.boolean() }).strict().parse(req.body);
  req.user.showInDirectory = showInDirectory;
  await req.user.save();
  res.json({ showInDirectory });
}));

router.patch('/settings', asyncHandler(async (req, res) => {
  const patch = z.object({ language: z.enum(['bn', 'en']).optional(), lowDataMode: z.boolean().optional() }).strict().parse(req.body);
  Object.assign(req.user, patch);
  await req.user.save();
  res.json({ language: req.user.language, lowDataMode: req.user.lowDataMode });
}));

router.use('/', require('./meSettings'));   // consents, outcome feedback
router.use('/', require('./meCareer')); // goal, evidence, readiness, mentor-profile

module.exports = router;
module.exports.serializeMe = serializeMe;
