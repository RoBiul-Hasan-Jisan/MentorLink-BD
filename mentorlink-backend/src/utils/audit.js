const AuditLog = require('../models/AuditLog');
// Every admin action goes through here.
module.exports = (actorId, action, targetType, targetId, meta = {}) =>
  AuditLog.create({ actorId: actorId || undefined, system: !actorId, action, targetType, targetId: String(targetId), meta });
