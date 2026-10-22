const express = require('express');
const { z } = require('zod');
const { User, MentorProfile, MentorRequest, Session, Plan, Task, Message, Notification } = require('../models');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/guards');
const { bad, notFound, forbidden, conflict } = require('../utils/httpError');
const { notify, toObjectId } = require('../utils/helpers');

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
  }).strict(); // reliability counters cannot be set by the mentor
  r.get('/me/mentor-profile', ...mentor, async (req, res) => res.json({ profile: await MentorProfile.findOne({ userId: req.user._id }) }));
  r.put('/me/mentor-profile', ...mentor, validate(mpSchema), async (req, res) => {
    res.json({ profile: await MentorProfile.findOneAndUpdate({ userId: req.user._id }, { $set: req.body }, { upsert: true, returnDocument: 'after' }) });
  });

  // ---- requests ----
  const reqSchema = z.object({
    mentorId: z.string(), goalText: z.string().trim().min(5).max(400),
    questions: z.array(z.string().trim().min(3).max(200)).min(1).max(3), preferredSlots: z.array(z.string().max(20)).max(6).optional(),
  }).strict();
  r.post('/requests', ...student, validate(reqSchema), async (req, res) => {
    toObjectId(req.body.mentorId, 'mentor id');
    const m = await User.findOne({ _id: req.body.mentorId, role: 'mentor', verificationStatus: 'verified' });
    const mp = m && (await MentorProfile.findOne({ userId: m._id }));
    if (!m || !mp) throw notFound('Mentor not found.');
    if ((m.blockedBy || []).some((b) => String(b) === String(req.user._id)) || (req.user.blockedBy || []).some((b) => String(b) === String(m._id))) throw forbidden();
    if (mp.paused) throw conflict('MENTOR_PAUSED', 'This mentor is not taking new requests right now.');
    if (await MentorRequest.findOne({ studentId: req.user._id, mentorId: m._id, status: { $in: ['pending', 'accepted'] } })) throw conflict('REQUEST_EXISTS', 'You already have an open request with this mentor.');
    const open = await MentorRequest.countDocuments({ mentorId: m._id, status: 'pending' });
    if (mp.acceptedRequests + open >= mp.weeklyCapacity) throw conflict('MENTOR_AT_CAPACITY', 'This mentor has no open spots.');
    const doc = await MentorRequest.create({ ...req.body, studentId: req.user._id, mentorId: m._id });
    await notify(m._id, 'New mentor request', `${req.user.displayName} sent you a request.`, 'request');
    res.status(201).json({ request: doc });
  });
  r.get('/requests', A, requireRole('student', 'mentor'), async (req, res) => {
    const key = req.user.role === 'student' ? 'studentId' : 'mentorId';
    const list = await MentorRequest.find({ [key]: req.user._id }).sort({ createdAt: -1 });
    res.json({ requests: list });
  });
  const decSchema = z.object({ decision: z.enum(['accept', 'decline']), reason: z.string().max(300).optional() }).strict();
  r.post('/requests/:id/decision', ...mentor, validate(decSchema), async (req, res) => {
    toObjectId(req.params.id);
    const doc = await MentorRequest.findOne({ _id: req.params.id, mentorId: req.user._id });
    if (!doc) throw notFound();
    if (doc.status !== 'pending') throw conflict('ALREADY_DECIDED', 'This request was already answered.');
    if (req.body.decision === 'accept') {
      const mp = await MentorProfile.findOne({ userId: req.user._id });
      if (mp.acceptedRequests >= mp.weeklyCapacity) throw conflict('MENTOR_AT_CAPACITY', 'You are at capacity.');
      doc.status = 'accepted';
      mp.acceptedRequests += 1;
      if (mp.acceptedRequests >= mp.weeklyCapacity) mp.paused = true; // auto-pause at capacity
      await mp.save();
    } else { doc.status = 'declined'; doc.declineReason = req.body.reason; }
    await doc.save();
    await notify(doc.studentId, `Request ${doc.status}`, doc.declineReason || '', 'request');
    res.json({ request: doc });
  });

  // ---- sessions ----
  const sesSchema = z.object({ requestId: z.string(), startsAt: z.coerce.date(), mode: z.enum(['video', 'phone', 'in_person']).optional(), meetingLink: z.string().max(300).optional() }).strict();
  r.post('/sessions', ...mentor, validate(sesSchema), async (req, res) => {
    toObjectId(req.body.requestId);
    const rq = await MentorRequest.findOne({ _id: req.body.requestId, mentorId: req.user._id, status: 'accepted' });
    if (!rq) throw forbidden('Sessions need an accepted request.');
    const s = await Session.create({ ...req.body, studentId: rq.studentId, mentorId: req.user._id });
    await notify(rq.studentId, 'Session scheduled', s.startsAt.toISOString(), 'session');
    res.status(201).json({ session: s });
  });
  r.get('/sessions', A, requireRole('student', 'mentor'), async (req, res) => {
    const key = req.user.role === 'student' ? 'studentId' : 'mentorId';
    res.json({ sessions: await Session.find({ [key]: req.user._id }).sort({ startsAt: 1 }) });
  });
  // Notes -> next steps -> tasks in the student's four-week plan.
  const doneSchema = z.object({ notes: z.string().max(4000).optional(), nextSteps: z.array(z.object({ text: z.string().min(2).max(200), week: z.number().int().min(1).max(4).default(1) })).max(8).default([]) }).strict();
  r.post('/sessions/:id/complete', ...mentor, validate(doneSchema), async (req, res) => {
    toObjectId(req.params.id);
    const s = await Session.findOne({ _id: req.params.id, mentorId: req.user._id });
    if (!s) throw notFound();
    if (s.status === 'completed') throw conflict('ALREADY_COMPLETED', 'Already completed.');
    const plan = (await Plan.findOne({ studentId: s.studentId })) || (await Plan.create({ studentId: s.studentId }));
    s.status = 'completed'; s.notes = req.body.notes; s.nextSteps = [];
    for (const step of req.body.nextSteps) {
      const due = new Date(plan.startsOn.getTime() + step.week * 7 * 864e5);
      const t = await Task.create({ planId: plan._id, studentId: s.studentId, title: step.text, week: step.week, dueDate: due, sourceSessionId: s._id });
      s.nextSteps.push({ text: step.text, taskId: t._id });
    }
    await s.save();
    await MentorProfile.updateOne({ userId: req.user._id }, { $inc: { sessionsCompleted: 1 } });
    await notify(s.studentId, 'Session notes ready', `${req.body.nextSteps.length} new step(s) in your plan.`, 'plan');
    res.json({ session: s });
  });

  // ---- four-week plan ----
  r.get('/me/plan', ...student, async (req, res) => {
    const plan = await Plan.findOne({ studentId: req.user._id });
    const tasks = plan ? await Task.find({ planId: plan._id }).sort({ week: 1, createdAt: 1 }) : [];
    const done = tasks.filter((t) => t.status === 'done').length;
    res.json({ plan, tasks, progress: tasks.length ? Math.round((100 * done) / tasks.length) : 0 });
  });
  r.patch('/tasks/:id', A, requireRole('student', 'mentor'), validate(z.object({ status: z.enum(['todo', 'done']).optional(), mentorComment: z.string().max(300).optional() }).strict()), async (req, res) => {
    toObjectId(req.params.id);
    const t = await Task.findById(req.params.id);
    if (!t) throw notFound();
    if (req.user.role === 'student') {
      if (String(t.studentId) !== String(req.user._id)) throw notFound();
      if (req.body.mentorComment !== undefined) throw forbidden('Only your mentor can comment.');
      if (req.body.status) t.status = req.body.status;
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
    await notify(other, 'New message', req.body.text.slice(0, 80), 'chat');
    res.status(201).json({ message: msg });
  });

  // ---- notifications, block ----
  r.get('/notifications', A, async (req, res) => res.json({ notifications: await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50) }));
  r.post('/notifications/:id/read', A, async (req, res) => {
    toObjectId(req.params.id);
    await Notification.updateOne({ _id: req.params.id, userId: req.user._id }, { read: true });
    res.json({ ok: true });
  });
  r.post('/users/:id/block', A, async (req, res) => {
    toObjectId(req.params.id);
    if (String(req.params.id) === String(req.user._id)) throw bad('SELF_BLOCK', 'You cannot block yourself.');
    await User.updateOne({ _id: req.user._id }, { $addToSet: { blockedBy: req.params.id } });
    res.json({ ok: true });
  });
  return r;
};
