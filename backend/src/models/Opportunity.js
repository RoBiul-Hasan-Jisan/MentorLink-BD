const { mongoose } = require('../config/db');
const { Schema } = mongoose;
const ref = (name, extra = {}) => ({ type: Schema.Types.ObjectId, ref: name, ...extra });

const opportunitySchema = new Schema(
  {
    postedBy: ref('User', { required: true }),
    title: { type: String, required: true, maxlength: 120 },
    organization: { type: String, required: true, maxlength: 120 },
    type: { type: String, enum: ['job', 'internship', 'other'], default: 'job' },
    workplaceMode: { type: String, enum: ['onsite', 'hybrid', 'remote'], default: 'onsite' },
    locationText: { type: String, maxlength: 120 }, // job location text only, never applicant coordinates
    description: { type: String, required: true, maxlength: 4000 },
    requiredSkills: [{ skillKey: String, requiredLevel: { type: Number, min: 1, max: 3, default: 2 }, weight: { type: Number, default: 1 } }],
    applicationDeadline: Date,
    noFeeConfirmed: { type: Boolean, default: false },
    // Separate, honest labels: who posted it, whether a person reviewed this listing, whether the poster declared no fee.
    sourceLabel: { type: String, enum: ['verified_alumni', 'admin'], required: true },
    listingReviewed: { type: Boolean, default: false },
    suspiciousFlags: [String],
    status: { type: String, enum: ['pending', 'approved', 'hidden', 'removed'], default: 'pending', index: true },
    reportCount: { type: Number, default: 0 },
    reviewedBy: ref('User'),
    reviewedAt: Date,
  },
  { timestamps: true }
);

const STAGES = ['Applied', 'Under Review', 'Shortlisted', 'Interview', 'Offer', 'Hired', 'Rejected', 'Withdrawn'];

const applicationSchema = new Schema(
  {
    studentId: ref('User', { required: true, index: true }),
    opportunityId: ref('Opportunity', { required: true, index: true }),
    cvVersionId: ref('CvVersion', { required: true }),
    applicantNote: { type: String, maxlength: 500 },
    // Exactly what the student agreed to share, and when.
    consentSnapshot: {
      sharedFields: [String],
      consentedAt: { type: Date, required: true },
    },
    stage: { type: String, enum: STAGES, default: 'Applied' },
    statusMessage: { type: String, default: 'Your application was received.' },
    stageHistory: [{ stage: String, by: ref('User'), at: { type: Date, default: Date.now }, message: String }],
    outcomeFeedback: { type: String, enum: ['yes', 'little', 'not_yet'] },
  },
  { timestamps: true }
);
// A student can apply only once to the same post.
applicationSchema.index({ studentId: 1, opportunityId: 1 }, { unique: true });

const reportSchema = new Schema(
  {
    reporterId: ref('User', { required: true }),
    targetType: { type: String, enum: ['opportunity', 'user'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, required: true, maxlength: 300 },
    status: { type: String, enum: ['open', 'actioned', 'dismissed'], default: 'open' },
  },
  { timestamps: true }
);
// One person reporting the same target repeatedly counts once.
reportSchema.index({ reporterId: 1, targetType: 1, targetId: 1 }, { unique: true });

const auditLogSchema = new Schema(
  {
    actorId: ref('User', { required: true }),
    action: { type: String, required: true },
    targetType: String,
    targetId: Schema.Types.Mixed,
    detail: Schema.Types.Mixed,
  },
  { timestamps: true }
);

module.exports = {
  STAGES,
  Opportunity: mongoose.model('Opportunity', opportunitySchema),
  Application: mongoose.model('Application', applicationSchema),
  Report: mongoose.model('Report', reportSchema),
  AuditLog: mongoose.model('AuditLog', auditLogSchema),
};
