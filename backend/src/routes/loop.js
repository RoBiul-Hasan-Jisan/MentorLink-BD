// Mentor-in-the-loop career development, gap-to-mentor matching and the career outcome tracker.
//   assess -> plan -> practice -> review -> reassess
// A mentor can ENDORSE evidence (capped at the mentor's own skill level), ask for more work, and re-order or annotate a student's roadmap.
// A mentor can never change a score directly: scores come from evidence, and endorsements are evidence that the student can see.
const express = require('express');
const { z } = require('zod');
const M = require('../models');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/guards');
const { bad, notFound, forbidden, conflict } = require('../utils/httpError');
const { notify, toObjectId, audit, firstNameInitial } = require('../utils/helpers');
const { levelsFromEvidence } = require('../services/readiness');
const jobgap = require('../services/jobgap');
const { levelName } = require('../data/levels');
const { TARGETS } = require('../data/targets');

const K = 5; // groups smaller than this are never shown (privacy)
const HELP = ['technical_interview', 'portfolio_review', 'cv_review', 'roadmap_review', 'career_switch'];
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), h = Math.floor(s.length / 2); return s.length % 2 ? s[h] : Math.round(((s[h - 1] + s[h]) / 2) * 10) / 10; };
const mean = (a) => (a.length ? Math.round((a.reduce((t, x) => t + x, 0) / a.length) * 10) / 10 : null);

