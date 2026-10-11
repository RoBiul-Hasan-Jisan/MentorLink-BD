const router = require('express').Router();
const { z } = require('zod');
const { authenticateFirebase, requireRole } = require('../middleware/auth');
const privacyGuard = require('../middleware/privacyGuard');
const MentorRequest = require('../models/MentorRequest');
const MentorProfile = require('../models/MentorProfile');
const Session = require('../models/Session');
const SessionNote = require('../models/SessionNote');
const Task = require('../models/Task');
const { ensurePlan } = require('../services/planService');
const { notify } = require('../services/notify');
const { objectId, pageQuery } = require('../utils/validators');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

router.use(authenticateFirebase, privacyGuard, requireRole('student', 'mentor'));

const mine = (user) => ({ [user.role === 'mentor' ? 'mentorId' : 'studentId']: user._id });
const populate = (q) => q.populate('studentId', 'displayName').populate('mentorId', 'displayName');
const ser = (s) => ({
  id: String(s._id), requestId: String(s.requestId), scheduledAt: s.scheduledAt, durationMin: s.durationMin, format: s.format,
  topic: s.topic || null, meetingLink: s.meetingLink || null, meetingNote: s.meetingNote || null, status: s.status,
  lateCancel: s.lateCancel ?? null, rating: s.rating ?? null,
  student: { id: String(s.studentId._id ?? s.studentId), displayName: s.studentId.displayName },
  mentor: { id: String(s.mentorId._id ?? s.mentorId), displayName: s.mentorId.displayName },
});
async function ownSession(req) {
  const s = await populate(Session.findOne({ _id: objectId.parse(req.params.id), ...mine(req.user) }));
  if (!s) throw new AppError(404, 'NOT_FOUND', 'Session not found'); // not yours -> same answer as "does not exist"
  return s;
}
const other = (s, user) => (String(s.studentId._id) === String(user._id) ? s.mentorId._id : s.studentId._id);

// ---------- mentor schedules a session on an accepted request ----------
const createSchema = z.object({
  requestId: objectId,
  scheduledAt: z.coerce.date().refine((d) => d.getTime() > Date.now(), 'must be in the future'),
  durationMin: z.number().int().min(10).max(180).default(30),
  topic: z.string().trim().max(120).optional(),
  meetingLink: z.string().trim().max(300).optional(),   // e.g. "meet.example.org/abrar-robiul", pasted by the mentor
  meetingNote: z.string().trim().max(200).optional(),
}).strict();

router.post('/', requireRole('mentor'), asyncHandler(async (req, res) => {
  const b = createSchema.parse(req.body);
  const r = await MentorRequest.findOne({ _id: b.requestId, mentorId: req.user._id, status: 'accepted' });
  if (!r) throw new AppError(404, 'NOT_FOUND', 'No accepted request found');
  const s = await Session.create({ ...b, studentId: r.studentId, mentorId: req.user._id, format: r.format });
  await notify(r.studentId, { type: 'session_scheduled', title: { en: 'Session confirmed', bn: 'সেশন নিশ্চিত' },
    body: { en: `${req.user.displayName} scheduled a session.`, bn: `${req.user.displayName} একটি সেশন ঠিক করেছেন।` }, data: { sessionId: String(s._id) } });
  res.status(201).json({ session: ser(await populate(Session.findById(s._id))) });
}));

router.get('/', asyncHandler(async (req, res) => {
  const { page, limit } = pageQuery.parse(req.query);
  const q = z.object({ status: z.enum(['scheduled', 'completed', 'cancelled']).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional() }).parse(req.query);
  const filter = { ...mine(req.user), ...(q.status && { status: q.status }),
    ...((q.from || q.to) && { scheduledAt: { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) } }) };
  const [items, total] = await Promise.all([populate(Session.find(filter).sort({ scheduledAt: 1 }).skip((page - 1) * limit).limit(limit)), Session.countDocuments(filter)]);
  res.json({ items: items.map(ser), page, limit, total });
}));

router.get('/:id', asyncHandler(async (req, res) => res.json({ session: ser(await ownSession(req)) })));

