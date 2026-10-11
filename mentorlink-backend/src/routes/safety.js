// Block and report USERS. (Reporting an opportunity lives in opportunities.js.)
const express = require('express');
const { z } = require('zod');
const { authenticateFirebase, requireRole } = require('../middleware/auth');
const privacyGuard = require('../middleware/privacyGuard');
const Block = require('../models/Block');
const Report = require('../models/Report');
const User = require('../models/User');
const { objectId } = require('../utils/validators');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

const guard = [authenticateFirebase, privacyGuard, requireRole('student', 'mentor')];
const blocks = express.Router(), reports = express.Router();
blocks.use(...guard); reports.use(...guard);

async function blockUser(me, userId, reason) {
  if (String(me._id) === String(userId)) throw new AppError(400, 'SELF', 'You cannot do this to yourself');
  const target = await User.findById(userId);
  if (!target || target.role === 'admin') throw new AppError(404, 'NOT_FOUND', 'User not found');
  await Block.updateOne({ blockerId: me._id, blockedId: userId }, { $setOnInsert: { reason } }, { upsert: true });
}

blocks.get('/', asyncHandler(async (req, res) => {
  const rows = await Block.find({ blockerId: req.user._id }).populate('blockedId', 'displayName');
  res.json({ items: rows.map((b) => ({ userId: String(b.blockedId._id), displayName: b.blockedId.displayName, createdAt: b.createdAt })) });
}));
blocks.post('/', asyncHandler(async (req, res) => {
  const b = z.object({ userId: objectId, reason: z.string().trim().max(200).optional() }).strict().parse(req.body);
  await blockUser(req.user, b.userId, b.reason);
  res.status(201).json({ blocked: true });
}));
blocks.delete('/:userId', asyncHandler(async (req, res) => {
  await Block.deleteOne({ blockerId: req.user._id, blockedId: objectId.parse(req.params.userId) });
  res.status(204).end();
}));

// Reasons are the ones in the design's "Report this user" sheet.
reports.post('/user', asyncHandler(async (req, res) => {
  const b = z.object({ userId: objectId, reason: z.enum(['asked_money', 'harassment', 'fake_profile', 'pressure_off_app', 'other']), details: z.string().trim().max(500).optional(), alsoBlock: z.boolean().default(false) }).strict().parse(req.body);
  if (String(b.userId) === String(req.user._id)) throw new AppError(400, 'SELF', 'You cannot report yourself');
  if (!(await User.exists({ _id: b.userId, role: { $ne: 'admin' } }))) throw new AppError(404, 'NOT_FOUND', 'User not found');
  let already = false;
  try { await Report.create({ reporterId: req.user._id, targetType: 'user', targetId: b.userId, reason: b.reason, details: b.details }); }
  catch (e) { if (e.code === 11000) already = true; else throw e; }
  if (b.alsoBlock) await blockUser(req.user, b.userId, b.reason);
  res.status(already ? 200 : 201).json({ reported: true, alreadyReported: already, blocked: b.alsoBlock });
}));

module.exports = { blocks, reports };
