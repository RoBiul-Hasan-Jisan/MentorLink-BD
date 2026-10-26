// Models for: mock interviews, progress history, workshops, community Q&A, private verification documents.
const { mongoose } = require('../config/db');
const { Schema } = mongoose;
const ref = (name, extra = {}) => ({ type: Schema.Types.ObjectId, ref: name, ...extra });

// A practice interview with a mentor. Feedback is a rubric (1-5 each) plus a written note.
const mockInterviewSchema = new Schema({
  studentId: ref('User', { required: true, index: true }),
  mentorId: ref('User', { required: true, index: true }),
  startsAt: { type: Date, required: true },
  status: { type: String, enum: ['booked', 'done', 'cancelled'], default: 'booked' },
  rubric: { communication: Number, technical: Number, problemSolving: Number, confidence: Number },
  overall: Number,
  note: { type: String, maxlength: 1000 },
}, { timestamps: true });

// One readiness snapshot per student per day, so "My progress" can draw a real history (not invented numbers).
const progressSnapshotSchema = new Schema({
  studentId: ref('User', { required: true, index: true }),
  day: { type: String, required: true }, // YYYY-MM-DD
  roleKey: String,
  percent: { type: Number, required: true },
}, { timestamps: true });
progressSnapshotSchema.index({ studentId: 1, day: 1 }, { unique: true });

const workshopSchema = new Schema({
  hostId: ref('User', { required: true }),
  title: { type: String, required: true, maxlength: 120 },
  description: { type: String, maxlength: 500, default: '' },
  skillKey: String,
  startsAt: { type: Date, required: true },
  seats: { type: Number, required: true, min: 2, max: 200 },
  attendees: [ref('User')],
  status: { type: String, enum: ['open', 'cancelled'], default: 'open' },
}, { timestamps: true });

const questionSchema = new Schema({
  authorId: ref('User', { required: true }),
  title: { type: String, required: true, maxlength: 150 },
  body: { type: String, maxlength: 1000, default: '' },
  status: { type: String, enum: ['visible', 'hidden', 'removed'], default: 'visible' },
  reporters: [ref('User')], // unique reporters; hidden automatically at the threshold
}, { timestamps: true });
const answerSchema = new Schema({
  questionId: ref('Question', { required: true, index: true }),
  authorId: ref('User', { required: true }),
  authorRole: { type: String, required: true },
  body: { type: String, required: true, maxlength: 1000 },
}, { timestamps: true });

// Private proof (student ID photo, graduation certificate). Only the owner and admins can read it. Deleted when rejected.
const verificationDocSchema = new Schema({
  userId: ref('User', { required: true, index: true }),
  kind: { type: String, enum: ['student_id', 'graduation_proof', 'department_letter'], required: true },
  mime: { type: String, enum: ['image/jpeg', 'image/png', 'application/pdf'], required: true },
  sizeBytes: Number,
  data: { type: Buffer, select: false },
}, { timestamps: true });

// Path Twin: a mentor's own career journey as dated skill milestones (month 0 = graduation).
// Shared only when the mentor turns `shared` on. Only skills and months are stored: no employer names, no salary.
const journeySchema = new Schema({
  mentorId: ref('User', { required: true, unique: true }),
  shared: { type: Boolean, default: false },
  firstJobMonths: { type: Number, min: 0, max: 60, default: null }, // months from graduation to first job
  milestones: [{ _id: false, skillKey: { type: String, required: true }, month: { type: Number, min: -24, max: 60, required: true }, level: { type: Number, min: 1, max: 3, required: true } }],
  note: { type: String, maxlength: 300, default: '' },
}, { timestamps: true });

module.exports = {
  Journey: mongoose.model('Journey', journeySchema),
  MockInterview: mongoose.model('MockInterview', mockInterviewSchema),
  ProgressSnapshot: mongoose.model('ProgressSnapshot', progressSnapshotSchema),
  Workshop: mongoose.model('Workshop', workshopSchema),
  Question: mongoose.model('Question', questionSchema),
  Answer: mongoose.model('Answer', answerSchema),
  VerificationDoc: mongoose.model('VerificationDoc', verificationDocSchema),
};
