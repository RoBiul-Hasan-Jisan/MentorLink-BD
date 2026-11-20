// Student "what do I do next" tools.
//   GET /me/actions   Career Action Center: up to 5 ranked actions, each with a reason and a screen to open
//   GET /me/tracker   Application tracker board: saved / applied / interview / offer / done, with "no reply yet" flags
// Read-only. Students only. All ranking rules are in services/actions.js and services/tracker.js (plain unit tests).
const express = require('express');
const M = require('../models');
const { requireRole } = require('../middleware/auth');
const { levelsFromEvidence, computeReadiness } = require('../services/readiness');
const { fitOf } = require('../services/jobtools');
const { buildActions } = require('../services/actions');
const { buildBoard } = require('../services/tracker');
const { firstNameInitial } = require('../utils/helpers');

module.exports = function actionRoutes(auth) {
  const r = express.Router();
  const student = [auth.authenticate, requireRole('student')];

  r.get('/me/actions', ...student, async (req, res) => {
    const now = new Date(); const uid = req.user._id;
    const [prof, evidence, skills, nextSession, tasks, offers, interview, docs, unseen, cv, mentorReq, closing, apps] = await Promise.all([
      M.StudentProfile.findOne({ userId: uid }).lean(), M.SkillEvidence.find({ studentId: uid }).lean(), M.Skill.find().lean(),
      M.Session.findOne({ studentId: uid, status: 'scheduled', startsAt: { $gt: now } }).sort({ startsAt: 1 }).lean(),
      M.Task.find({ studentId: uid, status: 'todo', dueDate: { $ne: null } }).sort({ dueDate: 1 }).limit(1).lean(),
      M.Offer.countDocuments({ studentId: uid, status: 'sent' }),
      M.Interview.findOne({ studentId: uid, status: { $in: ['scheduled', 'confirmed'] }, startsAt: { $gt: now } }).sort({ startsAt: 1 }).lean(),
      M.DocumentRequest.countDocuments({ studentId: uid, status: { $in: ['requested', 'needs_fix'] } }),
      M.MentorReview.countDocuments({ studentId: uid, seenByStudent: false }),
      M.CvVersion.exists({ studentId: uid }), M.MentorRequest.exists({ studentId: uid, status: 'accepted' }),
      M.Opportunity.find({ status: 'approved', closed: { $ne: true }, applicationDeadline: { $gt: now, $lt: new Date(now.getTime() + 3 * 864e5) } }).limit(20).lean(),
      M.Application.find({ studentId: uid, stage: { $in: ['Applied', 'Under Review'] }, createdAt: { $lt: new Date(now.getTime() - 7 * 864e5) } }).select('opportunityId createdAt stageHistory').lean(),
    ]);
    const levels = levelsFromEvidence(evidence);
    const role = prof && prof.careerGoalRoleKey ? await M.RoleTemplate.findOne({ key: prof.careerGoalRoleKey }).lean() : null;
    let topGap = null;
    if (role) {
      const out = computeReadiness({ role, evidence, skills, weeklyHours: prof.weeklyHours });
      const g = out.gaps[0];
      if (g) topGap = { skillKey: g.skillKey, nameEn: g.nameEn || g.skillKey, nameBn: g.nameBn || g.nameEn || g.skillKey, hasProof: !!(levels[g.skillKey] && levels[g.skillKey].nonSelf) };
      // The quiz action only makes sense when a quiz exists for that skill.
      if (topGap && !topGap.hasProof && !(await M.Quiz.exists({ skillKey: topGap.skillKey }))) topGap.hasProof = true;
    }
    const appliedTo = new Set((await M.Application.find({ studentId: uid }).select('opportunityId').lean()).map((a) => String(a.opportunityId)));
    let closingJob = null;
    for (const o of closing) {
      if (appliedTo.has(String(o._id))) continue;
      const fit = fitOf(o, levels); if (fit === undefined || fit < 50) continue;
      if (!closingJob || fit > closingJob.fit) closingJob = { id: o._id, title: o.title, fit, daysLeft: Math.max(1, Math.ceil((new Date(o.applicationDeadline) - now) / 864e5)) };
    }
    let nextSess = null;
    if (nextSession) { const mu = await M.User.findById(nextSession.mentorId).select('displayName').lean(); nextSess = { at: nextSession.startsAt, mentor: firstNameInitial(mu && mu.displayName) }; }
    const t = tasks[0];
    const dueTask = t && new Date(t.dueDate).getTime() - now.getTime() < 48 * 36e5 ? { title: t.title, overdue: new Date(t.dueDate) < now } : null;
    const result = buildActions({
      now, hasGoal: !!role, hasCv: !!cv, hasMentor: !!mentorReq, nextSession: nextSess, dueTask, docsToSend: docs, offersWaiting: offers,
      interviewSoon: interview ? { title: interview.title, at: interview.startsAt } : null, unseenReviews: unseen, topGap, closingJob, staleApps: apps.length,
    });
    res.json({ ...result, note: 'Fixed rules, not AI: offers, interviews and papers first, then sessions, tasks, feedback, goal, closing jobs, your biggest gap.' });
  });

  r.get('/me/tracker', ...student, async (req, res) => {
    const uid = req.user._id;
    const [apps, saved] = await Promise.all([
      M.Application.find({ studentId: uid }).sort({ createdAt: -1 }).limit(200).populate('opportunityId', 'title organization applicationDeadline').lean(),
      M.SavedJob.find({ studentId: uid }).sort({ createdAt: -1 }).limit(100).populate('opportunityId', 'title organization applicationDeadline status closed').lean(),
    ]);
    const applied = new Set(apps.map((a) => a.opportunityId && String(a.opportunityId._id)));
    res.json({
      ...buildBoard({
        apps: apps.map((a) => ({ ...a, opportunity: a.opportunityId })),
        saved: saved.filter((s) => s.opportunityId && !s.opportunityId.closed && s.opportunityId.status === 'approved' && !applied.has(String(s.opportunityId._id))).map((s) => ({ opportunityId: s.opportunityId._id, opportunity: s.opportunityId })),
      }),
      note: 'A card turns red after 7 days with no reply. That is normal for some companies: message them politely or apply to a similar job.',
    });
  });
  return r;
};
