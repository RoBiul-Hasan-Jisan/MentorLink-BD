const router = require('express').Router();
const { z } = require('zod');
const { authenticateFirebase, requireRole } = require('../middleware/auth');
const privacyGuard = require('../middleware/privacyGuard');
const Application = require('../models/Application');
const { canTransition, canWithdraw, uiStage, timeline } = require('../services/stageMachine');
const { notify } = require('../services/notify');
const { objectId, pageQuery } = require('../utils/validators');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

router.use(authenticateFirebase, privacyGuard);

const ser = (a) => ({
  id: String(a._id), opportunity: a.opportunityId && a.opportunityId.title ? { id: String(a.opportunityId._id), title: a.opportunityId.title, organization: a.opportunityId.organization } : { id: String(a.opportunityId) },
  stage: a.stage, uiStage: uiStage(a.stage), statusMessage: a.statusMessage || null, appliedAt: a.createdAt,
  timeline: timeline(a.stage, a.stageHistory), history: a.stageHistory.map((h) => ({ stage: h.stage, uiStage: uiStage(h.stage), at: h.at, message: h.message || null })),
  sharedFields: a.consentSnapshot.fields, consentedAt: a.consentSnapshot.consentedAt,
});

// ---------- student: my applications (own only) ----------
router.get('/', requireRole('student'), asyncHandler(async (req, res) => {
  const { page, limit } = pageQuery.parse(req.query);
  const filter = { studentId: req.user._id };
  const [items, total] = await Promise.all([Application.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('opportunityId', 'title organization'), Application.countDocuments(filter)]);
  res.json({ items: items.map(ser), active: items.filter((a) => canWithdraw(a.stage)).length, page, limit, total });
}));

router.get('/:id', requireRole('student'), asyncHandler(async (req, res) => {
  const a = await Application.findOne({ _id: objectId.parse(req.params.id), studentId: req.user._id }).populate('opportunityId', 'title organization');
  if (!a) throw new AppError(404, 'NOT_FOUND', 'Application not found');
  res.json({ application: ser(a) });
}));

router.post('/:id/withdraw', requireRole('student'), asyncHandler(async (req, res) => {
  const a = await Application.findOne({ _id: objectId.parse(req.params.id), studentId: req.user._id });
  if (!a) throw new AppError(404, 'NOT_FOUND', 'Application not found');
  if (!canWithdraw(a.stage)) throw new AppError(409, 'CANNOT_WITHDRAW', `Application is already ${a.stage}`);
  const u = await Application.findOneAndUpdate({ _id: a._id, stage: a.stage }, { $set: { stage: 'Withdrawn', statusMessage: 'You withdrew this application.' }, $push: { stageHistory: { stage: 'Withdrawn', by: req.user._id, message: 'Withdrawn by applicant' } } }, { new: true });
  if (!u) throw new AppError(409, 'CONFLICT', 'The application changed, try again');
  res.json({ application: ser(u) });
}));

// ---------- poster moves an applicant along. The server validates every move and records it. ----------
const TITLES = {
  Shortlisted: { en: 'You were shortlisted', bn: 'আপনি শর্টলিস্টেড হয়েছেন' }, Interview: { en: 'Interview stage', bn: 'ইন্টারভিউ পর্যায়' },
  Offer: { en: 'You received an offer', bn: 'আপনি অফার পেয়েছেন' }, Hired: { en: 'You were selected', bn: 'আপনি নির্বাচিত হয়েছেন' }, Rejected: { en: 'Application update', bn: 'আবেদনের আপডেট' },
};
router.patch('/:id/stage', requireRole('mentor', 'admin'), asyncHandler(async (req, res) => {
  const { stage, message } = z.object({ stage: z.enum(['Under Review', 'Shortlisted', 'Interview', 'Offer', 'Hired', 'Rejected']), message: z.string().trim().max(200).optional() }).strict().parse(req.body);
  const a = await Application.findById(objectId.parse(req.params.id)).populate('opportunityId', 'title postedBy');
  if (!a || String(a.opportunityId.postedBy) !== String(req.user._id)) throw new AppError(404, 'NOT_FOUND', 'Application not found'); // only the poster of THIS post
  if (!canTransition(a.stage, stage)) throw new AppError(409, 'INVALID_TRANSITION', `Cannot move from ${a.stage} to ${stage}`);
  const u = await Application.findOneAndUpdate({ _id: a._id, stage: a.stage }, { $set: { stage, statusMessage: message || a.statusMessage }, $push: { stageHistory: { stage, by: req.user._id, message } } }, { new: true });
  if (!u) throw new AppError(409, 'CONFLICT', 'The application changed, try again');
  if (TITLES[stage]) await notify(a.studentId, { type: 'application_stage', title: TITLES[stage], body: { en: `${a.opportunityId.title}${message ? `: ${message}` : ''}`, bn: `${a.opportunityId.title}${message ? `: ${message}` : ''}` }, data: { applicationId: String(a._id), stage } });
  res.json({ application: { id: String(u._id), stage: u.stage, uiStage: uiStage(u.stage), statusMessage: u.statusMessage || null } });
}));

module.exports = router;
