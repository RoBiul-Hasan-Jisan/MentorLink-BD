const mongoose = require('mongoose');
const { Schema } = mongoose;
const schema = new Schema({
  reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: ['opportunity', 'user'], required: true },
  targetId: { type: Schema.Types.ObjectId, required: true },
  reason: { type: String, required: true },
  details: String,
  status: { type: String, enum: ['open', 'dismissed', 'actioned'], default: 'open' },
}, { timestamps: true });
// One person can report a target only once: repeated reports never count twice.
schema.index({ reporterId: 1, targetType: 1, targetId: 1 }, { unique: true });
schema.index({ targetType: 1, targetId: 1, status: 1 });
module.exports = mongoose.model('Report', schema);
