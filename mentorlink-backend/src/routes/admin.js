const router = require('express').Router();
const { z } = require('zod');
const { authenticateFirebase, requireRole } = require('../middleware/auth');
const University = require('../models/University');
const User = require('../models/User');
const audit = require('../utils/audit');
const { toPublic } = require('../services/universityService');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

router.use(authenticateFirebase, requireRole('admin'));

// Admin sends human-friendly latitude/longitude for a CAMPUS (not a person). Stored as GeoJSON [lng, lat].
const campusSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
}).refine((c) => !(c.latitude === 0 && c.longitude === 0), 'Placeholder 0,0 is not a real campus location');

const base = {
  name: z.string().trim().min(2), shortName: z.string().trim().min(1), city: z.string().trim().min(1),
  campus: campusSchema, campusAddressText: z.string().trim().default(''),
  emailDomains: z.array(z.string().trim().toLowerCase()).default([]), active: z.boolean().default(true),
};
const toDoc = (b) => {
  const { campus, ...rest } = b;
  return { ...rest, ...(campus && { campus: { type: 'Point', coordinates: [campus.longitude, campus.latitude] } }) };
};

router.post('/universities', asyncHandler(async (req, res) => {
  const uni = await University.create(toDoc(z.object(base).strict().parse(req.body)));
  await audit(req.user._id, 'university.create', 'University', uni._id, { name: uni.name });
  res.status(201).json({ university: toPublic(uni) });
}));

router.patch('/universities/:id', asyncHandler(async (req, res) => {
  const patch = z.object(base).partial().strict().parse(req.body);
  const uni = await University.findByIdAndUpdate(req.params.id, toDoc(patch), { new: true });
  if (!uni) throw new AppError(404, 'NOT_FOUND', 'University not found');
  await audit(req.user._id, 'university.update', 'University', uni._id, { fields: Object.keys(patch) });
  res.json({ university: toPublic(uni) });
}));

// Demo/pilot helper: admin verifies or rejects an account. Audit-logged.
router.patch('/users/:id/verification', asyncHandler(async (req, res) => {
  const { verificationStatus } = z.object({ verificationStatus: z.enum(['pending', 'verified', 'rejected']) }).strict().parse(req.body);
  const user = await User.findByIdAndUpdate(req.params.id, { verificationStatus }, { new: true });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
  await audit(req.user._id, 'user.verification', 'User', user._id, { verificationStatus });
  res.json({ id: String(user._id), verificationStatus });
}));

router.use('/', require('./adminOps')); // verification queue, scam review, audit, fairness, preview

module.exports = router;
