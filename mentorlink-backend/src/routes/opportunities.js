const router = require('express').Router();
const { z } = require('zod');
const { authenticateFirebase, requireRole } = require('../middleware/auth');
const privacyGuard = require('../middleware/privacyGuard');
const env = require('../config/env');
const Opportunity = require('../models/Opportunity');
const Application = require('../models/Application');
const CvVersion = require('../models/CvVersion');
const Report = require('../models/Report');
const Skill = require('../models/Skill');
const University = require('../models/University');
const ConsentRecord = require('../models/ConsentRecord');
const { loadLevels } = require('../services/studentContext');
const { opportunityFit } = require('../services/fit');
const { uiStage, timeline } = require('../services/stageMachine');
const { notify } = require('../services/notify');
const { flagOpportunity } = require('../utils/scamKeywords');
const { shortName } = require('../utils/publicCard');
const audit = require('../utils/audit');
const { objectId, pageQuery } = require('../utils/validators');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

router.use(authenticateFirebase, privacyGuard, requireRole('student', 'mentor', 'admin'));

const same = (a, b) => String(a) === String(b);
const CONTENT_KEYS = ['title', 'organization', 'employmentType', 'workplaceMode', 'city', 'salaryRange', 'description', 'requiredSkills', 'applicationDeadline'];

const skillReq = z.object({ skillKey: z.string().min(1), weight: z.number().int().min(1).max(5), requiredLevel: z.number().int().min(1).max(3) }).strict();
const baseShape = {
  title: z.string().trim().min(3).max(120),
  organization: z.string().trim().max(120).default(''),
  employmentType: z.enum(['full_time', 'part_time', 'internship', 'freelance', 'contract']),
  workplaceMode: z.enum(['onsite', 'hybrid', 'remote']).default('onsite'),
  city: z.string().trim().max(80).optional(), // job location text, never an applicant location
  salaryRange: z.object({ min: z.number().min(0), max: z.number().min(0), currency: z.string().length(3).default('BDT') }).strict().refine((s) => s.min <= s.max, 'min must be <= max').optional(),
  description: z.string().trim().min(10).max(3000),
  requiredSkills: z.array(skillReq).min(1).max(10),
  applicationDeadline: z.coerce.date().refine((d) => d.getTime() > Date.now(), 'must be in the future'),
};
// noFeeConfirmed must be literally true: a post without the no-fee declaration cannot be created.
const createSchema = z.object({ ...baseShape, noFeeConfirmed: z.literal(true) }).strict();

async function checkSkills(requiredSkills) {
  const keys = [...new Set(requiredSkills.map((s) => s.skillKey))];
  if (keys.length !== requiredSkills.length) throw new AppError(400, 'DUPLICATE_SKILL', 'Each skill can appear once');
  if ((await Skill.countDocuments({ key: { $in: keys } })) !== keys.length) throw new AppError(400, 'UNKNOWN_SKILL', 'Unknown skill key');
}

// Three DIFFERENT claims, never merged: who posted it, whether an admin reviewed the listing, and the no-fee declaration.
const labels = (o) => ({ source: o.posterRole === 'mentor' ? 'verified_alumni' : 'admin', listingReviewed: !!o.reviewedBy, noFeeDeclared: o.noFeeConfirmed, organizationVerified: false });

function ser(o, { names = {}, fit = null, applied = null, poster = null, includeFlags = false } = {}) {
  return {
    id: String(o._id), title: o.title, organization: o.organization, type: o.type, employmentType: o.employmentType, workplaceMode: o.workplaceMode,
    city: o.city || null, salaryRange: o.salaryRange && o.salaryRange.max != null ? o.salaryRange : null, description: o.description,
    requiredSkills: o.requiredSkills.map((r) => ({ skillKey: r.skillKey, ...names[r.skillKey], weight: r.weight, requiredLevel: r.requiredLevel })),
    applicationDeadline: o.applicationDeadline, status: o.status, labels: labels(o), postedBy: poster, createdAt: o.createdAt,
    ...(fit && { fit }), ...(applied && { application: applied }), ...(includeFlags && { flags: o.flags, reportCount: o.reportCount }),
  };
}
const namesMap = async () => Object.fromEntries((await Skill.find()).map((s) => [s.key, { nameEn: s.nameEn, nameBn: s.nameBn }]));
const posterOf = (o) => (o.postedBy && o.postedBy.displayName ? { id: String(o.postedBy._id), displayName: o.postedBy.displayName } : null);

