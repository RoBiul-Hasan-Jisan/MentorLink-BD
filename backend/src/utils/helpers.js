const { AuditLog, Notification, MentorRequest } = require('../models');
const { bad } = require('./httpError');
const { mongoose } = require('../config/db');

// Every admin / sensitive action goes to the audit log.
async function audit(actorId, action, targetType, targetId, detail) {
  return AuditLog.create({ actorId, action, targetType, targetId, detail });
}

// In-app notification record, plus a push (Firebase Cloud Messaging) when the person has a device registered.
//  - `target` is an optional { type, id } telling the app where to go when the notification is tapped (see utils/notifyTarget.js).
//  - Reminders (kind 'reminder') are not created at all when the person switched "Session reminders" off.
//  - Pushes are held back during the person's quiet hours; the in-app notification is still stored.
async function notify(userId, title, body = '', kind = 'info', target) {
  const { buildTarget, inQuietHours } = require('./notifyTarget');
  let u = null;
  try { u = await require('../models').User.findById(userId).select('deviceTokens remindersOn quietHours'); } catch { u = null; }
  if (kind === 'reminder' && u && u.remindersOn === false) return null;
  const t = buildTarget(target);
  const n = await Notification.create({ userId, title, body, kind, ...(t ? { targetType: t.type, ...(t.id ? { targetId: t.id } : {}) } : {}) });
  try {
    if (u && u.deviceTokens && u.deviceTokens.length && !inQuietHours(u.quietHours)) require('../config/firebase').sendPush(u.deviceTokens, title, body);
  } catch { /* push is best effort */ }
  return n;
}

function toObjectId(id, name = 'id') {
  if (!mongoose.isValidObjectId(id)) throw bad('INVALID_ID', `Invalid ${name}.`);
  return id;
}

// "Robiul Hasan Jisan" -> "Robiul H."  (students show first name + initial only)
function firstNameInitial(displayName) {
  const parts = String(displayName || '').trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || '';
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

// Chat and session data are visible only to the two people in an ACCEPTED request.
async function loadAcceptedRequestFor(user, requestId) {
  toObjectId(requestId, 'request id');
  const r = await MentorRequest.findById(requestId);
  if (!r) return null;
  const mine = String(r.studentId) === String(user._id) || String(r.mentorId) === String(user._id);
  return mine ? r : null;
}

module.exports = { audit, notify, toObjectId, firstNameInitial, loadAcceptedRequestFor };
