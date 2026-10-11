const Notification = require('../models/Notification');
const DeviceToken = require('../models/DeviceToken');
const User = require('../models/User');
const firebase = require('../config/firebase');
const realtime = require('./realtime');

async function push(userId, n) {
  const [tokens, user] = await Promise.all([DeviceToken.find({ userId }), User.findById(userId).select('language')]);
  if (!tokens.length) return;
  const lang = user?.language || 'en';
  const res = await firebase.sendMulticast(tokens.map((t) => t.token), {
    title: n.title[lang] || n.title.en, body: n.body[lang] || n.body.en, data: { type: n.type, ...(n.data || {}) },
  });
  // Remove tokens FCM says are dead.
  const dead = [];
  res.responses.forEach((r, i) => {
    if (!r.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(r.error?.code)) dead.push(tokens[i].token);
  });
  if (dead.length) await DeviceToken.deleteMany({ token: { $in: dead } });
}

/**
 * Saves a notification record, pushes it live over the socket, and sends FCM push in the background.
 * A push failure never breaks the request that triggered it.
 * title/body: { en, bn }
 */
async function notify(userId, { type, title, body, data = {} }) {
  const n = await Notification.create({ userId, type, title, body, data });
  realtime.emitToUser(userId, 'notification', { id: String(n._id), type, title, body, data, createdAt: n.createdAt });
  push(userId, n).catch(() => {});
  return n;
}
module.exports = { notify };
