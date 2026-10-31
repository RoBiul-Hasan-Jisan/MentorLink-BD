const { AuditLog, Notification, MentorRequest } = require('../models');
const { bad } = require('./httpError');
const { mongoose } = require('../config/db');

// Every admin / sensitive action goes to the audit log.
async function audit(actorId, action, targetType, targetId, detail) {
  return AuditLog.create({ actorId, action, targetType, targetId, detail });
}

// In-app notification record. A push (Firebase Cloud Messaging) can be sent from here later.
async function notify(userId, title, body = '', kind = 'info') {
  const n = await Notification.create({ userId, title, body, kind });
  try {
    const { User } = require('../models');
    const u = await User.findById(userId);
    if (u && u.deviceTokens.length) require('../config/firebase').sendPush(u.deviceTokens, title, body);
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