// ---------- create ----------
router.post('/', requireRole('mentor', 'admin'), asyncHandler(async (req, res) => {
  if (req.user.verificationStatus !== 'verified') throw new AppError(403, 'NOT_VERIFIED', 'Only verified posters can post');
  const b = createSchema.parse(req.body);
  await checkSkills(b.requiredSkills);
  const flags = flagOpportunity(b);
  // First post needs admin review. Later posts are auto-approved only if clean (no suspicious keywords).
  const hasApproved = await Opportunity.exists({ postedBy: req.user._id, status: 'approved' });
  const status = !flags.length && (req.user.role === 'admin' || hasApproved) ? 'approved' : 'pending';
  const o = await Opportunity.create({ ...b, postedBy: req.user._id, posterRole: req.user.role, type: b.employmentType === 'internship' ? 'internship' : 'job', flags, status });
  res.status(201).json({ opportunity: ser(o, { names: await namesMap(), includeFlags: true }), review: status === 'pending' ? 'An admin will review your post, usually within 48 hours.' : null });
}));

// ---------- board ----------
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit } = pageQuery.parse(req.query);
  const { employmentType } = z.object({ employmentType: z.enum(['full_time', 'part_time', 'internship', 'freelance', 'contract']).optional() }).parse(req.query);
  const filter = { status: 'approved', applicationDeadline: { $gte: new Date() }, ...(employmentType && { employmentType }) };
  const [items, total, names] = await Promise.all([
    Opportunity.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('postedBy', 'displayName'),
    Opportunity.countDocuments(filter), namesMap(),
  ]);
  let fitData = null, appliedBy = new Map(), hiddenStubs = [];
  if (req.user.role === 'student') {
    const ids = items.map((o) => o._id);
    const [lv, apps, reported] = await Promise.all([loadLevels(req.user._id), Application.find({ studentId: req.user._id, opportunityId: { $in: ids } }), Report.distinct('targetId', { reporterId: req.user._id, targetType: 'opportunity' })]);
    fitData = lv;
    appliedBy = new Map(apps.map((a) => [String(a.opportunityId), { id: String(a._id), stage: a.stage, uiStage: uiStage(a.stage) }]));
    // Posts you reported that are now hidden show as a stub ("Hidden until admin review"), nothing else about them.
    hiddenStubs = (await Opportunity.find({ _id: { $in: reported }, status: 'hidden' })).map((o) => ({ id: String(o._id), title: o.title, status: 'hidden', reportCount: o.reportCount }));
  }
  res.json({ items: items.map((o) => ser(o, { names, poster: posterOf(o), applied: appliedBy.get(String(o._id)),
    fit: fitData && opportunityFit(o.requiredSkills, fitData.levels, fitData.hours, fitData.weeklyHours, names) })), hiddenByYourReport: hiddenStubs, page, limit, total });
}));

