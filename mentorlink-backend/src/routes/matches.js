const router = require('express').Router();
const { authenticateFirebase, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const MentorProfile = require('../models/MentorProfile');
const Match = require('../models/Match');
const Block = require('../models/Block');
const Skill = require('../models/Skill');
const { loadReadiness } = require('../services/studentContext');
const { effectiveActiveMentees } = require('../services/capacity');
const { rankMentors } = require('../services/matching/rank');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

const PERIOD_DAYS = 30;
router.use(authenticateFirebase, requireRole('student'));

router.get('/', asyncHandler(async (req, res) => {
  const ctx = await loadReadiness(req.user._id);
  if (!ctx.ready) throw new AppError(400, 'GOAL_REQUIRED', 'Set your career goal first (PUT /api/me/goal)');
  const { profile, template, names, gaps } = ctx;

  const [mentorUsers, blocks, allSkills] = await Promise.all([
    User.find({ role: 'mentor', verificationStatus: 'verified' }),
    Block.find({ $or: [{ blockerId: req.user._id }, { blockedId: req.user._id }] }),
    Skill.find(),
  ]);
  const profiles = await MentorProfile.find({ userId: { $in: mentorUsers.map((u) => u._id) } });
  const profByUser = new Map(profiles.map((p) => [String(p.userId), p]));
  const blocked = new Set(blocks.flatMap((b) => [String(b.blockerId), String(b.blockedId)]));
  const skillName = (k) => names[k]?.nameEn || k;

  const mentors = mentorUsers.filter((u) => profByUser.has(String(u._id))).map((u) => {
    const p = profByUser.get(String(u._id));
    const skills = Object.fromEntries(p.expertiseSkills.map((s) => [s.skillKey, s.level]));
    return {
      mentorId: String(u._id), displayName: u.displayName, roleTitle: p.roleTitle, industry: p.industry,
      roleKeys: p.roleKeys, yearsExperience: p.yearsExperience, skills, languages: p.languages,
      availableSlots: p.availableSlots, sessionsCompleted: p.sessionsCompleted, acceptedRequests: p.acceptedRequests,
      isRising: p.isRising, ratingAvg: p.ratingAvg, weeklyCapacity: p.weeklyCapacity, activeMentees: effectiveActiveMentees(p),
      paused: p.paused, verified: true, blocked: blocked.has(String(u._id)),
      doc: [p.roleTitle, p.industry, ...p.roleKeys, ...p.expertiseSkills.map((s) => skillName(s.skillKey))].join(' '),
    };
  });

  // Recommendation history over the recent period (for the 25% fairness cap)
  const since = new Date(Date.now() - PERIOD_DAYS * 86400000);
  const rows = await Match.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$mentorId', n: { $sum: 1 } } }]);
  const history = { total: rows.reduce((a, r) => a + r.n, 0), byMentor: Object.fromEntries(rows.map((r) => [String(r._id), r.n])) };

  const student = {
    goalRoleKey: template.key, relatedRoleKeys: template.relatedRoleKeys,
    languages: profile.languages, preferredSlots: profile.preferredSlots,
    gapKeys: gaps.map((g) => g.skillKey), skillNames: names,
    doc: [template.titleEn, profile.goalText, ...gaps.map((g) => skillName(g.skillKey))].join(' '),
  };

  const { top, baseline, fairness } = rankMentors(student, mentors, history);

  // Save factor scores so every result can be explained later. One row per pair.
  await Promise.all(top.map((m) => Match.updateOne(
    { studentId: req.user._id, mentorId: m.mentorId },
    { $set: { score: m.score, factorScores: m.factors, reasons: m.reasons } }, { upsert: true })));

  res.json({
    matches: top.map((m) => ({
      mentorId: m.mentorId, displayName: m.displayName, roleTitle: m.roleTitle, industry: m.industry,
      yearsExperience: m.yearsExperience, ratingAvg: m.ratingAvg, isRising: m.isRising, verified: true,
      slotsFree: m.weeklyCapacity - m.activeMentees, weeklyCapacity: m.weeklyCapacity,
      score: m.percent, factorScores: m.factors, points: m.points, reasons: m.reasons,
      strongIn: Object.entries(m.skills).filter(([, l]) => l >= 3).map(([k]) => ({ skillKey: k, ...names[k] })),
    })),
    baseline, fairness,
    method: 'Formula-based. Weights: career 30, gaps 25, experience 15, language 10, schedule 10, reliability 10.',
  });
}));

module.exports = router;
