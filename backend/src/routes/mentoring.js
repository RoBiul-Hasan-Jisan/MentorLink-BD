const express = require('express');
const { z } = require('zod');
const { User, MentorProfile, MentorRequest, Session, Plan, Task, Message, Notification, Match, StudentProfile, RoleTemplate, SkillEvidence, Skill } = require('../models');
const { computeReadiness } = require('../services/readiness');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/guards');
const { bad, notFound, forbidden, conflict } = require('../utils/httpError');
const { notify, toObjectId } = require('../utils/helpers');
const { normalizeMeetingLink } = require('../utils/links');

module.exports = function mentoringRoutes(auth) {
  const r = express.Router();
  const A = auth.authenticate;
  const student = [A, requireRole('student')];
  const mentor = [A, requireRole('mentor')];
  const mine = (req, doc) => String(doc.studentId) === String(req.user._id) || String(doc.mentorId) === String(req.user._id);

  // ---- mentor profile ----
  const mpSchema = z.object({
    industry: z.string().max(80).optional(), roleTitle: z.string().max(80).optional(), roleKey: z.string().max(60).optional(),
    relatedRoleKeys: z.array(z.string()).max(6).optional(), yearsExperience: z.number().min(0).max(50).optional(),
    expertiseSkills: z.array(z.object({ skillKey: z.string(), level: z.number().int().min(1).max(3) })).max(15).optional(),
    languages: z.array(z.enum(['bn', 'en'])).optional(), weeklyCapacity: z.number().int().min(0).max(20).optional(),
    availableSlots: z.array(z.string().max(20)).max(14).optional(), paused: z.boolean().optional(),
    helpsWith: z.array(z.enum(['technical_interview', 'portfolio_review', 'cv_review', 'roadmap_review', 'career_switch'])).max(5).optional(),
  }).strict(); // reliability counters cannot be set by the mentor
  r.get('/me/mentor-profile', ...mentor, async (req, res) => res.json({ profile: await MentorProfile.findOne({ userId: req.user._id }) }));
  r.put('/me/mentor-profile', ...mentor, validate(mpSchema), async (req, res) => {
    res.json({ profile: await MentorProfile.findOneAndUpdate({ userId: req.user._id }, { $set: req.body }, { upsert: true, returnDocument: 'after' }) });
  });

  // ---- requests ----
  const reqSchema = z.object({
    mentorId: z.string(), goalText: z.string().trim().min(5).max(400),
    questions: z.array(z.string().trim().min(3).max(200)).min(1).max(3), preferredSlots: z.array(z.string().max(20)).max(14).optional(), focusSkillKey: z.string().max(40).optional(), focusKind: z.enum(['technical_interview', 'portfolio_review', 'cv_review', 'roadmap_review', 'career_switch', 'skill_gap']).optional(), format: z.enum(['video', 'phone', 'in_person', 'message']).optional(), message: z.string().trim().max(500).optional(),
  }).strict();
  r.post('/requests', ...student, validate(reqSchema), async (req, res) => {
    toObjectId(req.body.mentorId, 'mentor id');
    const m = await User.findOne({ _id: req.body.mentorId, role: 'mentor', verificationStatus: 'verified' });
    const mp = m && (await MentorProfile.findOne({ userId: m._id }));
    if (!m || !mp) throw notFound('Mentor not found.');
    if ((m.blockedBy || []).some((b) => String(b) === String(req.user._id)) || (req.user.blockedBy || []).some((b) => String(b) === String(m._id))) throw forbidden();
    if (mp.paused) throw conflict('MENTOR_PAUSED', 'This mentor is not taking new requests right now.');
    if (await MentorRequest.findOne({ studentId: req.user._id, mentorId: m._id, status: { $in: ['pending', 'accepted'] } })) throw conflict('REQUEST_EXISTS', 'You already have an open request with this mentor.');
    // Fair use: a declined mentor is not asked again straight away, and one student cannot flood many mentors at once.
    const COOLDOWN_DAYS = 7, MAX_OPEN = 5;
    const lastNo = await MentorRequest.findOne({ studentId: req.user._id, mentorId: m._id, status: 'declined' }).sort({ updatedAt: -1 });
    if (lastNo) {
      const until = new Date(new Date(lastNo.updatedAt).getTime() + COOLDOWN_DAYS * 86400000);
      if (until > new Date()) throw conflict('REQUEST_COOLDOWN', `This mentor declined your last request. You can ask again on ${until.toISOString().slice(0, 10)}, or choose another mentor.`);
    }
    if ((await MentorRequest.countDocuments({ studentId: req.user._id, status: 'pending' })) >= MAX_OPEN) throw conflict('TOO_MANY_OPEN', `You already have ${MAX_OPEN} requests waiting for a reply. Wait for an answer or cancel one first.`);
    const open = await MentorRequest.countDocuments({ mentorId: m._id, status: 'pending' });
    if (mp.acceptedRequests + open >= mp.weeklyCapacity) throw conflict('MENTOR_AT_CAPACITY', 'This mentor has no open spots.');
    const doc = await MentorRequest.create({ ...req.body, studentId: req.user._id, mentorId: m._id });
    await notify(m._id, 'New mentor request', `${req.user.displayName} sent you a request.`, 'request', { type: 'request', id: String(doc._id) });
    res.status(201).json({ request: doc });
  });
  r.get('/requests', A, requireRole('student', 'mentor'), async (req, res) => {
    const key = req.user.role === 'student' ? 'studentId' : 'mentorId';
    const otherKey = req.user.role === 'student' ? 'mentorId' : 'studentId';
    const list = await MentorRequest.find({ [key]: req.user._id }).sort({ createdAt: -1 }).lean();
    const users = await User.find({ _id: { $in: list.map((x) => x[otherKey]) } }).select('displayName department').lean();
    const um = new Map(users.map((u) => [String(u._id), u]));
    // A mentor sees the match score, readiness and the gaps they can help with, for students who sent them a request (design: request card).
    const extra = new Map();
    if (req.user.role === 'mentor' && list.length) {
      const ids = list.map((x) => x.studentId);
      const [matches, profiles, evidence, skills, mp] = await Promise.all([
        Match.find({ mentorId: req.user._id, studentId: { $in: ids } }).lean(), StudentProfile.find({ userId: { $in: ids } }).lean(),
        SkillEvidence.find({ studentId: { $in: ids } }).lean(), Skill.find().lean(), MentorProfile.findOne({ userId: req.user._id }).lean(),
      ]);
      const roles = new Map((await RoleTemplate.find().lean()).map((x) => [x.key, x]));
      const strong = new Map(((mp && mp.expertiseSkills) || []).map((e) => [e.skillKey, e.level]));
      for (const id of ids) {
        const prof = profiles.find((x) => String(x.userId) === String(id));
        const role = prof && roles.get(prof.careerGoalRoleKey);
        const m = matches.find((x) => String(x.studentId) === String(id));
        let readiness = null, gaps = [];
        if (role) {
          const r2 = computeReadiness({ role, evidence: evidence.filter((e) => String(e.studentId) === String(id)), skills, weeklyHours: prof.weeklyHours });
          readiness = r2.readiness;
          gaps = r2.gaps.slice(0, 3).map((g) => ({ skillKey: g.skillKey, nameEn: g.nameEn, nameBn: g.nameBn, canHelp: (strong.get(g.skillKey) || 0) >= 2 }));
        }
        extra.set(String(id), { matchScore: m ? m.score : null, readiness, gaps, goalRoleKey: prof ? prof.careerGoalRoleKey : null });
      }
    }
    res.json({ requests: list.map((x) => ({ ...x, withName: (um.get(String(x[otherKey])) || {}).displayName || '', department: (um.get(String(x[otherKey])) || {}).department || '', ...(extra.get(String(x.studentId)) || {}) })) });
  });
  const decSchema = z.object({ decision: z.enum(['accept', 'decline']), reason: z.string().max(300).optional() }).strict();
  r.post('/requests/:id/decision', ...mentor, validate(decSchema), async (req, res) => {
    toObjectId(req.params.id);
    const existing = await MentorRequest.findOne({ _id: req.params.id, mentorId: req.user._id });
    if (!existing) throw notFound();
    if (existing.status !== 'pending') throw conflict('ALREADY_DECIDED', 'This request was already answered.');
    if (req.body.decision === 'accept') {
      const mp = await MentorProfile.findOne({ userId: req.user._id });
      if (!mp) throw notFound('Set up your mentor profile first.');
      if (mp.acceptedRequests >= mp.weeklyCapacity) throw conflict('MENTOR_AT_CAPACITY', 'You are at capacity.');
    }
    // Claim the decision atomically: a double tap or two devices cannot answer (or count) the same request twice.
    const doc = await MentorRequest.findOneAndUpdate(
      { _id: existing._id, mentorId: req.user._id, status: 'pending' },
      { $set: req.body.decision === 'accept' ? { status: 'accepted' } : { status: 'declined', declineReason: req.body.reason } },
      { returnDocument: 'after' });
    if (!doc) throw conflict('ALREADY_DECIDED', 'This request was already answered.');
    if (req.body.decision === 'accept') {
      const mp = await MentorProfile.findOneAndUpdate({ userId: req.user._id }, { $inc: { acceptedRequests: 1 } }, { returnDocument: 'after' });
      if (mp && mp.acceptedRequests >= mp.weeklyCapacity && !mp.paused) { mp.paused = true; await mp.save(); } // auto-pause at capacity
    }
    await notify(doc.studentId, `Request ${doc.status}`, doc.declineReason || '', 'request', { type: doc.status === 'accepted' ? 'chat' : 'request', id: String(doc._id) });
    res.json({ request: doc });
  });

  // ---- sessions ----
  const sesSchema = z.object({ requestId: z.string(), startsAt: z.coerce.date(), mode: z.enum(['video', 'phone', 'in_person', 'message']).optional(), meetingLink: z.string().max(300).optional() }).strict();
  r.post('/sessions', ...mentor, validate(sesSchema), async (req, res) => {
    toObjectId(req.body.requestId);
    const rq = await MentorRequest.findOne({ _id: req.body.requestId, mentorId: req.user._id, status: 'accepted' });
    if (!rq) throw forbidden('Sessions need an accepted request.');
    if (!(req.body.startsAt.getTime() > Date.now())) throw bad('PAST', 'Pick a time in the future.');
    const body = { ...req.body };
    if (body.meetingLink !== undefined && String(body.meetingLink).trim() !== '') {
      body.meetingLink = normalizeMeetingLink(body.meetingLink);
      if (!body.meetingLink) throw bad('BAD_MEETING_LINK', 'The meeting link must be a secure https link.');
    } else delete body.meetingLink;
    const s = await Session.create({ ...body, studentId: rq.studentId, mentorId: req.user._id });
    await notify(rq.studentId, 'Session scheduled', s.startsAt.toISOString(), 'session', { type: 'session', id: String(s._id) });
    res.status(201).json({ session: s });
  });
  r.get('/sessions', A, requireRole('student', 'mentor'), async (req, res) => {
    const key = req.user.role === 'student' ? 'studentId' : 'mentorId';
    const list = await Session.find({ [key]: req.user._id }).sort({ startsAt: 1 }).lean();
    // Attach the other person's name (and the mentor's job title) so the home card can show "Rahim Ahmed, Data Analyst".
    const other = req.user.role === 'student' ? 'mentorId' : 'studentId';
    const users = await User.find({ _id: { $in: list.map((x) => x[other]) } }).select('displayName').lean();
    const profs = await MentorProfile.find({ userId: { $in: list.map((x) => x.mentorId) } }).select('userId roleTitle').lean();
    const nameOf = new Map(users.map((u) => [String(u._id), u.displayName]));
    const titleOf = new Map(profs.map((p) => [String(p.userId), p.roleTitle]));
    res.json({ sessions: list.map((x) => ({ ...x, withName: nameOf.get(String(x[other])) || '', withTitle: req.user.role === 'student' ? (titleOf.get(String(x.mentorId)) || '') : '' })) });
  });
  // Notes -> next steps -> tasks in the student's four-week plan.
  const doneSchema = z.object({ notes: z.string().max(4000).optional(), nextSteps: z.array(z.object({ text: z.string().min(2).max(200), week: z.number().int().min(1).max(4).default(1) })).max(8).default([]), durationMin: z.number().int().min(5).max(240).optional() }).strict();
  r.post('/sessions/:id/complete', ...mentor, validate(doneSchema), async (req, res) => {
    toObjectId(req.params.id);
    const s = await Session.findOne({ _id: req.params.id, mentorId: req.user._id });
    if (!s) throw notFound();
    if (s.status === 'completed') throw conflict('ALREADY_COMPLETED', 'Already completed.');
    const plan = (await Plan.findOne({ studentId: s.studentId })) || (await Plan.create({ studentId: s.studentId }));
    s.status = 'completed'; s.notes = req.body.notes; s.nextSteps = []; if (req.body.durationMin) s.durationMin = req.body.durationMin;
    for (const step of req.body.nextSteps) {
      const due = new Date(plan.startsOn.getTime() + step.week * 7 * 864e5);
      const t = await Task.create({ planId: plan._id, studentId: s.studentId, title: step.text, week: step.week, dueDate: due, sourceSessionId: s._id });
      s.nextSteps.push({ text: step.text, taskId: t._id });
    }
    await s.save();
    await MentorProfile.updateOne({ userId: req.user._id }, { $inc: { sessionsCompleted: 1 } });
    await notify(s.studentId, 'Session notes ready', `${req.body.nextSteps.length} new step(s) in your plan.`, 'plan', { type: 'session', id: String(s._id) });
    res.json({ session: s });
  });

  // ---- four-week plan ----
  r.get('/me/plan', ...student, async (req, res) => {
    const plan = await Plan.findOne({ studentId: req.user._id });
    const tasks = plan ? await Task.find({ planId: plan._id }).sort({ week: 1, createdAt: 1 }) : [];
    const done = tasks.filter((t) => t.status === 'done').length;
    // Streak = consecutive days (ending today, or yesterday) on which the student completed at least one task.
    const days = new Set(tasks.filter((t) => t.status === 'done' && t.completedAt).map((t) => new Date(t.completedAt.getTime() + 6 * 36e5).toISOString().slice(0, 10)));
    const dayStr = (off) => new Date(Date.now() + 6 * 36e5 - off * 864e5).toISOString().slice(0, 10); // Asia/Dhaka (UTC+6) calendar days
    let streak = 0, off = days.has(dayStr(0)) ? 0 : 1;
    while (days.has(dayStr(off))) { streak += 1; off += 1; }
    res.json({ plan, tasks, progress: tasks.length ? Math.round((100 * done) / tasks.length) : 0, streak });
  });
  r.patch('/tasks/:id', A, requireRole('student', 'mentor'), validate(z.object({ status: z.enum(['todo', 'done']).optional(), mentorComment: z.string().max(300).optional() }).strict()), async (req, res) => {
    toObjectId(req.params.id);
    const t = await Task.findById(req.params.id);
    if (!t) throw notFound();
    if (req.user.role === 'student') {
      if (String(t.studentId) !== String(req.user._id)) throw notFound();
      if (req.body.mentorComment !== undefined) throw forbidden('Only your mentor can comment.');
      if (req.body.status) { t.status = req.body.status; t.completedAt = req.body.status === 'done' ? new Date() : undefined; }
    } else {
      const linked = await MentorRequest.findOne({ studentId: t.studentId, mentorId: req.user._id, status: 'accepted' });
      if (!linked) throw notFound();
      if (req.body.status) throw forbidden('Only the student can mark tasks done.');
      if (req.body.mentorComment !== undefined) t.mentorComment = req.body.mentorComment;
    }
    await t.save();
    res.json({ task: t });
  });

  // ---- chat (only after acceptance, only the two people) ----
  async function chatRequest(req) {
    toObjectId(req.params.id);
    const rq = await MentorRequest.findById(req.params.id);
    if (!rq || !mine(req, rq)) throw notFound();
    if (rq.status !== 'accepted') throw forbidden('Chat opens after the mentor accepts.');
    return rq;
  }
  r.get('/requests/:id/messages', A, async (req, res) => {
    await chatRequest(req);
    res.json({ messages: await Message.find({ requestId: req.params.id }).sort({ createdAt: 1 }).limit(200) });
  });
  r.post('/requests/:id/messages', A, validate(z.object({ text: z.string().trim().min(1).max(2000) }).strict()), async (req, res) => {
    const rq = await chatRequest(req);
    const msg = await Message.create({ requestId: rq._id, senderId: req.user._id, text: req.body.text });
    const io = req.app.get('io');
    if (io) io.to(`req:${rq._id}`).emit('message', msg);
    const other = String(rq.studentId) === String(req.user._id) ? rq.mentorId : rq.studentId;
    await notify(other, 'New message', req.body.text.slice(0, 80), 'chat', { type: 'chat', id: String(rq._id) });
    res.status(201).json({ message: msg });
  });

  r.post('/me/device-token', A, validate(z.object({ token: z.string().min(20).max(400) }).strict()), async (req, res) => {
    await User.updateOne({ _id: req.user._id }, { $addToSet: { deviceTokens: req.body.token } });
    res.json({ ok: true });
  });
  // ---- notifications, block ----
  // ?limit=1..100 (default 50) and ?before=<ISO date> page backwards. Each item carries `target` ({type,id}) when the app can open something.
  r.get('/notifications', A, async (req, res) => {
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const filter = { userId: req.user._id };
    if (req.query.before) {
      const b = new Date(String(req.query.before));
      if (Number.isNaN(b.getTime())) throw bad('BAD_BEFORE', 'before must be a date.');
      filter.createdAt = { $lt: b };
    }
    const [list, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.countDocuments({ userId: req.user._id, read: { $ne: true } }),
    ]);
    res.json({
      notifications: list.map(({ targetType, targetId, ...n }) => ({ ...n, target: targetType ? { type: targetType, ...(targetId ? { id: targetId } : {}) } : null })),
      unreadCount, hasMore: list.length === limit,
    });
  });
  r.post('/notifications/read-all', A, async (req, res) => {
    await Notification.updateMany({ userId: req.user._id, read: { $ne: true } }, { read: true });
    res.json({ ok: true });
  });
  r.post('/notifications/:id/read', A, async (req, res) => {
    toObjectId(req.params.id);
    await Notification.updateOne({ _id: req.params.id, userId: req.user._id }, { read: true });
    res.json({ ok: true });
  });
  r.post('/users/:id/block', A, async (req, res) => {
    toObjectId(req.params.id);
    if (String(req.params.id) === String(req.user._id)) throw bad('SELF_BLOCK', 'You cannot block yourself.');
    if (!(await User.exists({ _id: req.params.id }))) throw notFound('User not found.');
    await User.updateOne({ _id: req.user._id }, { $addToSet: { blockedBy: req.params.id } });
    res.json({ ok: true });
  });
  return r;
};
