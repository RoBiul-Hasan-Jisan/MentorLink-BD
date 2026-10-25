const express = require('express');
const { z } = require('zod');
const { Roadmap, RoadmapProgress, Quiz, RoleTemplate, Skill, SkillEvidence, StudentProfile, MentorProfile, User, Match, Resource, ResourceProgress, Report } = require('../models');
const { toObjectId, audit } = require('../utils/helpers');
const env = require('../config/env');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/guards');
const { bad, notFound, conflict } = require('../utils/httpError');
const { computeReadiness } = require('../services/readiness');
const { rankMentors, keywordBaseline } = require('../services/matching');

module.exports = function learningRoutes(auth) {
  const r = express.Router();
  const student = [auth.authenticate, requireRole('student')];

  r.get('/roles', auth.authenticate, async (_q, res) => res.json({ roles: await RoleTemplate.find().sort({ titleEn: 1 }) }));
  r.get('/skills', auth.authenticate, async (_q, res) => res.json({ skills: await Skill.find().sort({ nameEn: 1 }) }));

  const goalSchema = z.object({
    careerGoalRoleKey: z.string().min(1), goalText: z.string().trim().max(300).optional(),
    weeklyHours: z.number().min(0).max(80).optional(),
    languages: z.array(z.enum(['bn', 'en'])).min(1).optional(), requestedSlots: z.array(z.string().max(20)).max(14).optional(),
  }).strict();
  r.put('/me/goal', ...student, validate(goalSchema), async (req, res) => {
    if (!(await RoleTemplate.findOne({ key: req.body.careerGoalRoleKey }))) throw bad('UNKNOWN_ROLE', 'Unknown career goal.');
    const p = await StudentProfile.findOneAndUpdate({ userId: req.user._id }, { $set: req.body }, { upsert: true, returnDocument: 'after' });
    res.json({ profile: p });
  });

  const evSchema = z.object({
    skillKey: z.string().min(1), type: z.enum(['self', 'quiz', 'project']), level: z.number().int().min(1).max(3), url: z.string().url().max(300).optional(),
  }).strict(); // students cannot create "endorsement" evidence
  r.post('/me/evidence', ...student, validate(evSchema), async (req, res) => {
    if (!(await Skill.findOne({ key: req.body.skillKey }))) throw bad('UNKNOWN_SKILL', 'Unknown skill.');
    res.status(201).json({ evidence: await SkillEvidence.create({ ...req.body, studentId: req.user._id }) });
  });

  async function readinessFor(user) {
    const profile = await StudentProfile.findOne({ userId: user._id });
    if (!profile || !profile.careerGoalRoleKey) throw bad('NO_GOAL', 'Choose a career goal first.');
    const role = await RoleTemplate.findOne({ key: profile.careerGoalRoleKey });
    const [evidence, skills] = await Promise.all([SkillEvidence.find({ studentId: user._id }), Skill.find()]);
    return { profile, role, result: computeReadiness({ role, evidence, skills, weeklyHours: profile.weeklyHours }) };
  }
  r.get('/me/readiness', ...student, async (req, res) => { const x = await readinessFor(req.user); res.json({ ...x.result, roleTitleEn: x.role.titleEn, roleTitleBn: x.role.titleBn, weeklyHours: x.profile.weeklyHours }); });

  r.get('/matches', ...student, async (req, res) => {
    const { profile, role, result } = await readinessFor(req.user);
    const mentorUsers = await User.find({ role: 'mentor', verificationStatus: 'verified' });
    const profs = await MentorProfile.find({ userId: { $in: mentorUsers.map((u) => u._id) } });
    const mentors = mentorUsers.map((u) => ({ user: u, profile: profs.find((p) => String(p.userId) === String(u._id)) })).filter((m) => m.profile);
    const since = new Date(Date.now() - 14 * 864e5);
    const recent = await Match.find({ createdAt: { $gte: since } });
    const recentCounts = {};
    for (const m of recent) recentCounts[String(m.mentorId)] = (recentCounts[String(m.mentorId)] || 0) + 1;
    const ranked = rankMentors({ student: { user: req.user, profile }, role, gaps: result.gaps, mentors, recentCounts });
    await Match.deleteMany({ studentId: req.user._id });
    if (ranked.length) await Match.insertMany(ranked.map((m) => ({ studentId: req.user._id, mentorId: m.mentorId, score: m.score, factorScores: m.factorScores, reasons: m.reasons })));
    const byId = new Map(mentorUsers.map((u) => [String(u._id), u]));
    const pmap = new Map(profs.map((p) => [String(p.userId), p]));
    res.json({
      matches: ranked.map((m) => {
        const u = byId.get(String(m.mentorId)), p = pmap.get(String(m.mentorId));
        return { ...m, mentor: { id: u._id, name: u.displayName, roleTitle: p.roleTitle, industry: p.industry, yearsExperience: p.yearsExperience, isRising: p.isRising } };
      }),
      baseline: keywordBaseline({ student: { user: req.user, profile }, role, mentors }).slice(0, 5),
    });
  });

  // ---- quizzes: the SERVER grades. Passing creates 'quiz' evidence (counts more than self-rating). ----
  r.get('/quizzes/:skillKey', ...student, async (req, res) => {
    const z = await Quiz.findOne({ skillKey: req.params.skillKey });
    if (!z) throw notFound('No quiz for this skill yet.');
    res.json({ skillKey: z.skillKey, questions: z.questions.map((x) => ({ q: x.q, options: x.options })) });
  });
  r.post('/quizzes/:skillKey/submit', ...student, validate(z.object({ answers: z.array(z.number().int().min(0).max(5)).min(1).max(20) }).strict()), async (req, res) => {
    const quiz = await Quiz.findOne({ skillKey: req.params.skillKey });
    if (!quiz) throw notFound('No quiz for this skill yet.');
    if (req.body.answers.length !== quiz.questions.length) throw bad('WRONG_ANSWER_COUNT', `Answer all ${quiz.questions.length} questions.`);
    const correct = quiz.questions.filter((x, i) => x.answer === req.body.answers[i]).length;
    const pct = Math.round((100 * correct) / quiz.questions.length);
    const level = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 40 ? 1 : 0;
    if (level > 0) await SkillEvidence.create({ studentId: req.user._id, skillKey: quiz.skillKey, type: 'quiz', level });
    res.json({ correct, total: quiz.questions.length, percent: pct, levelAwarded: level });
  });

  // ---- learning resource hub ----
  r.get('/resources', auth.authenticate, async (req, res) => {
    const filter = { status: 'approved' };
    if (req.query.skillKey) filter.skillKey = String(req.query.skillKey);
    if (req.query.language) filter.language = String(req.query.language);
    const list = await Resource.find(filter).sort({ language: 1, title: 1 }).limit(100);
    let st = new Map();
    if (req.user.role === 'student') st = new Map((await ResourceProgress.find({ studentId: req.user._id })).map((p) => [String(p.resourceId), p.status]));
    res.json({ resources: list.map((x) => ({ id: x._id, title: x.title, url: x.url, skillKey: x.skillKey, language: x.language, kind: x.kind, free: x.free, linkStatus: x.linkStatus || null, lastLinkCheckedAt: x.lastLinkCheckedAt || null, status: st.get(String(x._id)) || null, done: st.get(String(x._id)) === 'completed' })) });
  });
  // Student-only, private to the student. Progress never raises a skill level by itself.
  async function setProgress(req, res, status) {
    toObjectId(req.params.id);
    if (!(await Resource.findOne({ _id: req.params.id, status: 'approved' }))) throw notFound();
    await ResourceProgress.updateOne({ studentId: req.user._id, resourceId: req.params.id }, { $set: { status } }, { upsert: true });
    res.json({ ok: true, status });
  }
  r.post('/resources/:id/complete', ...student, (req, res) => setProgress(req, res, 'completed'));
  r.put('/resources/:id/progress', ...student, validate(z.object({ status: z.enum(['saved', 'in_progress', 'completed']) }).strict()), (req, res) => setProgress(req, res, req.body.status));
  r.delete('/resources/:id/progress', ...student, async (req, res) => {
    toObjectId(req.params.id);
    await ResourceProgress.deleteOne({ studentId: req.user._id, resourceId: req.params.id });
    res.json({ ok: true });
  });
  // Broken-link / bad-content report. One report per student; hidden automatically at the same threshold as job posts.
  r.post('/resources/:id/report', ...student, validate(z.object({ reason: z.string().trim().min(3).max(300) }).strict()), async (req, res) => {
    toObjectId(req.params.id);
    if (!(await Resource.findOne({ _id: req.params.id, status: 'approved' }))) throw notFound();
    try { await Report.create({ reporterId: req.user._id, targetType: 'resource', targetId: req.params.id, reason: req.body.reason }); } catch (e) { if (e.code === 11000) throw conflict('ALREADY_REPORTED', 'You already reported this.'); throw e; }
    const count = await Report.countDocuments({ targetType: 'resource', targetId: req.params.id });
    const rs = await Resource.findByIdAndUpdate(req.params.id, { reportCount: count }, { returnDocument: 'after' });
    let hidden = false;
    if (rs && count >= env.reportHideThreshold) { rs.status = 'hidden'; await rs.save(); hidden = true; await audit(req.user._id, 'auto_hide_resource', 'resource', rs._id, { reports: count }); }
    res.status(201).json({ ok: true, hidden });
  });

  // ---- roadmaps: where a beginner starts in a skill ----
  r.get('/roadmaps', auth.authenticate, async (req, res) => {
    const [maps, skills] = await Promise.all([Roadmap.find().lean(), Skill.find().lean()]);
    const names = new Map(skills.map((s) => [s.key, s]));
    let done = new Map();
    if (req.user.role === 'student') for (const p of await RoadmapProgress.find({ studentId: req.user._id })) done.set(p.skillKey, (done.get(p.skillKey) || 0) + 1);
    res.json({ roadmaps: maps.map((m) => {
      const topics = m.stages.flatMap((s) => s.topics);
      return { skillKey: m.skillKey, nameEn: names.get(m.skillKey)?.nameEn || m.skillKey, nameBn: names.get(m.skillKey)?.nameBn || m.skillKey, summaryEn: m.summaryEn, summaryBn: m.summaryBn, topicCount: topics.length, totalHours: topics.reduce((t, x) => t + x.hours, 0), doneCount: done.get(m.skillKey) || 0 };
    }).sort((a, b) => a.nameEn.localeCompare(b.nameEn)) });
  });
  r.get('/roadmaps/:skillKey', auth.authenticate, async (req, res) => {
    const m = await Roadmap.findOne({ skillKey: String(req.params.skillKey) }).lean();
    if (!m) throw notFound('No roadmap for this skill yet.');
    const sk = await Skill.findOne({ key: m.skillKey }).lean();
    const resources = await Resource.find({ skillKey: m.skillKey, status: 'approved' }).sort({ language: 1, title: 1 }).lean();
    let done = new Set();
    if (req.user.role === 'student') done = new Set((await RoadmapProgress.find({ studentId: req.user._id, skillKey: m.skillKey })).map((p) => p.topicKey));
    const topics = m.stages.flatMap((s) => s.topics);
    const next = topics.find((t) => !done.has(t.key));
    res.json({
      skillKey: m.skillKey, nameEn: sk?.nameEn || m.skillKey, nameBn: sk?.nameBn || m.skillKey, summaryEn: m.summaryEn, summaryBn: m.summaryBn,
      stages: m.stages.map((s) => ({ level: s.level, titleEn: s.titleEn, titleBn: s.titleBn, topics: s.topics.map((t) => ({ key: t.key, titleEn: t.titleEn, titleBn: t.titleBn, hours: t.hours, done: done.has(t.key) })) })),
      totalHours: topics.reduce((t, x) => t + x.hours, 0), doneCount: done.size, percent: topics.length ? Math.round((100 * done.size) / topics.length) : 0,
      startHere: next ? next.key : null,
      hasQuiz: !!(await Quiz.findOne({ skillKey: m.skillKey })),
      resources: resources.map((x) => ({ id: x._id, title: x.title, url: x.url, language: x.language, kind: x.kind, free: x.free })),
      note: 'Ticking topics tracks your study. Your skill level only changes with evidence: a quiz, a project or a mentor endorsement.',
    });
  });
  r.put('/roadmaps/:skillKey/topics/:topicKey', ...student, validate(z.object({ done: z.boolean() }).strict()), async (req, res) => {
    const m = await Roadmap.findOne({ skillKey: String(req.params.skillKey) }).lean();
    if (!m || !m.stages.some((s) => s.topics.some((t) => t.key === req.params.topicKey))) throw notFound();
    const f = { studentId: req.user._id, skillKey: m.skillKey, topicKey: req.params.topicKey };
    if (req.body.done) await RoadmapProgress.updateOne(f, { $set: f }, { upsert: true }); else await RoadmapProgress.deleteOne(f);
    res.json({ ok: true, done: req.body.done });
  });

  // ---- mentor profile detail (public card + expertise; no contact details) ----
  r.get('/mentors/:id', ...student, async (req, res) => {
    toObjectId(req.params.id);
    const u = await User.findOne({ _id: req.params.id, role: 'mentor', verificationStatus: 'verified' });
    if (!u || (u.blockedBy || []).map(String).includes(String(req.user._id)) || (req.user.blockedBy || []).map(String).includes(String(u._id))) throw notFound();
    const p = await MentorProfile.findOne({ userId: u._id });
    if (!p) throw notFound();
    const sk = new Map((await Skill.find({ key: { $in: p.expertiseSkills.map((e) => e.skillKey) } })).map((s) => [s.key, s]));
    res.json({ mentor: {
      id: u._id, name: u.displayName, department: u.department, batchYear: u.batchYear, roleTitle: p.roleTitle, industry: p.industry,
      yearsExperience: p.yearsExperience, languages: p.languages, isRising: p.isRising, sessionsCompleted: p.sessionsCompleted,
      openSlots: p.paused ? [] : p.availableSlots, paused: p.paused,
      expertise: p.expertiseSkills.map((e) => ({ skillKey: e.skillKey, level: e.level, nameEn: sk.get(e.skillKey)?.nameEn, nameBn: sk.get(e.skillKey)?.nameBn })),
    } });
  });
  return r;
};
