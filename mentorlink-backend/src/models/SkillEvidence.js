const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  skillKey: { type: String, required: true },
  type: { type: String, enum: ['self', 'quiz', 'project', 'endorsement'], required: true },
  level: { type: Number, min: 1, max: 3, required: true },
  url: String,
  // verified = checked by the system (quiz) or a human (endorsement / reviewed project).
  // A student can never set this. Self-reports and unreviewed projects stay unverified.
  verified: { type: Boolean, default: false },
  endorsedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
module.exports = mongoose.model('SkillEvidence', schema);
