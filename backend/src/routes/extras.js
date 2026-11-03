// Features from the design/proposal that the first routes did not cover:
// matching info, "not interested", cancel/rate sessions, mock interviews, progress and badges, data export/delete,
// consent record, workshops, community Q&A, mentor impact, department approvals/report, admin roles/preview, verification uploads.
const express = require('express');
const { z } = require('zod');
const M = require('../models');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/guards');
const { bad, notFound, forbidden, conflict } = require('../utils/httpError');
const { notify, toObjectId, audit, firstNameInitial } = require('../utils/helpers');
const env = require('../config/env');
const { computeReadiness } = require('../services/readiness');
const { W } = require('../services/matching');
const { scamFlags } = require('../services/scam');
const { recordSnapshot, weekStreak, badgeList } = require('../services/progress');

const K = 3; // groups smaller than this are hidden from the department (privacy)

module.exports = function extrasRoutes(auth) {
  const r = express.Router();
  const A = auth.authenticate;
  const student = [A, requireRole('student')];
  const mentor = [A, requireRole('mentor')];
  const admin = [A, requireRole('admin')];
  const dept = [A, requireRole('department', 'admin')];
  const noEmployer = [A, requireRole('student', 'mentor', 'department', 'admin')];
  const oid = (x) => toObjectId(String(x));

  // ---------- how matching works (single source of truth: the same weights the code uses) ----------
  r.get('/matching/info', A, (_q, res) => res.json({
    steps: [
      { en: 'Filter. Remove unverified, paused, full or blocked mentors.', bn: 'ছাঁকনি। অযাচাইকৃত, বিরতিতে থাকা, পূর্ণ বা ব্লক করা মেন্টর বাদ।' },
      { en: 'Score. Six factors, each a number from 0 to 1.', bn: 'স্কোর। ছয়টি বিষয়, প্রতিটি ০ থেকে ১।' },
      { en: 'Weigh. Match % = sum of weight x factor score.', bn: 'ওজন। ম্যাচ % = ওজন × স্কোরের যোগফল।' },
      { en: 'Re-rank fairly. One mentor is not shown to everyone. At least one rising mentor appears.', bn: 'ন্যায্য সাজানো। একজন মেন্টর সবাইকে দেখানো হয় না। অন্তত একজন উদীয়মান মেন্টর থাকে।' },
    ],
    factors: [
      { key: 'career', weight: W.career, en: 'Career and industry alignment', bn: 'ক্যারিয়ার ও ইন্ডাস্ট্রি মিল' },
      { key: 'gap', weight: W.gap, en: 'Can guide your missing skills', bn: 'আপনার ঘাটতি দক্ষতায় সাহায্য' },
      { key: 'experience', weight: W.experience, en: 'Relevant experience', bn: 'প্রাসঙ্গিক অভিজ্ঞতা' },
      { key: 'language', weight: W.language, en: 'Language preference', bn: 'ভাষার পছন্দ' },
      { key: 'schedule', weight: W.schedule, en: 'Schedule overlap', bn: 'সময়ের মিল' },
      { key: 'reliability', weight: W.reliability, en: 'Mentoring reliability', bn: 'মেন্টরিংয়ে নির্ভরযোগ্যতা' },
    ],
    promises: { en: 'Gender, religion, region and family background are never used. No mentor may take more than 25% of recommendations. You can always say "Not interested".', bn: 'লিঙ্গ, ধর্ম, অঞ্চল ও পারিবারিক পটভূমি কখনো ব্যবহার হয় না। কোনো মেন্টর ২৫%-এর বেশি সুপারিশ পায় না। আপনি সবসময় "আগ্রহী নই" বলতে পারেন।' },
    quality: { en: 'Quality is checked with Precision@5, nDCG@5 and MRR against a plain keyword ranking during the pilot. No result exists yet.', bn: 'পাইলটে Precision@5, nDCG@5 ও MRR দিয়ে সাধারণ কিওয়ার্ড র‍্যাংকিংয়ের সাথে তুলনা করা হবে। এখনও কোনো ফলাফল নেই।' },
  }));

  r.post('/matches/:mentorId/dismiss', ...student, async (req, res) => {
    oid(req.params.mentorId);
    await M.StudentProfile.updateOne({ userId: req.user._id }, { $addToSet: { dismissedMentors: req.params.mentorId } }, { upsert: true });
    await M.Match.deleteMany({ studentId: req.user._id, mentorId: req.params.mentorId });
    res.json({ ok: true });
  });

  // ---------- requests and sessions: cancel, rate, no-show ----------
  r.post('/requests/:id/cancel', ...student, async (req, res) => {
    oid(req.params.id);
    const rq = await M.MentorRequest.findOne({ _id: req.params.id, studentId: req.user._id });
    if (!rq) throw notFound();
    if (rq.status !== 'pending') throw conflict('NOT_PENDING', 'Only a pending request can be cancelled.');
    rq.status = 'cancelled'; await rq.save();
    res.json({ ok: true });
  });
  r.post('/sessions/:id/cancel', A, requireRole('student', 'mentor'), async (req, res) => {
    oid(req.params.id);
    const s = await M.Session.findOne({ _id: req.params.id, $or: [{ studentId: req.user._id }, { mentorId: req.user._id }] });
    if (!s) throw notFound();
    if (s.status !== 'scheduled') throw conflict('NOT_SCHEDULED', 'Only a scheduled session can be cancelled.');
    if (s.startsAt.getTime() - Date.now() < 2 * 3600e3) throw conflict('TOO_LATE', 'Cancel at least 2 hours before the session.');
    s.status = 'cancelled'; s.cancelledBy = req.user._id; await s.save();
    await notify(String(s.studentId) === String(req.user._id) ? s.mentorId : s.studentId, 'Session cancelled', `${req.user.displayName} cancelled the session.`, 'session');
    res.json({ ok: true });
  });
  r.post('/sessions/:id/rate', ...student, validate(z.object({ stars: z.number().int().min(1).max(5), comment: z.string().trim().max(300).optional() }).strict()), async (req, res) => {
    oid(req.params.id);
    const s = await M.Session.findOne({ _id: req.params.id, studentId: req.user._id });
    if (!s) throw notFound();
    if (s.status !== 'completed') throw conflict('NOT_COMPLETED', 'You can rate a session after it is completed.');
    if (s.rating && s.rating.stars) throw conflict('ALREADY_RATED', 'You already rated this session.');
    s.rating = { ...req.body, at: new Date() }; await s.save();
    const mp = await M.MentorProfile.findOne({ userId: s.mentorId });
    if (mp) { mp.ratingAvg = Math.round(((mp.ratingAvg * mp.ratingCount + req.body.stars) / (mp.ratingCount + 1)) * 10) / 10; mp.ratingCount += 1; await mp.save(); }
    res.json({ ok: true });
  });
  r.post('/sessions/:id/mentor-no-show', ...student, async (req, res) => {
    oid(req.params.id);
    const s = await M.Session.findOne({ _id: req.params.id, studentId: req.user._id });
    if (!s) throw notFound();
    if (s.startsAt.getTime() > Date.now()) throw conflict('NOT_STARTED', 'The session has not started yet.');
    if (s.mentorNoShow) throw conflict('ALREADY_REPORTED', 'Already reported.');
    s.mentorNoShow = true; if (s.status === 'scheduled') s.status = 'cancelled'; await s.save();
    await M.MentorProfile.updateOne({ userId: s.mentorId }, { $inc: { noShows: 1 } });
    res.json({ ok: true });
  });

  // ---------- mock interviews ----------
  r.post('/mock-interviews', ...student, validate(z.object({ mentorId: z.string(), startsAt: z.coerce.date() }).strict()), async (req, res) => {
    oid(req.body.mentorId);
    if (req.body.startsAt.getTime() < Date.now()) throw bad('PAST', 'Pick a future time.');
    // Only with a mentor who accepted this student (mentor capacity is respected by the request flow).
    if (!(await M.MentorRequest.findOne({ studentId: req.user._id, mentorId: req.body.mentorId, status: 'accepted' }))) throw forbidden('Book a mock interview with a mentor who accepted your request.');
    const mi = await M.MockInterview.create({ studentId: req.user._id, mentorId: req.body.mentorId, startsAt: req.body.startsAt });
    await notify(req.body.mentorId, 'Mock interview booked', `${req.user.displayName} booked a practice interview.`, 'mock');
    res.status(201).json({ mockInterview: mi });
  });
  r.get('/mock-interviews', A, requireRole('student', 'mentor'), async (req, res) => {
    const key = req.user.role === 'student' ? 'studentId' : 'mentorId';
    const other = req.user.role === 'student' ? 'mentorId' : 'studentId';
    const list = await M.MockInterview.find({ [key]: req.user._id }).sort({ startsAt: -1 }).lean();
    const users = await M.User.find({ _id: { $in: list.map((x) => x[other]) } }).select('displayName').lean();
    const name = new Map(users.map((u) => [String(u._id), u.displayName]));
    res.json({ mockInterviews: list.map((x) => ({ ...x, withName: name.get(String(x[other])) || '' })) });
  });
  const rate = z.number().int().min(1).max(5);
  r.post('/mock-interviews/:id/feedback', ...mentor, validate(z.object({ communication: rate, technical: rate, problemSolving: rate, confidence: rate, note: z.string().trim().max(1000).optional() }).strict()), async (req, res) => {
    oid(req.params.id);
    const mi = await M.MockInterview.findOne({ _id: req.params.id, mentorId: req.user._id });
    if (!mi) throw notFound();
    if (mi.status === 'cancelled') throw conflict('CANCELLED', 'This interview was cancelled.');
    const { note, ...rubric } = req.body;
    mi.rubric = rubric; mi.note = note; mi.status = 'done';
    mi.overall = Math.round(((rubric.communication + rubric.technical + rubric.problemSolving + rubric.confidence) / 4) * 10) / 10;
    await mi.save();
    await notify(mi.studentId, 'Mock interview feedback', `Overall ${mi.overall} / 5`, 'mock');
    res.json({ mockInterview: mi });
  });
  r.post('/mock-interviews/:id/cancel', A, requireRole('student', 'mentor'), async (req, res) => {
    oid(req.params.id);
    const mi = await M.MockInterview.findOne({ _id: req.params.id, $or: [{ studentId: req.user._id }, { mentorId: req.user._id }] });
    if (!mi) throw notFound();
    if (mi.status !== 'booked') throw conflict('NOT_BOOKED', 'Only a booked interview can be cancelled.');
    mi.status = 'cancelled'; await mi.save(); res.json({ ok: true });
  });

  // ---------- my progress: history, streak, points, badges ----------
  r.get('/me/progress', ...student, async (req, res) => {
    const profile = await M.StudentProfile.findOne({ userId: req.user._id });
    let readiness = null, nextTarget = null, roleKey = null;
    if (profile && profile.careerGoalRoleKey) {
      const role = await M.RoleTemplate.findOne({ key: profile.careerGoalRoleKey });
      const [evidence, skills] = await Promise.all([M.SkillEvidence.find({ studentId: req.user._id }), M.Skill.find()]);
      const result = computeReadiness({ role, evidence, skills, weeklyHours: profile.weeklyHours });
      readiness = result.readiness; roleKey = role.key;
      await recordSnapshot(req.user._id, role.key, readiness);
      const g = result.gaps[0];
      if (g) nextTarget = { skillKey: g.skillKey, nameEn: g.nameEn, nameBn: g.nameBn, percent: Math.min(100, Math.round(readiness + (100 * g.priority) / Math.max(1, role.requiredSkills.reduce((t, s) => t + s.weight, 0)))) };
    }
    const [snaps, doneTasks, sessionsDone, quizEv, projEv, apps, cvs, mocks] = await Promise.all([
      M.ProgressSnapshot.find({ studentId: req.user._id }).sort({ day: 1 }).lean(),
      M.Task.find({ studentId: req.user._id, status: 'done', completedAt: { $ne: null } }).select('completedAt').lean(),
      M.Session.countDocuments({ studentId: req.user._id, status: 'completed' }),
      M.SkillEvidence.countDocuments({ studentId: req.user._id, type: 'quiz' }),
      M.SkillEvidence.countDocuments({ studentId: req.user._id, type: 'project' }),
      M.Application.countDocuments({ studentId: req.user._id }),
      M.CvVersion.find({ studentId: req.user._id, 'reviewComments.0': { $exists: true } }).limit(1).lean(),
      M.MockInterview.countDocuments({ studentId: req.user._id, status: 'done' }),
    ]);
    const streakWeeks = weekStreak(doneTasks.map((t) => t.completedAt));
    const badges = badgeList({ sessionsDone, quizEvidence: quizEv, streakWeeks, applications: apps, projectEvidence: projEv, cvReviewed: cvs.length > 0, mocksDone: mocks, readiness: readiness || 0 });
    res.json({
      roleKey, readiness, history: snaps.map((s) => ({ day: s.day, percent: s.percent })),
      points: snaps.length ? snaps[snaps.length - 1].percent - snaps[0].percent : 0,
      streakWeeks, applications: apps, nextTarget, badges, badgesEarned: badges.filter((b) => b.earned).length,
      note: 'Private to you. No leaderboard. History starts the first day you open this screen or your readiness.',
    });
  });

  // ---------- consent record, export, delete ----------
  r.get('/me/consents', A, async (req, res) => {
    const apps = req.user.role === 'student' ? await M.Application.find({ studentId: req.user._id }).populate('opportunityId', 'title organization').lean() : [];
    res.json({
      signupConsent: { text: 'Code of Conduct accepted; data used for mentoring and matching only.', at: req.user.createdAt },
      shareProgressWithDept: req.user.shareProgressWithDept, shareProgressWithMentors: req.user.shareProgressWithMentors, showInDirectory: req.user.showInDirectory,
      applications: apps.map((a) => ({ opportunity: a.opportunityId && a.opportunityId.title, organization: a.opportunityId && a.opportunityId.organization, sharedFields: a.consentSnapshot && a.consentSnapshot.sharedFields, at: a.consentSnapshot && a.consentSnapshot.at })),
    });
  });
  r.get('/me/export', A, async (req, res) => {
    const id = req.user._id;
    const own = (Model, f = 'studentId') => Model.find({ [f]: id }).lean();
    const [profile, mentorProfile, evidence, cvs, tasks, apps, requests, sessions, notifications, roadmap, resources, snaps, messages, mocks] = await Promise.all([
      M.StudentProfile.findOne({ userId: id }).lean(), M.MentorProfile.findOne({ userId: id }).lean(), own(M.SkillEvidence), own(M.CvVersion), own(M.Task),
      own(M.Application), M.MentorRequest.find({ $or: [{ studentId: id }, { mentorId: id }] }).lean(), M.Session.find({ $or: [{ studentId: id }, { mentorId: id }] }).lean(),
      M.Notification.find({ userId: id }).lean(), own(M.RoadmapProgress), M.ResourceProgress.find({ userId: id }).lean(), own(M.ProgressSnapshot),
      M.Message.find({ senderId: id }).lean(), M.MockInterview.find({ $or: [{ studentId: id }, { mentorId: id }] }).lean(),
    ]);
    const u = req.user;
    res.setHeader('Content-Disposition', 'attachment; filename="mentorlink-my-data.json"');
    res.json({
      exportedAt: new Date(), account: { email: u.email, displayName: u.displayName, role: u.role, department: u.department, batchYear: u.batchYear, language: u.language, verificationStatus: u.verificationStatus, createdAt: u.createdAt },
      settings: { showInDirectory: u.showInDirectory, lowDataMode: u.lowDataMode, remindersOn: u.remindersOn, quietHours: u.quietHours, shareProgressWithDept: u.shareProgressWithDept, shareProgressWithMentors: u.shareProgressWithMentors },
      profile, mentorProfile, evidence, cvVersions: cvs, tasks, applications: apps, requests, sessions, mockInterviews: mocks, notifications, roadmapProgress: roadmap, resourceProgress: resources, progressHistory: snaps, messagesSent: messages,
    });
  });
  r.delete('/me', A, validate(z.object({ confirm: z.literal('DELETE') }).strict()), async (req, res) => {
    const u = req.user;
    if (u.role === 'admin') throw forbidden('An admin account cannot delete itself here.');
    const id = u._id;
    await Promise.all([
      M.StudentProfile.deleteMany({ userId: id }), M.MentorProfile.deleteMany({ userId: id }), M.SkillEvidence.deleteMany({ studentId: id }), M.CvVersion.deleteMany({ studentId: id }),
      M.Task.deleteMany({ studentId: id }), M.Plan.deleteMany({ studentId: id }), M.Notification.deleteMany({ userId: id }), M.RoadmapProgress.deleteMany({ studentId: id }),
      M.ResourceProgress.deleteMany({ userId: id }), M.ProgressSnapshot.deleteMany({ studentId: id }), M.VerificationDoc.deleteMany({ userId: id }), M.Match.deleteMany({ $or: [{ studentId: id }, { mentorId: id }] }),
      M.Message.deleteMany({ senderId: id }), M.Application.deleteMany({ studentId: id }), M.MockInterview.deleteMany({ $or: [{ studentId: id }, { mentorId: id }] }),
      M.Session.deleteMany({ $or: [{ studentId: id }, { mentorId: id }] }), M.MentorRequest.deleteMany({ $or: [{ studentId: id }, { mentorId: id }] }),
      M.Answer.deleteMany({ authorId: id }), M.Question.deleteMany({ authorId: id }),
      M.Workshop.updateMany({}, { $pull: { attendees: id } }),
    ]);
    const uid = u.firebaseUid;
    Object.assign(u, { email: `deleted+${id}@deleted.invalid`, displayName: 'Deleted user', department: undefined, showInDirectory: false, deviceTokens: [], verificationStatus: 'rejected', deletedAt: new Date(), shareProgressWithDept: false, shareProgressWithMentors: false });
    u.mentorApplication = { status: 'none' }; u.departmentApplication = { status: 'none' };
    await u.save();
    await audit(id, 'self_delete', 'user', id);
    if (process.env.NODE_ENV !== 'test') await require('../config/firebase').deleteFirebaseUser(uid);
    res.json({ ok: true });
  });

  // ---------- private verification documents (student ID photo, graduation proof) ----------
  // The JSON body limit for this route is raised in app.js. Files stay under 300 KB (the app compresses before upload).
  const docSchema = z.object({ kind: z.enum(['student_id', 'graduation_proof', 'department_letter']), mime: z.enum(['image/jpeg', 'image/png', 'application/pdf']), dataBase64: z.string().min(20).max(420_000) }).strict();
  r.post('/me/verification-doc', noEmployer, validate(docSchema), async (req, res) => {
    const buf = Buffer.from(req.body.dataBase64, 'base64');
    if (buf.length > 300_000) throw bad('FILE_TOO_LARGE', 'File must be under 300 KB. Compress it first.');
    const sig = buf.subarray(0, 4).toString('hex');
    const ok = (req.body.mime === 'image/jpeg' && sig.startsWith('ffd8ff')) || (req.body.mime === 'image/png' && sig === '89504e47') || (req.body.mime === 'application/pdf' && buf.subarray(0, 4).toString() === '%PDF');
    if (!ok) throw bad('BAD_FILE', 'The file does not look like the type you selected.');
    await M.VerificationDoc.deleteMany({ userId: req.user._id, kind: req.body.kind }); // one per kind; replacing is allowed
    const d = await M.VerificationDoc.create({ userId: req.user._id, kind: req.body.kind, mime: req.body.mime, sizeBytes: buf.length, data: buf });
    res.status(201).json({ doc: { id: d._id, kind: d.kind, mime: d.mime, sizeBytes: d.sizeBytes } });
  });
  r.get('/me/verification-docs', A, async (req, res) => {
    const docs = await M.VerificationDoc.find({ userId: req.user._id }).select('kind mime sizeBytes createdAt').lean();
    res.json({ docs, note: 'Stored privately. Admins review them. Deleted automatically if rejected.' });
  });
  r.delete('/me/verification-docs/:id', A, async (req, res) => {
    oid(req.params.id);
    await M.VerificationDoc.deleteOne({ _id: req.params.id, userId: req.user._id }); res.json({ ok: true });
  });
  r.get('/admin/verification-docs/:userId', ...admin, async (req, res) => {
    oid(req.params.userId);
    const docs = await M.VerificationDoc.find({ userId: req.params.userId }).select('+data').lean();
    await audit(req.user._id, 'view_verification_docs', 'user', req.params.userId);
    res.json({ docs: docs.map((d) => ({ id: d._id, kind: d.kind, mime: d.mime, sizeBytes: d.sizeBytes, dataBase64: d.data.toString('base64') })) });
  });

  // ---------- department application (the server sets the role only after an admin approves) ----------
  r.post('/me/department-application', ...student, validate(z.object({ note: z.string().trim().max(300).optional() }).strict()), async (req, res) => {
    req.user.departmentApplication = { status: 'pending', note: req.body.note, submittedAt: new Date() };
    await req.user.save(); res.status(201).json({ status: 'pending' });
  });
  r.get('/admin/department-applications', ...admin, async (_q, res) => {
    const users = await M.User.find({ 'departmentApplication.status': 'pending' }).select('displayName email department universityId departmentApplication').lean();
    res.json({ applications: users });
  });
  r.post('/admin/department-applications/:id', ...admin, validate(z.object({ decision: z.enum(['approved', 'rejected']) }).strict()), async (req, res) => {
    oid(req.params.id);
    const u = await M.User.findById(req.params.id);
    if (!u || u.departmentApplication.status !== 'pending') throw notFound();
    u.departmentApplication.status = req.body.decision;
    if (req.body.decision === 'approved') { u.role = 'department'; u.verificationStatus = 'verified'; } else await M.VerificationDoc.deleteMany({ userId: u._id });
    await u.save();
    await audit(req.user._id, `department_application_${req.body.decision}`, 'user', u._id);
    res.json({ ok: true, role: u.role });
  });

  // ---------- workshops ----------
  const wsOut = (w, me) => ({ id: w._id, title: w.title, description: w.description, skillKey: w.skillKey, startsAt: w.startsAt, seats: w.seats, taken: w.attendees.length, joined: w.attendees.some((a) => String(a) === String(me)), host: w.hostName, status: w.status });
  r.get('/workshops', noEmployer, async (req, res) => {
    const list = await M.Workshop.find({ status: 'open', startsAt: { $gte: new Date(Date.now() - 864e5) } }).sort({ startsAt: 1 }).limit(50).lean();
    const hosts = await M.User.find({ _id: { $in: list.map((w) => w.hostId) } }).select('displayName').lean();
    const hn = new Map(hosts.map((h) => [String(h._id), h.displayName]));
    res.json({ workshops: list.map((w) => wsOut({ ...w, hostName: hn.get(String(w.hostId)) }, req.user._id)) });
  });
  r.post('/workshops', A, requireRole('mentor', 'department', 'admin'), validate(z.object({ title: z.string().trim().min(4).max(120), description: z.string().trim().max(500).optional(), skillKey: z.string().max(40).optional(), startsAt: z.coerce.date(), seats: z.number().int().min(2).max(200) }).strict()), async (req, res) => {
    if (req.user.verificationStatus !== 'verified') throw forbidden('Only verified users can host a workshop.');
    if (req.body.startsAt.getTime() < Date.now()) throw bad('PAST', 'Pick a future time.');
    const w = await M.Workshop.create({ ...req.body, hostId: req.user._id });
    res.status(201).json({ workshop: wsOut({ ...w.toObject(), hostName: req.user.displayName }, req.user._id) });
  });
  r.post('/workshops/:id/join', ...student, async (req, res) => {
    oid(req.params.id);
    const ex = await M.Workshop.findOne({ _id: req.params.id, status: 'open' });
    if (!ex) throw notFound();
    if (ex.attendees.some((a) => String(a) === String(req.user._id))) throw conflict('ALREADY_JOINED', 'You already joined.');
    // Atomic: the update only matches while the seat list is not full, so two students cannot take the last seat together.
    const w = await M.Workshop.findOneAndUpdate({ _id: ex._id, status: 'open', attendees: { $ne: req.user._id }, [`attendees.${ex.seats - 1}`]: { $exists: false } }, { $addToSet: { attendees: req.user._id } }, { returnDocument: 'after' });
    if (!w) throw conflict('FULL', 'No seats left.');
    res.json({ ok: true, taken: w.attendees.length });
  });
  r.delete('/workshops/:id/join', ...student, async (req, res) => { oid(req.params.id); await M.Workshop.updateOne({ _id: req.params.id }, { $pull: { attendees: req.user._id } }); res.json({ ok: true }); });
  r.post('/workshops/:id/cancel', A, requireRole('mentor', 'department', 'admin'), async (req, res) => {
    oid(req.params.id);
    const w = await M.Workshop.findById(req.params.id);
    if (!w || (req.user.role !== 'admin' && String(w.hostId) !== String(req.user._id))) throw notFound();
    w.status = 'cancelled'; await w.save();
    for (const a of w.attendees) await notify(a, 'Workshop cancelled', w.title, 'workshop');
    res.json({ ok: true });
  });

  // ---------- community Q&A (moderated) ----------
  const nameOf = async (ids) => new Map((await M.User.find({ _id: { $in: ids } }).select('displayName role verificationStatus').lean()).map((u) => [String(u._id), u]));
  r.get('/qa', noEmployer, async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 80);
    const f = { status: 'visible' };
    if (q) f.title = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const list = await M.Question.find(f).sort({ createdAt: -1 }).limit(50).lean();
    const [users, counts] = await Promise.all([nameOf(list.map((x) => x.authorId)), M.Answer.aggregate([{ $match: { questionId: { $in: list.map((x) => x._id) } } }, { $group: { _id: '$questionId', n: { $sum: 1 }, mentor: { $sum: { $cond: [{ $eq: ['$authorRole', 'mentor'] }, 1, 0] } } } }])]);
    const c = new Map(counts.map((x) => [String(x._id), x]));
    res.json({ questions: list.map((x) => ({ id: x._id, title: x.title, by: firstNameInitial((users.get(String(x.authorId)) || {}).displayName), createdAt: x.createdAt, answers: (c.get(String(x._id)) || {}).n || 0, mentorAnswers: (c.get(String(x._id)) || {}).mentor || 0 })), note: 'Moderated. Reported posts are hidden for review.' });
  });
  r.get('/qa/:id', noEmployer, async (req, res) => {
    oid(req.params.id);
    const x = await M.Question.findOne({ _id: req.params.id, status: 'visible' }).lean();
    if (!x) throw notFound();
    const answers = await M.Answer.find({ questionId: x._id }).sort({ createdAt: 1 }).lean();
    const users = await nameOf([x.authorId, ...answers.map((a) => a.authorId)]);
    const nm = (id) => firstNameInitial((users.get(String(id)) || {}).displayName);
    res.json({ id: x._id, title: x.title, body: x.body, by: nm(x.authorId), createdAt: x.createdAt, answers: answers.map((a) => ({ id: a._id, body: a.body, by: nm(a.authorId), role: a.authorRole, verifiedMentor: a.authorRole === 'mentor' && (users.get(String(a.authorId)) || {}).verificationStatus === 'verified', createdAt: a.createdAt })) });
  });
  const qSchema = z.object({ title: z.string().trim().min(8).max(150), body: z.string().trim().max(1000).optional() }).strict();
  r.post('/qa', A, requireRole('student', 'mentor'), validate(qSchema), async (req, res) => {
    const flags = scamFlags(`${req.body.title} ${req.body.body || ''}`);
    if (flags.length) throw bad('NOT_ALLOWED', 'Posts asking for money or off-app contact are not allowed.');
    res.status(201).json({ id: (await M.Question.create({ ...req.body, authorId: req.user._id }))._id });
  });
  r.post('/qa/:id/answers', A, requireRole('student', 'mentor'), validate(z.object({ body: z.string().trim().min(3).max(1000) }).strict()), async (req, res) => {
    oid(req.params.id);
    const x = await M.Question.findOne({ _id: req.params.id, status: 'visible' });
    if (!x) throw notFound();
    if (scamFlags(req.body.body).length) throw bad('NOT_ALLOWED', 'Posts asking for money or off-app contact are not allowed.');
    await M.Answer.create({ questionId: x._id, authorId: req.user._id, authorRole: req.user.role, body: req.body.body });
    if (String(x.authorId) !== String(req.user._id)) await notify(x.authorId, 'New answer', x.title, 'qa');
    res.status(201).json({ ok: true });
  });
  r.post('/qa/:id/report', A, requireRole('student', 'mentor'), async (req, res) => {
    oid(req.params.id);
    const x = await M.Question.findOneAndUpdate({ _id: req.params.id, status: 'visible' }, { $addToSet: { reporters: req.user._id } }, { returnDocument: 'after' }); // one person counts once
    if (!x) throw notFound();
    let hidden = false;
    if (x.reporters.length >= env.reportHideThreshold) { x.status = 'hidden'; await x.save(); hidden = true; await audit(req.user._id, 'auto_hide_question', 'question', x._id, { reports: x.reporters.length }); }
    res.status(201).json({ ok: true, hidden });
  });
  r.get('/admin/qa', ...admin, async (_q, res) => res.json({ questions: await M.Question.find({ status: { $ne: 'removed' }, $or: [{ status: 'hidden' }, { 'reporters.0': { $exists: true } }] }).select('title status reporters').lean() }));
  r.post('/admin/qa/:id/moderate', ...admin, validate(z.object({ decision: z.enum(['hide', 'restore', 'remove']) }).strict()), async (req, res) => {
    oid(req.params.id);
    const status = { hide: 'hidden', restore: 'visible', remove: 'removed' }[req.body.decision];
    const x = await M.Question.findByIdAndUpdate(req.params.id, { status, ...(status === 'visible' ? { reporters: [] } : {}) }, { returnDocument: 'after' });
    if (!x) throw notFound();
    await audit(req.user._id, `qa_${req.body.decision}`, 'question', x._id); res.json({ ok: true });
  });

  // ---------- mentor impact ----------
  r.get('/me/impact', ...mentor, async (req, res) => {
    const [mp, sessions] = await Promise.all([M.MentorProfile.findOne({ userId: req.user._id }), M.Session.find({ mentorId: req.user._id, status: 'completed' }).lean()]);
    const students = [...new Set(sessions.map((s) => String(s.studentId)))];
    const minutes = sessions.reduce((t, s) => t + (s.durationMin || 45), 0);
    // Student progress and outcomes appear ONLY for students who allowed mentors to see them.
    const consenting = await M.User.find({ _id: { $in: students }, shareProgressWithMentors: true }).select('displayName').lean();
    const progress = [];
    for (const s of consenting) {
      const snaps = await M.ProgressSnapshot.find({ studentId: s._id }).sort({ day: 1 }).lean();
      progress.push({ name: firstNameInitial(s.displayName), gain: snaps.length > 1 ? snaps[snaps.length - 1].percent - snaps[0].percent : null });
    }
    const apps = await M.Application.find({ studentId: { $in: consenting.map((c) => c._id) } }).select('stage').lean();
    const trusted = (mp ? mp.sessionsCompleted : 0) >= 10 && (mp ? mp.noShows : 0) === 0;
    res.json({
      sessionsHeld: sessions.length, studentsHelped: students.length, hoursGiven: Math.round((minutes / 60) * 10) / 10, avgRating: mp ? mp.ratingAvg : 0, ratingCount: mp ? mp.ratingCount : 0,
      trustedMentor: trusted, progress,
      outcomes: { interviews: apps.filter((a) => a.stage === 'Interview').length, shortlisted: apps.filter((a) => a.stage === 'Shortlisted').length, offers: apps.filter((a) => ['Offer', 'Hired'].includes(a.stage)).length, note: 'Self-reported by students who agreed to share. Not proof that mentoring caused them.' },
    });
  });
  r.get('/me/impact/certificate', ...mentor, async (req, res) => {
    const mp = await M.MentorProfile.findOne({ userId: req.user._id });
    const n = mp ? mp.sessionsCompleted : 0;
    if (n < 1) throw conflict('NO_SESSIONS', 'Complete at least one session to receive a certificate.');
    res.json({ certificate: { name: req.user.displayName, sessions: n, issuedAt: new Date(), id: `MLBD-${String(req.user._id).slice(-8).toUpperCase()}`, text: 'Thank you for mentoring students on MentorLink BD.' } });
  });

  // ---------- department: weekly sessions, approvals, bulk onboarding, report ----------
  const rx = (t) => new RegExp(`^${String(t || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  // Department staff are scoped to THEIR university and department. Admins must say which one.
  async function deptScope(req) {
    const uni = req.user.role === 'admin' ? req.query.universityId : req.user.universityId;
    const dep = req.user.role === 'admin' ? req.query.department : req.user.department;
    if (!uni || !dep) throw bad('DEPARTMENT_REQUIRED', 'A university and a department are required.');
    return { universityId: uni, department: rx(dep) };
  }
  r.get('/department/weekly', ...dept, async (req, res) => {
    const f = { ...(await deptScope(req)), role: 'student' };
    const ids = (await M.User.find(f).select('_id').lean()).map((x) => x._id);
    if (ids.length < K) return res.json({ weeks: null, note: `Groups smaller than ${K} are hidden to protect privacy.` });
    const since = new Date(Date.now() - 6 * 7 * 864e5);
    const ss = await M.Session.find({ studentId: { $in: ids }, status: 'completed', startsAt: { $gte: since } }).select('startsAt').lean();
    const weeks = Array.from({ length: 6 }, (_, i) => ({ week: i + 1, sessions: 0 }));
    for (const s of ss) { const i = Math.min(5, Math.max(0, Math.floor((s.startsAt - since) / (7 * 864e5)))); weeks[i].sessions += 1; }
    res.json({ weeks, activeStudents: ids.length, sessionsDone: ss.length });
  });
  r.get('/department/approvals', ...dept, async (req, res) => {
    const f = { ...(await deptScope(req)), role: 'student', affiliationStatus: 'pending' };
    const users = await M.User.find(f).select('displayName batchYear department emailDomainMatch').limit(100).lean();
    res.json({ pending: users.map((u) => ({ id: u._id, name: u.displayName, batchYear: u.batchYear, department: u.department, emailDomainMatch: u.emailDomainMatch })), note: 'Only name, batch and department are shown. Approving confirms affiliation, nothing else.' });
  });
  r.post('/department/approvals/:id', ...dept, validate(z.object({ decision: z.enum(['approved', 'rejected']) }).strict()), async (req, res) => {
    oid(req.params.id);
    const f = { ...(await deptScope(req)), _id: req.params.id, role: 'student' };
    const u = await M.User.findOneAndUpdate(f, { affiliationStatus: req.body.decision }, { returnDocument: 'after' });
    if (!u) throw notFound();
    await audit(req.user._id, `affiliation_${req.body.decision}`, 'user', u._id);
    await notify(u._id, `Affiliation ${req.body.decision}`, '', 'affiliation');
    res.json({ ok: true });
  });
  // Bulk onboarding by CSV: the department sends the roll-list emails and matching PENDING students are approved.
  r.post('/department/bulk-approve', ...dept, validate(z.object({ emails: z.array(z.string().email().max(120)).min(1).max(500) }).strict()), async (req, res) => {
    const f = { ...(await deptScope(req)), role: 'student', affiliationStatus: 'pending', email: { $in: req.body.emails.map((e) => e.toLowerCase()) } };
    const r2 = await M.User.updateMany(f, { affiliationStatus: 'approved' });
    await audit(req.user._id, 'affiliation_bulk_approve', 'department', req.user._id, { listed: req.body.emails.length, approved: r2.modifiedCount });
    res.json({ listed: req.body.emails.length, approved: r2.modifiedCount });
  });
  r.get('/department/report.csv', ...dept, async (req, res) => {
    const f = { ...(await deptScope(req)), role: 'student' };
    const studs = await M.User.find(f).select('_id shareProgressWithDept').lean();
    const ids = studs.map((s) => s._id);
    const lines = ['metric,value'];
    if (ids.length < K) lines.push(`note,"Groups smaller than ${K} are hidden to protect privacy"`);
    else {
      const goals = await M.StudentProfile.aggregate([{ $match: { userId: { $in: ids }, careerGoalRoleKey: { $ne: null } } }, { $group: { _id: '$careerGoalRoleKey', n: { $sum: 1 } } }]);
      lines.push(`active_students,${ids.length}`, `sessions_completed,${await M.Session.countDocuments({ studentId: { $in: ids }, status: 'completed' })}`, `applications,${await M.Application.countDocuments({ studentId: { $in: ids } })}`);
      for (const g of goals) if (g.n >= K) lines.push(`goal_${g._id},${g.n}`);
    }
    await audit(req.user._id, 'department_report_export', 'department', req.user._id);
    res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', 'attachment; filename="career-office-report.csv"');
    res.send(lines.join('\n') + '\n');
  });

  // ---------- admin: roles, users, logged preview, outcomes ----------
  r.get('/admin/users', ...admin, async (req, res) => {
    const f = {};
    if (req.query.role) f.role = String(req.query.role);
    if (req.query.q) f.displayName = new RegExp(String(req.query.q).slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const page = Math.max(1, Number(req.query.page) || 1);
    const users = await M.User.find({ ...f, deletedAt: null }).select('displayName email role verificationStatus department universityId').sort({ createdAt: -1 }).skip((page - 1) * 30).limit(30).lean();
    res.json({ users, page });
  });
  // Admin: change a user's sign-in email and/or set a new password. The password is write-only (Firebase keeps only a hash),
  // so it can never be shown. Every use is audit-logged WITHOUT the password. Other admins' accounts cannot be changed here.
  r.post('/admin/users/:id/account', ...admin, validate(z.object({ email: z.string().trim().toLowerCase().email().max(120).optional(), newPassword: z.string().min(8).max(100).optional() }).strict()), async (req, res) => {
    oid(req.params.id);
    if (!req.body.email && !req.body.newPassword) throw bad('NOTHING_TO_CHANGE', 'Enter a new email or a new password.');
    const u = await M.User.findById(req.params.id);
    if (!u || u.deletedAt) throw notFound();
    if (u.role === 'admin' && String(u._id) !== String(req.user._id)) throw forbidden('Another admin account cannot be changed here.');
    const emailChanged = !!req.body.email && req.body.email !== String(u.email || '').toLowerCase();
    if (emailChanged && (await M.User.findOne({ email: req.body.email, _id: { $ne: u._id } }))) throw conflict('EMAIL_TAKEN', 'Another account already uses this email.');
    try { await require('../config/firebase').adminUpdateFirebaseUser(u.firebaseUid, { email: emailChanged ? req.body.email : undefined, password: req.body.newPassword }); }
    catch (e) { throw bad('FIREBASE_UPDATE_FAILED', (e && e.message) || 'Could not update the sign-in account.'); }
    if (emailChanged) { u.email = req.body.email; await u.save(); }
    await audit(req.user._id, 'admin_account_change', 'user', u._id, { emailChanged, passwordChanged: !!req.body.newPassword });
    await notify(u._id, 'Your sign-in details were changed by an admin', 'If you did not expect this, contact support.', 'security');
    res.json({ ok: true, email: u.email, emailChanged, passwordChanged: !!req.body.newPassword });
  });
  // Employer only comes from company verification; admin only by the seed. This endpoint cannot create either.
  r.patch('/admin/users/:id/role', ...admin, validate(z.object({ role: z.enum(['student', 'mentor', 'department']) }).strict()), async (req, res) => {
    oid(req.params.id);
    if (String(req.params.id) === String(req.user._id)) throw forbidden('You cannot change your own role.');
    const u = await M.User.findById(req.params.id);
    if (!u) throw notFound();
    if (['admin', 'employer'].includes(u.role)) throw forbidden('Admin and employer roles are not changed here.');
    const before = u.role; u.role = req.body.role; await u.save();
    await audit(req.user._id, 'role_change', 'user', u._id, { from: before, to: req.body.role });
    res.json({ ok: true, role: u.role });
  });
  const SCREENS = {
    student: ['Home', 'Mentors', 'Plan', 'Jobs', 'Profile'], mentor: ['Requests', 'Opportunities', 'Impact', 'Profile'],
    department: ['Overview', 'Approvals', 'Workshops', 'Profile'], employer: ['Jobs', 'Applicants', 'Company'], admin: ['Queue', 'Companies', 'Resources', 'Insights', 'Profile'],
  };
  r.post('/admin/preview', ...admin, validate(z.object({ role: z.enum(['student', 'mentor', 'department', 'employer']) }).strict()), async (req, res) => {
    await audit(req.user._id, 'preview_role', 'role', undefined, { role: req.body.role }); // every preview is recorded
    res.json({ role: req.body.role, readOnly: true, screens: SCREENS[req.body.role], note: 'Read-only preview of what this role sees. You cannot act as them.' });
  });
  r.get('/admin/outcomes', ...admin, async (_q, res) => {
    const g = await M.Application.aggregate([{ $match: { outcomeFeedback: { $ne: null } } }, { $group: { _id: '$outcomeFeedback', n: { $sum: 1 } } }]);
    res.json({ outcomes: Object.fromEntries(g.map((x) => [x._id, x.n])), note: 'Used to evaluate recommendations. It does not change match weights automatically.' });
  });

  return r;
};
