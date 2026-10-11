const mongoose = require('mongoose');
const { Schema } = mongoose;
const schema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  mentorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  goalText: { type: String, required: true },
  questions: { type: [String], default: [] },
  preferredSlots: { type: [String], default: [] },
  format: { type: String, enum: ['video', 'phone', 'in_person'], default: 'video' },
  // pending -> accepted | declined | expired | cancelled (cancelled = student withdrew before reply)
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'expired', 'cancelled'], default: 'pending' },
  declineReason: { type: String, enum: ['at_capacity', 'outside_expertise', 'time_conflict', 'other'] },
  respondedAt: Date,
  // What the student chose to share with this mentor at request time (avoids N+1 lookups later).
  snapshot: {
    readinessPercent: Number, roleTitleEn: String, roleTitleBn: String, matchScore: Number,
    gaps: [{ _id: false, skillKey: String, nameEn: String, nameBn: String }],
  },
}, { timestamps: true });
// One pending request per student+mentor pair.
schema.index({ studentId: 1, mentorId: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
schema.index({ mentorId: 1, status: 1, createdAt: -1 });
schema.index({ studentId: 1, createdAt: -1 });
module.exports = mongoose.model('MentorRequest', schema);