module.exports = function loopRoutes(auth) {
  const r = express.Router();
  const A = auth.authenticate;
  const student = [A, requireRole('student')];
  const mentor = [A, requireRole('mentor')];
  const admin = [A, requireRole('admin')];
  const oid = (x) => toObjectId(String(x));

  // A mentor may only work with students who have an ACCEPTED request with them.
  async function mustBeMentee(mentorUser, studentId) {
    oid(studentId);
    const rq = await M.MentorRequest.findOne({ mentorId: mentorUser._id, studentId, status: 'accepted' });
    if (!rq) throw forbidden('You can only review students whose request you accepted.');
    return rq;
  }
  const skillNames = async () => new Map((await M.Skill.find().select('key nameEn nameBn').lean()).map((s) => [s.key, s]));

  // ---------- student: ask a mentor to review a project ----------
  r.post('/me/evidence/:id/request-review', ...student, validate(z.object({ mentorId: z.string() }).strict()), async (req, res) => {
    oid(req.params.id); oid(req.body.mentorId);
    const ev = await M.SkillEvidence.findOne({ _id: req.params.id, studentId: req.user._id, type: 'project' });
    if (!ev) throw notFound('Only your own project evidence can be reviewed.');
    if (!(await M.MentorRequest.findOne({ mentorId: req.body.mentorId, studentId: req.user._id, status: 'accepted' }))) throw bad('NO_MENTOR', 'Choose a mentor who accepted your request.');
    ev.reviewStatus = 'requested'; ev.reviewMentorId = req.body.mentorId; await ev.save();
    await notify(req.body.mentorId, 'Project review requested', `${req.user.displayName} asked you to review a ${ev.skillKey} project.`, 'review');
    res.json({ ok: true });
  });

  // ---------- mentor: review queue, pack, endorse, advise ----------
  r.get('/mentor/review-queue', ...mentor, async (req, res) => {
    const asks = await M.SkillEvidence.find({ reviewMentorId: req.user._id, reviewStatus: 'requested' }).sort({ createdAt: 1 }).lean();
    const users = new Map((await M.User.find({ _id: { $in: asks.map((a) => a.studentId) } }).select('displayName').lean()).map((u) => [String(u._id), u]));
    const names = await skillNames();
    const mentees = await M.MentorRequest.find({ mentorId: req.user._id, status: 'accepted' }).select('studentId').lean();
    const mu = new Map((await M.User.find({ _id: { $in: mentees.map((m) => m.studentId) } }).select('displayName').lean()).map((u) => [String(u._id), u]));
    res.json({
      reviews: asks.map((a) => ({ evidenceId: a._id, studentId: a.studentId, student: firstNameInitial((users.get(String(a.studentId)) || {}).displayName), skillKey: a.skillKey, skillEn: (names.get(a.skillKey) || {}).nameEn || a.skillKey, skillBn: (names.get(a.skillKey) || {}).nameBn || a.skillKey, level: a.level, url: a.url || null, askedAt: a.createdAt })),
      mentees: mentees.map((m) => ({ studentId: m.studentId, name: firstNameInitial((mu.get(String(m.studentId)) || {}).displayName) })),
    });
  });

  r.get('/mentees/:studentId/review-pack', ...mentor, async (req, res) => {
    await mustBeMentee(req.user, req.params.studentId);
    const sid = req.params.studentId;
    const [u, prof, ev, snaps, reviews] = await Promise.all([
      M.User.findById(sid).select('displayName department').lean(), M.StudentProfile.findOne({ userId: sid }).lean(),
      M.SkillEvidence.find({ studentId: sid }).sort({ createdAt: -1 }).lean(), M.ProgressSnapshot.find({ studentId: sid }).sort({ day: 1 }).lean(),
      M.MentorReview.find({ studentId: sid, mentorId: req.user._id }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);
    const names = await skillNames();
    const levels = levelsFromEvidence(ev);
    const role = prof && prof.careerGoalRoleKey ? await M.RoleTemplate.findOne({ key: prof.careerGoalRoleKey }).lean() : null;
    const gaps = role ? role.requiredSkills.filter((rs) => ((levels[rs.skillKey] || {}).level || 0) < rs.requiredLevel).map((rs) => ({ skillKey: rs.skillKey, nameEn: (names.get(rs.skillKey) || {}).nameEn || rs.skillKey, nameBn: (names.get(rs.skillKey) || {}).nameBn || rs.skillKey, have: (levels[rs.skillKey] || {}).level || 0, need: rs.requiredLevel })) : [];
    const selected = (prof && prof.selectedTargets) || [];
    const targets = [];
    for (const k of selected) {
      const t = TARGETS.find((x) => x.key === k); if (!t) continue;
      const done = new Set((await M.RoadmapProgress.find({ studentId: sid, skillKey: `target:${k}` }).lean()).map((p) => p.topicKey));
      targets.push({ key: k, titleEn: t.titleEn, titleBn: t.titleBn, topics: t.topics.map((x) => ({ key: x.key, titleEn: x.titleEn, titleBn: x.titleBn, known: done.has(x.key) })) });
    }
    res.json({
      student: { id: sid, name: firstNameInitial(u && u.displayName), department: u && u.department, goalRoleKey: prof && prof.careerGoalRoleKey },
      readinessHistory: snaps.map((s) => ({ day: s.day, percent: s.percent })), gaps,
      evidence: ev.map((e) => ({ id: e._id, skillKey: e.skillKey, skillEn: (names.get(e.skillKey) || {}).nameEn || e.skillKey, type: e.type, level: e.level, url: e.url || null, reviewStatus: e.reviewStatus, at: e.createdAt })),
      targets, myReviews: reviews.map((x) => ({ id: x._id, kind: x.kind, decision: x.decision, action: x.action, skillKey: x.skillKey, topicKey: x.topicKey, targetKey: x.targetKey, note: x.note, at: x.createdAt })),
    });
  });

  r.post('/mentees/:studentId/evidence/:evId/review', ...mentor, validate(z.object({ decision: z.enum(['endorse', 'needs_work']), level: z.number().int().min(1).max(3).optional(), note: z.string().trim().max(400).optional() }).strict()), async (req, res) => {
    await mustBeMentee(req.user, req.params.studentId); oid(req.params.evId);
    const ev = await M.SkillEvidence.findOne({ _id: req.params.evId, studentId: req.params.studentId, type: 'project' });
    if (!ev) throw notFound('Project evidence not found.');
    const note = req.body.note || '';
    if (req.body.decision === 'endorse') {
      const level = req.body.level || ev.level;
      const mp = await M.MentorProfile.findOne({ userId: req.user._id }).lean();
      const mine = ((mp && mp.expertiseSkills) || []).find((e) => e.skillKey === ev.skillKey);
      if (!mine || mine.level < level) throw bad('ABOVE_YOUR_LEVEL', 'You can only endorse up to your own level in this skill.');
      await M.SkillEvidence.create({ studentId: ev.studentId, skillKey: ev.skillKey, type: 'endorsement', level, endorsedBy: req.user._id, url: ev.url });
      ev.reviewStatus = 'endorsed';
    } else { ev.reviewStatus = 'needs_work'; }
    await ev.save();
    await M.MentorReview.create({ studentId: ev.studentId, mentorId: req.user._id, kind: 'evidence', evidenceId: ev._id, skillKey: ev.skillKey, decision: req.body.decision, level: req.body.level || ev.level, note });
    await notify(ev.studentId, req.body.decision === 'endorse' ? 'Your project was endorsed' : 'Your project needs a little more work', note || ev.skillKey, 'review');
    await audit(req.user._id, `evidence_${req.body.decision}`, 'evidence', ev._id);
    res.status(201).json({ ok: true, reviewStatus: ev.reviewStatus });
  });

  // Roadmap advice changes ORDER and adds notes only. It does not tick topics or change any score.
  r.post('/mentees/:studentId/advice', ...mentor, validate(z.object({ targetKey: z.string().max(40), topicKey: z.string().max(40).optional(), action: z.enum(['prioritize', 'deprioritize', 'note']), note: z.string().trim().max(400).optional() }).strict()), async (req, res) => {
    await mustBeMentee(req.user, req.params.studentId);
    const t = TARGETS.find((x) => x.key === req.body.targetKey);
    if (!t) throw notFound('Unknown target.');
    if (req.body.topicKey && !t.topics.some((x) => x.key === req.body.topicKey)) throw notFound('Unknown topic.');
    if (req.body.action !== 'note' && !req.body.topicKey) throw bad('TOPIC_REQUIRED', 'Choose the topic you want to move.');
    if (req.body.action === 'note' && !(req.body.note || '').trim()) throw bad('NOTE_REQUIRED', 'Write the note.');
    const a = await M.MentorReview.create({ studentId: req.params.studentId, mentorId: req.user._id, kind: 'advice', targetKey: t.key, topicKey: req.body.topicKey, action: req.body.action, note: req.body.note || '' });
    await notify(req.params.studentId, 'Your mentor updated your roadmap advice', `${t.titleEn}`, 'review');
    res.status(201).json({ id: a._id });
  });

  // ---------- student: what mentors said ----------
  r.get('/me/reviews', ...student, async (req, res) => {
    const list = await M.MentorReview.find({ studentId: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
    const mu = new Map((await M.User.find({ _id: { $in: list.map((x) => x.mentorId) } }).select('displayName').lean()).map((u) => [String(u._id), u]));
    const names = await skillNames();
    await M.MentorReview.updateMany({ studentId: req.user._id, seenByStudent: false }, { seenByStudent: true });
    res.json({ reviews: list.map((x) => ({ id: x._id, kind: x.kind, mentor: firstNameInitial((mu.get(String(x.mentorId)) || {}).displayName), mentorId: x.mentorId, decision: x.decision, level: x.level, skillKey: x.skillKey, skillEn: x.skillKey ? (names.get(x.skillKey) || {}).nameEn || x.skillKey : null, targetKey: x.targetKey, topicKey: x.topicKey, action: x.action, note: x.note, at: x.createdAt, isNew: !x.seenByStudent })) });
  });

  // ---------- the cycle: assess -> plan -> practice -> review -> reassess ----------
  async function loopFor(user) {
    const day = 864e5, now = Date.now();
    const [prof, snaps, doneTasks, reviews] = await Promise.all([
      M.StudentProfile.findOne({ userId: user._id }).lean(), M.ProgressSnapshot.find({ studentId: user._id }).sort({ day: 1 }).lean(),
      M.Task.countDocuments({ studentId: user._id, status: 'done', completedAt: { $gt: new Date(now - 14 * day) } }), M.MentorReview.find({ studentId: user._id }).sort({ createdAt: -1 }).limit(1).lean(),
    ]);
    const lastReview = reviews[0];
    const assess = snaps.length > 0;
    const plan = !!(prof && ((prof.selectedTargets || []).length || prof.careerGoalRoleKey));
    const practice = doneTasks > 0;
    const review = !!lastReview;
    const reassess = !!(lastReview && snaps.some((s) => new Date(`${s.day}T23:59:59Z`) > lastReview.createdAt));
    const steps = [['assess', assess], ['plan', plan], ['practice', practice], ['review', review], ['reassess', reassess]];
    const current = (steps.find(([, d]) => !d) || ['assess'])[0];
    const before = lastReview ? ([...snaps].reverse().find((s) => new Date(`${s.day}T00:00:00Z`) <= lastReview.createdAt) || snaps[0]) : null;
    return { steps: steps.map(([key, done]) => ({ key, done, current: key === current })), current, readinessAtLastReview: before ? before.percent : null, readinessNow: snaps.length ? snaps[snaps.length - 1].percent : null };
  }
  r.get('/me/loop', ...student, async (req, res) => res.json(await loopFor(req.user)));

  // ---------- gap-to-mentor: mentors for ONE specific gap, with the evidence for each claim ----------
  r.get('/me/gaps/:skillKey/mentors', ...student, async (req, res) => {
    const skill = await M.Skill.findOne({ key: req.params.skillKey }).lean();
    if (!skill) throw notFound('Unknown skill.');
    const focus = String(req.query.focus || '');
    if (focus && !HELP.includes(focus)) throw bad('UNKNOWN_FOCUS', 'Unknown kind of help.');
    const prof = (await M.StudentProfile.findOne({ userId: req.user._id }).lean()) || {};
    const blocked = new Set([...(req.user.blockedBy || []), ...(prof.dismissedMentors || [])].map(String));
    const users = await M.User.find({ role: 'mentor', verificationStatus: 'verified' }).select('displayName blockedBy').lean();
    const profiles = new Map((await M.MentorProfile.find({ userId: { $in: users.map((u) => u._id) }, paused: { $ne: true } }).lean()).map((p) => [String(p.userId), p]));
    const endorsed = new Map((await M.MentorReview.aggregate([{ $match: { kind: 'evidence', decision: 'endorse', skillKey: skill.key } }, { $group: { _id: '$mentorId', n: { $sum: 1 } } }])).map((x) => [String(x._id), x.n]));
    const journeys = new Map((await M.Journey.find({ shared: true }).lean()).map((j) => [String(j.mentorId), j]));
    const open = new Map((await M.MentorRequest.aggregate([{ $match: { status: 'pending' } }, { $group: { _id: '$mentorId', n: { $sum: 1 } } }])).map((x) => [String(x._id), x.n]));
    const out = [];
    for (const u of users) {
      const p = profiles.get(String(u._id));
      if (!p || blocked.has(String(u._id)) || (u.blockedBy || []).map(String).includes(String(req.user._id))) continue;
      const exp = (p.expertiseSkills || []).find((e) => e.skillKey === skill.key);
      const lvl = exp ? exp.level : 0;
      if (!lvl && !(focus && (p.helpsWith || []).includes(focus))) continue; // needs the skill, or the exact kind of help asked for
      const n = endorsed.get(String(u._id)) || 0;
      const j = journeys.get(String(u._id));
      const jm = j ? (j.milestones || []).filter((m) => m.skillKey === skill.key).sort((a, b) => b.level - a.level)[0] : null;
      const spots = Math.max(0, (p.weeklyCapacity || 0) - (p.acceptedRequests || 0) - (open.get(String(u._id)) || 0));
      if (spots <= 0) continue;
      const helps = focus ? (p.helpsWith || []).includes(focus) : false;
      const score = 0.40 * (lvl / 3) + 0.15 * Math.min(1, n / 3) + 0.10 * (jm ? 1 : 0) + 0.10 * ((p.ratingAvg || 0) / 5) + 0.05 * Math.min(1, (p.sessionsCompleted || 0) / 10) + 0.05 * Math.min(1, spots / 3) + 0.15 * (helps ? 1 : 0);
      const evidence = [];
      if (lvl) evidence.push({ kind: 'expertise', en: `Expertise in ${skill.nameEn}: ${levelName(lvl).en} (declared, reviewed at approval)`, bn: `${skill.nameBn} দক্ষতা: ${levelName(lvl).bn} (ঘোষিত)` });
      if (n) evidence.push({ kind: 'endorsements', en: `Endorsed ${n} student project${n > 1 ? 's' : ''} in ${skill.nameEn} on this platform`, bn: `এই প্ল্যাটফর্মে ${skill.nameBn}-এ ${n}টি প্রজেক্ট এন্ডোর্স করেছেন` });
      if (jm) evidence.push({ kind: 'journey', en: `Own journey shows ${skill.nameEn} level ${jm.level} at month ${jm.month}`, bn: `নিজের যাত্রায় মাস ${jm.month}-এ ${skill.nameBn} লেভেল ${jm.level}` });
      if (helps) evidence.push({ kind: 'helps_with', en: `Offers help with: ${focus.replace(/_/g, ' ')}`, bn: `সাহায্য করেন: ${focus.replace(/_/g, ' ')}` });
      if (p.ratingCount >= 3) evidence.push({ kind: 'rating', en: `Rated ${p.ratingAvg.toFixed(1)} from ${p.ratingCount} sessions`, bn: `${p.ratingCount}টি সেশনে রেটিং ${p.ratingAvg.toFixed(1)}` });
      out.push({ mentorId: String(u._id), name: firstNameInitial(u.displayName), roleTitle: p.roleTitle, industry: p.industry, score: Math.round(score * 100), openSpots: spots, helpsWith: p.helpsWith || [], evidence });
    }
    out.sort((a, b) => b.score - a.score);
    res.json({ skill: { key: skill.key, nameEn: skill.nameEn, nameBn: skill.nameBn }, focus: focus || null, mentors: out.slice(0, 5), note: 'Ranked for this one gap. Expertise is declared by the mentor; endorsements and ratings come from this platform.' });
  });

  // ---------- outcome tracker (student's own view) ----------
  r.put('/me/outcome-sharing', ...student, validate(z.object({ on: z.boolean() }).strict()), async (req, res) => {
    await M.User.updateOne({ _id: req.user._id }, { shareOutcomesForResearch: req.body.on });
    res.json({ on: req.body.on });
  });
  r.get('/me/outcome-tracker', ...student, async (req, res) => {
    const sid = req.user._id;
    const [snaps, ev, mocks, apps, sessions, reviews] = await Promise.all([
      M.ProgressSnapshot.find({ studentId: sid }).sort({ day: 1 }).lean(), M.SkillEvidence.find({ studentId: sid }).sort({ createdAt: 1 }).lean(),
      M.MockInterview.find({ studentId: sid, status: 'done' }).sort({ startsAt: 1 }).lean(), M.Application.find({ studentId: sid }).lean(),
      M.Session.countDocuments({ studentId: sid, status: 'completed' }), M.MentorReview.countDocuments({ studentId: sid }),
    ]);
    const names = await skillNames();
    const bySkill = new Map();
    for (const e of ev) { const a = bySkill.get(e.skillKey) || { first: e, latest: e }; if (e.level >= a.latest.level) a.latest = e; bySkill.set(e.skillKey, a); }
    const competencies = [...bySkill.entries()].map(([k, a]) => ({ skillKey: k, nameEn: (names.get(k) || {}).nameEn || k, nameBn: (names.get(k) || {}).nameBn || k, from: a.first.level, to: a.latest.level, change: a.latest.level - a.first.level, proven: ev.some((e) => e.skillKey === k && e.type !== 'self') })).sort((a, b) => b.change - a.change);
    const reached = (a, s) => (a.stageHistory || []).some((h) => s.includes(h.stage));
    const score = (m) => (typeof m.overall === 'number' ? m.overall : null);
    const ms = mocks.map(score).filter((x) => x !== null);
    res.json({
      sharingForResearch: !!req.user.shareOutcomesForResearch,
      readiness: { first: snaps.length ? snaps[0].percent : null, latest: snaps.length ? snaps[snaps.length - 1].percent : null, firstDay: snaps.length ? snaps[0].day : null, latestDay: snaps.length ? snaps[snaps.length - 1].day : null },
      competencies,
      portfolio: ev.filter((e) => e.type === 'project').map((e) => ({ skillKey: e.skillKey, nameEn: (names.get(e.skillKey) || {}).nameEn || e.skillKey, level: e.level, url: e.url || null, reviewStatus: e.reviewStatus, at: e.createdAt })),
      mockInterviews: { count: mocks.length, first: ms.length ? ms[0] : null, latest: ms.length ? ms[ms.length - 1] : null },
      applications: { total: apps.length, interviews: apps.filter((a) => reached(a, ['Interview', 'Offer', 'Hired'])).length, selected: apps.filter((a) => reached(a, ['Offer', 'Hired'])).length },
      mentoring: { sessionsCompleted: sessions, reviewsReceived: reviews },
      loop: await loopFor(req.user),
      note: 'Private to you. Numbers come from your own activity. They show what changed, not what caused it.',
    });
  });

  // ---------- admin: does structured mentoring help? Consenting students only, grouped, small groups hidden ----------
  r.get('/admin/impact', ...admin, async (_q, res) => {
    const students = await M.User.find({ role: 'student', shareOutcomesForResearch: true }).select('_id').lean();
    const ids = students.map((s) => s._id);
    const [snaps, reviewed, sessioned, apps] = await Promise.all([
      M.ProgressSnapshot.find({ studentId: { $in: ids } }).sort({ day: 1 }).lean(), M.MentorReview.distinct('studentId', { studentId: { $in: ids } }),
      M.Session.distinct('studentId', { studentId: { $in: ids }, status: 'completed' }), M.Application.find({ studentId: { $in: ids } }).lean(),
    ]);
    const rev = new Set(reviewed.map(String)), ses = new Set(sessioned.map(String));
    const first = new Map(), last = new Map();
    for (const s of snaps) { const k = String(s.studentId); if (!first.has(k)) first.set(k, s); last.set(k, s); }
    const gapDays = (a, b) => (new Date(b.day) - new Date(a.day)) / 864e5;
    const group = (name, pick) => {
      const members = ids.map(String).filter(pick);
      const deltas = members.filter((k) => first.has(k) && gapDays(first.get(k), last.get(k)) >= 7).map((k) => last.get(k).percent - first.get(k).percent);
      const withApps = members.filter((k) => apps.some((a) => String(a.studentId) === k));
      const interviewed = withApps.filter((k) => apps.some((a) => String(a.studentId) === k && (a.stageHistory || []).some((h) => ['Interview', 'Offer', 'Hired'].includes(h.stage))));
      const enough = members.length >= K;
      return { group: name, students: enough ? members.length : null, measuredStudents: enough ? deltas.length : null, medianReadinessChange: enough && deltas.length >= K ? median(deltas) : null, meanReadinessChange: enough && deltas.length >= K ? mean(deltas) : null, interviewRate: enough && withApps.length >= K ? Math.round((100 * interviewed.length) / withApps.length) : null, hidden: !enough ? `Fewer than ${K} students: hidden to protect privacy.` : undefined };
    };
    res.json({
      consentingStudents: ids.length >= K ? ids.length : null,
      groups: [group('Mentor-reviewed (project or roadmap review)', (k) => rev.has(k)), group('Sessions only, no review', (k) => !rev.has(k) && ses.has(k)), group('No mentoring yet', (k) => !rev.has(k) && !ses.has(k))],
      caveat: 'Observational. Students who ask for mentoring may differ from those who do not (motivation, time, starting level), so a difference here does not prove mentoring caused it. Use it to decide what to test next, not as a result.',
      note: 'Only students who agreed to share. Groups under 5 are hidden. No names.',
    });
  });


  // ---------- Career Gap Intelligence from real postings ----------
  // For a target role: what the approved, open postings ask for, and where the student's EVIDENCE stands (proven / self-rated only / missing).
  r.get('/me/job-gaps', ...student, async (req, res) => {
    const prof = (await M.StudentProfile.findOne({ userId: req.user._id }).lean()) || {};
    const roleKey = String(req.query.role || prof.careerGoalRoleKey || '');
    const role = roleKey ? await M.RoleTemplate.findOne({ key: roleKey }).lean() : null;
    if (!role) throw bad('NO_ROLE', 'Choose a career goal first.');
    const all = await M.Opportunity.find({ status: 'approved', closed: { $ne: true } }).select('title organization requiredSkills').limit(200).lean();
    const posts = jobgap.relevantPostings(all, role);
    const dem = jobgap.demand(posts);
    const ev = await M.SkillEvidence.find({ studentId: req.user._id }).select('skillKey type level').lean();
    const cmp = jobgap.compare(dem, ev);
    const names = await skillNames();
    const quizzes = new Set((await M.Quiz.find().select('skillKey').lean()).map((q) => q.skillKey));
    const label = (x) => ({ ...x, nameEn: (names.get(x.skillKey) || {}).nameEn || x.skillKey, nameBn: (names.get(x.skillKey) || {}).nameBn || x.skillKey, share: Math.round(x.share * 100), hasQuiz: quizzes.has(x.skillKey) });
    res.json({
      role: { key: role.key, titleEn: role.titleEn, titleBn: role.titleBn },
      postingsUsed: posts.length, sampleTitles: posts.slice(0, 5).map((p) => ({ title: p.title, organization: p.organization })),
      strengths: cmp.strengths.map(label), evidenceNeeded: cmp.evidenceNeeded.map(label),
      missing: cmp.missing.map(label),
      next: cmp.missing.slice(0, 3).map((m) => ({ skillKey: m.skillKey, nameEn: (names.get(m.skillKey) || {}).nameEn || m.skillKey, nameBn: (names.get(m.skillKey) || {}).nameBn || m.skillKey, action: quizzes.has(m.skillKey) ? 'quiz' : 'project' })),
      note: posts.length < 5 ? `Based on only ${posts.length} approved posting(s), so treat it as a hint, not the market.` : `Based on ${posts.length} approved postings on this app, not the whole job market.`,
    });
  });

  return r;
};
