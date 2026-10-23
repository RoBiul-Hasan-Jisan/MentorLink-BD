const express = require('express');
const { z } = require('zod');
const { Quiz, RoleTemplate, Skill, SkillEvidence, StudentProfile, MentorProfile, User, Match, Resource, ResourceProgress } = require('../models');
const { toObjectId } = require('../utils/helpers');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/guards');
const { bad, notFound } = require('../utils/httpError');
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
    let done = new Set();
    if (req.user.role === 'student') done = new Set((await ResourceProgress.find({ studentId: req.user._id })).map((p) => String(p.resourceId)));
    res.json({ resources: list.map((x) => ({ id: x._id, title: x.title, url: x.url, skillKey: x.skillKey, language: x.language, kind: x.kind, free: x.free, done: done.has(String(x._id)) })) });
  });
  r.post('/resources/:id/complete', ...student, async (req, res) => {
    toObjectId(req.params.id);
    if (!(await Resource.findOne({ _id: req.params.id, status: 'approved' }))) throw notFound();
    await ResourceProgress.updateOne({ studentId: req.user._id, resourceId: req.params.id }, { $setOnInsert: { studentId: req.user._id, resourceId: req.params.id } }, { upsert: true });
    res.json({ ok: true });
  });
  return r;
};
