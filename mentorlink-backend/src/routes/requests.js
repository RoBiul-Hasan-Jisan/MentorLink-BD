const router = require('express').Router();
const { z } = require('zod');
const { authenticateFirebase, requireRole } = require('../middleware/auth');
const privacyGuard = require('../middleware/privacyGuard');
const User = require('../models/User');
const MentorProfile = require('../models/MentorProfile');
const MentorRequest = require('../models/MentorRequest');
const Match = require('../models/Match');
const Block = require('../models/Block');
const { loadReadiness } = require('../services/studentContext');
const { weekStart, isAtCapacity } = require('../services/capacity');
const { notify } = require('../services/notify');
const { shortName } = require('../utils/publicCard');
const { objectId, pageQuery } = require('../utils/validators');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

router.use(authenticateFirebase, privacyGuard);

const TTL_DAYS = 7, MAX_PENDING = 3;
const slots = z.array(z.string().trim().min(3).max(20)).min(1).max(5);

const createSchema = z.object({
  mentorId: objectId,
  goalText: z.string().trim().min(5).max(300),
  questions: z.array(z.string().trim().min(3).max(300)).min(2).max(3), // design: "Your questions (2 to 3)"
  preferredSlots: slots,
  format: z.enum(['video', 'phone', 'in_person']).default('video'),
}).strict();

const populate = (q) => q.populate('studentId', 'displayName department batchYear').populate('mentorId', 'displayName');
function serialize(r) {
  const s = r.studentId, m = r.mentorId;
  return {
    id: String(r._id), status: r.status, goalText: r.goalText, questions: r.questions, preferredSlots: r.preferredSlots,
    format: r.format, declineReason: r.declineReason || null, createdAt: r.createdAt, respondedAt: r.respondedAt || null,
    // A mentor sees the student's first name + initial, department and what the student chose to share. Never email/phone.
    student: { id: String(s._id), displayName: shortName(s.displayName), department: s.department || null, batchYear: s.batchYear || null },
    mentor: { id: String(m._id), displayName: m.displayName },
    snapshot: r.snapshot,
  };
}
// Requests pending for more than 7 days expire (done lazily, no cron needed).
const expireStale = () => MentorRequest.updateMany(
  { status: 'pending', createdAt: { $lt: new Date(Date.now() - TTL_DAYS * 86400000) } }, { $set: { status: 'expired', respondedAt: new Date() } });

// ---------- student sends a request ----------
router.post('/', requireRole('student'), asyncHandler(async (req, res) => {
  const body = createSchema.parse(req.body);
  if (req.user.verificationStatus !== 'verified') throw new AppError(403, 'NOT_VERIFIED', 'Only verified students can request mentors');
  await expireStale();

  const mentor = await User.findOne({ _id: body.mentorId, role: 'mentor', verificationStatus: 'verified' });
  const profile = mentor && await MentorProfile.findOne({ userId: mentor._id });
  if (!mentor || !profile) throw new AppError(404, 'NOT_FOUND', 'Mentor not found');
  const blocked = await Block.exists({ $or: [{ blockerId: req.user._id, blockedId: mentor._id }, { blockerId: mentor._id, blockedId: req.user._id }] });
  if (blocked || profile.paused) throw new AppError(409, 'MENTOR_UNAVAILABLE', 'This mentor is not available');
  if (isAtCapacity(profile)) throw new AppError(409, 'MENTOR_AT_CAPACITY', 'This mentor is full this week');

  const [accepted, pendingCount] = await Promise.all([
    MentorRequest.exists({ studentId: req.user._id, mentorId: mentor._id, status: 'accepted' }),
    MentorRequest.countDocuments({ studentId: req.user._id, status: 'pending' }),
  ]);
  if (accepted) throw new AppError(409, 'ALREADY_MENTORED', 'You already have an accepted request with this mentor');
  if (pendingCount >= MAX_PENDING) throw new AppError(409, 'TOO_MANY_PENDING', `You can have at most ${MAX_PENDING} pending requests`);

  // Snapshot of what the student shares: readiness, top gaps and match score.
  const [ctx, match] = await Promise.all([loadReadiness(req.user._id), Match.findOne({ studentId: req.user._id, mentorId: mentor._id })]);
  const snapshot = {
    matchScore: match ? Math.round(match.score * 100) : null,
    ...(ctx.ready && { readinessPercent: ctx.result.readinessPercent, roleTitleEn: ctx.result.roleTitle.en, roleTitleBn: ctx.result.roleTitle.bn,
      gaps: ctx.result.gaps.slice(0, 3).map((g) => ({ skillKey: g.skillKey, nameEn: g.nameEn, nameBn: g.nameBn })) }),
  };

  const created = await MentorRequest.create({ ...body, studentId: req.user._id, mentorId: mentor._id, snapshot });
  await notify(mentor._id, { type: 'request_new', title: { en: 'New mentoring request', bn: 'নতুন মেন্টরিং অনুরোধ' },
    body: { en: `${shortName(req.user.displayName)} sent you a request`, bn: `${shortName(req.user.displayName)} আপনাকে অনুরোধ পাঠিয়েছেন` }, data: { requestId: String(created._id) } });
  res.status(201).json({ request: serialize(await populate(MentorRequest.findById(created._id))) });
}));

