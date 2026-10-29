// Career Passport settings, Mentor Sprints and company invitations.
const { mongoose } = require('../config/db');
const { Schema } = mongoose;
const ref = (name, extra = {}) => ({ type: Schema.Types.ObjectId, ref: name, ...extra });

// One passport per student. The public link uses a random slug (not guessable, not an identity token).
// The owner can switch it off or create a new link at any time.
const passportSchema = new Schema({
  userId: ref('User', { required: true, unique: true }),
  slug: { type: String, unique: true, sparse: true },
  enabled: { type: Boolean, default: false },
  talentPool: { type: Boolean, default: false }, // opt in: verified companies may find me by proven skills
  headline: { type: String, maxlength: 80, default: '' },
  show: {
    skills: { type: Boolean, default: true }, projects: { type: Boolean, default: true }, endorsements: { type: Boolean, default: true },
    github: { type: Boolean, default: true }, badges: { type: Boolean, default: true }, sprints: { type: Boolean, default: true },
  },
  views: { type: Number, default: 0 },
  lastViewedAt: Date,
}, { timestamps: true });

const sprintSchema = new Schema({
  studentId: ref('User', { required: true, index: true }),
  mentorId: ref('User'),
  skillKey: { type: String, required: true },
  titleEn: String, titleBn: String,
  status: { type: String, enum: ['active', 'submitted', 'needs_work', 'completed', 'abandoned'], default: 'active', index: true },
  startedAt: { type: Date, default: Date.now },
  days: [{ n: Number, kind: String, titleEn: String, titleBn: String, taskEn: String, taskBn: String, done: { type: Boolean, default: false }, doneAt: Date }],
  proofUrl: { type: String, maxlength: 300 },
  proofNote: { type: String, maxlength: 400, default: '' },
  review: { decision: String, level: Number, note: String, at: Date },
  badge: { type: Boolean, default: false },
}, { timestamps: true });

// A verified company asks a student (who opted in) to talk. The student decides.
const inviteSchema = new Schema({
  studentId: ref('User', { required: true, index: true }),
  organizationId: ref('Organization', { required: true, index: true }),
  invitedBy: ref('User', { required: true }),
  opportunityId: ref('Opportunity'),
  message: { type: String, maxlength: 300, default: '' },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  respondedAt: Date,
}, { timestamps: true });
inviteSchema.index({ studentId: 1, organizationId: 1, opportunityId: 1 }, { unique: true });

module.exports = {
  Passport: mongoose.model('Passport', passportSchema),
  Sprint: mongoose.model('Sprint', sprintSchema),
  TalentInvite: mongoose.model('TalentInvite', inviteSchema),
};
