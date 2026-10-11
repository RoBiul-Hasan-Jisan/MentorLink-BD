const mongoose = require('mongoose');
module.exports = mongoose.model('AuditLog', new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // empty for automatic system actions
  system: { type: Boolean, default: false },
  action: { type: String, required: true },
  targetType: String,
  targetId: String,
  meta: mongoose.Schema.Types.Mixed,
}, { timestamps: { createdAt: true, updatedAt: false } }));