// ---------- mentor reschedules / edits ----------
router.patch('/:id', requireRole('mentor'), asyncHandler(async (req, res) => {
  const patch = createSchema.omit({ requestId: true }).partial().strict().parse(req.body);
  const s = await ownSession(req);
  if (s.status !== 'scheduled') throw new AppError(409, 'NOT_SCHEDULED', 'Only scheduled sessions can be changed');
  Object.assign(s, patch);
  if (patch.scheduledAt) s.reminderSent = false; // new time -> new reminder
  await s.save();
  if (patch.scheduledAt) await notify(other(s, req.user), { type: 'session_rescheduled', title: { en: 'Session time changed', bn: 'সেশনের সময় বদলেছে' },
    body: { en: 'Open Sessions to see the new time.', bn: 'নতুন সময় দেখতে সেশন খুলুন।' }, data: { sessionId: String(s._id) } });
  res.json({ session: ser(s) });
}));

// ---------- either person can cancel. Within 2 hours is marked "late" (it only informs; it never blocks anyone) ----------
router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const s = await ownSession(req);
  if (s.status !== 'scheduled') throw new AppError(409, 'NOT_SCHEDULED', 'Only scheduled sessions can be cancelled');
  s.status = 'cancelled'; s.cancelledBy = req.user._id; s.cancelledAt = new Date();
  s.lateCancel = s.scheduledAt.getTime() - Date.now() < 2 * 3600 * 1000;
  await s.save();
  await notify(other(s, req.user), { type: 'session_cancelled', title: { en: 'Session cancelled', bn: 'সেশন বাতিল' },
    body: { en: `${req.user.displayName} cancelled the session.`, bn: `${req.user.displayName} সেশন বাতিল করেছেন।` }, data: { sessionId: String(s._id) } });
  res.json({ session: ser(s) });
}));

// ---------- mentor marks it completed (only after its start time) ----------
router.post('/:id/complete', requireRole('mentor'), asyncHandler(async (req, res) => {
  const s = await ownSession(req);
  const done = await Session.findOneAndUpdate({ _id: s._id, status: 'scheduled', scheduledAt: { $lte: new Date() } }, { $set: { status: 'completed', completedAt: new Date() } }, { new: true });
  if (!done) throw new AppError(409, 'CANNOT_COMPLETE', 'Only a scheduled session that has started can be completed');
  await MentorProfile.updateOne({ userId: req.user._id }, { $inc: { sessionsCompleted: 1 } }); // feeds the reliability factor
  await notify(s.studentId._id, { type: 'session_completed', title: { en: 'Session completed', bn: 'সেশন সম্পন্ন' },
    body: { en: 'Rate this session to help future matches.', bn: 'ভবিষ্যৎ ম্যাচ উন্নত করতে সেশনটি রেট করুন।' }, data: { sessionId: String(s._id) } });
  res.json({ session: ser(await populate(Session.findById(s._id))) });
}));

// ---------- student rates once; mentor average is updated atomically ----------
router.post('/:id/rate', requireRole('student'), asyncHandler(async (req, res) => {
  const { rating } = z.object({ rating: z.number().int().min(1).max(5) }).strict().parse(req.body);
  const s = await ownSession(req);
  const rated = await Session.findOneAndUpdate({ _id: s._id, status: 'completed', rating: null }, { $set: { rating, ratedAt: new Date() } }, { new: true });
  if (!rated) throw new AppError(409, 'CANNOT_RATE', 'Only a completed, not-yet-rated session can be rated');
  const n = { $ifNull: ['$ratingCount', 0] };
  await MentorProfile.updateOne({ userId: s.mentorId._id }, [{ $set: { // pipeline update = one atomic step
    ratingAvg: { $round: [{ $divide: [{ $add: [{ $multiply: [{ $ifNull: ['$ratingAvg', 0] }, n] }, rating] }, { $add: [n, 1] }] }, 2] },
    ratingCount: { $add: [n, 1] } } }]);
  res.json({ session: ser(await populate(Session.findById(s._id))) });
}));

