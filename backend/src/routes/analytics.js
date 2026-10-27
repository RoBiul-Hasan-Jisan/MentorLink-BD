// Department analytics: anonymous, grouped numbers for the department's OWN students. Never a name, never one person's row.
// Any number below K is returned as null (the app shows "hidden"), so a small group can never be picked out.
const express = require('express');
const M = require('../models');
const { requireRole } = require('../middleware/auth');
const { bad } = require('../utils/httpError');
const { computeReadiness } = require('../services/readiness');

const K = 5;
const WEEK = 7 * 864e5;
const cell = (n) => (n >= K ? n : null);
const esc = (t) => String(t || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Bands of readiness. Pure, so it is easy to test.
function bandCounts(percents) {
  const bands = [{ key: 'low', from: 0, to: 39 }, { key: 'mid', from: 40, to: 69 }, { key: 'high', from: 70, to: 100 }];
  return bands.map((b) => ({ key: b.key, from: b.from, to: b.to, count: cell(percents.filter((p) => p >= b.from && p <= b.to).length) }));
}

module.exports = function analyticsRoutes(auth) {
  const r = express.Router();
  const dept = [auth.authenticate, requireRole('department', 'admin')];

  r.get('/department/analytics', ...dept, async (req, res) => {
    const uni = req.user.role === 'admin' ? req.query.universityId : req.user.universityId;
    const dep = req.user.role === 'admin' ? req.query.department : req.user.department;
    if (!uni || !dep) throw bad('DEPARTMENT_REQUIRED', 'A university and a department are required.');
    const students = await M.User.find({ universityId: uni, department: new RegExp(`^${esc(dep)}$`, 'i'), role: 'student' }).select('_id').limit(2000).lean();
    const ids = students.map((s) => s._id);
    const note = `Groups smaller than ${K} are hidden to protect privacy.`;
    if (ids.length < K) return res.json({ hidden: true, k: K, note });

    const since = new Date(Date.now() - 6 * WEEK);
    const [profiles, roles, skills, evidence, sessions, projects, github, reviews] = await Promise.all([
      M.StudentProfile.find({ userId: { $in: ids } }).select('userId careerGoalRoleKey').lean(),
      M.RoleTemplate.find().lean(), M.Skill.find().lean(),
      M.SkillEvidence.find({ studentId: { $in: ids } }).select('studentId skillKey type level reviewStatus').lean(),
      M.Session.find({ studentId: { $in: ids }, status: 'completed', startsAt: { $gte: since } }).select('startsAt').lean(),
      M.PortfolioProject.find({ studentId: { $in: ids } }).select('studentId').lean(),
      M.GithubLink.find({ userId: { $in: ids }, verified: true }).select('userId').lean(),
      M.PlanReview.find({ studentId: { $in: ids } }).select('studentId status').lean(),
    ]);
    const roleByKey = new Map(roles.map((x) => [x.key, x]));
    const evBy = new Map();
    for (const e of evidence) { const k = String(e.studentId); if (!evBy.has(k)) evBy.set(k, []); evBy.get(k).push(e); }

    const percents = [];
    const goalCount = {};
    for (const p of profiles) {
      const role = roleByKey.get(p.careerGoalRoleKey);
      if (!role) continue;
      goalCount[role.key] = (goalCount[role.key] || 0) + 1;
      percents.push(computeReadiness({ role, evidence: evBy.get(String(p.userId)) || [], skills, weeklyHours: 0 }).readiness);
    }
    const studentsWith = (pred) => new Set(evidence.filter(pred).map((e) => String(e.studentId))).size;
    const weeks = Array.from({ length: 6 }, (_, i) => ({ week: i + 1, sessions: 0 }));
    for (const s of sessions) { const i = Math.min(5, Math.max(0, Math.floor((s.startsAt - since) / WEEK))); weeks[i].sessions += 1; }
    const withProjects = new Set(projects.map((x) => String(x.studentId))).size;

    res.json({
      k: K, note, students: ids.length,
      readiness: { withGoal: cell(percents.length), bands: percents.length >= K ? bandCounts(percents) : [] },
      goals: Object.entries(goalCount).filter(([, n]) => n >= K).map(([key, count]) => ({ key, titleEn: roleByKey.get(key).titleEn, titleBn: roleByKey.get(key).titleBn, count })).sort((a, b) => b.count - a.count),
      evidence: {
        quiz: cell(studentsWith((e) => e.type === 'quiz')),
        project: cell(studentsWith((e) => e.type === 'project')),
        endorsed: cell(studentsWith((e) => e.type === 'endorsement')),
      },
      portfolio: { studentsWithProjects: cell(withProjects), githubVerified: cell(github.length) },
      planReviews: { approved: cell(new Set(reviews.filter((x) => x.status === 'approved').map((x) => String(x.studentId))).size) },
      weeks: sessions.length >= K ? weeks : null,
    });
  });
  return r;
};
module.exports.bandCounts = bandCounts;
