// Mentor-in-the-loop: a mentor's reviews of a student's project evidence and roadmap advice.
const { mongoose } = require('../config/db');
const { Schema } = mongoose;
const ref = (name, extra = {}) => ({ type: Schema.Types.ObjectId, ref: name, ...extra });

const mentorReviewSchema = new Schema({
  studentId: ref('User', { required: true, index: true }),
  mentorId: ref('User', { required: true, index: true }),
  kind: { type: String, enum: ['evidence', 'advice'], required: true },
  // evidence review
  evidenceId: ref('SkillEvidence'),
  skillKey: String,
  decision: { type: String, enum: ['endorse', 'needs_work'] },
  level: { type: Number, min: 1, max: 3 },
  // roadmap advice: change the ORDER or add a note; never changes a score
  targetKey: String,
  topicKey: String,
  action: { type: String, enum: ['prioritize', 'deprioritize', 'note'] },
  note: { type: String, maxlength: 400, default: '' },
  seenByStudent: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = { MentorReview: mongoose.model('MentorReview', mentorReviewSchema) };
