const Skill = require('../models/Skill');
const RoleTemplate = require('../models/RoleTemplate');
const StudentProfile = require('../models/StudentProfile');
const SkillEvidence = require('../models/SkillEvidence');
const R = require('./readiness');

// Loads one student's data and runs the pure readiness functions on it.
async function loadReadiness(userId) {
  const profile = await StudentProfile.findOne({ userId });
  if (!profile || !profile.careerGoalRoleKey) return { profile, ready: false };
  const [template, skills, evidence] = await Promise.all([
    RoleTemplate.findOne({ key: profile.careerGoalRoleKey }),
    Skill.find(),
    SkillEvidence.find({ studentId: userId }),
  ]);
  if (!template) return { profile, ready: false };

  const names = Object.fromEntries(skills.map((s) => [s.key, { nameEn: s.nameEn, nameBn: s.nameBn }]));
  const hours = Object.fromEntries(skills.map((s) => [s.key, s.hoursPerLevel]));
  const required = template.requiredSkills.map((r) => ({ skillKey: r.skillKey, weight: r.weight, requiredLevel: r.requiredLevel }));
  const levels = R.effectiveLevels(evidence.map((e) => ({ skillKey: e.skillKey, level: e.level, verified: e.verified })));
  const gaps = R.computeGaps(required, levels);
  const ttr = R.timeToReady(gaps, hours, profile.weeklyHours);

  return {
    ready: true, profile, template, names,
    required, levels, gaps,
    result: {
      roleKey: template.key, roleTitle: { en: template.titleEn, bn: template.titleBn },
      readinessPercent: Math.round(R.readinessPercent(required, levels)),
      projectedIfTopGapsClosed: Math.round(R.projectedPercent(required, levels, gaps, 2)),
      confidence: Math.round(R.confidence(levels) * 100) / 100,
      gaps: gaps.map((g) => ({ ...g, ...names[g.skillKey] })),
      skills: required.map((r) => ({ skillKey: r.skillKey, ...names[r.skillKey], requiredLevel: r.requiredLevel,
        currentLevel: levels[r.skillKey]?.level || 0, verified: !!levels[r.skillKey]?.verified })), // radar chart data
      timeToReadyWeeks: ttr.weeks, timeToReadyNote: ttr.note, weeklyHours: profile.weeklyHours,
    },
  };
}

// Levels only (no goal needed). Used for job fit and CV skills, loaded once per request (no N+1).
async function loadLevels(userId) {
  const [evidence, skills, profile] = await Promise.all([SkillEvidence.find({ studentId: userId }), Skill.find(), StudentProfile.findOne({ userId })]);
  return {
    levels: R.effectiveLevels(evidence.map((e) => ({ skillKey: e.skillKey, level: e.level, verified: e.verified }))),
    names: Object.fromEntries(skills.map((s) => [s.key, { nameEn: s.nameEn, nameBn: s.nameBn }])),
    hours: Object.fromEntries(skills.map((s) => [s.key, s.hoursPerLevel])),
    weeklyHours: profile ? profile.weeklyHours : 0,
  };
}
module.exports = { loadReadiness, loadLevels };
