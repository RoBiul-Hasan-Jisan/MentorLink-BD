const express = require('express');
const { z } = require('zod');
const { Resource, Skill, User, University, MentorProfile, StudentProfile, SkillEvidence, Opportunity, Report, AuditLog, Application, Match, SavedJob } = require('../models');
const aj = require('../services/adminjobs');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/guards');
const { notFound, bad } = require('../utils/httpError');
const { audit, notify, toObjectId } = require('../utils/helpers');

module.exports = function adminRoutes(auth) {
  const r = express.Router();
  const admin = [auth.authenticate, requireRole('admin')];

  r.get('/admin/verification-queue', ...admin, async (_q, res) => {
    const [users, mentorApps, opps, hidden] = await Promise.all([
      User.find({ verificationStatus: 'pending', role: { $in: ['student', 'mentor', 'department'] } }).select('displayName email role universityId department verificationProof').limit(100),
      User.find({ 'mentorApplication.status': 'pending' }).select('displayName email mentorApplication universityId'),
      Opportunity.find({ status: 'pending' }).limit(100),
      Opportunity.find({ status: 'hidden' }).select('title organization suspiciousFlags status').limit(100), // auto-hidden after 3 reports: admin can restore or remove
    ]);
    res.json({ users, mentorApplications: mentorApps, opportunities: opps, hiddenOpportunities: hidden });
  });
  r.post('/admin/users/:id/verify', ...admin, validate(z.object({ decision: z.enum(['verified', 'rejected']) }).strict()), async (req, res) => {
    toObjectId(req.params.id);
    const u = await User.findByIdAndUpdate(req.params.id, { verificationStatus: req.body.decision }, { returnDocument: 'after' });
    if (!u) throw notFound();
    if (req.body.decision === 'rejected') await require('../models').VerificationDoc.deleteMany({ userId: u._id }); // rejected proof is deleted
    await audit(req.user._id, `user_${req.body.decision}`, 'user', u._id);
    await notify(u._id, `Verification ${req.body.decision}`, '', 'verification');
    res.json({ ok: true });
  });
  // Only here can a role change to mentor.
  r.post('/admin/mentor-applications/:id', ...admin, validate(z.object({ decision: z.enum(['approved', 'rejected']) }).strict()), async (req, res) => {
    toObjectId(req.params.id);
    const u = await User.findById(req.params.id);
    if (!u || u.mentorApplication.status !== 'pending') throw notFound();
    u.mentorApplication.status = req.body.decision;
    if (req.body.decision === 'approved') {
      u.role = 'mentor'; u.verificationStatus = 'verified';
      await MentorProfile.updateOne({ userId: u._id }, { $setOnInsert: { userId: u._id, roleTitle: u.mentorApplication.roleTitle, industry: u.mentorApplication.industry, yearsExperience: u.mentorApplication.yearsExperience, isRising: true } }, { upsert: true });
    }
    await u.save();
    if (req.body.decision === 'rejected') await require('../models').VerificationDoc.deleteMany({ userId: u._id });
    await audit(req.user._id, `mentor_application_${req.body.decision}`, 'user', u._id);
    res.json({ ok: true, role: u.role });
  });
  r.post('/admin/opportunities/:id/review', ...admin, validate(z.object({ decision: z.enum(['approve', 'reject', 'restore', 'remove']) }).strict()), async (req, res) => {
    toObjectId(req.params.id);
    const map = { approve: 'approved', restore: 'approved', reject: 'removed', remove: 'removed' };
    const o = await Opportunity.findById(req.params.id);
    if (!o) throw notFound();
    o.status = map[req.body.decision]; o.reviewedBy = req.user._id; o.reviewedAt = new Date();
    if (['approve', 'restore'].includes(req.body.decision)) o.listingReviewed = true;
    await o.save();
    if (req.body.decision !== 'approve') await Report.updateMany({ targetType: 'opportunity', targetId: o._id }, { status: req.body.decision === 'restore' ? 'dismissed' : 'actioned' });
    await audit(req.user._id, `opportunity_${req.body.decision}`, 'opportunity', o._id);
    // The person who posted it hears the decision (a student or alumnus posting for the first time would otherwise wait in silence).
    const said = { approve: 'Your job post was approved and is now visible.', restore: 'Your job post is visible again.', reject: 'Your job post was not approved.', remove: 'Your job post was removed.' }[req.body.decision];
    if (o.postedBy) await notify(o.postedBy, said, o.title, 'opportunity', { type: 'opportunity', id: String(o._id) });
    res.json({ status: o.status });
  });
  // Safety reports (users, opportunities, resources). The reporter is never shown; the queue shows what was reported and why.
  r.get('/admin/reports', ...admin, async (req, res) => {
    const status = ['open', 'actioned', 'dismissed'].includes(String(req.query.status)) ? String(req.query.status) : 'open';
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const list = await Report.find({ status }).sort({ createdAt: -1 }).limit(limit).select('targetType targetId reason status createdAt').lean();
    const userIds = list.filter((x) => x.targetType === 'user').map((x) => x.targetId);
    const names = new Map((await User.find({ _id: { $in: userIds } }).select('displayName role').lean()).map((u) => [String(u._id), u]));
    res.json({ status, reports: list.map((x) => ({ id: x._id, targetType: x.targetType, targetId: x.targetId, reason: x.reason, status: x.status, createdAt: x.createdAt, targetName: (names.get(String(x.targetId)) || {}).displayName || null, targetRole: (names.get(String(x.targetId)) || {}).role || null })) });
  });
  r.post('/admin/reports/:id/resolve', ...admin, validate(z.object({ decision: z.enum(['actioned', 'dismissed']) }).strict()), async (req, res) => {
    toObjectId(req.params.id);
    const rep = await Report.findOneAndUpdate({ _id: req.params.id, status: 'open' }, { status: req.body.decision }, { returnDocument: 'after' });
    if (!rep) throw notFound('No open report with this id.');
    await audit(req.user._id, `report_${req.body.decision}`, 'report', rep._id, { targetType: rep.targetType });
    res.json({ ok: true, status: rep.status });
  });
  // ALL job posts, any status, with how many people applied (by stage) and how many saved it. Filters: status, q, page, limit.
  r.get('/admin/jobs', ...admin, async (req, res) => {
    const p = aj.parseAdminParams(req.query);
    const jobs = await Opportunity.find({}).sort({ createdAt: -1 }).limit(2000).lean();
    const ids = jobs.map((j) => j._id);
    const [apps, saves] = await Promise.all([
      Application.find({ opportunityId: { $in: ids } }).select('opportunityId stage').lean(),
      SavedJob.find({ opportunityId: { $in: ids } }).select('opportunityId').lean(),
    ]);
    const appsBy = aj.groupBy(apps, 'opportunityId'), savesBy = aj.groupBy(saves, 'opportunityId');
    const page = aj.paginate(aj.filterAdminJobs(jobs, p), p.page, p.limit);
    const posters = new Map((await User.find({ _id: { $in: page.items.map((j) => j.postedBy) } }).select('displayName').lean()).map((u) => [String(u._id), u.displayName]));
    res.json({
      totals: aj.totals(jobs, appsBy, savesBy),
      jobs: page.items.map((j) => aj.jobRow(j, appsBy.get(String(j._id)) || [], (savesBy.get(String(j._id)) || []).length, posters.get(String(j.postedBy)) || '')),
      total: page.total, page: page.page, limit: page.limit, hasMore: page.hasMore,
    });
  });
  // Who applied to one job. Names, department, stage and date only: never the CV, note or contact details.
  r.get('/admin/jobs/:id/applications', ...admin, async (req, res) => {
    toObjectId(req.params.id);
    const job = await Opportunity.findById(req.params.id).lean();
    if (!job) throw notFound();
    const apps = await Application.find({ opportunityId: job._id }).sort({ createdAt: -1 }).limit(500).select('studentId stage createdAt').lean();
    const students = new Map((await User.find({ _id: { $in: apps.map((a) => a.studentId) } }).select('displayName department').lean()).map((u) => [String(u._id), u]));
    res.json({ job: { id: job._id, title: job.title, organization: job.organization, status: job.status }, byStage: aj.countByStage(apps), applications: apps.map((a) => aj.applicantRow(a, students.get(String(a.studentId)))) });
  });
  r.get('/admin/audit-logs', ...admin, async (req, res) => {
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '100'), 10) || 100));
    const filter = {};
    if (req.query.before) { const b = new Date(String(req.query.before)); if (!Number.isNaN(b.getTime())) filter.createdAt = { $lt: b }; }
    res.json({ logs: await AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit) });
  });

  // Fairness check: share of recent recommendations per mentor.
  r.get('/admin/fairness', ...admin, async (_q, res) => {
    const ms = await Match.find();
    const counts = {};
    for (const m of ms) counts[m.mentorId] = (counts[m.mentorId] || 0) + 1;
    const total = ms.length || 1;
    const users = await User.find({ _id: { $in: Object.keys(counts) } }).select('displayName');
    res.json({ total: ms.length, mentors: users.map((u) => ({ name: u.displayName, share: Math.round((100 * counts[u._id]) / total) })).sort((a, b) => b.share - a.share) });
  });

  // University management (the only place campus coordinates are accepted).
  const uniSchema = z.object({ name: z.string().min(3).max(120), shortName: z.string().min(2).max(20), city: z.string().min(2).max(60), lat: z.number().min(20.5).max(26.7), lng: z.number().min(88).max(92.8), campusAddressText: z.string().max(200).optional(), emailDomains: z.array(z.string()).optional() }).strict();
  r.post('/admin/universities', ...admin, validate(uniSchema), async (req, res) => {
    const { lat, lng, ...rest } = req.body;
    const u = await University.create({ ...rest, campus: { type: 'Point', coordinates: [lng, lat] } });
    await audit(req.user._id, 'university_create', 'university', u._id);
    res.status(201).json({ id: u._id });
  });
  r.patch('/admin/universities/:id', ...admin, validate(uniSchema.partial()), async (req, res) => {
    toObjectId(req.params.id);
    const { lat, lng, ...rest } = req.body;
    const set = { ...rest };
    if ((lat === undefined) !== (lng === undefined)) throw bad('BOTH_COORDS', 'Send lat and lng together.');
    if (lat !== undefined) set.campus = { type: 'Point', coordinates: [lng, lat] };
    const u = await University.findByIdAndUpdate(req.params.id, { $set: set }, { returnDocument: 'after' });
    if (!u) throw notFound();
    await audit(req.user._id, 'university_update', 'university', u._id);
    res.json({ ok: true });
  });

  const resSchema = z.object({ title: z.string().min(3).max(140), url: z.string().url().max(300).refine((u) => /^https:\/\//.test(u), 'must be https'), skillKey: z.string(), language: z.enum(['bn', 'en']).default('en'), kind: z.enum(['course', 'video', 'article', 'practice']).default('course') }).strict();
  r.post('/admin/resources', ...admin, validate(resSchema), async (req, res) => {
    if (!(await Skill.findOne({ key: req.body.skillKey }))) throw bad('UNKNOWN_SKILL', 'Unknown skill.');
    const doc = await Resource.create({ ...req.body, addedBy: req.user._id });
    await audit(req.user._id, 'resource_add', 'resource', doc._id);
    res.status(201).json({ id: doc._id });
  });
  // Checks every approved resource link (up to 100 per run). Broken links are flagged, never hidden automatically.
  r.post('/admin/resources/check-links', ...admin, async (req, res) => {
    const { checkUrl } = require('../services/linkcheck');
    const list = await Resource.find({ status: 'approved' }).limit(100);
    const out = { ok: 0, broken: 0, blocked: 0 };
    for (let i = 0; i < list.length; i += 5) {
      await Promise.all(list.slice(i, i + 5).map(async (x) => {
        const r = await (req.app.get('checkUrl') || checkUrl)(x.url);
        x.linkStatus = r.status; x.lastLinkCheckedAt = new Date(); await x.save(); out[r.status] += 1;
      }));
    }
    await audit(req.user._id, 'resource_link_check', 'resource', null, out);
    res.json(out);
  });
  r.delete('/admin/resources/:id', ...admin, async (req, res) => {
    toObjectId(req.params.id);
    const d = await Resource.findByIdAndUpdate(req.params.id, { status: 'hidden' });
    if (!d) throw notFound();
    await audit(req.user._id, 'resource_hide', 'resource', d._id);
    res.json({ ok: true });
  });

  // Department: anonymized numbers for their own university only. Groups smaller than 3 are hidden.
  r.get('/department/overview', auth.authenticate, requireRole('department', 'admin'), async (req, res) => {
    const uid = req.user.role === 'admin' ? req.query.universityId : req.user.universityId;
    if (!uid) throw bad('UNIVERSITY_REQUIRED', 'universityId is required.');
    const studs = await User.find({ universityId: uid, role: 'student' }).select('_id');
    const ids = studs.map((s) => s._id);
    const goals = await StudentProfile.aggregate([{ $match: { userId: { $in: ids }, careerGoalRoleKey: { $ne: null } } }, { $group: { _id: '$careerGoalRoleKey', n: { $sum: 1 } } }]);
    const applications = await Application.countDocuments({ studentId: { $in: ids } });
    const K = 3;
    res.json({
      students: studs.length >= K ? studs.length : null,
      careerGoals: goals.filter((g) => g.n >= K).map((g) => ({ role: g._id, count: g.n })),
      applications: studs.length >= K ? applications : null,
      note: `Groups smaller than ${K} are hidden to protect privacy.`,
    });
  });
  return r;
};
