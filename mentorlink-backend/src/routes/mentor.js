const router = require('express').Router();
const { authenticateFirebase, requireRole } = require('../middleware/auth');
const privacyGuard = require('../middleware/privacyGuard');
const MentorProfile = require('../models/MentorProfile');
const Session = require('../models/Session');
const MentorRequest = require('../models/MentorRequest');
const Application = require('../models/Application');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticateFirebase, privacyGuard, requireRole('mentor'));

// "Your impact": counts from the mentor's own sessions. Outcomes only for mentees who agreed to share them.
router.get('/impact', asyncHandler(async (req, res) => {
  const me = req.user._id;
  const [profile, done, lateCancels, menteeIds] = await Promise.all([
    MentorProfile.findOne({ userId: me }),
    Session.aggregate([{ $match: { mentorId: me, status: 'completed' } }, { $group: { _id: null, sessions: { $sum: 1 }, minutes: { $sum: '$durationMin' }, students: { $addToSet: '$studentId' } } }]),
    Session.countDocuments({ mentorId: me, status: 'cancelled', cancelledBy: me, lateCancel: true }),
    MentorRequest.find({ mentorId: me, status: 'accepted' }).distinct('studentId'),
  ]);
  const d = done[0] || { sessions: 0, minutes: 0, students: [] };
  const consenting = await User.find({ _id: { $in: menteeIds }, 'consents.mentorOutcomes': true }).distinct('_id');
  const outcomes = await Application.aggregate([{ $match: { studentId: { $in: consenting } } }, { $group: { _id: '$stage', n: { $sum: 1 } } }]);
  const n = (...stages) => outcomes.filter((o) => stages.includes(o._id)).reduce((a, o) => a + o.n, 0);
  res.json({
    sessionsHeld: d.sessions, studentsHelped: d.students.length, hoursGiven: Math.round((d.minutes / 60) * 10) / 10, averageRating: profile ? profile.ratingAvg : 0,
    trustedMentor: d.sessions >= 10 && lateCancels === 0, // "10+ completed sessions and no no-shows" (late cancels by the mentor count as no-shows)
    reportedOutcomes: { interviews: n('Interview', 'Offer', 'Hired'), shortlists: n('Shortlisted'), menteesSharing: consenting.length, selfReported: true },
  });
}));

module.exports = router;
