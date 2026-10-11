const router = require('express').Router();
const { authenticateFirebase, requireRole } = require('../middleware/auth');
const privacyGuard = require('../middleware/privacyGuard');
const env = require('../config/env');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Session = require('../models/Session');
const Task = require('../models/Task');
const { weekStart } = require('../services/capacity');
const { notify } = require('../services/notify');
const { shortName } = require('../utils/publicCard');
const audit = require('../utils/audit');
const { objectId } = require('../utils/validators');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

router.use(authenticateFirebase, privacyGuard, requireRole('department'));
const rx = (s) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
const deptFilter = (u) => ({ role: 'student', universityId: u.universityId, department: rx(u.department || '\u0000') });

// ANONYMIZED counts only. No names, ids or emails. Students can switch this off (consents.departmentProgress).
router.get('/overview', asyncHandler(async (req, res) => {
  const cohortIds = await User.find({ ...deptFilter(req.user), verificationStatus: 'verified', 'consents.departmentProgress': { $ne: false } }).distinct('_id');
  if (cohortIds.length < env.DEPT_MIN_COHORT) {
    // Tiny groups could identify one person, so numbers are withheld.
    return res.json({ anonymized: true, suppressed: true, minCohort: env.DEPT_MIN_COHORT, note: `Counts appear once at least ${env.DEPT_MIN_COHORT} students take part.` });
  }
  const ws = weekStart(), WEEK = 7 * 86400000;
  const boundaries = Array.from({ length: 7 }, (_, i) => new Date(ws.getTime() - (5 - i) * WEEK)); // last 6 weeks incl. this one
  const [activeStudents, sessionsDone, milestones, buckets] = await Promise.all([
    StudentProfile.countDocuments({ userId: { $in: cohortIds }, careerGoalRoleKey: { $exists: true, $ne: null } }),
    Session.countDocuments({ studentId: { $in: cohortIds }, status: 'completed' }),
    Task.countDocuments({ studentId: { $in: cohortIds }, status: 'done' }),
    Session.aggregate([{ $match: { studentId: { $in: cohortIds }, status: 'completed', completedAt: { $gte: boundaries[0] } } },
      { $bucket: { groupBy: '$completedAt', boundaries, default: 'later', output: { n: { $sum: 1 } } } }]),
  ]);
  const byStart = new Map(buckets.filter((b) => b._id !== 'later').map((b) => [new Date(b._id).getTime(), b.n]));
  res.json({ anonymized: true, suppressed: false, cohortSize: cohortIds.length, activeStudents, sessionsDone, milestones,
    sessionsPerWeek: boundaries.slice(0, 6).map((d, i) => ({ week: i + 1, startsAt: d, completed: byStart.get(d.getTime()) || 0 })) });
}));

// Affiliation approvals: same university AND same department only.
router.get('/affiliations', asyncHandler(async (req, res) => {
  const rows = await User.find({ ...deptFilter(req.user), verificationStatus: 'pending' }).sort({ createdAt: 1 }).limit(50);
  res.json({ waiting: rows.length, items: rows.map((u) => ({ id: String(u._id), displayName: shortName(u.displayName), batchYear: u.batchYear || null, requestedAt: u.createdAt })) });
}));

router.post('/affiliations/:userId/approve', asyncHandler(async (req, res) => {
  const u = await User.findOneAndUpdate({ _id: objectId.parse(req.params.userId), ...deptFilter(req.user), verificationStatus: 'pending' }, { $set: { verificationStatus: 'verified' } }, { new: true });
  if (!u) throw new AppError(404, 'NOT_FOUND', 'No pending student of your department with that id');
  await audit(req.user._id, 'affiliation.approve', 'User', u._id, { department: req.user.department });
  await notify(u._id, { type: 'verified', title: { en: 'You are verified', bn: 'আপনি যাচাইকৃত' }, body: { en: 'Your department confirmed your affiliation.', bn: 'আপনার বিভাগ আপনার পরিচয় নিশ্চিত করেছে।' }, data: {} });
  res.json({ id: String(u._id), verificationStatus: 'verified' });
}));

module.exports = router;
