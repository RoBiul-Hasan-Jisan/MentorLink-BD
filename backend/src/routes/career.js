// Career hub extras: pathway graph, project portfolio, GitHub link, plan review by a mentor, help finder.
//  - A project becomes SkillEvidence (type "project", level 1) per skill, so the existing mentor review loop (routes/loop.js) applies to it.
//  - A mentor can approve a plan or ask for changes. That never changes a score: scores come only from evidence.
//  - GitHub only suggests projects. Nothing is added to a score without the student choosing it.
const express = require('express');
const { z } = require('zod');
const M = require('../models');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/guards');
const { bad, notFound, conflict } = require('../utils/httpError');
const { notify, toObjectId, firstNameInitial } = require('../utils/helpers');
const { TARGETS, analyse } = require('../data/targets');
const { buildGraph } = require('../services/pathgraph');
const { computeReadiness } = require('../services/readiness');
const github = require('../services/github');

const HELP = [
  ['technical_interview', 'Technical interviews', 'ইন্টারভিউ প্রস্তুতি'], ['portfolio_review', 'Portfolio review', 'পোর্টফোলিও রিভিউ'],
  ['cv_review', 'CV review', 'সিভি রিভিউ'], ['roadmap_review', 'Roadmap review', 'রোডম্যাপ রিভিউ'], ['career_switch', 'Career switch', 'ক্যারিয়ার বদল'],
];
const REVIEW_RANK = { endorsed: 3, needs_work: 2, requested: 1, none: 0 };

