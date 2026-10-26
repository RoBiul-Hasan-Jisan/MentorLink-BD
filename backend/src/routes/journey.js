// Path Twin routes. Mentors opt in to share a skills-only journey; students see "people who were where I am now".
const express = require('express');
const { z } = require('zod');
const M = require('../models');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/guards');
const { bad } = require('../utils/httpError');
const { firstNameInitial } = require('../utils/helpers');
const { levelsFromEvidence } = require('../services/readiness');
const { findTwins, similarity, stateAtGraduation } = require('../services/pathtwin');

module.exports = function journeyRoutes(auth) {
  const r = express.Router();
  const A = auth.authenticate;

  const schema = z.object({
    shared: z.boolean(),
    firstJobMonths: z.number().int().min(0).max(60).nullable().optional(),
    milestones: z.array(z.object({ skillKey: z.string().min(1).max(40), month: z.number().int().min(-24).max(60), level: z.number().int().min(1).max(3) }).strict()).max(20),
    note: z.string().trim().max(300).optional(),
  }).strict();

  r.get('/me/journey', A, requireRole('mentor'), async (req, res) => {
    const j = await M.Journey.findOne({ mentorId: req.user._id }).lean();
    res.json({ journey: j || { shared: false, firstJobMonths: null, milestones: [], note: '' } });
  });

  r.put('/me/journey', A, requireRole('mentor'), validate(schema), async (req, res) => {
    const keys = [...new Set(req.body.milestones.map((m) => m.skillKey))];
    const found = await M.Skill.find({ key: { $in: keys } }).select('key').lean();
    if (found.length !== keys.length) throw bad('UNKNOWN_SKILL', 'One of the skills is not in the skill list.');
    const j = await M.Journey.findOneAndUpdate({ mentorId: req.user._id }, { $set: { ...req.body, firstJobMonths: req.body.firstJobMonths ?? null } }, { upsert: true, returnDocument: 'after' });
    res.json({ journey: j });
  });

  r.get('/me/path-twins', A, requireRole('student'), async (req, res) => {
    const you = {};
    for (const [k, v] of Object.entries(levelsFromEvidence(await M.SkillEvidence.find({ studentId: req.user._id })))) if (v.level > 0) you[k] = v.level;
    const shared = await M.Journey.find({ shared: true }).lean();
    const mentors = await M.User.find({ _id: { $in: shared.map((j) => j.mentorId) }, role: 'mentor', verificationStatus: 'verified' }).select('displayName').lean();
    const byId = new Map(mentors.map((m) => [String(m._id), m]));
    const blocked = new Set((req.user.blockedBy || []).map(String));
    const usable = shared.filter((j) => byId.has(String(j.mentorId)) && !blocked.has(String(j.mentorId)));
    const profiles = new Map((await M.MentorProfile.find({ userId: { $in: usable.map((j) => j.mentorId) } }).select('userId roleTitle industry').lean()).map((p) => [String(p.userId), p]));
    const { twins, consensus } = findTwins(you, usable, 5);
    const skills = new Map((await M.Skill.find().select('key nameEn nameBn').lean()).map((s) => [s.key, s]));
    const nm = (k) => ({ skillKey: k, nameEn: (skills.get(k) || {}).nameEn || k, nameBn: (skills.get(k) || {}).nameBn || k });
    res.json({
      you: Object.entries(you).map(([k, level]) => ({ ...nm(k), level })),
      twins: twins.map((t) => {
        const id = String(t.journey.mentorId), p = profiles.get(id) || {};
        return {
          mentorId: id, name: firstNameInitial(byId.get(id).displayName), roleTitle: p.roleTitle || '', industry: p.industry || '',
          similarity: Math.round(t.sim * 100), firstJobMonths: t.journey.firstJobMonths, note: t.journey.note || '',
          atGraduation: Object.entries(stateAtGraduation(t.journey.milestones)).map(([k, level]) => ({ ...nm(k), level })),
          next: t.next.map((m) => ({ ...nm(m.skillKey), month: m.month, level: m.level, youHave: (you[m.skillKey] || 0) >= m.level })),
        };
      }),
      consensus: consensus.map((c) => ({ ...nm(c.skillKey), ...c })),
      note: 'Twins are matched on skills only. Their journeys are shared by choice. This is what happened for them, not a promise for you.',
    });
  });

  return r;
};
module.exports.similarity = similarity;
