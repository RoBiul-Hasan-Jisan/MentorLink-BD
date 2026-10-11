const router = require('express').Router();
const { z } = require('zod');
const { authenticateFirebase } = require('../middleware/auth');
const privacyGuard = require('../middleware/privacyGuard');
const Notification = require('../models/Notification');
const DeviceToken = require('../models/DeviceToken');
const { objectId, pageQuery } = require('../utils/validators');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

router.use(authenticateFirebase, privacyGuard);

router.get('/', asyncHandler(async (req, res) => {
  const { page, limit } = pageQuery.parse(req.query);
  const [items, total, unread] = await Promise.all([
    Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Notification.countDocuments({ userId: req.user._id }),
    Notification.countDocuments({ userId: req.user._id, readAt: null }),
  ]);
  res.json({ items: items.map((n) => ({ id: String(n._id), type: n.type, title: n.title, body: n.body, data: n.data, read: !!n.readAt, createdAt: n.createdAt })), page, limit, total, unread });
}));

router.post('/read-all', asyncHandler(async (req, res) => {
  const r = await Notification.updateMany({ userId: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ marked: r.modifiedCount });
}));

router.post('/:id/read', asyncHandler(async (req, res) => {
  const r = await Notification.updateOne({ _id: objectId.parse(req.params.id), userId: req.user._id }, { $set: { readAt: new Date() } }); // own only
  if (!r.matchedCount) throw new AppError(404, 'NOT_FOUND', 'Notification not found');
  res.json({ ok: true });
}));

// FCM device token. A token belongs to whoever signed in last on that device.
router.post('/device-token', asyncHandler(async (req, res) => {
  const b = z.object({ token: z.string().min(20).max(4096), platform: z.enum(['android', 'ios', 'web']).default('android') }).strict().parse(req.body);
  await DeviceToken.updateOne({ token: b.token }, { $set: { userId: req.user._id, platform: b.platform } }, { upsert: true });
  res.status(204).end();
}));
router.delete('/device-token', asyncHandler(async (req, res) => { // call on log out
  const { token } = z.object({ token: z.string().min(20) }).strict().parse(req.body);
  await DeviceToken.deleteOne({ token, userId: req.user._id });
  res.status(204).end();
}));

module.exports = router;
