// Company recruitment portal (Phase 2). Access rule: role=employer AND an active membership in a VERIFIED organization.
const express = require('express');
const { z } = require('zod');
const { Organization, OrganizationMember, Opportunity, Application, CvVersion, User } = require('../models');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/guards');
const { bad, notFound, forbidden, conflict } = require('../utils/httpError');
const { audit, notify, toObjectId } = require('../utils/helpers');
const { normalizeCv, stripContact } = require('../services/cv');
const { scamFlags, uiStage, canMove } = require('../services/scam');
const { STAGES } = require('../models');

module.exports = function employerRoutes(auth) {
  const r = express.Router();
  const A = auth.authenticate;

  // ---- any student-level user can ask to register a company. Role is NOT changed here. ----
  const orgSchema = z.object({
    name: z.string().trim().min(2).max(120), website: z.string().url().max(200).optional(), industry: z.string().max(80).optional(),
    city: z.string().max(80).optional(), publicDescription: z.string().max(600).optional(),
    workEmail: z.string().email().max(120), verificationEvidence: z.string().trim().min(5).max(500),
  }).strict();
  r.post('/orgs/register', A, requireRole('student'), validate(orgSchema), async (req, res) => {
    if (await OrganizationMember.findOne({ userId: req.user._id, status: { $in: ['pending', 'active'] } })) throw conflict('ALREADY_REQUESTED', 'You already have a company request.');
    let org;
    try { org = await Organization.create(req.body); } catch (e) { if (e.code === 11000) throw conflict('ORG_EXISTS', 'A company with this name already exists.'); throw e; }
    await OrganizationMember.create({ organizationId: org._id, userId: req.user._id, membershipRole: 'owner', status: 'pending' });
    res.status(201).json({ id: org._id, verificationStatus: org.verificationStatus });
  });
  r.get('/me/organization', A, requireRole('student', 'employer'), async (req, res) => {
    const m = await OrganizationMember.findOne({ userId: req.user._id, status: { $in: ['pending', 'active'] } });
    const org = m && (await Organization.findById(m.organizationId));
    res.json({ organization: org ? { id: org._id, name: org.name, verificationStatus: org.verificationStatus, membershipStatus: m.status } : null });
  });

  // ---- recruiter tools ----
  async function orgContext(req, _res, next) {
    const m = await OrganizationMember.findOne({ userId: req.user._id, status: 'active' });
    const org = m && (await Organization.findById(m.organizationId));
    if (!org || org.verificationStatus !== 'verified') throw forbidden('Your company is not verified.');
    req.org = org; req.member = m; next();
  }
  const emp = [A, requireRole('employer'), orgContext];

  r.get('/employer/org', ...emp, async (req, res) => {
    const { name, website, industry, city, publicDescription, verificationStatus } = req.org;
    res.json({ organization: { id: req.org._id, name, website, industry, city, publicDescription, verificationStatus } }); // never the private evidence
  });
  r.patch('/employer/org', ...emp, validate(z.object({ website: z.string().url().max(200).optional(), publicDescription: z.string().max(600).optional(), industry: z.string().max(80).optional(), city: z.string().max(80).optional() }).strict()), async (req, res) => {
    Object.assign(req.org, req.body); await req.org.save(); res.json({ ok: true });
  });

  const jobSchema = z.object({
    title: z.string().trim().min(3).max(120), type: z.enum(['job', 'internship', 'other']).default('job'),
    employmentType: z.enum(['full_time', 'part_time', 'internship', 'contract', 'freelance']).optional(),
    workplaceMode: z.enum(['onsite', 'hybrid', 'remote']).default('onsite'), locationText: z.string().max(120).optional(),
    description: z.string().trim().min(20).max(4000), applicationDeadline: z.coerce.date().optional(),
    requiredSkills: z.array(z.object({ skillKey: z.string(), requiredLevel: z.number().int().min(1).max(3).default(2), weight: z.number().min(0).default(1) })).max(10).default([]),
    noFeeConfirmed: z.boolean(),
  }).strict();
  r.post('/employer/jobs', ...emp, validate(jobSchema), async (req, res) => {
    if (!req.body.noFeeConfirmed) throw bad('NO_FEE_REQUIRED', 'You must confirm that this post never asks applicants for money.');
    const flags = scamFlags(`${req.body.title} ${req.body.description}`);
    const hasApproved = await Opportunity.exists({ organizationId: req.org._id, status: 'approved' });
    const auto = !!hasApproved && !flags.length; // the FIRST post of a company is always reviewed by an admin
    const job = await Opportunity.create({ ...req.body, postedBy: req.user._id, organizationId: req.org._id, organization: req.org.name, sourceLabel: 'employer', suspiciousFlags: flags, status: auto ? 'approved' : 'pending', listingReviewed: auto });
    res.status(201).json({ job });
  });
  r.get('/employer/jobs', ...emp, async (req, res) => {
    const jobs = await Opportunity.find({ organizationId: req.org._id }).sort({ createdAt: -1 });
    const counts = await Application.aggregate([{ $match: { opportunityId: { $in: jobs.map((j) => j._id) } } }, { $group: { _id: '$opportunityId', n: { $sum: 1 } } }]);
    res.json({ jobs: jobs.map((j) => ({ ...j.toObject(), applicants: (counts.find((c) => String(c._id) === String(j._id)) || { n: 0 }).n })) });
  });
  async function ownJob(req) {
    toObjectId(req.params.id);
    const j = await Opportunity.findOne({ _id: req.params.id, organizationId: req.org._id }); // other companies' jobs look like 404
    if (!j) throw notFound();
    return j;
  }
  r.post('/employer/jobs/:id/close', ...emp, async (req, res) => { const j = await ownJob(req); j.closed = true; await j.save(); res.json({ ok: true }); });
  r.get('/employer/jobs/:id/applicants', ...emp, async (req, res) => {
    const j = await ownJob(req);
    const apps = await Application.find({ opportunityId: j._id }).populate('studentId', 'displayName department').populate('cvVersionId');
    res.json({ applicants: apps.map((a) => {
      const f = a.consentSnapshot.sharedFields; // only what the student agreed to share
      return { id: a._id, stage: a.stage, studentSees: uiStage(a.stage), name: f.includes('name') ? a.studentId.displayName : undefined, department: f.includes('department') ? a.studentId.department : undefined, cv: f.includes('cv') ? (f.includes('contact') ? normalizeCv(a.cvVersionId.data) : stripContact(normalizeCv(a.cvVersionId.data))) : undefined, note: a.applicantNote, sharedFields: f, consentedAt: a.consentSnapshot.consentedAt };
    }) });
  });
  r.patch('/employer/applications/:id/stage', ...emp, validate(z.object({ stage: z.enum(STAGES), message: z.string().max(200).optional() }).strict()), async (req, res) => {
    toObjectId(req.params.id);
    const a = await Application.findById(req.params.id);
    const job = a && (await Opportunity.findOne({ _id: a.opportunityId, organizationId: req.org._id }));
    if (!a || !job) throw notFound();
    if (req.body.stage === 'Withdrawn') throw forbidden('Only the student can withdraw.');
    if (!canMove(a.stage, req.body.stage)) throw conflict('INVALID_STAGE', `Cannot move from ${a.stage} to ${req.body.stage}.`);
    a.stage = req.body.stage; if (req.body.message) a.statusMessage = req.body.message;
    a.stageHistory.push({ stage: req.body.stage, by: req.user._id, message: req.body.message });
    await a.save();
    await notify(a.studentId, 'Application update', `${job.title}: ${uiStage(a.stage)}`, 'application');
    res.json({ stage: a.stage, studentSees: uiStage(a.stage) });
  });

  // ---- admin: organization verification ----
  const admin = [A, requireRole('admin')];
  r.get('/admin/organizations', ...admin, async (req, res) => {
    const filter = req.query.status ? { verificationStatus: String(req.query.status) } : {};
    res.json({ organizations: await Organization.find(filter).sort({ createdAt: -1 }).limit(100) }); // admin sees the private evidence
  });
  r.post('/admin/organizations/:id/review', ...admin, validate(z.object({ decision: z.enum(['verified', 'rejected', 'suspended']) }).strict()), async (req, res) => {
    toObjectId(req.params.id);
    const org = await Organization.findById(req.params.id);
    if (!org) throw notFound();
    org.verificationStatus = req.body.decision; org.reviewedBy = req.user._id; org.reviewedAt = new Date();
    await org.save();
    const members = await OrganizationMember.find({ organizationId: org._id, status: { $in: ['pending', 'active'] } });
    for (const m of members) {
      if (req.body.decision === 'verified') {
        m.status = 'active'; await m.save();
        await User.updateOne({ _id: m.userId, role: 'student' }, { role: 'employer' }); // role is promoted ONLY here, by the server
        await notify(m.userId, 'Company verified', org.name, 'organization');
      } else if (req.body.decision === 'suspended') {
        await Opportunity.updateMany({ organizationId: org._id, status: 'approved' }, { status: 'hidden' });
      }
    }
    await audit(req.user._id, `organization_${req.body.decision}`, 'organization', org._id);
    res.json({ ok: true });
  });
  return r;
};
