// Job-readiness path: one clear route from "pick a target" to "apply with proof".
//   GET  /me/ready-path             checklist, next step, top 3 gaps, weekly plan
//   GET  /me/interview-practice     role question bank + my latest self-ratings
//   POST /me/interview-practice     rate one practice answer (1-5)
//   POST /me/interview-practice/request-feedback   ask one of my accepted mentors to review my practice
//   GET  /me/ready-jobs             jobs I can apply to now, and jobs I am 1-2 skills away from
//   GET  /me/apply-defaults         what one-tap apply reuses (latest CV, last consent, saved answers)
//   GET  /stories                   real, anonymous "from X% to hired" stories (opt-in, hidden until enough students)
// Rules: students only; nothing here changes a skill level (levels come from evidence); no AI service, no cost.
const express = require('express');
const { z } = require('zod');
const M = require('../models');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/guards');
const { bad, forbidden } = require('../utils/httpError');
const { notify } = require('../utils/helpers');
const { computeReadiness, levelsFromEvidence } = require('../services/readiness');
const { normalizeCv, cvTips } = require('../services/cv');
const { fitOf } = require('../services/jobtools');
const JR = require('../services/jobready');

module.exports = function readyRoutes(auth) {
  const r = express.Router();
  const A = auth.authenticate;
  const student = [A, requireRole('student')];

  async function goalContext(user) {
    const profile = await M.StudentProfile.findOne({ userId: user._id }).lean();
    const role = profile && profile.careerGoalRoleKey ? await M.RoleTemplate.findOne({ key: profile.careerGoalRoleKey }).lean() : null;
    return { profile, role };
  }

  r.get('/me/ready-path', ...student, async (req, res) => {
    const uid = req.user._id;
    const { profile, role } = await goalContext(req.user);
    const [evidence, skills, cvs, mocks, apps, practice, quizzes] = await Promise.all([
      M.SkillEvidence.find({ studentId: uid }).lean(), M.Skill.find().lean(),
      M.CvVersion.find({ studentId: uid }).sort({ version: -1 }).limit(1).lean(),
      M.MockInterview.countDocuments({ studentId: uid, status: 'done' }),
      M.Application.countDocuments({ studentId: uid, stage: { $ne: 'Withdrawn' } }),
      role ? M.PracticeAnswer.find({ studentId: uid, roleKey: role.key }).lean() : [],
      M.Quiz.find().select('skillKey').lean(),
    ]);
    const result = role ? computeReadiness({ role, evidence, skills, weeklyHours: profile.weeklyHours }) : null;
    const cvScore = cvs.length ? cvTips(normalizeCv(cvs[0].data, req.user)).score : 0;
    const summary = role ? JR.practiceSummary(role.key, practice) : { answered: 0 };
    const checklist = JR.buildChecklist({ hasGoal: !!role, cvCount: cvs.length, cvScore, confidence: result ? result.confidence : 0, mocksDone: mocks, practiceAnswered: summary.answered, applications: apps });
    const gaps = result ? result.gaps.slice(0, 3) : [];
    const resources = gaps.length ? await M.Resource.find({ skillKey: { $in: gaps.map((g) => g.skillKey) }, status: 'approved' }).select('skillKey title url kind language free').lean() : [];
    const plan = JR.weeklyPlan({ gaps, resources, quizSkills: new Set(quizzes.map((q) => q.skillKey)), weeklyHours: profile && profile.weeklyHours });
    res.json({
      target: role ? { key: role.key, titleEn: role.titleEn, titleBn: role.titleBn } : null,
      readiness: result ? result.readiness : null, confidence: result ? result.confidence : null,
      topGaps: gaps.map((g) => ({ skillKey: g.skillKey, nameEn: g.nameEn, nameBn: g.nameBn, current: g.current, required: g.required, hours: g.hours })),
      weeklyPlan: plan, checklist, nextStep: JR.nextStep(checklist), practice: summary,
      note: 'Every step ends in proof: a quiz, a project or a mentor endorsement. Self-rating never counts as proof.',
    });
  });

  // ---------------- interview practice ----------------
  r.get('/me/interview-practice', ...student, async (req, res) => {
    const { role } = await goalContext(req.user);
    if (!role) throw bad('NO_GOAL', 'Choose a career goal first.');
    const answers = await M.PracticeAnswer.find({ studentId: req.user._id, roleKey: role.key }).sort({ createdAt: 1 }).lean();
    const latest = new Map(answers.map((a) => [a.questionId, a]));
    res.json({
      roleKey: role.key, roleTitleEn: role.titleEn, roleTitleBn: role.titleBn,
      questions: JR.questionsFor(role.key).map((x) => ({ ...x, myRating: latest.has(x.id) ? latest.get(x.id).rating : null, myNote: latest.has(x.id) ? latest.get(x.id).note : '' })),
      summary: JR.practiceSummary(role.key, answers),
      tips: ['Say your answer out loud first, then rate yourself honestly.', 'Use one real example. Give a number or a result.', 'After 5 questions, ask a mentor for a real mock interview.'],
    });
  });
  r.post('/me/interview-practice', ...student, validate(z.object({ questionId: z.string().max(40), rating: z.number().int().min(1).max(5), note: z.string().trim().max(1000).optional() }).strict()), async (req, res) => {
    const { role } = await goalContext(req.user);
    if (!role) throw bad('NO_GOAL', 'Choose a career goal first.');
    if (!JR.isQuestionOf(role.key, req.body.questionId)) throw bad('BAD_QUESTION', 'This question is not in your role\'s practice set.');
    await M.PracticeAnswer.create({ studentId: req.user._id, roleKey: role.key, questionId: req.body.questionId, rating: req.body.rating, note: req.body.note || '' });
    const answers = await M.PracticeAnswer.find({ studentId: req.user._id, roleKey: role.key }).lean();
    res.status(201).json({ summary: JR.practiceSummary(role.key, answers) });
  });
  r.post('/me/interview-practice/request-feedback', ...student, validate(z.object({ mentorId: z.string() }).strict()), async (req, res) => {
    const { role } = await goalContext(req.user);
    if (!role) throw bad('NO_GOAL', 'Choose a career goal first.');
    if (!(await M.MentorRequest.findOne({ studentId: req.user._id, mentorId: req.body.mentorId, status: 'accepted' }))) throw forbidden('Ask a mentor who accepted your request.');
    const answers = await M.PracticeAnswer.find({ studentId: req.user._id, roleKey: role.key }).lean();
    const s = JR.practiceSummary(role.key, answers);
    if (s.answered < 1) throw bad('NO_PRACTICE', 'Practise at least one question first.');
    await notify(req.body.mentorId, 'Interview practice feedback', `${req.user.displayName} practised ${s.answered} ${role.titleEn} question(s), self-rated average ${s.average}/5. Please share feedback or offer a mock interview.`, 'mock');
    res.json({ ok: true, answered: s.answered, average: s.average });
  });

  // ---------------- ranked jobs ----------------
  r.get('/me/ready-jobs', ...student, async (req, res) => {
    const now = new Date();
    const [jobs, evidence, apps, skills] = await Promise.all([
      M.Opportunity.find({ status: 'approved', closed: { $ne: true } }).sort({ createdAt: -1 }).limit(500).lean(),
      M.SkillEvidence.find({ studentId: req.user._id }).lean(),
      M.Application.find({ studentId: req.user._id, stage: { $ne: 'Withdrawn' } }).select('opportunityId').lean(),
      M.Skill.find().lean(),
    ]);
    const have = levelsFromEvidence(evidence);
    const applied = new Set(apps.map((a) => String(a.opportunityId)));
    const open = jobs.filter((j) => !applied.has(String(j._id)) && (!j.applicationDeadline || new Date(j.applicationDeadline) > now));
    const { applyNow, almost } = JR.rankJobs(open, have, fitOf);
    const name = new Map(skills.map((s) => [s.key, s]));
    const card = (x) => ({
      id: x.job._id, title: x.job.title, organization: x.job.organization, locationText: x.job.locationText, type: x.job.type, fit: x.fit, applicationDeadline: x.job.applicationDeadline,
      hasScreeningQuestions: (x.job.screeningQuestions || []).length > 0,
      missing: x.missing.map((m) => ({ ...m, nameEn: (name.get(m.skillKey) || {}).nameEn || m.skillKey, nameBn: (name.get(m.skillKey) || {}).nameBn || m.skillKey, learnRoute: `/roadmap/${m.skillKey}` })),
    });
    res.json({
      applyNow: applyNow.slice(0, 30).map(card), almostThere: almost.slice(0, 30).map(card),
      counts: { applyNow: applyNow.length, almostThere: almost.length },
      note: '"Apply now" means every skill the job asks for is at the level it asks for. "Almost there" means 1 or 2 skills are below it.',
    });
  });

  // ---------------- one-tap apply: what is reused ----------------
  r.get('/me/apply-defaults', ...student, async (req, res) => {
    const [cv, last, past] = await Promise.all([
      M.CvVersion.findOne({ studentId: req.user._id }).sort({ version: -1 }).select('version').lean(),
      M.Application.findOne({ studentId: req.user._id }).sort({ createdAt: -1 }).select('consentSnapshot').lean(),
      M.Application.find({ studentId: req.user._id, 'answers.0': { $exists: true } }).sort({ createdAt: -1 }).limit(10).populate('opportunityId', 'screeningQuestions').lean(),
    ]);
    const saved = {};
    for (const a of past) { const qs = (a.opportunityId && a.opportunityId.screeningQuestions) || []; qs.forEach((qq, i) => { const t = typeof qq === 'string' ? qq : qq && qq.text; if (t && a.answers[i] && !saved[t]) saved[t] = a.answers[i]; }); }
    res.json({ cvVersionId: cv ? cv._id : null, cvVersion: cv ? cv.version : null, sharedFields: last ? last.consentSnapshot.sharedFields : ['name', 'cv', 'skills'], savedAnswers: saved,
      note: 'One-tap apply sends your latest CV and the same sharing choices as last time. You still tick the consent box every time.' });
  });

  // ---------------- success stories ----------------
  // Separate consent from research sharing: a story is one person's journey (anonymous, but shown one by one), so it has its own switch.
  r.get('/me/story-sharing', ...student, async (req, res) => res.json({ on: !!req.user.shareStory }));
  r.put('/me/story-sharing', ...student, validate(z.object({ on: z.boolean() }).strict()), async (req, res) => {
    await M.User.updateOne({ _id: req.user._id }, { shareStory: req.body.on });
    res.json({ on: req.body.on });
  });
  r.get('/stories', A, requireRole('student', 'mentor', 'department', 'admin'), async (_req, res) => {
    const hired = await M.Application.find({ stage: 'Hired' }).select('studentId stageHistory').lean();
    const users = await M.User.find({ _id: { $in: hired.map((a) => a.studentId) }, role: 'student', shareStory: true, deletedAt: null }).select('_id').lean();
    const ok = new Set(users.map((u) => String(u._id)));
    const rows = [], roles = new Map((await M.RoleTemplate.find().select('key titleEn titleBn').lean()).map((x) => [x.key, x]));
    const seen = new Set();
    for (const a of hired) {
      const sid = String(a.studentId);
      if (!ok.has(sid) || seen.has(sid)) continue;
      seen.add(sid);
      const h = (a.stageHistory || []).filter((x) => x.stage === 'Hired').pop();
      if (!h) continue;
      const snaps = await M.ProgressSnapshot.find({ studentId: a.studentId }).sort({ day: 1 }).lean();
      if (!snaps.length) continue;
      const hiredDay = new Date(h.at).toISOString().slice(0, 10);
      const before = snaps.filter((s) => s.day <= hiredDay);
      const lastSnap = before.length ? before[before.length - 1] : snaps[snaps.length - 1];
      const role = roles.get(lastSnap.roleKey) || {};
      rows.push({ roleTitleEn: role.titleEn || 'a job', roleTitleBn: role.titleBn, firstPercent: snaps[0].percent, hirePercent: lastSnap.percent, firstDay: snaps[0].day, hiredAt: h.at });
    }
    res.json({ ...JR.buildStories(rows), note: 'Only students who agreed to share their outcome appear. No names, no universities.' });
  });

  return r;
};
