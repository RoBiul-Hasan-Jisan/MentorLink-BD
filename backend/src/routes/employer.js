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
const { STAGES, SkillEvidence, Skill } = require('../models');
const { levelsFromEvidence } = require('../services/readiness');
const jobtools = require('../services/jobtools');
const employerStats = require('../services/employerstats');

module.exports = function employerRoutes(auth) {
  const r = express.Router();
  const A = auth.authenticate;

  // A company is registered ONLY together with a recruiter account (POST /api/auth/register-recruiter in core.js).
  // Students cannot register a company: their role is fixed to student.
  r.get('/me/organization', A, requireRole('employer'), async (req, res) => {
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
    res.json({ organization: { id: req.org._id, name, website, industry, city, publicDescription, verificationStatus }, responsiveness: await jobtools.responseStats(req.org._id) }); // never the private evidence
  });
  r.patch('/employer/org', ...emp, validate(z.object({ website: z.string().url().max(200).optional(), publicDescription: z.string().max(600).optional(), industry: z.string().max(80).optional(), city: z.string().max(80).optional() }).strict()), async (req, res) => {
    Object.assign(req.org, req.body); await req.org.save(); res.json({ ok: true });
  });

  const skillItem = z.object({ skillKey: z.string(), requiredLevel: z.number().int().min(1).max(3).default(2), weight: z.number().min(0).default(1) });
  const jobFields = {
    title: z.string().trim().min(3).max(120), type: z.enum(['job', 'internship', 'other']).default('job'),
    employmentType: z.enum(['full_time', 'part_time', 'internship', 'contract', 'freelance']).optional(),
    workplaceMode: z.enum(['onsite', 'hybrid', 'remote']).default('onsite'), locationText: z.string().max(120).optional(),
    description: z.string().trim().min(20).max(4000), applicationDeadline: z.coerce.date().optional(),
    requiredSkills: z.array(skillItem).max(10).default([]),
    salaryMin: z.number().int().min(0).max(10000000).optional(), salaryMax: z.number().int().min(0).max(10000000).optional(), // BDT per month
    vacancies: z.number().int().min(1).max(500).default(1),
    experienceLevel: z.enum(['fresher', 'junior', 'mid']).optional(),
    screeningQuestions: z.array(z.string().trim().min(3).max(200)).max(3).default([]),
  };
  const salaryOk = (b) => !(b.salaryMin !== undefined && b.salaryMax !== undefined && b.salaryMax < b.salaryMin);
  const jobSchema = z.object({ ...jobFields, noFeeConfirmed: z.boolean(), saveAsDraft: z.boolean().optional() }).strict();
  const editSchema = z.object({ ...Object.fromEntries(Object.entries(jobFields).map(([k, v]) => [k, v.optional()])), applicationDeadline: z.coerce.date().nullable().optional() }).strict(); // null = no deadline
  const pastDeadline = (d) => d && new Date(d) < new Date();

  // Every new post (and every repost) waits for an admin to approve it. Students only see it after approval. Money words are still flagged for the admin.
  async function publishStatus(org, text) {
    const flags = scamFlags(text);
    return { flags, auto: false, fields: { status: 'pending', listingReviewed: false, reviewDueAt: jobtools.reviewDue() } };
  }
  async function afterPublish(job) { if (job.status === 'approved') await jobtools.alertMatchingStudents(job); }

  r.post('/employer/jobs', ...emp, validate(jobSchema), async (req, res) => {
    const { saveAsDraft, ...body } = req.body;
    if (!salaryOk(body)) throw bad('BAD_SALARY', 'The highest salary cannot be below the lowest.');
    if (pastDeadline(body.applicationDeadline)) throw bad('BAD_DEADLINE', 'The deadline must be a future date.');
    if (!saveAsDraft && !body.noFeeConfirmed) throw bad('NO_FEE_REQUIRED', 'You must confirm that this post never asks applicants for money.');
    const base = { ...body, postedBy: req.user._id, organizationId: req.org._id, organization: req.org.name, sourceLabel: 'employer', suspiciousFlags: scamFlags(`${body.title} ${body.description}`) };
    if (saveAsDraft) return res.status(201).json({ job: await Opportunity.create({ ...base, status: 'draft', listingReviewed: false }) }); // a draft is private to the company
    const pub = await publishStatus(req.org, `${body.title} ${body.description}`);
    const job = await Opportunity.create({ ...base, suspiciousFlags: pub.flags, ...pub.fields });
    await afterPublish(job);
    res.status(201).json({ job });
  });
  r.get('/employer/jobs', ...emp, async (req, res) => {
    await jobtools.closeExpiredJobs();
    const jobs = await Opportunity.find({ organizationId: req.org._id }).sort({ createdAt: -1 });
    const ids = jobs.map((j) => j._id);
    const counts = await Application.aggregate([{ $match: { opportunityId: { $in: ids } } }, { $group: { _id: '$opportunityId', n: { $sum: 1 } } }]);
    const saves = await require('../models').SavedJob.aggregate([{ $match: { opportunityId: { $in: ids } } }, { $group: { _id: '$opportunityId', n: { $sum: 1 } } }]);
    const num = (arr, j) => (arr.find((c) => String(c._id) === String(j._id)) || { n: 0 }).n;
    res.json({ jobs: jobs.map((j) => ({ ...j.toObject(), applicants: num(counts, j), saves: num(saves, j) })) });
  });
  async function ownJob(req) {
    toObjectId(req.params.id);
    const j = await Opportunity.findOne({ _id: req.params.id, organizationId: req.org._id }); // other companies' jobs look like 404
    if (!j) throw notFound();
    return j;
  }
  r.post('/employer/jobs/:id/close', ...emp, async (req, res) => { const j = await ownJob(req); j.closed = true; await j.save(); res.json({ ok: true }); });
  // Reopen a closed job. If its deadline has passed, send a new future deadline in the same call (or null for no deadline).
  r.post('/employer/jobs/:id/reopen', ...emp, validate(z.object({ applicationDeadline: z.coerce.date().nullable().optional() }).strict()), async (req, res) => {
    const j = await ownJob(req);
    if (['hidden', 'removed'].includes(j.status)) throw forbidden('An admin hid or removed this job, so it cannot be reopened.');
    const body = req.body || {};
    if (body.applicationDeadline !== undefined) {
      if (pastDeadline(body.applicationDeadline)) throw bad('BAD_DEADLINE', 'The deadline must be a future date.');
      j.applicationDeadline = body.applicationDeadline; // null clears it
    }
    if (pastDeadline(j.applicationDeadline)) throw conflict('DEADLINE_PASSED', 'The deadline has passed. Pick a new deadline first.');
    j.closed = false; await j.save(); res.json({ ok: true, job: j });
  });
  // Edit a job. Admin-removed or hidden jobs cannot be edited. If an edit adds money words, a live job goes back to review.
  r.patch('/employer/jobs/:id', ...emp, validate(editSchema), async (req, res) => {
    const j = await ownJob(req);
    if (['hidden', 'removed'].includes(j.status)) throw forbidden('An admin hid or removed this job, so it cannot be edited.');
    if (!salaryOk({ salaryMin: req.body.salaryMin !== undefined ? req.body.salaryMin : j.salaryMin, salaryMax: req.body.salaryMax !== undefined ? req.body.salaryMax : j.salaryMax })) throw bad('BAD_SALARY', 'The highest salary cannot be below the lowest.');
    if (pastDeadline(req.body.applicationDeadline)) throw bad('BAD_DEADLINE', 'The deadline must be a future date.');
    Object.assign(j, req.body);
    // Giving a closed job a new future deadline (or removing the deadline) opens it again, so students see it right away.
    if (j.closed && req.body.applicationDeadline !== undefined) j.closed = false;
    j.suspiciousFlags = scamFlags(`${j.title} ${j.description}`);
    if (j.status === 'approved' && j.suspiciousFlags.length) { j.status = 'pending'; j.listingReviewed = false; j.reviewDueAt = jobtools.reviewDue(); }
    await j.save();
    res.json({ job: j });
  });
  // Delete a job for good (for example extra copies made by Repost). A job that already has applicants needs ?force=true,
  // which also removes those applications and everything attached to them.
  r.delete('/employer/jobs/:id', ...emp, async (req, res) => {
    const j = await ownJob(req);
    const applicants = await Application.countDocuments({ opportunityId: j._id });
    if (applicants && req.query.force !== 'true') throw conflict('HAS_APPLICANTS', `This job has ${applicants} applicant(s). Deleting it removes their applications too.`);
    const { Interview, AppMessage, DocumentRequest, Offer } = require('../models/hiring');
    const by = { opportunityId: j._id };
    await Promise.all([Application.deleteMany(by), require('../models').SavedJob.deleteMany(by), Interview.deleteMany(by), AppMessage.deleteMany(by), DocumentRequest.deleteMany(by), Offer.deleteMany(by)]);
    await require('../models').DeletedDemoJob.updateOne({ key: j.demoKey || j.title }, { $set: { key: j.demoKey || j.title } }, { upsert: true }); // the demo seed must not bring it back
    await Opportunity.deleteOne({ _id: j._id });
    res.json({ ok: true, removedApplications: applicants });
  });
  // Send a draft for publishing (same rules as a new post).
  r.post('/employer/jobs/:id/submit', ...emp, validate(z.object({ noFeeConfirmed: z.literal(true) }).strict()), async (req, res) => {
    const j = await ownJob(req);
    if (j.status !== 'draft') throw conflict('NOT_A_DRAFT', 'Only a draft can be sent for publishing.');
    const pub = await publishStatus(req.org, `${j.title} ${j.description}`);
    Object.assign(j, { noFeeConfirmed: true, suspiciousFlags: pub.flags, ...pub.fields });
    await j.save(); await afterPublish(j);
    res.json({ job: j });
  });
  // Post the same job again as a new post (new deadline optional). Goes through the same review rules.
  r.post('/employer/jobs/:id/repost', ...emp, validate(z.object({ applicationDeadline: z.coerce.date().optional() }).strict()), async (req, res) => {
    const old = await ownJob(req);
    if (['hidden', 'removed'].includes(old.status)) throw forbidden('An admin hid or removed this job, so it cannot be reposted.');
    if (pastDeadline(req.body.applicationDeadline)) throw bad('BAD_DEADLINE', 'The deadline must be a future date.');
    const o = old.toObject();
    const pub = await publishStatus(req.org, `${o.title} ${o.description}`);
    const job = await Opportunity.create({ postedBy: req.user._id, organizationId: req.org._id, organization: req.org.name, sourceLabel: 'employer', noFeeConfirmed: true,
      title: o.title, type: o.type, employmentType: o.employmentType, workplaceMode: o.workplaceMode, locationText: o.locationText, description: o.description, requiredSkills: o.requiredSkills,
      salaryMin: o.salaryMin, salaryMax: o.salaryMax, vacancies: o.vacancies, experienceLevel: o.experienceLevel, screeningQuestions: o.screeningQuestions, applicationDeadline: req.body.applicationDeadline, suspiciousFlags: pub.flags, ...pub.fields });
    await afterPublish(job);
    res.status(201).json({ job });
  });
  // Company analytics: hiring funnel, time to first reply and time to hire (whole company and per job). Counts only: no student names.
  r.get('/employer/analytics', ...emp, async (req, res) => {
    const jobs = await Opportunity.find({ organizationId: req.org._id }).select('title views status closed createdAt').lean();
    const ids = jobs.map((j) => j._id);
    const apps = await Application.find({ opportunityId: { $in: ids } }).select('opportunityId stage createdAt stageHistory').lean();
    const saves = await require('../models').SavedJob.aggregate([{ $match: { opportunityId: { $in: ids } } }, { $group: { _id: '$opportunityId', n: { $sum: 1 } } }]);
    const saveOf = new Map(saves.map((s) => [String(s._id), s.n]));
    const by = new Map(); for (const a of apps) { const k = String(a.opportunityId); if (!by.has(k)) by.set(k, []); by.get(k).push(a); }
    const perJob = jobs.map((j) => {
      const f = employerStats.funnelFor(by.get(String(j._id)) || []);
      const hired = f.steps.find((s) => s.key === 'hired').count;
      return { id: j._id, title: j.title, status: j.status, closed: !!j.closed, views: j.views || 0, saves: saveOf.get(String(j._id)) || 0, applications: f.total, hired, applyRatePercent: j.views ? Math.round((100 * f.total) / j.views) : null, medianFirstReplyDays: f.medianFirstReplyDays };
    }).sort((a, b) => b.applications - a.applications);
    res.json({ company: employerStats.funnelFor(apps), jobs: perJob, note: 'Counts only. Student names are never part of these numbers. With fewer than 3 applicants the numbers are only a hint.' });
  });
  // Numbers for one job: how many looked, saved, applied, and where applicants are now.
  r.get('/employer/jobs/:id/stats', ...emp, async (req, res) => {
    const j = await ownJob(req);
    const apps = await Application.find({ opportunityId: j._id }).select('stage').lean();
    const byStage = {}; for (const a of apps) byStage[a.stage] = (byStage[a.stage] || 0) + 1;
    const saves = await require('../models').SavedJob.countDocuments({ opportunityId: j._id });
    res.json({ views: j.views || 0, saves, applications: apps.length, byStage, applyRatePercent: j.views ? Math.round((100 * apps.length) / j.views) : null });
  });
  // Applicants, ranked. sort=fit|newest|stage, stage=<one stage>. Fit uses the student's verified skill levels and appears ONLY when the student agreed to share "skills".
  r.get('/employer/jobs/:id/applicants', ...emp, async (req, res) => {
    const j = await ownJob(req);
    const filter = { opportunityId: j._id };
    if (req.query.stage) { if (!STAGES.includes(String(req.query.stage))) throw bad('BAD_QUERY', 'Unknown stage.'); filter.stage = String(req.query.stage); }
    const sort = String(req.query.sort || 'fit');
    if (!['fit', 'newest', 'stage'].includes(sort)) throw bad('BAD_QUERY', 'sort must be fit, newest or stage.');
    const apps = (await Application.find(filter).populate('studentId', 'displayName department').populate('cvVersionId')).filter((a) => a.studentId); // a deleted student has no row
    const evidence = await SkillEvidence.find({ studentId: { $in: apps.map((a) => a.studentId._id) } }).lean();
    const skillName = new Map((await Skill.find({ key: { $in: (j.requiredSkills || []).map((x) => x.skillKey) } }).lean()).map((x) => [x.key, x.nameEn || x.key]));
    const ev = new Map(); for (const e of evidence) { const k = String(e.studentId); if (!ev.has(k)) ev.set(k, []); ev.get(k).push(e); }
    const rows = apps.map((a) => {
      const f = a.consentSnapshot.sharedFields; // only what the student agreed to share
      const fit = f.includes('skills') ? jobtools.fitOf(j, levelsFromEvidence(ev.get(String(a.studentId._id)) || [])) : undefined;
      // "Skill endorsed by a mentor": only for skills this job asks for, only when the student shares skills, and never the mentor's name.
      const wanted = new Set((j.requiredSkills || []).map((x) => x.skillKey));
      const endorsedSkills = f.includes('skills') ? [...new Set((ev.get(String(a.studentId._id)) || []).filter((e) => e.type === 'endorsement' && wanted.has(e.skillKey)).map((e) => skillName.get(e.skillKey) || e.skillKey))] : undefined;
      return { id: a._id, stage: a.stage, studentSees: uiStage(a.stage), appliedAt: a.createdAt, fit, endorsedSkills, mentorEndorsed: endorsedSkills ? endorsedSkills.length > 0 : undefined, name: f.includes('name') ? a.studentId.displayName : undefined, department: f.includes('department') ? a.studentId.department : undefined, cv: f.includes('cv') ? (f.includes('contact') ? normalizeCv(a.cvVersionId.data) : stripContact(normalizeCv(a.cvVersionId.data))) : undefined, note: a.applicantNote, answers: a.answers || [], sharedFields: f, consentedAt: a.consentSnapshot.consentedAt };
    });
    const order = (x) => STAGES.indexOf(x.stage);
    rows.sort(sort === 'fit' ? (x, y) => (y.fit === undefined ? -1 : y.fit) - (x.fit === undefined ? -1 : x.fit) || new Date(y.appliedAt) - new Date(x.appliedAt)
      : sort === 'stage' ? (x, y) => order(x) - order(y) || new Date(y.appliedAt) - new Date(x.appliedAt)
      : (x, y) => new Date(y.appliedAt) - new Date(x.appliedAt));
    res.json({ applicants: rows, job: { title: j.title, screeningQuestions: j.screeningQuestions || [] } });
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
