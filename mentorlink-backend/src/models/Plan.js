const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  roleKey: String,
  startDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
}, { timestamps: true });
schema.index({ studentId: 1 }, { unique: true, partialFilterExpression: { status: 'active' } }); // one active plan
module.exports = mongoose.model('Plan', schema);
