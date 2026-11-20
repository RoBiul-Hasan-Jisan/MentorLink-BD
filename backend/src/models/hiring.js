// The hiring process AFTER someone applies: interviews, messages, document requests ("papers") and offers.
// Every record belongs to one Application. Poster = the person (or company team) who posted the job.
const { mongoose } = require('../config/db');
const { Schema } = mongoose;
const ref = (name, extra = {}) => ({ type: Schema.Types.ObjectId, ref: name, ...extra });

const INTERVIEW_KINDS = ['phone', 'video', 'onsite', 'written_test', 'assignment'];
const INTERVIEW_STATUSES = ['scheduled', 'confirmed', 'reschedule_requested', 'declined', 'completed', 'cancelled', 'no_show'];
const DOC_TYPES = ['cv_update', 'transcript', 'certificate', 'national_id', 'reference_letter', 'portfolio', 'cover_letter', 'work_sample', 'other'];
const DOC_STATUSES = ['requested', 'submitted', 'accepted', 'needs_fix'];
const OFFER_STATUSES = ['sent', 'accepted', 'declined', 'withdrawn'];

const interviewSchema = new Schema(
  {
    applicationId: ref('Application', { required: true, index: true }),
    opportunityId: ref('Opportunity', { required: true, index: true }),
    studentId: ref('User', { required: true, index: true }),
    scheduledBy: ref('User', { required: true }),
    round: { type: Number, min: 1, default: 1 },
    title: { type: String, required: true, maxlength: 80 }, // "HR screening", "Technical round"
    kind: { type: String, enum: INTERVIEW_KINDS, required: true },
    startsAt: { type: Date, required: true },
    durationMin: { type: Number, min: 10, max: 480, default: 30 },
    meetingLink: { type: String, maxlength: 300 }, // https only (checked in the route)
    placeText: { type: String, maxlength: 160 }, // office name / room: text about the JOB site, never a person's address
    notes: { type: String, maxlength: 500 }, // what to prepare / bring: the student sees this
    status: { type: String, enum: INTERVIEW_STATUSES, default: 'scheduled', index: true },
    studentNote: { type: String, maxlength: 300 }, // why the student asked to move or decline
    proposedStartsAt: Date,
    result: { type: String, enum: ['pending', 'passed', 'not_passed'], default: 'pending' },
    feedback: { type: String, maxlength: 500 }, // private to the poster unless feedbackShared
    feedbackShared: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const appMessageSchema = new Schema(
  {
    applicationId: ref('Application', { required: true, index: true }),
    senderId: ref('User', { required: true }),
    side: { type: String, enum: ['student', 'poster'], required: true },
    body: { type: String, required: true, maxlength: 1000 },
    flags: [String], // scam signals (asks for money, off-platform contact). Shown to the reader as a warning and to the admin.
  },
  { timestamps: true }
);
appMessageSchema.index({ applicationId: 1, createdAt: 1 });

const documentRequestSchema = new Schema(
  {
    applicationId: ref('Application', { required: true, index: true }),
    opportunityId: ref('Opportunity', { required: true, index: true }),
    studentId: ref('User', { required: true, index: true }),
    requestedBy: ref('User', { required: true }),
    docType: { type: String, enum: DOC_TYPES, required: true },
    label: { type: String, required: true, maxlength: 120 },
    note: { type: String, maxlength: 300 },
    dueAt: Date,
    status: { type: String, enum: DOC_STATUSES, default: 'requested', index: true },
    // What the student sends back: a share link (Drive, GitHub, ...) and/or text. Files are never stored here.
    submission: { text: { type: String, maxlength: 1000 }, link: { type: String, maxlength: 300 }, submittedAt: Date },
    reviewNote: { type: String, maxlength: 300 },
    reviewedAt: Date,
  },
  { timestamps: true }
);

const offerSchema = new Schema(
  {
    applicationId: ref('Application', { required: true, unique: true }), // one offer per application
    opportunityId: ref('Opportunity', { required: true, index: true }),
    studentId: ref('User', { required: true, index: true }),
    createdBy: ref('User', { required: true }),
    positionTitle: { type: String, required: true, maxlength: 120 },
    salaryText: { type: String, maxlength: 80 }, // free text, e.g. "BDT 25,000 per month"
    employmentType: { type: String, enum: ['full_time', 'part_time', 'internship', 'contract', 'freelance'] },
    startDate: Date,
    workPlaceText: { type: String, maxlength: 120 },
    terms: { type: String, maxlength: 1000 },
    expiresAt: Date,
    status: { type: String, enum: OFFER_STATUSES, default: 'sent', index: true },
    respondedAt: Date,
    declineReason: { type: String, maxlength: 300 },
  },
  { timestamps: true }
);

module.exports = {
  INTERVIEW_KINDS, INTERVIEW_STATUSES, DOC_TYPES, DOC_STATUSES, OFFER_STATUSES,
  Interview: mongoose.model('Interview', interviewSchema),
  AppMessage: mongoose.model('AppMessage', appMessageSchema),
  DocumentRequest: mongoose.model('DocumentRequest', documentRequestSchema),
  Offer: mongoose.model('Offer', offerSchema),
};