module.exports = function careerRoutes(auth) {
  const r = express.Router();
  const A = auth.authenticate;
  const student = [A, requireRole('student')];
  const mentor = [A, requireRole('mentor')];
  const acceptedMentorIds = async (studentId) => (await M.MentorRequest.find({ studentId, status: 'accepted' }).select('mentorId').lean()).map((x) => String(x.mentorId));

  // ---------- pathway graph ----------
  r.get('/me/graph', ...student, async (req, res) => {
    const prof = (await M.StudentProfile.findOne({ userId: req.user._id }).lean()) || {};
    const key = String(req.query.target || (prof.selectedTargets || [])[0] || (TARGETS.find((t) => t.kind === 'career') || TARGETS[0]).key);
    const target = TARGETS.find((t) => t.key === key);
    if (!target) throw notFound('Unknown target.');
    const [prog, ev, quizzes] = await Promise.all([
      M.RoadmapProgress.find({ studentId: req.user._id, skillKey: `target:${target.key}` }).lean(),
      M.SkillEvidence.find({ studentId: req.user._id, type: { $ne: 'self' } }).lean(),
      M.Quiz.find().select('skillKey').lean(),
    ]);
    const evidence = {};
    for (const e of ev) evidence[e.skillKey] = Math.max(evidence[e.skillKey] || 0, e.level);
    const a = analyse(target, new Set(prog.map((p) => p.topicKey)), evidence, prof.weeklyHours || 0);
    res.json({ ...buildGraph(target, a, { quizSkills: new Set(quizzes.map((q) => q.skillKey)) }), selected: (prof.selectedTargets || []), available: TARGETS.map((t) => ({ key: t.key, kind: t.kind, titleEn: t.titleEn, titleBn: t.titleBn })) });
  });

  // ---------- projects ----------
  const projectOut = (p, evs) => {
    const mine = evs.filter((e) => (p.evidenceIds || []).map(String).includes(String(e._id)));
    const review = mine.reduce((best, e) => (REVIEW_RANK[e.reviewStatus || 'none'] > REVIEW_RANK[best] ? e.reviewStatus || 'none' : best), 'none');
    return { id: p._id, title: p.title, url: p.url, description: p.description, skillKeys: p.skillKeys, source: p.source, review, evidenceIds: p.evidenceIds, createdAt: p.createdAt };
  };
  const projectBody = z.object({
    title: z.string().trim().min(3).max(120),
    url: z.string().url().max(300).refine((u) => /^https:\/\//i.test(u), 'Use a link that starts with https://'),
    skillKeys: z.array(z.string().min(1).max(40)).min(1).max(5),
    description: z.string().trim().max(600).optional(),
    source: z.enum(['manual', 'github']).optional(),
  }).strict();
  async function checkSkills(keys) {
    const uniq = [...new Set(keys)];
    const found = await M.Skill.find({ key: { $in: uniq } }).select('key').lean();
    if (found.length !== uniq.length) throw bad('UNKNOWN_SKILL', 'Choose skills from the list.');
    return uniq;
  }
  async function writeEvidence(studentId, project, skillKeys) {
    const ids = [];
    for (const skillKey of skillKeys) ids.push((await M.SkillEvidence.create({ studentId, skillKey, type: 'project', level: 1, url: project.url })).id);
    project.evidenceIds = ids; project.skillKeys = skillKeys;
    await project.save();
  }
  async function mustOwn(req) {
    toObjectId(req.params.id);
    const p = await M.PortfolioProject.findOne({ _id: req.params.id, studentId: req.user._id });
    if (!p) throw notFound('Project not found.');
    const evs = await M.SkillEvidence.find({ _id: { $in: p.evidenceIds } }).lean();
    return { p, evs };
  }

  r.get('/me/portfolio', ...student, async (req, res) => {
    const [projects, link, skills, accepted] = await Promise.all([
      M.PortfolioProject.find({ studentId: req.user._id }).sort({ createdAt: -1 }).lean(),
      M.GithubLink.findOne({ userId: req.user._id }).lean(),
      M.Skill.find().select('key nameEn nameBn').sort({ nameEn: 1 }).lean(),
      acceptedMentorIds(req.user._id),
    ]);
    const evs = await M.SkillEvidence.find({ _id: { $in: projects.flatMap((p) => p.evidenceIds || []) } }).lean();
    const used = new Set(projects.map((p) => p.url));
    const known = new Set(skills.map((s) => s.key));
    const suggestions = link && link.verified ? (link.repos || []).filter((x) => !used.has(x.url)).slice(0, 6).map((x) => ({ title: x.name, url: x.url, description: x.description || '', skillKeys: github.skillsForRepo(x).filter((k) => known.has(k)) })) : [];
    const mentors = (await M.User.find({ _id: { $in: accepted } }).select('displayName').lean()).map((u) => ({ id: u._id, name: firstNameInitial(u.displayName) }));
    res.json({ projects: projects.map((p) => projectOut(p, evs)), github: ghState(link), suggestions, skills, mentors, note: 'A new project counts as level 1 evidence. A mentor can endorse it up to their own level.' });
  });

  r.post('/me/projects', ...student, validate(projectBody), async (req, res) => {
    const keys = await checkSkills(req.body.skillKeys);
    if (await M.PortfolioProject.findOne({ studentId: req.user._id, url: req.body.url })) throw conflict('DUPLICATE_PROJECT', 'This link is already in your portfolio.');
    const p = await M.PortfolioProject.create({ studentId: req.user._id, title: req.body.title, url: req.body.url, description: req.body.description || '', source: req.body.source || 'manual' });
    await writeEvidence(req.user._id, p, keys);
    res.status(201).json({ project: projectOut(p, await M.SkillEvidence.find({ _id: { $in: p.evidenceIds } }).lean()) });
  });

  r.put('/me/projects/:id', ...student, validate(projectBody), async (req, res) => {
    const { p, evs } = await mustOwn(req);
    if (evs.some((e) => e.reviewStatus === 'endorsed')) throw conflict('ENDORSED', 'Endorsed projects stay on record.');
    const keys = await checkSkills(req.body.skillKeys);
    await M.SkillEvidence.deleteMany({ _id: { $in: p.evidenceIds } });
    Object.assign(p, { title: req.body.title, url: req.body.url, description: req.body.description || '' });
    await writeEvidence(req.user._id, p, keys);
    res.json({ project: projectOut(p, await M.SkillEvidence.find({ _id: { $in: p.evidenceIds } }).lean()) });
  });

  r.delete('/me/projects/:id', ...student, async (req, res) => {
    const { p, evs } = await mustOwn(req);
    if (evs.some((e) => e.reviewStatus === 'endorsed')) throw conflict('ENDORSED', 'Endorsed projects stay on record.');
    await M.SkillEvidence.deleteMany({ _id: { $in: p.evidenceIds } });
    await p.deleteOne();
    res.json({ ok: true });
  });

  // One ask covers every skill of the project. The mentor then reviews each skill in the existing review queue.
  r.post('/me/projects/:id/request-review', ...student, validate(z.object({ mentorId: z.string() }).strict()), async (req, res) => {
    toObjectId(req.body.mentorId);
    const { p } = await mustOwn(req);
    if (!(await acceptedMentorIds(req.user._id)).includes(String(req.body.mentorId))) throw bad('NO_MENTOR', 'Choose a mentor who accepted your request.');
    await M.SkillEvidence.updateMany({ _id: { $in: p.evidenceIds }, reviewStatus: { $in: ['none', 'needs_work'] } }, { $set: { reviewStatus: 'requested', reviewMentorId: req.body.mentorId } });
    await notify(req.body.mentorId, 'Project review requested', `${req.user.displayName} asked you to review "${p.title}".`, 'review');
    res.json({ ok: true });
  });

  // ---------- GitHub ----------
  const ghState = (l) => ({ username: l ? l.username : null, code: l && !l.verified ? l.code : null, verified: !!(l && l.verified), repos: l ? (l.repos || []).length : 0, checkedAt: l ? l.checkedAt : null });
  r.get('/me/github', ...student, async (req, res) => res.json(ghState(await M.GithubLink.findOne({ userId: req.user._id }).lean())));
  r.post('/me/github/start', ...student, validate(z.object({ username: z.string().trim().min(1).max(39) }).strict()), async (req, res) => {
    const username = github.checkUsername(req.body.username);
    const l = await M.GithubLink.findOneAndUpdate({ userId: req.user._id }, { $set: { username, code: github.newCode(), verified: false, repos: [], checkedAt: null } }, { upsert: true, returnDocument: 'after' });
    res.json(ghState(l));
  });
  r.post('/me/github/verify', ...student, async (req, res) => {
    const l = await M.GithubLink.findOne({ userId: req.user._id });
    if (!l) throw bad('NO_GITHUB', 'Enter your GitHub username first.');
    l.repos = await github.verifyOwnership(l.username, l.code);
    l.verified = true; l.checkedAt = new Date();
    await l.save();
    res.json(ghState(l));
  });
  r.post('/me/github/disconnect', ...student, async (req, res) => { await M.GithubLink.deleteOne({ userId: req.user._id }); res.json({ ok: true }); });

  // ---------- plan review ----------
  const reviewOut = async (x) => {
    const m = await M.User.findById(x.mentorId).select('displayName').lean();
    return { id: x._id, status: x.status, mentor: firstNameInitial(m && m.displayName), mentorId: x.mentorId, studentNote: x.studentNote, mentorNote: x.mentorNote, tasksDone: x.tasksDone, tasksTotal: x.tasksTotal, at: x.createdAt, decidedAt: x.decidedAt || null };
  };
  r.get('/me/plan-review', ...student, async (req, res) => {
    const last = await M.PlanReview.findOne({ studentId: req.user._id }).sort({ createdAt: -1 }).lean();
    const accepted = await acceptedMentorIds(req.user._id);
    const mentors = (await M.User.find({ _id: { $in: accepted } }).select('displayName').lean()).map((u) => ({ id: u._id, name: firstNameInitial(u.displayName) }));
    res.json({ review: last ? await reviewOut(last) : null, mentors });
  });
  r.post('/me/plan-review', ...student, validate(z.object({ mentorId: z.string(), note: z.string().trim().max(300).optional() }).strict()), async (req, res) => {
    toObjectId(req.body.mentorId);
    if (!(await acceptedMentorIds(req.user._id)).includes(String(req.body.mentorId))) throw bad('NO_MENTOR', 'Choose a mentor who accepted your request.');
    if (await M.PlanReview.findOne({ studentId: req.user._id, status: 'requested' })) throw conflict('REVIEW_OPEN', 'You already asked a mentor to review your plan.');
    const tasks = await M.Task.find({ studentId: req.user._id }).select('status').lean();
    if (!tasks.length) throw bad('EMPTY_PLAN', 'Your plan has no tasks yet. Add or get tasks first.');
    const x = await M.PlanReview.create({ studentId: req.user._id, mentorId: req.body.mentorId, studentNote: req.body.note || '', tasksTotal: tasks.length, tasksDone: tasks.filter((t) => t.status === 'done').length });
    await notify(req.body.mentorId, 'Plan review requested', `${req.user.displayName} asked you to review their 4-week plan.`, 'review');
    res.status(201).json({ review: await reviewOut(x) });
  });
  r.get('/mentor/plan-reviews', ...mentor, async (req, res) => {
    const list = await M.PlanReview.find({ mentorId: req.user._id, status: 'requested' }).sort({ createdAt: 1 }).lean();
    const users = new Map((await M.User.find({ _id: { $in: list.map((x) => x.studentId) } }).select('displayName').lean()).map((u) => [String(u._id), u]));
    const out = [];
    for (const x of list) {
      const tasks = await M.Task.find({ studentId: x.studentId }).sort({ week: 1 }).select('title week status').lean();
      out.push({ id: x._id, studentId: x.studentId, student: firstNameInitial((users.get(String(x.studentId)) || {}).displayName), studentNote: x.studentNote, at: x.createdAt, tasks: tasks.map((t) => ({ title: t.title, week: t.week, status: t.status })) });
    }
    res.json({ reviews: out });
  });
  r.post('/mentor/plan-reviews/:id', ...mentor, validate(z.object({ decision: z.enum(['approved', 'changes']), note: z.string().trim().max(400).optional() }).strict()), async (req, res) => {
    toObjectId(req.params.id);
    const x = await M.PlanReview.findOne({ _id: req.params.id, mentorId: req.user._id });
    if (!x) throw notFound('Review not found.');
    if (x.status !== 'requested') throw conflict('ALREADY_DECIDED', 'You already answered this review.');
    if (req.body.decision === 'changes' && !(req.body.note || '').trim()) throw bad('NOTE_REQUIRED', 'Say what should change.');
    x.status = req.body.decision; x.mentorNote = req.body.note || ''; x.decidedAt = new Date();
    await x.save();
    await notify(x.studentId, req.body.decision === 'approved' ? 'Your plan was approved' : 'Your mentor suggested plan changes', x.mentorNote || req.user.displayName, 'review');
    res.json({ ok: true, status: x.status });
  });

  // ---------- help finder: pick the problem you have, get mentors for it ----------
  r.get('/me/help-finder', ...student, async (req, res) => {
    const prof = await M.StudentProfile.findOne({ userId: req.user._id }).lean();
    let gaps = [];
    if (prof && prof.careerGoalRoleKey) {
      const [role, evidence, skills] = await Promise.all([M.RoleTemplate.findOne({ key: prof.careerGoalRoleKey }).lean(), M.SkillEvidence.find({ studentId: req.user._id }).lean(), M.Skill.find().lean()]);
      if (role) gaps = computeReadiness({ role, evidence, skills, weeklyHours: prof.weeklyHours }).gaps.slice(0, 6).map((g) => ({ skillKey: g.skillKey, nameEn: g.nameEn, nameBn: g.nameBn, current: g.current, required: g.required }));
    }
    res.json({ skills: gaps, interventions: HELP.map(([key, labelEn, labelBn]) => ({ key, labelEn, labelBn })) });
  });
  r.get('/me/help-finder/mentors', ...student, async (req, res) => {
    const focus = String(req.query.focus || '');
    if (!HELP.some((h) => h[0] === focus)) throw bad('UNKNOWN_FOCUS', 'Unknown kind of help.');
    const prof = (await M.StudentProfile.findOne({ userId: req.user._id }).lean()) || {};
    const blocked = new Set([...(req.user.blockedBy || []), ...(prof.dismissedMentors || [])].map(String));
    const users = await M.User.find({ role: 'mentor', verificationStatus: 'verified' }).select('displayName blockedBy').lean();
    const profiles = new Map((await M.MentorProfile.find({ userId: { $in: users.map((u) => u._id) }, paused: { $ne: true }, helpsWith: focus }).lean()).map((p) => [String(p.userId), p]));
    const out = [];
    for (const u of users) {
      const p = profiles.get(String(u._id));
      if (!p || blocked.has(String(u._id)) || (u.blockedBy || []).map(String).includes(String(req.user._id))) continue;
      const spots = Math.max(0, (p.weeklyCapacity || 0) - (p.acceptedRequests || 0));
      if (spots <= 0) continue;
      const score = 0.5 * ((p.ratingAvg || 0) / 5) + 0.3 * Math.min(1, (p.sessionsCompleted || 0) / 10) + 0.2 * Math.min(1, spots / 3);
      out.push({ mentorId: String(u._id), name: firstNameInitial(u.displayName), roleTitle: p.roleTitle, industry: p.industry, openSpots: spots, rating: p.ratingCount >= 3 ? p.ratingAvg : null, sessions: p.sessionsCompleted || 0, score: Math.round(score * 100) });
    }
    out.sort((a, b) => b.score - a.score);
    res.json({ focus, mentors: out.slice(0, 5), note: 'Ranked by rating, sessions done and open spots. Only mentors who list this kind of help appear.' });
  });

  return r;
};
