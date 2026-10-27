// Career Decision Lab: compare roles, see what employers ask for, run a what-if, find the mentor for the next gap.
// It only COMBINES existing pieces (readiness, job postings, topic graph, mentor profiles). It stores nothing.
const express = require('express');
const { z } = require('zod');
const M = require('../models');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/guards');
const { bad } = require('../utils/httpError');
const { TARGETS } = require('../data/targets');
const lab = require('../services/decisionlab');

const PREREQS = lab.skillPrereqs(TARGETS);
const MAX_ROLES = 3;

module.exports = function labRoutes(auth) {
  const r = express.Router();
  const student = [auth.authenticate, requireRole('student')];

  async function context(user) {
    const [profile, roles, skills, evidence, postings, quizzes] = await Promise.all([
      M.StudentProfile.findOne({ userId: user._id }).lean(),
      M.RoleTemplate.find().lean(), M.Skill.find().lean(),
      M.SkillEvidence.find({ studentId: user._id }).select('skillKey type level').lean(),
      M.Opportunity.find({ status: 'approved', closed: { $ne: true } }).select('title requiredSkills').limit(200).lean(),
      M.Quiz.find().select('skillKey').lean(),
    ]);
    return { profile: profile || {}, roles, skills, evidence, postings, quizSkills: new Set(quizzes.map((q) => q.skillKey)) };
  }
  const names = (skills) => new Map(skills.map((s) => [s.key, s]));

  // Open capacity of verified mentors who declare expertise in a skill (the detailed, explained list is GET /me/gaps/:skillKey/mentors).
  async function mentorSupply(user, skillKeys) {
    const users = await M.User.find({ role: 'mentor', verificationStatus: 'verified' }).select('blockedBy').lean();
    const ok = users.filter((u) => !(u.blockedBy || []).map(String).includes(String(user._id)));
    const profs = await M.MentorProfile.find({ userId: { $in: ok.map((u) => u._id) }, paused: { $ne: true } }).lean();
    const out = {};
    for (const k of skillKeys) {
      out[k] = profs.filter((p) => (p.expertiseSkills || []).some((e) => e.skillKey === k && e.level >= 2) && (p.weeklyCapacity || 0) - (p.acceptedRequests || 0) > 0).length;
    }
    return out;
  }

  r.get('/me/decision-lab', ...student, async (req, res) => {
    const c = await context(req.user);
    const sk = names(c.skills);
    const byKey = new Map(c.roles.map((x) => [x.key, x]));
    let keys = String(req.query.roles || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (keys.length > MAX_ROLES) throw bad('TOO_MANY_ROLES', `Compare up to ${MAX_ROLES} roles.`);
    for (const k of keys) if (!byKey.has(k)) throw bad('UNKNOWN_ROLE', 'Unknown role.');
    const analyse = (role) => lab.analyzeRole({ role, evidence: c.evidence, skills: c.skills, weeklyHours: c.profile.weeklyHours, allPostings: c.postings, prereqs: PREREQS });
    if (!keys.length) { // default: my goal plus the two other roles I am closest to
      const goal = c.profile.careerGoalRoleKey && byKey.has(c.profile.careerGoalRoleKey) ? [c.profile.careerGoalRoleKey] : [];
      const others = c.roles.filter((x) => !goal.includes(x.key)).map((x) => ({ key: x.key, readiness: analyse(x).readiness })).sort((a, b) => b.readiness - a.readiness).slice(0, MAX_ROLES - goal.length);
      keys = [...goal, ...others.map((x) => x.key)];
    }
    const results = keys.map((k) => analyse(byKey.get(k)));
    const supply = await mentorSupply(req.user, [...new Set(results.map((x) => x.next && x.next.skillKey).filter(Boolean))]);
    const label = (k) => ({ nameEn: (sk.get(k) || {}).nameEn || k, nameBn: (sk.get(k) || {}).nameBn || k });
    const shape = (x) => ({
      ...x,
      skills: x.skills.slice(0, 6).map((s) => ({ ...s, ...label(s.skillKey), learnFirst: s.learnFirst.map((l) => ({ ...l, ...label(l.skillKey) })) })),
      blocked: undefined,
      next: x.next ? { ...x.next, ...label(x.next.skillKey), action: c.quizSkills.has(x.next.skillKey) ? 'quiz' : 'project', mentorsAvailable: supply[x.next.skillKey] || 0 } : null,
      postingNote: x.postings.small
        ? `Only ${x.postings.used} approved posting(s) match this role, so skills are ranked from the role requirements, not employer demand.`
        : `Employer demand is based on ${x.postings.used} approved postings in this app, not the whole job market.`,
    });
    res.json({
      goalRoleKey: c.profile.careerGoalRoleKey || null,
      roles: lab.compareRoles(results).map(shape),
      available: c.roles.map((x) => ({ key: x.key, titleEn: x.titleEn, titleBn: x.titleBn })),
      formula: 'Priority = demand share (D) x importance (W) x gap (G). Demand uses approved postings when there are at least 3, otherwise D = 1.',
      note: 'Readiness is preparedness under this model. It is not a chance of getting a job.',
    });
  });

  const simSchema = z.object({
    roleKey: z.string().min(1).max(60),
    learn: z.array(z.object({ skillKey: z.string().min(1).max(40), level: z.number().int().min(1).max(3) }).strict()).min(1).max(10),
  }).strict();
  r.post('/me/decision-lab/simulate', ...student, validate(simSchema), async (req, res) => {
    const c = await context(req.user);
    const role = c.roles.find((x) => x.key === req.body.roleKey);
    if (!role) throw bad('UNKNOWN_ROLE', 'Unknown role.');
    const known = new Set(c.skills.map((s) => s.key));
    if (req.body.learn.some((l) => !known.has(l.skillKey))) throw bad('UNKNOWN_SKILL', 'Unknown skill.');
    res.json(lab.simulate({ role, evidence: c.evidence, skills: c.skills, weeklyHours: c.profile.weeklyHours, learn: req.body.learn }));
  });

  return r;
};
