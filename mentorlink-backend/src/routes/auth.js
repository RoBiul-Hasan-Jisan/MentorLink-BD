const router = require('express').Router();
const { z } = require('zod');
const { authenticateFirebaseNewUser } = require('../middleware/auth');
const privacyGuard = require('../middleware/privacyGuard');
const rate = require('../middleware/rateLimit');
const firebase = require('../config/firebase');
const User = require('../models/User');
const University = require('../models/University');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');
const { serializeMe } = require('./me');

// .strict(): any extra key (role, verificationStatus, ...) is rejected with 400.
// The client can NEVER choose its own role. New accounts are always "student".
const schema = z.object({
  displayName: z.string().trim().min(2).max(80),
  universityId: z.string().regex(/^[a-f\d]{24}$/i, 'must be a university id'),
  department: z.string().trim().max(80).optional(),
  batchYear: z.number().int().min(1990).max(2100).optional(),
  language: z.enum(['bn', 'en']).default('en'),
}).strict();

router.post('/register-profile', rate.registration, authenticateFirebaseNewUser, privacyGuard,
  asyncHandler(async (req, res) => {
    const body = schema.parse(req.body);
    const uni = await University.findOne({ _id: body.universityId, active: true });
    if (!uni) throw new AppError(400, 'UNIVERSITY_NOT_FOUND', 'Choose a university from the list');

    // Email comes from Firebase (server side), not from the client.
    const fbUser = await firebase.getAuthUser(req.firebaseUid);
    if (!fbUser.email) throw new AppError(400, 'EMAIL_REQUIRED', 'Firebase account has no email');

    const user = await User.create({
      ...body, firebaseUid: req.firebaseUid, email: fbUser.email,
      role: 'student', verificationStatus: 'pending',
    });
    res.status(201).json({ user: serializeMe(user, uni) });
  }));

module.exports = router;
