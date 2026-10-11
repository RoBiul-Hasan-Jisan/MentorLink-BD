const router = require('express').Router();
const { z } = require('zod');
const { authenticateFirebase, requireRole } = require('../middleware/auth');
const privacyGuard = require('../middleware/privacyGuard');
const CvVersion = require('../models/CvVersion');
const SkillEvidence = require('../models/SkillEvidence');
const MentorRequest = require('../models/MentorRequest');
const { loadLevels } = require('../services/studentContext');
const { cvCompleteness } = require('../services/cvService');
const { notify } = require('../services/notify');
const { objectId } = require('../utils/validators');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

router.use(authenticateFirebase, privacyGuard, requireRole('student', 'mentor'));

const MAX_VERSIONS = 20;
const url = z.string().url().max(300).refine((u) => /^https?:\/\//.test(u), 'must be http(s)');
// No phone / email / address fields exist: strict() rejects them.
const cvSchema = z.object({
  language: z.enum(['bn', 'en']).default('en'),
  headline: z.string().trim().max(100).default(''),
  summary: z.string().trim().max(800).default(''),
  education: z.array(z.object({ institution: z.string().trim().max(120), degree: z.string().trim().max(120).optional(), year: z.number().int().min(1990).max(2100).optional() }).strict()).max(5).default([]),
  projects: z.array(z.object({ title: z.string().trim().min(2).max(100), description: z.string().trim().max(400).optional(), url: url.optional(), result: z.string().trim().max(200).optional() }).strict()).max(6).default([]),
}).strict();

const ser = (c, completeness, skills) => ({
  id: String(c._id), version: c.version, language: c.language, headline: c.headline, summary: c.summary, education: c.education, projects: c.projects,
  comments: c.comments.map((x) => ({ id: String(x._id), section: x.section, line: x.line ?? null, text: x.text, status: x.status, authorId: String(x.authorId), createdAt: x.createdAt })),
  openComments: c.comments.filter((x) => x.status === 'open').length, createdAt: c.createdAt, completeness, ...(skills && { skills }),
});
const isMentorOf = (mentorId, studentId) => MentorRequest.exists({ mentorId, studentId, status: 'accepted' });

router.post('/', requireRole('student'), asyncHandler(async (req, res) => {
  const body = cvSchema.parse(req.body);
  if ((await CvVersion.countDocuments({ studentId: req.user._id })) >= MAX_VERSIONS) throw new AppError(409, 'TOO_MANY_VERSIONS', `At most ${MAX_VERSIONS} CV versions`);
  let cv;
  for (let attempt = 0; attempt < 3 && !cv; attempt++) { // retry if two requests pick the same version number
    const last = await CvVersion.findOne({ studentId: req.user._id }).sort({ version: -1 });
    try { cv = await CvVersion.create({ ...body, studentId: req.user._id, version: (last ? last.version : 0) + 1 }); }
    catch (e) { if (e.code !== 11000) throw e; }
  }
  if (!cv) throw new AppError(409, 'CONFLICT', 'Try again');
  const evidence = (await SkillEvidence.distinct('skillKey', { studentId: req.user._id })).length;
  res.status(201).json({ cv: ser(cv, cvCompleteness(cv, evidence)) });
}));

router.get('/', requireRole('student'), asyncHandler(async (req, res) => {
  const [versions, evidence] = await Promise.all([CvVersion.find({ studentId: req.user._id }).sort({ version: -1 }), SkillEvidence.distinct('skillKey', { studentId: req.user._id })]);
  res.json({ items: versions.map((c) => ({ id: String(c._id), version: c.version, headline: c.headline, language: c.language, createdAt: c.createdAt,
    openComments: c.comments.filter((x) => x.status === 'open').length, completeness: cvCompleteness(c, evidence.length) })) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const c = await CvVersion.findById(objectId.parse(req.params.id));
  const own = c && String(c.studentId) === String(req.user._id);
  if (!c || (!own && !(req.user.role === 'mentor' && await isMentorOf(req.user._id, c.studentId)))) throw new AppError(404, 'NOT_FOUND', 'CV not found');
  const { levels, names } = await loadLevels(c.studentId);
  const skills = Object.entries(levels).map(([k, v]) => ({ skillKey: k, ...names[k], level: v.level, verified: v.verified }));
  res.json({ cv: ser(c, cvCompleteness(c, skills.length), skills) });
}));

router.post('/:id/review-request', requireRole('student'), asyncHandler(async (req, res) => {
  const { mentorId } = z.object({ mentorId: objectId }).strict().parse(req.body);
  const c = await CvVersion.findOne({ _id: objectId.parse(req.params.id), studentId: req.user._id });
  if (!c) throw new AppError(404, 'NOT_FOUND', 'CV not found');
  if (!(await isMentorOf(mentorId, req.user._id))) throw new AppError(403, 'NOT_YOUR_MENTOR', 'Ask one of your accepted mentors');
  c.reviewRequestedFrom = mentorId; await c.save();
  await notify(mentorId, { type: 'cv_review_requested', title: { en: 'CV review requested', bn: 'সিভি রিভিউ অনুরোধ' },
    body: { en: 'A mentee asked you to review their CV.', bn: 'একজন মেন্টি আপনার কাছে সিভি রিভিউ চেয়েছেন।' }, data: { cvId: String(c._id) } });
  res.json({ ok: true });
}));

router.post('/:id/comments', requireRole('mentor'), asyncHandler(async (req, res) => {
  const b = z.object({ section: z.enum(['personal', 'education', 'projects', 'skills']), line: z.number().int().min(1).max(20).optional(), text: z.string().trim().min(2).max(500) }).strict().parse(req.body);
  const c = await CvVersion.findById(objectId.parse(req.params.id));
  if (!c || !(await isMentorOf(req.user._id, c.studentId))) throw new AppError(404, 'NOT_FOUND', 'CV not found');
  c.comments.push({ ...b, authorId: req.user._id }); await c.save();
  await notify(c.studentId, { type: 'cv_comment', title: { en: `${req.user.displayName} commented on your CV`, bn: `${req.user.displayName} আপনার সিভিতে মন্তব্য করেছেন` },
    body: { en: b.text.slice(0, 80), bn: b.text.slice(0, 80) }, data: { cvId: String(c._id) } });
  res.status(201).json({ cv: ser(c, null) });
}));

router.patch('/:id/comments/:cid/resolve', requireRole('student'), asyncHandler(async (req, res) => {
  const r = await CvVersion.updateOne({ _id: objectId.parse(req.params.id), studentId: req.user._id, 'comments._id': objectId.parse(req.params.cid) }, { $set: { 'comments.$.status': 'resolved' } });
  if (!r.matchedCount) throw new AppError(404, 'NOT_FOUND', 'Comment not found');
  res.json({ ok: true });
}));

module.exports = router;
