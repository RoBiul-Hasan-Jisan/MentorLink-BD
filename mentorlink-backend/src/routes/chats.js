const router = require('express').Router();
const { z } = require('zod');
const { authenticateFirebase, requireRole } = require('../middleware/auth');
const privacyGuard = require('../middleware/privacyGuard');
const MentorRequest = require('../models/MentorRequest');
const Message = require('../models/Message');
const { loadChat, sendMessage, markRead, serialize } = require('../services/chat');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticateFirebase, privacyGuard, requireRole('student', 'mentor'));

// Conversation list: accepted requests + last message + unread count (two aggregates, no N+1).
router.get('/', asyncHandler(async (req, res) => {
  const key = req.user.role === 'mentor' ? 'mentorId' : 'studentId';
  const reqs = await MentorRequest.find({ [key]: req.user._id, status: 'accepted' }).sort({ updatedAt: -1 }).limit(50)
    .populate('studentId', 'displayName').populate('mentorId', 'displayName');
  const ids = reqs.map((r) => r._id);
  const [last, unread] = await Promise.all([
    Message.aggregate([{ $match: { requestId: { $in: ids } } }, { $sort: { createdAt: -1 } }, { $group: { _id: '$requestId', m: { $first: '$$ROOT' } } }]),
    Message.aggregate([{ $match: { requestId: { $in: ids }, receiverId: req.user._id, readAt: null } }, { $group: { _id: '$requestId', n: { $sum: 1 } } }]),
  ]);
  const lastBy = new Map(last.map((x) => [String(x._id), x.m])), unreadBy = new Map(unread.map((x) => [String(x._id), x.n]));
  res.json({ items: reqs.map((r) => {
    const them = req.user.role === 'mentor' ? r.studentId : r.mentorId;
    const m = lastBy.get(String(r._id));
    return { requestId: String(r._id), counterpart: { id: String(them._id), displayName: them.displayName },
      lastMessage: m ? serialize(m) : null, unread: unreadBy.get(String(r._id)) || 0 };
  }) });
}));

router.get('/:requestId/messages', asyncHandler(async (req, res) => {
  const q = z.object({ before: z.coerce.date().optional(), limit: z.coerce.number().int().min(1).max(50).default(30) }).parse(req.query);
  const r = await loadChat(req.params.requestId, req.user);
  const rows = await Message.find({ requestId: r._id, ...(q.before && { createdAt: { $lt: q.before } }) }).sort({ createdAt: -1 }).limit(q.limit);
  res.json({ items: rows.reverse().map(serialize), nextBefore: rows.length === q.limit ? rows[0].createdAt : null }); // oldest first
}));

router.post('/:requestId/messages', asyncHandler(async (req, res) => res.status(201).json({ message: await sendMessage(req.user, req.params.requestId, req.body) })));
router.post('/:requestId/read', asyncHandler(async (req, res) => res.json({ marked: await markRead(req.user, req.params.requestId) })));

module.exports = router;
