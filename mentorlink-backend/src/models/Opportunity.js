const mongoose = require('mongoose');
const { Schema } = mongoose;
const schema = new Schema({
  postedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  posterRole: { type: String, enum: ['mentor', 'admin'], required: true }, // source label: verified alumni vs admin
  organizationId: { type: Schema.Types.ObjectId },                         // Phase 2 (company portal)
  organization: { type: String, default: '' },
  title: { type: String, required: true },
  type: { type: String, enum: ['job', 'internship', 'other'], default: 'job' },
  employmentType: { type: String, enum: ['full_time', 'part_time', 'internship', 'freelance', 'contract'], required: true },
  workplaceMode: { type: String, enum: ['onsite', 'hybrid', 'remote'], default: 'onsite' },
  city: String, // JOB location text only. Never an applicant's location.
  salaryRange: { min: Number, max: Number, currency: { type: String, default: 'BDT' } },
  description: { type: String, required: true },
  requiredSkills: [{ _id: false, skillKey: String, weight: { type: Number, min: 1, max: 5 }, requiredLevel: { type: Number, min: 1, max: 3 } }],
  applicationDeadline: { type: Date, required: true },
  noFeeConfirmed: { type: Boolean, required: true },
  flags: { type: [String], default: [] },       // suspicious keywords found on submit
  status: { type: String, enum: ['pending', 'approved', 'hidden', 'removed', 'closed'], default: 'pending' },
  reportCount: { type: Number, default: 0 },    // OPEN reports from distinct people
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' }, reviewedAt: Date, reviewNote: String,
}, { timestamps: true });
schema.index({ status: 1, applicationDeadline: 1, createdAt: -1 });
schema.index({ postedBy: 1, status: 1 });
module.exports = mongoose.model('Opportunity', schema);
