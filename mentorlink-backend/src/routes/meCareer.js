// Mounted inside /api/me, AFTER authenticateFirebase + privacyGuard (see me.js).
const router = require('express').Router();
const { z } = require('zod');
const { requireRole } = require('../middleware/auth');
const StudentProfile = require('../models/StudentProfile');
const MentorProfile = require('../models/MentorProfile');
const SkillEvidence = require('../models/SkillEvidence');
const Skill = require('../models/Skill');
const RoleTemplate = require('../models/RoleTemplate');
const { loadReadiness } = require('../services/studentContext');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

const LANGS = z.array(z.enum(['bn', 'en'])).max(2);
const slots = z.array(z.string().trim().min(3).max(20)).max(10);

// ---- student goal ----
const goalSchema = z.object({
  careerGoalRoleKey: z.string().min(1),
  weeklyHours: z.number().int().min(0).max(60),
  languages: LANGS,
  goalText: z.string().trim().max(300).optional(),
  preferredSlots: slots.optional(),
}).strict();

router.get('/goal', requireRole('student'), asyncHandler(async (req, res) => {
  res.json({ goal: await StudentProfile.findOne({ userId: req.user._id }) });
}));

router.put('/goal', requireRole('student'), asyncHandler(async (req, res) => {
  const body = goalSchema.parse(req.body);
  if (!(await RoleTemplate.exists({ key: body.careerGoalRoleKey }))) throw new AppError(400, 'UNKNOWN_ROLE', 'Choose a role from the list');
  const goal = await StudentProfile.findOneAndUpdate({ userId: req.user._id }, { $set: body }, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json({ goal });
}));

// ---- evidence ----
// A student can only add "self" ratings or "project" links. Both stay UNVERIFIED until a quiz grader,
// a mentor endorsement or a reviewer (later phases) verifies them. Students cannot set verified/type quiz.
const evidenceSchema = z.object({
  skillKey: z.string().min(1),
  type: z.enum(['self', 'project']),
  level: z.number().int().min(1).max(3),
  url: z.string().url().max(300).refine((u) => /^https?:\/\//.test(u), 'must be http(s)').optional(),
}).strict().refine((e) => e.type !== 'project' || !!e.url, { message: 'a project needs a url', path: ['url'] });

router.get('/evidence', requireRole('student'), asyncHandler(async (req, res) => {
  res.json({ evidence: await SkillEvidence.find({ studentId: req.user._id }).sort({ createdAt: -1 }) });
}));

router.post('/evidence', requireRole('student'), asyncHandler(async (req, res) => {
  const body = evidenceSchema.parse(req.body);
  if (!(await Skill.exists({ key: body.skillKey }))) throw new AppError(400, 'UNKNOWN_SKILL', 'Unknown skill');
  const filter = { studentId: req.user._id, skillKey: body.skillKey, type: body.type, ...(body.type === 'project' && { url: body.url }) };
  const ev = await SkillEvidence.findOneAndUpdate(filter, { $set: { level: body.level, url: body.url, verified: false } }, { upsert: true, new: true });
  res.status(201).json({ evidence: ev });
}));

// ---- readiness ----
router.get('/readiness', requireRole('student'), asyncHandler(async (req, res) => {
  const ctx = await loadReadiness(req.user._id);
  if (!ctx.ready) throw new AppError(400, 'GOAL_REQUIRED', 'Set your career goal first (PUT /api/me/goal)');
  res.json({ readiness: ctx.result });
}));

// ---- mentor profile ----
const mentorSchema = z.object({
  industry: z.string().trim().max(80),
  roleTitle: z.string().trim().min(2).max(80),
  roleKeys: z.array(z.string()).max(5),
  yearsExperience: z.number().min(0).max(50),
  expertiseSkills: z.array(z.object({ skillKey: z.string(), level: z.number().int().min(1).max(3) }).strict()).max(20),
  languages: LANGS,
  weeklyCapacity: z.number().int().min(1).max(10),
  availableSlots: slots,
}).strict(); // stats (rating, sessions, isRising) are server-maintained and cannot be sent

router.get('/mentor-profile', requireRole('mentor'), asyncHandler(async (req, res) => {
  res.json({ profile: await MentorProfile.findOne({ userId: req.user._id }) });
}));

router.put('/mentor-profile', requireRole('mentor'), asyncHandler(async (req, res) => {
  const body = mentorSchema.parse(req.body);
  const [skillCount, roleCount] = await Promise.all([
    Skill.countDocuments({ key: { $in: body.expertiseSkills.map((s) => s.skillKey) } }),
    RoleTemplate.countDocuments({ key: { $in: body.roleKeys } }),
  ]);
  if (skillCount !== new Set(body.expertiseSkills.map((s) => s.skillKey)).size) throw new AppError(400, 'UNKNOWN_SKILL', 'Unknown skill key');
  if (roleCount !== new Set(body.roleKeys).size) throw new AppError(400, 'UNKNOWN_ROLE', 'Unknown role key');
  const profile = await MentorProfile.findOneAndUpdate({ userId: req.user._id }, { $set: body }, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json({ profile });
}));

module.exports = router;
