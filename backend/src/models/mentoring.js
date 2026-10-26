const { mongoose } = require('../config/db');
const { Schema } = mongoose;
const ref = (name, extra = {}) => ({ type: Schema.Types.ObjectId, ref: name, ...extra });

// Saved factor scores let the app explain every match ("Why this mentor").
const matchSchema = new Schema(
  {
    studentId: ref('User', { required: true, index: true }),
    mentorId: ref('User', { required: true }),
    score: { type: Number, required: true },
    factorScores: { type: Schema.Types.Mixed, default: {} },
    reasons: [{ en: String, bn: String }],
  },
  { timestamps: true }
);

const mentorRequestSchema = new Schema(
  {
    studentId: ref('User', { required: true, index: true }),
    mentorId: ref('User', { required: true, index: true }),
    goalText: { type: String, required: true, maxlength: 400 },
    questions: { type: [String], validate: (v) => v.length >= 1 && v.length <= 3 },
    preferredSlots: [String],
    format: { type: String, enum: ['video', 'phone', 'in_person'], default: 'video' },
    focusSkillKey: String, // the specific gap this request is about
    focusKind: String,
    status: { type: String, enum: ['pending', 'accepted', 'declined', 'expired', 'cancelled'], default: 'pending' },
    declineReason: { type: String, maxlength: 300 },
  },
  { timestamps: true }
);

const sessionSchema = new Schema(
  {
    requestId: ref('MentorRequest', { required: true }),
    studentId: ref('User', { required: true, index: true }),
    mentorId: ref('User', { required: true, index: true }),
    startsAt: { type: Date, required: true },
    mode: { type: String, enum: ['video', 'phone', 'in_person'], default: 'video' },
    meetingLink: { type: String, maxlength: 300 },
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
    reminderSent: { type: Boolean, default: false },
    durationMin: { type: Number, default: 45, min: 5, max: 240 },
    rating: { stars: { type: Number, min: 1, max: 5 }, comment: { type: String, maxlength: 300 }, at: Date },
    cancelledBy: ref('User'),
    mentorNoShow: { type: Boolean, default: false },
    notes: { type: String, maxlength: 4000 },
    nextSteps: [{ text: String, taskId: ref('Task') }],
  },
  { timestamps: true }
);

const planSchema = new Schema(
  {
    studentId: ref('User', { required: true, unique: true }),
    startsOn: { type: Date, default: Date.now },
    weeks: { type: Number, default: 4 },
  },
  { timestamps: true }
);

const taskSchema = new Schema(
  {
    planId: ref('Plan', { required: true, index: true }),
    studentId: ref('User', { required: true, index: true }),
    title: { type: String, required: true, maxlength: 200 },
    week: { type: Number, min: 1, max: 4, default: 1 },
    dueDate: Date,
    status: { type: String, enum: ['todo', 'done'], default: 'todo' },
    mentorComment: { type: String, maxlength: 300 },
    completedAt: Date,
    reminderSent: { type: Boolean, default: false },
    sourceSessionId: ref('Session'),
  },
  { timestamps: true }
);

const cvVersionSchema = new Schema(
  {
    studentId: ref('User', { required: true, index: true }),
    version: { type: Number, required: true },
    data: { type: Schema.Types.Mixed, required: true }, // structured CV sections
    reviewComments: [{ mentorId: ref('User'), text: String, at: { type: Date, default: Date.now } }],
  },
  { timestamps: true }
);

const messageSchema = new Schema(
  {
    requestId: ref('MentorRequest', { required: true, index: true }),
    senderId: ref('User', { required: true }),
    text: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true }
);

const notificationSchema = new Schema(
  {
    userId: ref('User', { required: true, index: true }),
    title: { type: String, required: true },
    body: { type: String, default: '' },
    kind: { type: String, default: 'info' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = {
  Match: mongoose.model('Match', matchSchema),
  MentorRequest: mongoose.model('MentorRequest', mentorRequestSchema),
  Session: mongoose.model('Session', sessionSchema),
  Plan: mongoose.model('Plan', planSchema),
  Task: mongoose.model('Task', taskSchema),
  CvVersion: mongoose.model('CvVersion', cvVersionSchema),
  Message: mongoose.model('Message', messageSchema),
  Notification: mongoose.model('Notification', notificationSchema),
};
