// Multi-skill hub: choose up to 5 targets, see one roadmap card per target, named skill levels, and mentors per chosen target.
const express = require('express');
const { z } = require('zod');
const M = require('../models');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/guards');
const { bad } = require('../utils/httpError');
const { firstNameInitial } = require('../utils/helpers');
const { TARGETS, analyse } = require('../data/targets');
const { levelName } = require('../data/levels');
const { levelsFromEvidence } = require('../services/readiness');

const MAX_TARGETS = 5;
const words = (t) => String(t || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
const STOP = new Set(['and', 'the', 'for', 'with', 'development', 'computing']);

// A mentor fits a target when their expertise skills overlap the target's linked skills, or their job title / industry shares a word with the target name.
// This is a transparent heuristic, shown with the reasons ("why"), not a prediction.
function mentorFit(target, mentor, profile) {
  const want = [...new Set(target.topics.filter((t) => t.ev).map((t) => t.ev[0]))];
  const have = new Map((profile.expertiseSkills || []).map((e) => [e.skillKey, e.level]));
  const hits = want.filter((k) => have.has(k));
  const skillPart = want.length ? hits.reduce((s, k) => s + have.get(k) / 3, 0) / want.length : 0;
  const tw = words(target.titleEn).filter((w) => !STOP.has(w));
  const mw = new Set([...words(profile.roleTitle), ...words(profile.industry)]);
  const kw = tw.filter((w) => mw.has(w));
  const kwPart = tw.length ? kw.length / tw.length : 0;
  const score = want.length ? 0.7 * skillPart + 0.3 * kwPart : kwPart;
  return { score, hits, kw };
}

module.exports = function hubRoutes(auth) {
  const r = express.Router();
  const student = [auth.authenticate, requireRole('student')];

  r.put('/me/targets', ...student, validate(z.object({ keys: z.array(z.string().max(40)).max(MAX_TARGETS) }).strict()), async (req, res) => {
    const keys = [...new Set(req.body.keys)];
    if (keys.some((k) => !TARGETS.some((t) => t.key === k))) throw bad('UNKNOWN_TARGET', 'One of the chosen targets does not exist.');
    await M.StudentProfile.findOneAndUpdate({ userId: req.user._id }, { $set: { selectedTargets: keys } }, { upsert: true });
    res.json({ keys });
  });

  async function context(user) {
    const [prof, ev] = await Promise.all([M.StudentProfile.findOne({ userId: user._id }).lean(), M.SkillEvidence.find({ studentId: user._id }).lean()]);
    return { prof: prof || {}, ev };
  }

  // Dashboard: what do I know, what next, one card per chosen target.
  r.get('/me/dashboard', ...student, async (req, res) => {
    const { prof, ev } = await context(req.user);
    const levels = levelsFromEvidence(ev);
    const nonSelf = {}; for (const e of ev) if (e.type !== 'self') nonSelf[e.skillKey] = Math.max(nonSelf[e.skillKey] || 0, e.level);
    const skills = new Map((await M.Skill.find().select('key nameEn nameBn').lean()).map((s) => [s.key, s]));
    const sel = (prof.selectedTargets || []).map((k) => TARGETS.find((t) => t.key === k)).filter(Boolean);
    const cards = [];
    for (const t of sel) {
      const prog = await M.RoadmapProgress.find({ studentId: req.user._id, skillKey: `target:${t.key}` }).lean();
      const a = analyse(t, new Set(prog.map((p) => p.topicKey)), nonSelf, prof.weeklyHours || 0);
      const next = a.path.find((x) => x.status === 'ready');
      cards.push({ key: t.key, titleEn: t.titleEn, titleBn: t.titleBn, kind: t.kind, percent: a.percent, verifiedPercent: a.verifiedPercent, weeksLeft: a.weeksLeft, hoursLeft: a.hoursLeft, next: next ? { key: next.key, titleEn: next.titleEn, titleBn: next.titleBn } : null });
    }
    const skillLevels = Object.entries(levels).map(([k, v]) => { const n = levelName(v.level); const s = skills.get(k) || {}; return { skillKey: k, nameEn: s.nameEn || k, nameBn: s.nameBn || k, level: v.level, levelEn: n.en, levelBn: n.bn, proven: v.nonSelf }; }).sort((a, b) => b.level - a.level);
    const weakest = cards.filter((c) => c.next).sort((a, b) => a.percent - b.percent)[0];
    res.json({
      maxTargets: MAX_TARGETS, selected: cards, skills: skillLevels,
      nextStep: weakest ? { targetKey: weakest.key, titleEn: weakest.next.titleEn, titleBn: weakest.next.titleBn, targetTitleEn: weakest.titleEn, targetTitleBn: weakest.titleBn } : null,
      questions: ['What do I already know?', 'What should I learn next?', 'How can I use my skills for my goal?'],
    });
  });

  // Mentors for every chosen target (top 3 each), with the reasons.
  r.get('/me/target-mentors', ...student, async (req, res) => {
    const { prof } = await context(req.user);
    const sel = (prof.selectedTargets || []).map((k) => TARGETS.find((t) => t.key === k)).filter(Boolean);
    const blocked = new Set([...(req.user.blockedBy || []), ...(prof.dismissedMentors || [])].map(String));
    const mentors = await M.User.find({ role: 'mentor', verificationStatus: 'verified' }).select('displayName blockedBy').lean();
    const profiles = new Map((await M.MentorProfile.find({ userId: { $in: mentors.map((m) => m._id) }, paused: { $ne: true } }).lean()).map((p) => [String(p.userId), p]));
    const skills = new Map((await M.Skill.find().select('key nameEn nameBn').lean()).map((s) => [s.key, s]));
    const out = sel.map((t) => {
      const list = [];
      for (const m of mentors) {
        const p = profiles.get(String(m._id));
        if (!p || blocked.has(String(m._id)) || (m.blockedBy || []).map(String).includes(String(req.user._id))) continue;
        const f = mentorFit(t, m, p);
        if (f.score <= 0) continue;
        list.push({ mentorId: String(m._id), name: firstNameInitial(m.displayName), roleTitle: p.roleTitle, industry: p.industry, fit: Math.round(f.score * 100), why: f.hits.map((k) => ({ skillKey: k, nameEn: (skills.get(k) || {}).nameEn || k, nameBn: (skills.get(k) || {}).nameBn || k })), roleWords: f.kw });
      }
      list.sort((a, b) => b.fit - a.fit);
      return { key: t.key, titleEn: t.titleEn, titleBn: t.titleBn, mentors: list.slice(0, 3) };
    });
    res.json({ targets: out, note: 'Fit compares the mentor expertise skills with the skills linked to the target, plus words in their job title. It is a guide, not a promise.' });
  });

  return r;
};
