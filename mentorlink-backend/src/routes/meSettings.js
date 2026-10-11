// Mounted inside /api/me (after authenticateFirebase + privacyGuard).
const router = require('express').Router();
const { z } = require('zod');
const { requireRole } = require('../middleware/auth');
const ConsentRecord = require('../models/ConsentRecord');
const OutcomeFeedback = require('../models/OutcomeFeedback');
const asyncHandler = require('../utils/asyncHandler');

const out = (u) => ({ departmentProgress: u.consents.departmentProgress, mentorOutcomes: u.consents.mentorOutcomes });
router.get('/consents', asyncHandler(async (req, res) => res.json({ consents: out(req.user) })));

// Every change is also saved in consentRecords (who agreed to what, and when).
router.patch('/consents', asyncHandler(async (req, res) => {
  const patch = z.object({ departmentProgress: z.boolean().optional(), mentorOutcomes: z.boolean().optional() }).strict().parse(req.body);
  for (const [k, v] of Object.entries(patch)) {
    req.user.consents[k] = v;
    await ConsentRecord.create({ userId: req.user._id, key: k, value: v });
  }
  await req.user.save();
  res.json({ consents: out(req.user) });
}));

// "Did mentoring help with your applications?" Self-reported, used only to evaluate recommendations in aggregate.
router.post('/outcome-feedback', requireRole('student'), asyncHandler(async (req, res) => {
  const { mentoringHelped } = z.object({ mentoringHelped: z.enum(['a_lot', 'a_little', 'not_yet']) }).strict().parse(req.body);
  await OutcomeFeedback.create({ studentId: req.user._id, mentoringHelped });
  res.status(201).json({ saved: true });
}));

module.exports = router;