// ---------- list own requests (student: sent, mentor: received) ----------
router.get('/', requireRole('student', 'mentor'), asyncHandler(async (req, res) => {
  const { page, limit } = pageQuery.parse(req.query);
  const status = z.enum(['pending', 'accepted', 'declined', 'expired', 'cancelled']).optional().parse(req.query.status);
  await expireStale();
  const filter = { [req.user.role === 'mentor' ? 'mentorId' : 'studentId']: req.user._id, ...(status && { status }) };
  const [items, total] = await Promise.all([
    populate(MentorRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)),
    MentorRequest.countDocuments(filter),
  ]);
  res.json({ items: items.map(serialize), page, limit, total });
}));

// Only the two people on a request can read it. Anyone else gets 404 (existence is not revealed).
async function ownRequest(req) {
  const r = await populate(MentorRequest.findById(objectId.parse(req.params.id)));
  const me = String(req.user._id);
  if (!r || (String(r.studentId._id) !== me && String(r.mentorId._id) !== me)) throw new AppError(404, 'NOT_FOUND', 'Request not found');
  return r;
}
router.get('/:id', requireRole('student', 'mentor'), asyncHandler(async (req, res) => res.json({ request: serialize(await ownRequest(req)) })));

// ---------- mentor accepts (capacity-checked atomically) ----------
router.post('/:id/accept', requireRole('mentor'), asyncHandler(async (req, res) => {
  const id = objectId.parse(req.params.id);
  const r = await MentorRequest.findOne({ _id: id, mentorId: req.user._id });
  if (!r) throw new AppError(404, 'NOT_FOUND', 'Request not found');
  if (r.status !== 'pending') throw new AppError(409, 'NOT_PENDING', `Request is already ${r.status}`);

  const week = weekStart();
  await MentorProfile.updateOne({ userId: req.user._id, capacityWeekStart: { $lt: week } }, { $set: { activeMentees: 0, capacityWeekStart: week } }); // new week: reset
  // Atomic: only increments while activeMentees < weeklyCapacity, so two quick accepts cannot overshoot the cap.
  const prof = await MentorProfile.findOneAndUpdate(
    { userId: req.user._id, $expr: { $lt: ['$activeMentees', '$weeklyCapacity'] } },
    { $inc: { activeMentees: 1, acceptedRequests: 1 }, $set: { capacityWeekStart: week } }, { new: true });
  if (!prof) throw new AppError(409, 'AT_CAPACITY', 'You reached your weekly capacity. Requests are paused until next week.');

  const flipped = await MentorRequest.findOneAndUpdate({ _id: id, status: 'pending' }, { $set: { status: 'accepted', respondedAt: new Date() } }, { new: true });
  if (!flipped) { // someone (the student cancelling) changed it meanwhile: give the slot back
    await MentorProfile.updateOne({ userId: req.user._id }, { $inc: { activeMentees: -1, acceptedRequests: -1 } });
    throw new AppError(409, 'NOT_PENDING', 'Request is no longer pending');
  }
  await notify(r.studentId, { type: 'request_accepted', title: { en: 'Request accepted', bn: 'অনুরোধ গৃহীত' },
    body: { en: `${req.user.displayName} accepted. Chat is now open.`, bn: `${req.user.displayName} গ্রহণ করেছেন। চ্যাট এখন খোলা।` }, data: { requestId: String(id) } });
  res.json({ request: serialize(await populate(MentorRequest.findById(id))), capacity: { used: prof.activeMentees, weekly: prof.weeklyCapacity, paused: prof.activeMentees >= prof.weeklyCapacity } });
}));

// ---------- mentor declines (reason is shown to the student) ----------
router.post('/:id/decline', requireRole('mentor'), asyncHandler(async (req, res) => {
  const id = objectId.parse(req.params.id);
  const { reason } = z.object({ reason: z.enum(['at_capacity', 'outside_expertise', 'time_conflict', 'other']) }).strict().parse(req.body);
  const r = await MentorRequest.findOneAndUpdate({ _id: id, mentorId: req.user._id, status: 'pending' },
    { $set: { status: 'declined', declineReason: reason, respondedAt: new Date() } }, { new: true });
  if (!r) throw new AppError(409, 'NOT_PENDING', 'Request not found or not pending');
  await notify(r.studentId, { type: 'request_declined', title: { en: 'Request declined', bn: 'অনুরোধ প্রত্যাখ্যাত' },
    body: { en: 'The mentor could not take your request. Try another match.', bn: 'মেন্টর অনুরোধটি নিতে পারেননি। অন্য মেন্টর চেষ্টা করুন।' }, data: { requestId: String(id), reason } });
  res.json({ request: serialize(await populate(MentorRequest.findById(id))) });
}));

// ---------- student cancels while still pending ("You can cancel before he accepts") ----------
router.post('/:id/cancel', requireRole('student'), asyncHandler(async (req, res) => {
  const id = objectId.parse(req.params.id);
  const r = await MentorRequest.findOneAndUpdate({ _id: id, studentId: req.user._id, status: 'pending' }, { $set: { status: 'cancelled', respondedAt: new Date() } }, { new: true });
  if (!r) throw new AppError(409, 'NOT_PENDING', 'Request not found or not pending');
  res.json({ request: serialize(await populate(MentorRequest.findById(id))) });
}));

module.exports = router;
