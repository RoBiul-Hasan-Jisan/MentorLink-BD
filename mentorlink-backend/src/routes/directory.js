const router = require('express').Router();
const { z } = require('zod');
const { authenticateFirebase, requireRole } = require('../middleware/auth');
const University = require('../models/University');
const User = require('../models/User');
const { listWithCounts } = require('../services/universityService');
const { toPublicCard } = require('../utils/publicCard');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

const PAGE_SIZE = 20;
// Employers are deliberately NOT in any list below: they get 403 on every directory endpoint.
// Departments only get anonymized counts (the map), never individual cards.
router.use(authenticateFirebase);

// One item per university: campus coordinates + counts. NEVER per-user coordinates.
router.get('/map', requireRole('student', 'mentor', 'department', 'admin'), asyncHandler(async (req, res) => {
  const items = await listWithCounts();
  const mine = req.user.universityId ? String(req.user.universityId) : null;
  res.json({ universities: items.map((u) => ({ ...u, isYourCampus: u.id === mine })) });
}));

router.get('/universities/:id/members', requireRole('student', 'mentor', 'admin'), asyncHandler(async (req, res) => {
  const { role, page } = z.object({
    role: z.enum(['student', 'mentor']).default('student'),
    page: z.coerce.number().int().min(1).default(1),
  }).parse(req.query);

  const uni = await University.findById(req.params.id);
  if (!uni || !uni.active) throw new AppError(404, 'NOT_FOUND', 'University not found');

  const filter = {
    universityId: uni._id, role, verificationStatus: 'verified', showInDirectory: true,
    _id: { $ne: req.user._id }, // the viewer's own card is handled separately
  };
  const [others, total] = await Promise.all([
    User.find(filter).sort({ displayName: 1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE),
    User.countDocuments(filter),
  ]);

  const items = others.map((u) => toPublicCard(u, uni.name));
  // The logged-in user always sees themselves, pinned first, even if hidden from others.
  const isOwnUniversity = req.user.universityId && String(req.user.universityId) === String(uni._id);
  if (page === 1 && isOwnUniversity && req.user.role === role) {
    items.unshift(toPublicCard(req.user, uni.name, { isYou: true }));
  }
  res.json({ university: { id: String(uni._id), name: uni.name }, items, page, pageSize: PAGE_SIZE, total });
}));

module.exports = router;
