const { z } = require('zod');
const MentorRequest = require('../models/MentorRequest');
const Message = require('../models/Message');
const Block = require('../models/Block');
const { AppError } = require('../utils/errors');
const { findSuspicious } = require('../utils/scamKeywords');
const realtime = require('./realtime');
const { notify } = require('./notify');

const same = (a, b) => String(a) === String(b);

// Chat exists only for an ACCEPTED request, only for its two people, and never across a block.
async function loadChat(requestId, user) {
  if (!/^[a-f\d]{24}$/i.test(String(requestId))) throw new AppError(404, 'NOT_FOUND', 'Chat not found');
  const r = await MentorRequest.findById(requestId);
  if (!r || (!same(r.studentId, user._id) && !same(r.mentorId, user._id))) throw new AppError(404, 'NOT_FOUND', 'Chat not found'); // 404, not 403: do not reveal it exists
  if (r.status !== 'accepted') throw new AppError(403, 'CHAT_NOT_OPEN', 'Chat opens after the mentor accepts');
  const blocked = await Block.exists({ $or: [{ blockerId: r.studentId, blockedId: r.mentorId }, { blockerId: r.mentorId, blockedId: r.studentId }] });
  if (blocked) throw new AppError(403, 'CHAT_BLOCKED', 'This chat is not available');
  return r;
}

const messageSchema = z.object({ body: z.string().trim().min(1).max(2000), clientId: z.string().max(64).optional() }).strict();

const serialize = (m) => ({ id: String(m._id), requestId: String(m.requestId), senderId: String(m.senderId), body: m.body,
  clientId: m.clientId || null, flagged: m.flagged, readAt: m.readAt || null, createdAt: m.createdAt });

async function sendMessage(user, requestId, input) {
  const { body, clientId } = messageSchema.parse(input);
  const r = await loadChat(requestId, user);
  if (clientId) { // retry of a queued message: return the original, do not duplicate
    const prior = await Message.findOne({ requestId: r._id, senderId: user._id, clientId });
    if (prior) return serialize(prior);
  }
  const receiverId = same(r.studentId, user._id) ? r.mentorId : r.studentId;
  const terms = findSuspicious(body);
  const m = await Message.create({ requestId: r._id, senderId: user._id, receiverId, body, clientId, flagged: terms.length > 0, flaggedTerms: terms });
  const out = serialize(m);
  realtime.emitToRoom(`chat:${r._id}`, 'message', out);
  notify(receiverId, { type: 'message', title: { en: `New message from ${user.displayName}`, bn: `${user.displayName}-এর নতুন বার্তা` },
    body: { en: body.slice(0, 80), bn: body.slice(0, 80) }, data: { requestId: String(r._id) } }).catch(() => {});
  return out;
}

async function markRead(user, requestId) {
  const r = await loadChat(requestId, user);
  const res = await Message.updateMany({ requestId: r._id, receiverId: user._id, readAt: null }, { $set: { readAt: new Date() } });
  realtime.emitToRoom(`chat:${r._id}`, 'read', { requestId: String(r._id), readerId: String(user._id) });
  return res.modifiedCount;
}
module.exports = { loadChat, sendMessage, markRead, serialize };
