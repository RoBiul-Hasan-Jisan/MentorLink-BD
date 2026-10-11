const mongoose = require('mongoose');
const { Schema } = mongoose;
const schema = new Schema({
  requestId: { type: Schema.Types.ObjectId, ref: 'MentorRequest', required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  mentorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  scheduledAt: { type: Date, required: true },
  durationMin: { type: Number, default: 30 },
  format: { type: String, enum: ['video', 'phone', 'in_person'], default: 'video' },
  topic: String,
  meetingLink: String,  // pasted by the mentor; text only (no phone numbers are collected by the platform)
  meetingNote: String,  // e.g. in-person meeting point description
  status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
  cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' }, cancelledAt: Date, lateCancel: Boolean,
  completedAt: Date,
  rating: { type: Number, min: 1, max: 5, default: null }, ratedAt: Date,
  reminderSent: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ studentId: 1, scheduledAt: 1 });
schema.index({ mentorId: 1, scheduledAt: 1 });
schema.index({ status: 1, reminderSent: 1, scheduledAt: 1 });
module.exports = mongoose.model('Session', schema);
