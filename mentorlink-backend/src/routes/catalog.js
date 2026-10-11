const router = require('express').Router();
const { authenticateFirebase } = require('../middleware/auth');
const Skill = require('../models/Skill');
const RoleTemplate = require('../models/RoleTemplate');
const asyncHandler = require('../utils/asyncHandler');

router.get('/skills', authenticateFirebase, asyncHandler(async (req, res) => {
  const skills = await Skill.find().sort({ nameEn: 1 });
  res.json({ skills: skills.map((s) => ({ key: s.key, nameEn: s.nameEn, nameBn: s.nameBn })) });
}));

router.get('/roles', authenticateFirebase, asyncHandler(async (req, res) => {
  const [roles, skills] = await Promise.all([RoleTemplate.find().sort({ titleEn: 1 }), Skill.find()]);
  const names = Object.fromEntries(skills.map((s) => [s.key, s]));
  res.json({ roles: roles.map((r) => ({
    key: r.key, titleEn: r.titleEn, titleBn: r.titleBn,
    requiredSkills: r.requiredSkills.map((q) => ({ skillKey: q.skillKey, nameEn: names[q.skillKey]?.nameEn, nameBn: names[q.skillKey]?.nameBn, weight: q.weight, requiredLevel: q.requiredLevel })),
  })) });
}));

module.exports = router;
