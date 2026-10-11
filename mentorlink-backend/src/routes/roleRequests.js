const router = require('express').Router();
const { z } = require('zod');
const { authenticateFirebase, requireRole } = require('../middleware/auth');
const privacyGuard = require('../middleware/privacyGuard');
const RoleRequest = require('../models/RoleRequest');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticateFirebase, privacyGuard, requireRole('student'));

// Alumni / department sign-up: the account is a student first; this asks an admin for the other role.
// The server (not the client) changes the role, only after an admin approves (see admin routes).
router.post('/', asyncHandler(async (req, res) => {
  const b = z.object({
    requestedRole: z.enum(['mentor', 'department']),
    note: z.string().trim().max(500).optional(),
    proofUrl: z.string().url().max(300).refine((u) => /^https?:\/\//.test(u), 'must be http(s)').optional(),
  }).strict().parse(req.body);
  const rr = await RoleRequest.create({ ...b, userId: req.user._id }); // one pending request per user (unique partial index -> 409)
  res.status(201).json({ roleRequest: { id: String(rr._id), requestedRole: rr.requestedRole, status: rr.status, createdAt: rr.createdAt } });
}));

router.get('/', asyncHandler(async (req, res) => {
  const rows = await RoleRequest.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(10);
  res.json({ items: rows.map((r) => ({ id: String(r._id), requestedRole: r.requestedRole, status: r.status, reason: r.reason || null, createdAt: r.createdAt, reviewedAt: r.reviewedAt || null })) });
}));

module.exports = router;