router.get('/mine', requireRole('mentor', 'admin'), asyncHandler(async (req, res) => {
  const [items, names] = await Promise.all([Opportunity.find({ postedBy: req.user._id }).sort({ createdAt: -1 }).limit(50), namesMap()]);
  const counts = await Application.aggregate([{ $match: { opportunityId: { $in: items.map((o) => o._id) } } }, { $group: { _id: '$opportunityId', n: { $sum: 1 } } }]);
  const by = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({ items: items.map((o) => ({ ...ser(o, { names, includeFlags: true }), applicationCount: by.get(String(o._id)) || 0 })) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const o = await Opportunity.findById(objectId.parse(req.params.id)).populate('postedBy', 'displayName');
  const owner = o && same(o.postedBy._id, req.user._id);
  if (!o || (!owner && req.user.role !== 'admin' && o.status !== 'approved')) throw new AppError(404, 'NOT_FOUND', 'Opportunity not found'); // pending/hidden/removed are invisible to others
  const names = await namesMap();
  let fit = null, applied = null;
  if (req.user.role === 'student') {
    const [lv, app] = await Promise.all([loadLevels(req.user._id), Application.findOne({ studentId: req.user._id, opportunityId: o._id })]);
    fit = opportunityFit(o.requiredSkills, lv.levels, lv.hours, lv.weeklyHours, names);
    applied = app && { id: String(app._id), stage: app.stage, uiStage: uiStage(app.stage) };
  }
  res.json({ opportunity: ser(o, { names, poster: posterOf(o), fit, applied, includeFlags: owner || req.user.role === 'admin' }) });
}));

// ---------- edit / close (poster only). Edits to a live post go back to review so "listing reviewed" stays true ----------
router.patch('/:id', requireRole('mentor', 'admin'), asyncHandler(async (req, res) => {
  const patch = z.object(baseShape).partial().strict().parse(req.body);
  const o = await Opportunity.findOne({ _id: objectId.parse(req.params.id), postedBy: req.user._id });
  if (!o) throw new AppError(404, 'NOT_FOUND', 'Opportunity not found');
  if (['removed', 'closed'].includes(o.status)) throw new AppError(409, 'NOT_EDITABLE', 'This post is closed');
  if (patch.requiredSkills) await checkSkills(patch.requiredSkills);
  const changed = CONTENT_KEYS.some((k) => k in patch);
  Object.assign(o, patch);
  if (changed) {
    o.flags = flagOpportunity(o);
    if (req.user.role === 'mentor' || o.flags.length) { o.status = 'pending'; o.reviewedBy = undefined; o.reviewedAt = undefined; }
  }
  await o.save();
  res.json({ opportunity: ser(o, { names: await namesMap(), includeFlags: true }) });
}));

router.post('/:id/close', requireRole('mentor', 'admin'), asyncHandler(async (req, res) => {
  const o = await Opportunity.findOneAndUpdate({ _id: objectId.parse(req.params.id), postedBy: req.user._id, status: { $in: ['pending', 'approved', 'hidden'] } }, { $set: { status: 'closed' } }, { new: true });
  if (!o) throw new AppError(404, 'NOT_FOUND', 'Opportunity not found or already closed');
  res.json({ opportunity: ser(o, { names: await namesMap() }) });
}));

// ---------- report: one person counts once; 3 different people hide the post until an admin decides ----------
router.post('/:id/report', requireRole('student', 'mentor'), asyncHandler(async (req, res) => {
  const b = z.object({ reason: z.enum(['fee_requested', 'fake_company', 'misleading', 'inappropriate', 'other']), details: z.string().trim().max(500).optional() }).strict().parse(req.body);
  const o = await Opportunity.findById(objectId.parse(req.params.id));
  if (!o || !['approved', 'hidden'].includes(o.status)) throw new AppError(404, 'NOT_FOUND', 'Opportunity not found');
  if (same(o.postedBy, req.user._id)) throw new AppError(400, 'OWN_POST', 'You cannot report your own post');

  let alreadyReported = false;
  try { await Report.create({ reporterId: req.user._id, targetType: 'opportunity', targetId: o._id, ...b }); }
  catch (e) { if (e.code === 11000) alreadyReported = true; else throw e; } // unique index: a repeat report changes nothing

  const openCount = await Report.countDocuments({ targetType: 'opportunity', targetId: o._id, status: 'open' }); // = distinct reporters
  await Opportunity.updateOne({ _id: o._id }, { $set: { reportCount: openCount } });
  let hidden = o.status === 'hidden';
  if (openCount >= env.REPORT_HIDE_THRESHOLD) {
    const r = await Opportunity.updateOne({ _id: o._id, status: 'approved' }, { $set: { status: 'hidden' } });
    if (r.modifiedCount) {
      hidden = true;
      await audit(null, 'opportunity.auto_hide', 'Opportunity', o._id, { openReports: openCount, threshold: env.REPORT_HIDE_THRESHOLD });
      await notify(o.postedBy, { type: 'post_hidden', title: { en: 'Your post is hidden for review', bn: 'আপনার পোস্ট রিভিউয়ের জন্য লুকানো হয়েছে' },
        body: { en: 'Several people reported it. An admin will review it.', bn: 'একাধিক ব্যক্তি রিপোর্ট করেছেন। অ্যাডমিন রিভিউ করবেন।' }, data: { opportunityId: String(o._id) } });
    }
  }
  res.status(alreadyReported ? 200 : 201).json({ reported: true, alreadyReported, hidden });
}));

// ---------- apply (needs a verified student, a CV version and an explicit consent) ----------
const applySchema = z.object({
  cvVersionId: objectId,
  applicantNote: z.string().trim().max(500).optional(),
  consent: z.object({ shareCv: z.literal(true), shareReadiness: z.boolean().default(false), shareDepartment: z.boolean().default(false) }).strict(),
}).strict();

router.post('/:id/apply', requireRole('student'), asyncHandler(async (req, res) => {
  const b = applySchema.parse(req.body);
  if (req.user.verificationStatus !== 'verified') throw new AppError(403, 'NOT_VERIFIED', 'Only verified students can apply');
  const o = await Opportunity.findById(objectId.parse(req.params.id));
  if (!o || o.status !== 'approved') throw new AppError(404, 'NOT_FOUND', 'Opportunity not found');
  if (o.applicationDeadline < new Date()) throw new AppError(409, 'DEADLINE_PASSED', 'Applications are closed');
  const cv = await CvVersion.findOne({ _id: b.cvVersionId, studentId: req.user._id });
  if (!cv) throw new AppError(400, 'CV_NOT_FOUND', 'Choose one of your own CV versions');

  const lv = await loadLevels(req.user._id);
  const fit = opportunityFit(o.requiredSkills, lv.levels, lv.hours, lv.weeklyHours, lv.names);
  const fields = ['displayName', 'university', 'cv', ...(b.consent.shareDepartment ? ['department'] : []), ...(b.consent.shareReadiness ? ['fit'] : [])];
  const consentedAt = new Date();
  let app;
  try {
    app = await Application.create({ studentId: req.user._id, opportunityId: o._id, cvVersionId: cv._id, applicantNote: b.applicantNote, fitSnapshot: fit,
      consentSnapshot: { fields, cvVersionId: cv._id, consentedAt, version: 'v1' }, stageHistory: [{ stage: 'Applied', by: req.user._id, message: 'Application received' }], statusMessage: 'Your application was received.' });
  } catch (e) {
    if (e.code === 11000) throw new AppError(409, 'ALREADY_APPLIED', 'You already applied to this post'); // unique studentId + opportunityId
    throw e;
  }
  await ConsentRecord.create({ userId: req.user._id, key: 'application_share', value: fields, meta: { opportunityId: String(o._id), applicationId: String(app._id) } });
  await notify(o.postedBy, { type: 'application_new', title: { en: 'New application', bn: 'নতুন আবেদন' },
    body: { en: `${shortName(req.user.displayName)} applied for ${o.title}`, bn: `${shortName(req.user.displayName)} ${o.title}-এ আবেদন করেছেন` }, data: { opportunityId: String(o._id), applicationId: String(app._id) } });
  res.status(201).json({ application: { id: String(app._id), stage: app.stage, uiStage: uiStage(app.stage), sharedFields: fields, consentedAt } });
}));

// ---------- poster sees applicants: ONLY the fields each student consented to (no email, no phone, ever) ----------
router.get('/:id/applications', requireRole('mentor', 'admin'), asyncHandler(async (req, res) => {
  const { page, limit } = pageQuery.parse(req.query);
  const o = await Opportunity.findById(objectId.parse(req.params.id));
  if (!o || (!same(o.postedBy, req.user._id) && req.user.role !== 'admin')) throw new AppError(404, 'NOT_FOUND', 'Opportunity not found');
  if (!same(o.postedBy, req.user._id)) await audit(req.user._id, 'applications.view', 'Opportunity', o._id, {}); // admin access is logged
  const filter = { opportunityId: o._id };
  const [apps, total] = await Promise.all([
    Application.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('studentId', 'displayName department universityId').populate('cvVersionId'),
    Application.countDocuments(filter),
  ]);
  const unis = new Map((await University.find({ _id: { $in: apps.map((a) => a.studentId.universityId) } })).map((u) => [String(u._id), u.name]));
  res.json({ items: apps.map((a) => {
    const f = new Set(a.consentSnapshot.fields), s = a.studentId, cv = a.cvVersionId;
    return { id: String(a._id), stage: a.stage, uiStage: uiStage(a.stage), statusMessage: a.statusMessage || null, appliedAt: a.createdAt, note: a.applicantNote || null,
      applicant: { displayName: shortName(s.displayName), universityName: unis.get(String(s.universityId)) || null, ...(f.has('department') && { department: s.department || null }) },
      cv: f.has('cv') && cv ? { version: cv.version, language: cv.language, headline: cv.headline, summary: cv.summary, education: cv.education, projects: cv.projects } : null,
      fit: f.has('fit') ? a.fitSnapshot : null, sharedFields: [...f] };
  }), page, limit, total });
}));

module.exports = router;
