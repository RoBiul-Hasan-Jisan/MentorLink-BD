const express = require('express');
const { z } = require('zod');
const { normalizeCv, stripContact, cvTips } = require('../services/cv');
const { Opportunity, Application, Report, CvVersion, SkillEvidence, Skill, User, STAGES } = require('../models');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/guards');
const { bad, notFound, forbidden, conflict } = require('../utils/httpError');
const { audit, notify, toObjectId } = require('../utils/helpers');
const { scamFlags, uiStage, canMove } = require('../services/scam');
const { levelsFromEvidence } = require('../services/readiness');
const env = require('../config/env');

module.exports = function opportunityRoutes(auth) {
  const r = express.Router();
  const A = auth.authenticate;
  const student = [A, requireRole('student')];

  // ---- CV versions ----
  // A structured CV. No phone, email or home address fields: contact details are never stored in a CV
  // (the app shares only what the student ticks on the consent screen).
  const short = (n) => z.string().trim().max(n);
  // CV format v2 (see services/cv.js). Any shape is cleaned and size-limited by normalizeCv; the contact block is validated here.
  const cvSchema = z.object({ data: z.record(z.string(), z.any()) }).strict();
  const cleanCv = (data, user) => {
    const cv = normalizeCv(data, user);
    if (cv.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cv.contact.email)) throw bad('BAD_EMAIL', 'That email address does not look right.');
    if (cv.contact.phone && !/^[+\d][\d\s-]{5,}$/.test(cv.contact.phone)) throw bad('BAD_PHONE', 'That phone number does not look right.');
    return cv;
  };
  r.post('/me/cv', ...student, validate(cvSchema), async (req, res) => {
    const data = cleanCv(req.body.data, req.user);
    const last = await CvVersion.findOne({ studentId: req.user._id }).sort({ version: -1 });
    res.status(201).json({ cv: await CvVersion.create({ studentId: req.user._id, version: last ? last.version + 1 : 1, data }) });
  });
  // Rule-based tips (no AI service, no cost). Nothing is saved.
  r.post('/me/cv/check', ...student, validate(cvSchema), async (req, res) => res.json(cvTips(normalizeCv(req.body.data, req.user))));
  // A mentor reads the CV versions of their own accepted mentees only, WITHOUT the contact block.
  r.get('/mentees/:studentId/cv', A, requireRole('mentor'), async (req, res) => {
    toObjectId(req.params.studentId);
    const { MentorRequest } = require('../models');
    if (!(await MentorRequest.findOne({ studentId: req.params.studentId, mentorId: req.user._id, status: 'accepted' }))) throw notFound();
    const who = await User.findById(req.params.studentId).select('displayName').lean();
    const versions = await CvVersion.find({ studentId: req.params.studentId }).sort({ version: -1 }).limit(5).lean();
    res.json({ versions: versions.map((v) => ({ ...v, data: stripContact(normalizeCv(v.data, who || {})) })) });
  });
  r.get('/me/cv', ...student, async (req, res) => {
    const versions = await CvVersion.find({ studentId: req.user._id }).sort({ version: -1 }).lean();
    res.json({ versions: versions.map((v) => ({ ...v, data: normalizeCv(v.data, req.user) })) });
  });
  r.post('/cv/:id/review', A, requireRole('mentor'), validate(z.object({ text: z.string().min(2).max(500) }).strict()), async (req, res) => {
    toObjectId(req.params.id);
    const cv = await CvVersion.findById(req.params.id);
    if (!cv) throw notFound();
    const { MentorRequest } = require('../models');
    if (!(await MentorRequest.findOne({ studentId: cv.studentId, mentorId: req.user._id, status: 'accepted' }))) throw notFound();
    cv.reviewComments.push({ mentorId: req.user._id, text: req.body.text });
    await cv.save();
    res.json({ cv });
  });

  // ---- opportunity posting (verified alumni mentors or admin) ----
  const oppSchema = z.object({
    title: z.string().trim().min(3).max(120), organization: z.string().trim().min(2).max(120), type: z.enum(['job', 'internship', 'other']).default('job'),
    workplaceMode: z.enum(['onsite', 'hybrid', 'remote']).default('onsite'), locationText: z.string().max(120).optional(),
    description: z.string().trim().min(20).max(4000), applicationDeadline: z.coerce.date().optional(),
    requiredSkills: z.array(z.object({ skillKey: z.string(), requiredLevel: z.number().int().min(1).max(3).default(2), weight: z.number().min(0).default(1) })).max(10).default([]),
    noFeeConfirmed: z.boolean(),
  }).strict();
  r.post('/opportunities', A, requireRole('mentor', 'admin'), validate(oppSchema), async (req, res) => {
    if (req.user.verificationStatus !== 'verified') throw forbidden('Only verified users can post.');
    if (!req.body.noFeeConfirmed) throw bad('NO_FEE_REQUIRED', 'You must confirm that this post never asks applicants for money.');
    const flags = scamFlags(`${req.body.title} ${req.body.description}`);
    const isAdmin = req.user.role === 'admin';
    const opp = await Opportunity.create({
      ...req.body, postedBy: req.user._id, sourceLabel: isAdmin ? 'admin' : 'verified_alumni', suspiciousFlags: flags,
      status: isAdmin && !flags.length ? 'approved' : 'pending', listingReviewed: isAdmin && !flags.length,
    });
    res.status(201).json({ opportunity: opp });
  });

  const publicOpp = (o, fit) => ({
    id: o._id, title: o.title, organization: o.organization, type: o.type, workplaceMode: o.workplaceMode, locationText: o.locationText,
    description: o.description, applicationDeadline: o.applicationDeadline, requiredSkills: o.requiredSkills,
    labels: { source: o.sourceLabel, organizationVerified: !!o.organizationId, listingReviewed: o.listingReviewed, noFeeDeclared: o.noFeeConfirmed }, fit,
  });
  const fitOf = (o, have) => {
    if (!o.requiredSkills.length) return undefined;
    let n = 0, d = 0;
    for (const s of o.requiredSkills) { d += s.weight; n += s.weight * Math.min(((have[s.skillKey] || {}).level || 0) / s.requiredLevel, 1); }
    return d ? Math.round((100 * n) / d) : undefined;
  };
  r.get('/opportunities', A, requireRole('student', 'mentor', 'department', 'admin'), async (req, res) => {
    const list = await Opportunity.find({ status: 'approved', closed: { $ne: true } }).sort({ createdAt: -1 }).limit(100);
    let have = {};
    if (req.user.role === 'student') have = levelsFromEvidence(await SkillEvidence.find({ studentId: req.user._id }));
    const posters = new Map((await User.find({ _id: { $in: list.map((o) => o.postedBy) } }).select('displayName').lean()).map((u) => [String(u._id), u.displayName]));
    res.json({ opportunities: list.map((o) => ({ ...publicOpp(o, req.user.role === 'student' ? fitOf(o, have) : undefined), postedByName: posters.get(String(o.postedBy)) || '' })) });
  });
  // Job detail: the fit percentage and a skill-by-skill breakdown (design: "Your fit before applying").
  r.get('/opportunities/:id', A, requireRole('student', 'mentor', 'department', 'admin'), async (req, res) => {
    toObjectId(req.params.id);
    const o = await Opportunity.findOne({ _id: req.params.id, status: 'approved' });
    if (!o) throw notFound('This opportunity is not available.');
    const poster = await User.findById(o.postedBy).select('displayName').lean();
    let fit, breakdown = [], projectedFit = null;
    if (req.user.role === 'student') {
      const have = levelsFromEvidence(await SkillEvidence.find({ studentId: req.user._id }));
      fit = fitOf(o, have);
      const names = new Map((await Skill.find({ key: { $in: o.requiredSkills.map((s) => s.skillKey) } }).lean()).map((s) => [s.key, s]));
      breakdown = o.requiredSkills.map((s) => {
        const lvl = (have[s.skillKey] || {}).level || 0;
        const nm = names.get(s.skillKey) || {};
        return { skillKey: s.skillKey, nameEn: nm.nameEn || s.skillKey, nameBn: nm.nameBn || s.skillKey, need: s.requiredLevel, have: lvl, status: lvl >= s.requiredLevel ? 'met' : 'gap' };
      });
      const gapsOnly = breakdown.filter((b) => b.status === 'gap');
      if (gapsOnly.length) projectedFit = 100; // fit if every listed gap were closed; shown with the gap list, not as a promise
    }
    res.json({ opportunity: { ...publicOpp(o, fit), postedByName: (poster || {}).displayName || '', closed: !!o.closed }, fit, breakdown, projectedFit });
  });

  // ---- applications ----
  const applySchema = z.object({ cvVersionId: z.string(), note: z.string().max(500).optional(), consent: z.literal(true), sharedFields: z.array(z.string().max(30)).max(10).default(['name', 'cv']) }).strict();
  r.post('/opportunities/:id/apply', ...student, validate(applySchema), async (req, res) => {
    toObjectId(req.params.id);
    const opp = await Opportunity.findOne({ _id: req.params.id, status: 'approved', closed: { $ne: true } });
    if (!opp) throw notFound('This opportunity is not available.');
    if (opp.applicationDeadline && opp.applicationDeadline < new Date()) throw conflict('DEADLINE_PASSED', 'The deadline has passed.');
    toObjectId(req.body.cvVersionId, 'cv id');
    const cv = await CvVersion.findOne({ _id: req.body.cvVersionId, studentId: req.user._id });
    if (!cv) throw bad('CV_REQUIRED', 'Choose one of your CV versions.');
    const app = await Application.create({
      studentId: req.user._id, opportunityId: opp._id, cvVersionId: cv._id, applicantNote: req.body.note,
      consentSnapshot: { sharedFields: req.body.sharedFields, consentedAt: new Date() },
      stageHistory: [{ stage: 'Applied', by: req.user._id }],
    });
    await notify(opp.postedBy, 'New application', opp.title, 'application');
    res.status(201).json({ application: { id: app._id, stage: uiStage(app.stage) } });
  });
  r.get('/me/applications', ...student, async (req, res) => {
    const apps = await Application.find({ studentId: req.user._id }).sort({ createdAt: -1 }).populate('opportunityId', 'title organization').populate('cvVersionId', 'version');
    res.json({ applications: apps.map((a) => ({ id: a._id, opportunity: a.opportunityId, stage: uiStage(a.stage), backendStage: a.stage, withdrawn: a.stage === 'Withdrawn', statusMessage: a.statusMessage, outcomeFeedback: a.outcomeFeedback, appliedAt: a.createdAt, cvVersion: a.cvVersionId ? a.cvVersionId.version : null })) });
  });
  r.post('/applications/:id/withdraw', ...student, async (req, res) => {
    toObjectId(req.params.id);
    const a = await Application.findOne({ _id: req.params.id, studentId: req.user._id });
    if (!a) throw notFound();
    a.stage = 'Withdrawn'; a.stageHistory.push({ stage: 'Withdrawn', by: req.user._id }); await a.save();
    res.json({ stage: uiStage(a.stage) });
  });
  r.post('/applications/:id/outcome', ...student, validate(z.object({ outcomeFeedback: z.enum(['yes', 'little', 'not_yet']) }).strict()), async (req, res) => {
    toObjectId(req.params.id);
    const a = await Application.findOneAndUpdate({ _id: req.params.id, studentId: req.user._id }, { outcomeFeedback: req.body.outcomeFeedback }, { returnDocument: 'after' });
    if (!a) throw notFound();
    res.json({ ok: true });
  });
  // The poster sees applicants and moves them through stages. Only consented fields are shown.
  r.get('/opportunities/:id/applications', A, requireRole('mentor', 'admin'), async (req, res) => {
    toObjectId(req.params.id);
    const opp = await Opportunity.findById(req.params.id);
    if (!opp || (req.user.role !== 'admin' && String(opp.postedBy) !== String(req.user._id))) throw notFound();
    const apps = await Application.find({ opportunityId: opp._id }).populate('studentId', 'displayName department').populate('cvVersionId');
    res.json({ applications: apps.map((a) => {
      const f = a.consentSnapshot.sharedFields;
      return { id: a._id, stage: a.stage, name: f.includes('name') ? a.studentId.displayName : undefined, department: f.includes('department') ? a.studentId.department : undefined, cv: f.includes('cv') ? (f.includes('contact') ? normalizeCv(a.cvVersionId.data) : stripContact(normalizeCv(a.cvVersionId.data))) : undefined, note: a.applicantNote };
    }) });
  });
  r.patch('/applications/:id/stage', A, requireRole('mentor', 'admin'), validate(z.object({ stage: z.enum(STAGES), message: z.string().max(200).optional() }).strict()), async (req, res) => {
    toObjectId(req.params.id);
    const a = await Application.findById(req.params.id);
    const opp = a && (await Opportunity.findById(a.opportunityId));
    if (!a || (req.user.role !== 'admin' && String(opp.postedBy) !== String(req.user._id))) throw notFound();
    if (a.stage === 'Withdrawn') throw conflict('WITHDRAWN', 'The student withdrew this application.');
    if (!canMove(a.stage, req.body.stage)) throw conflict('INVALID_STAGE', `Cannot move from ${a.stage} to ${req.body.stage}.`);
    a.stage = req.body.stage; a.statusMessage = req.body.message || a.statusMessage;
    a.stageHistory.push({ stage: req.body.stage, by: req.user._id, message: req.body.message });
    await a.save();
    await notify(a.studentId, 'Application update', `${opp.title}: ${uiStage(a.stage)}`, 'application');
    res.json({ stage: a.stage, studentSees: uiStage(a.stage) });
  });

  // ---- anti-scam reporting ----
  r.post('/reports', A, requireRole('student', 'mentor'), validate(z.object({ targetType: z.enum(['opportunity', 'user']), targetId: z.string(), reason: z.string().trim().min(3).max(300) }).strict()), async (req, res) => {
    toObjectId(req.body.targetId, 'target id');
    try { await Report.create({ ...req.body, reporterId: req.user._id }); } catch (e) { if (e.code === 11000) throw conflict('ALREADY_REPORTED', 'You already reported this.'); throw e; }
    let hidden = false;
    if (req.body.targetType === 'opportunity') {
      const count = await Report.countDocuments({ targetType: 'opportunity', targetId: req.body.targetId });
      const opp = await Opportunity.findByIdAndUpdate(req.body.targetId, { reportCount: count }, { returnDocument: 'after' });
      if (opp && count >= env.reportHideThreshold && opp.status === 'approved') {
        opp.status = 'hidden'; await opp.save(); hidden = true;
        await audit(req.user._id, 'auto_hide_opportunity', 'opportunity', opp._id, { reports: count });
      }
    }
    res.status(201).json({ ok: true, hidden });
  });
  return r;
};