// ---------- session notes: mentor writes, both read; next steps can become plan tasks ----------
const noteSchema = z.object({
  summary: z.string().trim().min(5).max(1000),
  tags: z.array(z.string().trim().min(1).max(30)).max(5).default([]),
  mentorComment: z.string().trim().max(500).optional(),
  nextSteps: z.array(z.object({ title: z.string().trim().min(3).max(160), weekNumber: z.number().int().min(1).max(4), dueDate: z.coerce.date().optional() }).strict()).max(5).default([]),
}).strict();
const serNote = (n) => ({ id: String(n._id), sessionId: String(n.sessionId), summary: n.summary, tags: n.tags, mentorComment: n.mentorComment || null,
  nextSteps: n.nextSteps.map((x) => ({ id: String(x._id), title: x.title, weekNumber: x.weekNumber, dueDate: x.dueDate || null, added: !!x.taskId, taskId: x.taskId ? String(x.taskId) : null })) });

router.post('/:id/notes', requireRole('mentor'), asyncHandler(async (req, res) => {
  const b = noteSchema.parse(req.body);
  const s = await ownSession(req);
  if (s.status === 'cancelled') throw new AppError(409, 'CANCELLED', 'No notes for a cancelled session');
  const note = await SessionNote.create({ ...b, sessionId: s._id, mentorId: req.user._id, studentId: s.studentId._id }); // unique per session -> 409 if repeated
  if (b.nextSteps.length) await notify(s.studentId._id, { type: 'session_notes', title: { en: 'New session notes', bn: 'নতুন সেশন নোট' },
    body: { en: 'Tap to add next steps to your plan.', bn: 'পরবর্তী ধাপগুলো প্ল্যানে যোগ করুন।' }, data: { sessionId: String(s._id) } });
  res.status(201).json({ note: serNote(note) });
}));

router.patch('/:id/notes', requireRole('mentor'), asyncHandler(async (req, res) => {
  const patch = noteSchema.pick({ summary: true, tags: true, mentorComment: true }).partial().strict().parse(req.body);
  const s = await ownSession(req);
  const note = await SessionNote.findOneAndUpdate({ sessionId: s._id, mentorId: req.user._id }, { $set: patch }, { new: true });
  if (!note) throw new AppError(404, 'NOT_FOUND', 'No notes yet');
  res.json({ note: serNote(note) });
}));

router.get('/:id/notes', asyncHandler(async (req, res) => {
  const s = await ownSession(req);
  const note = await SessionNote.findOne({ sessionId: s._id });
  if (!note) throw new AppError(404, 'NOT_FOUND', 'No notes yet');
  res.json({ note: serNote(note) });
}));

// Student taps "Add task": the next step becomes a task in the four-week plan. Repeating the tap returns the same task.
router.post('/:id/notes/steps/:stepId/add-to-plan', requireRole('student'), asyncHandler(async (req, res) => {
  const s = await ownSession(req);
  const stepId = objectId.parse(req.params.stepId);
  const note = await SessionNote.findOne({ sessionId: s._id, 'nextSteps._id': stepId });
  const step = note && note.nextSteps.id(stepId);
  if (!step) throw new AppError(404, 'NOT_FOUND', 'Step not found');
  if (step.taskId) return res.json({ task: await Task.findById(step.taskId), alreadyAdded: true });

  const plan = await ensurePlan(req.user._id);
  let task;
  try {
    task = await Task.create({ planId: plan._id, studentId: req.user._id, title: step.title, weekNumber: step.weekNumber, dueDate: step.dueDate, source: 'session_note', sourceStepId: step._id });
  } catch (e) {
    if (e.code !== 11000) throw e; // double-tap race: the unique index stopped the duplicate
    task = await Task.findOne({ studentId: req.user._id, sourceStepId: step._id });
  }
  await SessionNote.updateOne({ _id: note._id, 'nextSteps._id': stepId }, { $set: { 'nextSteps.$.taskId': task._id } });
  res.status(201).json({ task });
}));

module.exports = router;
