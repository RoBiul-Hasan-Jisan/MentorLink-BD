const mongoose = require('mongoose');
const { Schema } = mongoose;
const STAGES = ['Applied', 'Under Review', 'Shortlisted', 'Interview', 'Offer', 'Hired', 'Rejected', 'Withdrawn'];
const schema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  opportunityId: { type: Schema.Types.ObjectId, ref: 'Opportunity', required: true },
  cvVersionId: { type: Schema.Types.ObjectId, ref: 'CvVersion', required: true },
  applicantNote: String,
  // Exactly what the student agreed to share with the poster, and when.
  consentSnapshot: { fields: [String], cvVersionId: Schema.Types.ObjectId, consentedAt: Date, version: String },
  fitSnapshot: Schema.Types.Mixed, // fit % + per-skill states at the time of applying
  stage: { type: String, enum: STAGES, default: 'Applied' },
  statusMessage: String,
  stageHistory: [{ _id: false, stage: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now }, message: String }],
}, { timestamps: true });
schema.index({ studentId: 1, opportunityId: 1 }, { unique: true }); // cannot apply twice to the same post
schema.index({ opportunityId: 1, stage: 1 });
module.exports = mongoose.model('Application', schema);
module.exports.STAGES = STAGES;
