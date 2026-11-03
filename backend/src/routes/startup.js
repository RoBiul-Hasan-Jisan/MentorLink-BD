// Launch features: Career Passport, Mentor Sprint, Daily Brief, Employer Talent Pool.
// Rules that hold for every route here:
//  - the role always comes from MongoDB (requireRole); a client never sends a role
//  - a mentor can endorse only up to their own level, and an endorsement is evidence, not a direct score change
//  - self-rated skills are never shown as proof; no contact details leave the server
//  - companies see only students who opted in, only proven skills, and only after the student agrees to an invite
const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const M = require('../models');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/guards');
const { bad, notFound, forbidden, conflict } = require('../utils/httpError');
const { notify, toObjectId, audit } = require('../utils/helpers');
const { computeReadiness, levelsFromEvidence } = require('../services/readiness');
const { badgeList, weekStreak } = require('../services/progress');
const S = require('../services/startup');

const DHAKA = 6 * 36e5;
const dayStr = (d) => new Date(new Date(d).getTime() + DHAKA).toISOString().slice(0, 10);
const newSlug = () => crypto.randomBytes(9).toString('base64url'); // 12 random characters; not derived from any user data

module.exports = function startupRoutes(auth) {
  const r = express.Router();
  const A = auth.authenticate;
  const student = [A, requireRole('student')];
  const mentor = [A, requireRole('mentor')];
  const employer = [A, requireRole('employer')];
  const oid = (x) => toObjectId(String(x));

  // ---------- shared loaders ----------
  async function passportData(userId) {
    const [user, evidence, skills, projects, github, doc, sprints] = await Promise.all([
      M.User.findById(userId).lean(),
      M.SkillEvidence.find({ studentId: userId }).lean(),
      M.Skill.find().lean(),
      M.PortfolioProject.find({ studentId: userId }).lean(),
      M.GithubLink.findOne({ userId }).lean(),
      M.Passport.findOne({ userId }).lean(),
      M.Sprint.find({ studentId: userId }).lean(),
    ]);
    if (!user) return null;
    const uni = user.universityId ? await M.University.findById(user.universityId).select('name shortName city').lean() : null;
    const reviewOf = (p) => {
      const ids = (p.evidenceIds || []).map(String);
      const mine = evidence.filter((e) => ids.includes(String(e._id)));
      return mine.some((e) => e.reviewStatus === 'endorsed') ? 'endorsed' : mine.some((e) => e.reviewStatus === 'needs_work') ? 'needs_work' : mine.some((e) => e.reviewStatus === 'requested') ? 'requested' : 'none';
    };
    const [sessionsDone, apps, mocks, doneTasks, cvs] = await Promise.all([
      M.Session.countDocuments({ studentId: userId, status: 'completed' }),
      M.Application.countDocuments({ studentId: userId }),
      M.MockInterview.countDocuments({ studentId: userId, status: 'done' }),
      M.Task.find({ studentId: userId, status: 'done', completedAt: { $ne: null } }).select('completedAt').lean(),
      M.CvVersion.find({ studentId: userId, 'reviewComments.0': { $exists: true } }).limit(1).lean(),
    ]);
    const badges = badgeList({ sessionsDone, quizEvidence: evidence.filter((e) => e.type === 'quiz').length, streakWeeks: weekStreak(doneTasks.map((t) => t.completedAt)), applications: apps, projectEvidence: evidence.filter((e) => e.type === 'project').length, cvReviewed: cvs.length > 0, mocksDone: mocks, readiness: 0 });
    const skillName = new Map(skills.map((s) => [s.key, s]));
    const sprintRows = sprints.map((x) => ({ ...x, titleEn: x.titleEn || (skillName.get(x.skillKey) || {}).nameEn, titleBn: x.titleBn || (skillName.get(x.skillKey) || {}).nameBn }));
    return { user, uni, evidence, skills, projects: projects.map((p) => ({ ...p, review: reviewOf(p) })), github, doc, badges, sprints: sprintRows };
  }
  const viewFrom = (d, forOwnerOrPublic = true) => S.passportView({ user: d.user, university: d.uni, evidence: d.evidence, skills: d.skills, projects: d.projects, github: d.github, badges: d.badges, sprints: d.sprints, show: d.doc && d.doc.show, headline: d.doc && d.doc.headline, forOwnerOrPublic });

  // ================= 1. CAREER PASSPORT =================
  r.get('/me/passport', ...student, async (req, res) => {
    const d = await passportData(req.user._id);
    const doc = d.doc || {};
    res.json({
      settings: { enabled: !!doc.enabled, talentPool: !!doc.talentPool, headline: doc.headline || '', show: { ...S.DEFAULT_SHOW, ...(doc.show || {}) }, slug: doc.enabled ? doc.slug : null, views: doc.views || 0 },
      view: viewFrom({ ...d, doc: { ...doc, show: S.DEFAULT_SHOW } }), // the owner always sees everything; "show" decides what OTHERS see
      publicView: viewFrom(d),
      selfRatedOnly: [...new Set(d.evidence.filter((e) => e.type === 'self').map((e) => e.skillKey))].filter((k) => !d.evidence.some((e) => e.skillKey === k && e.type !== 'self')).map((k) => { const s = d.skills.find((x) => x.key === k) || {}; return { skillKey: k, nameEn: s.nameEn || k, nameBn: s.nameBn || k }; }),
    });
  });

  const passportBody = z.object({
    enabled: z.boolean().optional(), talentPool: z.boolean().optional(), headline: z.string().trim().max(80).optional(),
    show: z.object({ skills: z.boolean(), projects: z.boolean(), endorsements: z.boolean(), github: z.boolean(), badges: z.boolean(), sprints: z.boolean() }).partial().strict().optional(),
  }).strict();
  r.put('/me/passport', ...student, validate(passportBody), async (req, res) => {
    const b = req.body;
    if ((b.enabled || b.talentPool) && req.user.verificationStatus !== 'verified') throw bad('NOT_VERIFIED', 'Verify your account before you share a passport.');
    let doc = await M.Passport.findOne({ userId: req.user._id });
    if (!doc) doc = new M.Passport({ userId: req.user._id });
    if (b.enabled !== undefined) doc.enabled = b.enabled;
    if (b.talentPool !== undefined) doc.talentPool = b.talentPool;
    if (b.headline !== undefined) doc.headline = b.headline;
    if (b.show) doc.show = { ...(doc.show && doc.show.toObject ? doc.show.toObject() : doc.show || {}), ...b.show };
    if ((doc.enabled) && !doc.slug) doc.slug = newSlug();
    await doc.save();
    res.json({ enabled: doc.enabled, talentPool: doc.talentPool, slug: doc.enabled ? doc.slug : null });
  });
  // A new link makes the old one stop working (for example after you shared it by mistake).
  r.post('/me/passport/rotate', ...student, async (req, res) => {
    const doc = await M.Passport.findOne({ userId: req.user._id });
    if (!doc || !doc.enabled) throw bad('NOT_SHARED', 'Switch sharing on first.');
    doc.slug = newSlug(); await doc.save();
    res.json({ slug: doc.slug });
  });

  // Public, no sign-in. Returns ONLY what the owner chose to show. Disabled or unknown links look identical (404).
  async function publicByslug(slug) {
    if (!/^[A-Za-z0-9_-]{8,24}$/.test(String(slug))) return null;
    const doc = await M.Passport.findOne({ slug, enabled: true });
    if (!doc) return null;
    const d = await passportData(doc.userId);
    if (!d || d.user.verificationStatus !== 'verified' || d.user.deletedAt) return null;
    M.Passport.updateOne({ _id: doc._id }, { $inc: { views: 1 }, $set: { lastViewedAt: new Date() } }).catch(() => {});
    return viewFrom(d);
  }
  r.get('/public/passport/:slug', async (req, res) => {
    const v = await publicByslug(req.params.slug);
    if (!v) throw notFound('This passport is not available.');
    res.set('Cache-Control', 'no-store'); res.json(v);
  });

  // ================= 2. MENTOR SPRINT =================
  const sprintOut = (s) => ({ id: s._id, skillKey: s.skillKey, titleEn: s.titleEn, titleBn: s.titleBn, status: s.status, startedAt: s.startedAt, dayIndex: S.sprintDayIndex(s), days: s.days, proofUrl: s.proofUrl || null, proofNote: s.proofNote || '', mentorId: s.mentorId || null, review: s.review && s.review.decision ? s.review : null, badge: !!s.badge });

  r.get('/me/sprints', ...student, async (req, res) => {
    const list = await M.Sprint.find({ studentId: req.user._id }).sort({ createdAt: -1 }).limit(20).lean();
    const accepted = await M.MentorRequest.find({ studentId: req.user._id, status: 'accepted' }).select('mentorId').lean();
    const mentors = await M.User.find({ _id: { $in: accepted.map((a) => a.mentorId) } }).select('displayName').lean();
    const quizzes = await M.Quiz.find().select('skillKey').lean();
    const skills = await M.Skill.find({ key: { $in: quizzes.map((q) => q.skillKey) } }).select('key nameEn nameBn').lean();
    res.json({ sprints: list.map(sprintOut), mentors: mentors.map((m) => ({ id: m._id, name: S.nameOf(m.displayName) })), skills: skills.map((s) => ({ skillKey: s.key, nameEn: s.nameEn, nameBn: s.nameBn })) });
  });

  r.post('/me/sprints', ...student, validate(z.object({ skillKey: z.string().min(1).max(40), mentorId: z.string().optional() }).strict()), async (req, res) => {
    if (await M.Sprint.findOne({ studentId: req.user._id, status: { $in: ['active', 'submitted', 'needs_work'] } })) throw conflict('SPRINT_OPEN', 'Finish or stop your current sprint first.');
    const skill = await M.Skill.findOne({ key: req.body.skillKey }).lean();
    if (!skill) throw notFound('Unknown skill.');
    let mentorId = null;
    if (req.body.mentorId) {
      oid(req.body.mentorId);
      if (!(await M.MentorRequest.findOne({ studentId: req.user._id, mentorId: req.body.mentorId, status: 'accepted' }))) throw bad('NO_MENTOR', 'Choose a mentor who accepted your request.');
      mentorId = req.body.mentorId;
    }
    // Use the student's weakest quiz topics (if any) to shape days 2 and 3.
    const weak = [];
    const dash = await M.Quiz.findOne({ skillKey: skill.key }).select('questions.topic').lean();
    if (dash) for (const q of dash.questions || []) if (q.topic && !weak.includes(q.topic)) weak.push(q.topic);
    const sprint = await M.Sprint.create({ studentId: req.user._id, mentorId, skillKey: skill.key, titleEn: `${skill.nameEn} sprint`, titleBn: `${skill.nameBn} স্প্রিন্ট`, days: S.sprintDays(skill, weak.slice(0, 2)) });
    res.status(201).json(sprintOut(sprint));
  });

  r.patch('/me/sprints/:id/days/:n', ...student, validate(z.object({ done: z.boolean() }).strict()), async (req, res) => {
    oid(req.params.id);
    const sp = await M.Sprint.findOne({ _id: req.params.id, studentId: req.user._id });
    if (!sp) throw notFound('Sprint not found.');
    if (!['active', 'needs_work'].includes(sp.status)) throw bad('SPRINT_CLOSED', 'This sprint is closed.');
    const day = sp.days.find((d) => d.n === Number(req.params.n));
    if (!day) throw notFound('No such day.');
    // A day can be ticked only when it has arrived (catching up on earlier days is fine). Stops ticking Day 7 on Day 5.
    if (req.body.done && day.n > S.sprintDayIndex(sp)) throw bad('DAY_NOT_YET', `Day ${day.n} opens on day ${day.n} of your sprint. Finish today's task first.`);
    day.done = req.body.done; day.doneAt = req.body.done ? new Date() : undefined;
    await sp.save();
    res.json(sprintOut(sp));
  });

  r.post('/me/sprints/:id/submit', ...student, validate(z.object({ proofUrl: z.string().url().max(300), note: z.string().trim().max(400).optional(), mentorId: z.string().optional() }).strict()), async (req, res) => {
    oid(req.params.id);
    const sp = await M.Sprint.findOne({ _id: req.params.id, studentId: req.user._id });
    if (!sp) throw notFound('Sprint not found.');
    const chk = S.canSubmitSprint(sp, req.body.proofUrl);
    if (!chk.ok) throw bad('CANNOT_SUBMIT', chk.reason);
    const mentorId = req.body.mentorId || sp.mentorId;
    if (!mentorId) throw bad('MENTOR_REQUIRED', 'Choose the mentor who will review your work.');
    oid(mentorId);
    if (!(await M.MentorRequest.findOne({ studentId: req.user._id, mentorId, status: 'accepted' }))) throw bad('NO_MENTOR', 'Choose a mentor who accepted your request.');
    sp.mentorId = mentorId; sp.proofUrl = req.body.proofUrl; sp.proofNote = req.body.note || ''; sp.status = 'submitted';
    await sp.save();
    await notify(mentorId, 'A sprint is ready for your review', `${sp.titleEn}`, 'review');
    res.json(sprintOut(sp));
  });

  r.post('/me/sprints/:id/stop', ...student, async (req, res) => {
    oid(req.params.id);
    const sp = await M.Sprint.findOne({ _id: req.params.id, studentId: req.user._id, status: { $in: ['active', 'needs_work'] } });
    if (!sp) throw notFound('No open sprint.');
    sp.status = 'abandoned'; await sp.save();
    res.json(sprintOut(sp));
  });

  r.get('/mentor/sprint-reviews', ...mentor, async (req, res) => {
    const list = await M.Sprint.find({ mentorId: req.user._id, status: 'submitted' }).sort({ updatedAt: 1 }).lean();
    const users = new Map((await M.User.find({ _id: { $in: list.map((x) => x.studentId) } }).select('displayName').lean()).map((u) => [String(u._id), u]));
    const mp = await M.MentorProfile.findOne({ userId: req.user._id }).lean();
    res.json({ reviews: list.map((x) => ({ ...sprintOut(x), student: S.nameOf((users.get(String(x.studentId)) || {}).displayName), myLevel: (((mp && mp.expertiseSkills) || []).find((e) => e.skillKey === x.skillKey) || {}).level || 0 })) });
  });

  r.post('/mentor/sprints/:id/review', ...mentor, validate(z.object({ decision: z.enum(['endorse', 'needs_work']), level: z.number().int().min(1).max(3).optional(), note: z.string().trim().max(400).optional() }).strict()), async (req, res) => {
    oid(req.params.id);
    const sp = await M.Sprint.findOne({ _id: req.params.id, mentorId: req.user._id, status: 'submitted' });
    if (!sp) throw notFound('No sprint waiting for you.');
    // Only a mentor with an accepted request from this student may review (it can change after submission).
    if (!(await M.MentorRequest.findOne({ mentorId: req.user._id, studentId: sp.studentId, status: 'accepted' }))) throw forbidden('You can only review students whose request you accepted.');
    const note = req.body.note || '';
    if (req.body.decision === 'endorse') {
      const mp = await M.MentorProfile.findOne({ userId: req.user._id }).lean();
      const mine = ((mp && mp.expertiseSkills) || []).find((e) => e.skillKey === sp.skillKey);
      const lv = S.endorseLevel(req.body.level || 1, mine && mine.level);
      if (!lv.ok) throw bad('ABOVE_YOUR_LEVEL', 'You can only endorse up to your own level in this skill.');
      await M.SkillEvidence.create({ studentId: sp.studentId, skillKey: sp.skillKey, type: 'endorsement', level: lv.level, endorsedBy: req.user._id, url: sp.proofUrl });
      sp.status = 'completed'; sp.badge = true; sp.review = { decision: 'endorse', level: lv.level, note, at: new Date() };
    } else {
      sp.status = 'needs_work'; sp.review = { decision: 'needs_work', note, at: new Date() };
    }
    await sp.save();
    await notify(sp.studentId, req.body.decision === 'endorse' ? 'Sprint complete: your mentor endorsed your work' : 'Your mentor asked for a little more work', note || sp.titleEn, 'review');
    await audit(req.user._id, `sprint_${req.body.decision}`, 'sprint', sp._id);
    res.json(sprintOut(sp));
  });

  // ================= 3. DAILY BRIEF =================
  r.get('/me/brief', ...student, async (req, res) => {
    const now = new Date();
    const uid = req.user._id;
    const [prof, evidence, skills, nextSession, sprint, tasks, jobs] = await Promise.all([
      M.StudentProfile.findOne({ userId: uid }).lean(),
      M.SkillEvidence.find({ studentId: uid }).lean(),
      M.Skill.find().lean(),
      M.Session.findOne({ studentId: uid, status: 'scheduled', startsAt: { $gt: now } }).sort({ startsAt: 1 }).lean(),
      M.Sprint.findOne({ studentId: uid, status: { $in: ['active', 'needs_work', 'submitted'] } }).lean(),
      M.Task.find({ studentId: uid }).lean(),
      M.Opportunity.find({ status: 'approved', closed: { $ne: true }, applicationDeadline: { $gt: now, $lt: new Date(now.getTime() + 3 * 864e5) } }).limit(10).lean(),
    ]);
    const levels = levelsFromEvidence(evidence);
    let topGap = null, readiness = null;
    const role = prof && prof.careerGoalRoleKey ? await M.RoleTemplate.findOne({ key: prof.careerGoalRoleKey }).lean() : null;
    if (role) {
      const out = computeReadiness({ role, evidence, skills, weeklyHours: prof.weeklyHours });
      readiness = out.readiness;
      const quizzes = new Set((await M.Quiz.find().select('skillKey').lean()).map((q) => q.skillKey));
      const g = out.gaps.find((x) => quizzes.has(x.skillKey));
      if (g) topGap = { skillKey: g.skillKey, nameEn: g.nameEn || g.skillKey, nameBn: g.nameBn || g.skillKey, hasProof: !!(levels[g.skillKey] && levels[g.skillKey].nonSelf) };
    }
    let nextSess = null;
    if (nextSession) { const mu = await M.User.findById(nextSession.mentorId).select('displayName').lean(); nextSess = { at: nextSession.startsAt, mentor: S.nameOf(mu && mu.displayName) }; }
    const open = tasks.filter((t) => t.status === 'todo' && t.dueDate).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
    const dueTask = open && new Date(open.dueDate).getTime() - now.getTime() < 48 * 36e5 ? { title: open.title, overdue: new Date(open.dueDate) < now } : null;
    let closingJob = null;
    for (const o of jobs) {
      const req2 = o.requiredSkills || []; if (!req2.length) continue;
      const fit = Math.round((100 * req2.reduce((t, s) => t + Math.min(((levels[s.skillKey] || {}).level || 0) / (s.requiredLevel || 1), 1), 0)) / req2.length);
      if (fit >= 50 && (!closingJob || fit > closingJob.fit)) closingJob = { id: o._id, title: o.title, fit, daysLeft: Math.max(1, Math.ceil((new Date(o.applicationDeadline) - now) / 864e5)) };
    }
    // Day streak: calendar days (Asia/Dhaka) with a finished task or a finished sprint day.
    const days = new Set();
    for (const t of tasks) if (t.status === 'done' && t.completedAt) days.add(dayStr(t.completedAt));
    const allSprints = await M.Sprint.find({ studentId: uid }).select('days').lean();
    for (const s of allSprints) for (const d of s.days || []) if (d.done && d.doneAt) days.add(dayStr(d.doneAt));
    let streakDays = 0, off = days.has(dayStr(now)) ? 0 : 1;
    while (days.has(dayStr(new Date(now.getTime() - off * 864e5)))) { streakDays += 1; off += 1; }
    const brief = S.dailyBrief({ hasGoal: !!(prof && prof.careerGoalRoleKey), nextSession: nextSess, sprint: sprint ? { ...sprintOut(sprint), status: sprint.status } : null, dueTask, topGap, closingJob, streakDays }, now);
    res.json({ ...brief, readiness, note: 'The move is chosen by fixed rules: session soon, open sprint day, due task, unproven top gap, closing job.' });
  });

  r.get('/me/week-card', ...student, async (req, res) => {
    const uid = req.user._id, since = new Date(Date.now() - 7 * 864e5);
    const [tasks, sprints, quizzes, snaps, d] = await Promise.all([
      M.Task.countDocuments({ studentId: uid, status: 'done', completedAt: { $gte: since } }),
      M.Sprint.find({ studentId: uid }).select('days').lean(),
      M.SkillEvidence.countDocuments({ studentId: uid, type: 'quiz', createdAt: { $gte: since } }),
      M.ProgressSnapshot.find({ studentId: uid }).sort({ day: 1 }).lean(),
      passportData(uid),
    ]);
    const sprintDaysDone = sprints.reduce((t, s) => t + (s.days || []).filter((x) => x.done && x.doneAt && new Date(x.doneAt) >= since).length, 0);
    const old = snaps.filter((s) => new Date(s.day) <= since).pop();
    const now = snaps[snaps.length - 1];
    const v = viewFrom(d);
    res.json(S.weekCard({ name: v.name, tasksDone: tasks, sprintDays: sprintDaysDone, quizzes, proofStrength: v.proofStrength, readinessNow: now ? now.percent : null, readinessWeekAgo: old ? old.percent : null }));
  });

  // ================= 4. EMPLOYER TALENT POOL =================
  async function orgContext(req, _res, next) {
    const m = await M.OrganizationMember.findOne({ userId: req.user._id, status: 'active' });
    const org = m && (await M.Organization.findById(m.organizationId));
    if (!org || org.verificationStatus !== 'verified') throw forbidden('Your company is not verified.');
    req.org = org; next();
  }

  r.get('/employer/talent', ...employer, orgContext, async (req, res) => {
    const wanted = S.parseWanted(req.query.skills);
    if (!wanted.length) throw bad('SKILLS_REQUIRED', 'Add 1 to 6 skills, for example skills=sql:2,python:1.');
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
    const pool = await M.Passport.find({ talentPool: true }).select('userId headline show').lean();
    const users = await M.User.find({ _id: { $in: pool.map((p) => p.userId) }, role: 'student', verificationStatus: 'verified', deletedAt: { $exists: false } }).select('_id').lean();
    const ok = new Set(users.map((u) => String(u._id)));
    const cards = [];
    for (const p of pool.filter((x) => ok.has(String(x.userId)))) {
      const d = await passportData(p.userId);
      if (!d) continue;
      const v = viewFrom(d);
      const m = S.talentMatch(v.skills, wanted);
      if (m.matched.length === 0) continue;
      cards.push({ talentId: String(p.userId), name: v.name, university: v.university && v.university.shortName, department: v.department, headline: v.headline, proofStrength: v.proofStrength, matchPct: m.pct, matched: m.matched, notProven: m.notProven, projects: v.projects.length });
    }
    cards.sort((a, b) => b.matchPct - a.matchPct || b.proofStrength - a.proofStrength);
    res.json({ wanted, total: cards.length, page, cards: cards.slice((page - 1) * 20, page * 20), note: 'Only students who opted in appear. Skills count only when proven (quiz, reviewed project or endorsement). "Not proven" does not mean "does not know it". No contact details are shown.' });
  });

  r.post('/employer/talent/:talentId/invite', ...employer, orgContext, validate(z.object({ opportunityId: z.string().optional(), message: z.string().trim().max(300).optional() }).strict()), async (req, res) => {
    oid(req.params.talentId);
    const doc = await M.Passport.findOne({ userId: req.params.talentId, talentPool: true });
    if (!doc) throw notFound('This student is not in the talent pool.');
    const st = await M.User.findOne({ _id: req.params.talentId, role: 'student', verificationStatus: 'verified' }).lean();
    if (!st || (st.blockedBy || []).map(String).includes(String(req.user._id))) throw notFound('This student is not in the talent pool.');
    let opportunityId;
    if (req.body.opportunityId) {
      oid(req.body.opportunityId);
      const o = await M.Opportunity.findOne({ _id: req.body.opportunityId, organizationId: req.org._id, status: 'approved', closed: { $ne: true } });
      if (!o) throw bad('BAD_JOB', 'Choose one of your approved, open jobs.');
      opportunityId = o._id;
    }
    // Daily limit per company so invitations cannot be used to spam students.
    const since = new Date(Date.now() - 864e5);
    if ((await M.TalentInvite.countDocuments({ organizationId: req.org._id, createdAt: { $gte: since } })) >= 20) throw conflict('INVITE_LIMIT', 'You reached today\'s limit of 20 invitations.');
    let inv;
    try { inv = await M.TalentInvite.create({ studentId: req.params.talentId, organizationId: req.org._id, invitedBy: req.user._id, opportunityId, message: req.body.message || '' }); }
    catch (e) { if (e.code === 11000) throw conflict('ALREADY_INVITED', 'You already invited this student.'); throw e; }
    await notify(req.params.talentId, `${req.org.name} would like to talk to you`, req.body.message || 'A verified company found your proof on MentorLink.', 'invite');
    res.status(201).json({ id: inv._id, status: inv.status });
  });

  r.get('/employer/invites', ...employer, orgContext, async (req, res) => {
    const list = await M.TalentInvite.find({ organizationId: req.org._id }).sort({ createdAt: -1 }).limit(50).lean();
    const users = new Map((await M.User.find({ _id: { $in: list.map((i) => i.studentId) } }).select('displayName').lean()).map((u) => [String(u._id), u]));
    res.json({ invites: list.map((i) => ({ id: i._id, student: S.nameOf((users.get(String(i.studentId)) || {}).displayName), status: i.status, message: i.message, at: i.createdAt, respondedAt: i.respondedAt || null })) });
  });

  // ---- student side of invitations ----
  r.get('/me/invites', ...student, async (req, res) => {
    const list = await M.TalentInvite.find({ studentId: req.user._id }).sort({ createdAt: -1 }).limit(30).lean();
    const orgs = new Map((await M.Organization.find({ _id: { $in: list.map((i) => i.organizationId) } }).select('name industry city website verificationStatus').lean()).map((o) => [String(o._id), o]));
    const opps = new Map((await M.Opportunity.find({ _id: { $in: list.filter((i) => i.opportunityId).map((i) => i.opportunityId) } }).select('title').lean()).map((o) => [String(o._id), o]));
    res.json({ invites: list.map((i) => { const o = orgs.get(String(i.organizationId)) || {}; return { id: i._id, company: o.name, industry: o.industry, city: o.city, verified: o.verificationStatus === 'verified', job: i.opportunityId ? { id: i.opportunityId, title: (opps.get(String(i.opportunityId)) || {}).title } : null, message: i.message, status: i.status, at: i.createdAt }; }) });
  });
  r.post('/me/invites/:id/respond', ...student, validate(z.object({ accept: z.boolean() }).strict()), async (req, res) => {
    oid(req.params.id);
    const inv = await M.TalentInvite.findOne({ _id: req.params.id, studentId: req.user._id, status: 'pending' });
    if (!inv) throw notFound('No pending invitation.');
    inv.status = req.body.accept ? 'accepted' : 'declined'; inv.respondedAt = new Date(); await inv.save();
    await notify(inv.invitedBy, req.body.accept ? 'A student accepted your invitation' : 'A student declined your invitation', '', 'invite');
    res.json({ status: inv.status });
  });


  // Public page for the QR code / link. Plain HTML, no scripts, everything escaped. Mounted at /p/:slug by app.js.
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  r.page = async (req, res) => {
    const v = await publicByslug(req.params.slug);
    res.set('Cache-Control', 'no-store'); res.set('X-Robots-Tag', 'noindex, nofollow');
    if (!v) { res.status(404).type('html').send('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not available</title><body style="font-family:system-ui;padding:32px"><h2>This passport is not available</h2><p>The link may have been switched off by its owner.</p></body>'); return; }
    const chips = v.skills.map((s) => `<li><b>${esc(s.nameEn)}</b> <span class="mut">${esc(s.nameBn)}</span><span class="lv">${esc(s.levelEn)}</span>${s.endorsed ? '<span class="en">Mentor endorsed</span>' : ''}<small>${esc(s.proof.join(', '))}</small></li>`).join('');
    const projects = v.projects.map((p) => `<li><a href="${/^https:\/\//i.test(p.url) ? esc(p.url) : '#'}" rel="noopener nofollow ugc">${esc(p.title)}</a> <small>${esc(p.review === 'endorsed' ? 'reviewed by a mentor' : 'not reviewed yet')}</small></li>`).join('');
    const badges = v.badges.map((b) => `<span class="bd">${esc(b.titleEn)}</span>`).join('');
    res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(v.name)} - Career Passport</title>
<style>:root{--g:#0A4A39;--s:#F0A21C;--p:#F5F7F3;--i:#15221D}*{box-sizing:border-box}body{margin:0;background:var(--p);color:var(--i);font:16px/1.5 system-ui,sans-serif}header{background:var(--g);color:#fff;padding:28px 20px}main{max-width:640px;margin:0 auto;padding:16px 20px 48px}h1{margin:0;font-size:1.6rem}.sub{opacity:.85}.score{display:inline-block;margin-top:12px;background:var(--s);color:#2a1a00;border-radius:99px;padding:4px 14px;font-weight:700}h2{font-size:1.05rem;margin:24px 0 8px}ul{list-style:none;padding:0;margin:0;display:grid;gap:8px}li{background:#fff;border-radius:14px;padding:12px 14px;box-shadow:0 1px 0 rgba(0,0,0,.06)}.mut{color:#5b6b64}.lv{float:right;background:#e6f2ec;color:var(--g);border-radius:99px;padding:0 10px;font-size:.85rem;font-weight:600}.en{display:inline-block;margin-left:6px;background:#fff3d6;border-radius:99px;padding:0 8px;font-size:.8rem}small{display:block;color:#5b6b64}.bd{display:inline-block;margin:0 6px 6px 0;background:#fff;border-radius:99px;padding:4px 12px;border:1px solid #d9e3dd}a{color:var(--g)}footer{color:#5b6b64;font-size:.85rem;margin-top:28px}</style></head><body>
<header><div class="sub">MentorLink BD · Career Passport</div><h1>${esc(v.name)}</h1><div class="sub">${esc(v.university ? v.university.name : '')}${v.department ? ' · ' + esc(v.department) : ''}</div>${v.headline ? `<p>${esc(v.headline)}</p>` : ''}<span class="score">Proof strength ${esc(v.proofStrength)}/100</span></header>
<main>${v.skills.length ? `<h2>Proven skills</h2><ul>${chips}</ul>` : ''}${v.projects.length ? `<h2>Projects</h2><ul>${projects}</ul>` : ''}${v.github ? `<h2>GitHub</h2><p><a href="${esc(v.github.url)}" rel="noopener nofollow ugc">${esc(v.github.username)}</a> (ownership checked)</p>` : ''}${badges ? `<h2>Milestones</h2><div>${badges}</div>` : ''}
<footer>${esc(v.note)}<br>Proof strength is a simple count of proven skills, endorsements, projects and finished sprints. It is not a prediction of job success.</footer></main></body></html>`);
  };

  return r;
};
