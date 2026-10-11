const mongoose = require('mongoose');

const NEEDS_UNIVERSITY = ['student', 'mentor', 'department'];

// PRIVACY: there is deliberately NO latitude/longitude/address/gps field on a user.
// strict mode (default) also drops any such field if one ever slips through.
const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  displayName: { type: String, required: true, trim: true },
  role: { type: String, enum: ['student', 'mentor', 'employer', 'department', 'admin'], default: 'student' },
  universityId: {
    type: mongoose.Schema.Types.ObjectId, ref: 'University',
    required() { return NEEDS_UNIVERSITY.includes(this.role); },
  },
  department: String,
  batchYear: Number,
  language: { type: String, enum: ['bn', 'en'], default: 'en' },
  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  showInDirectory: { type: Boolean, default: true },
  lowDataMode: { type: Boolean, default: false },
  // Consent switches (every change is also written to consentRecords)
  consents: {
    departmentProgress: { type: Boolean, default: true },  // anonymous counts only
    mentorOutcomes: { type: Boolean, default: false },     // lets my mentors see aggregate application outcomes
  },
}, { timestamps: true });

userSchema.index({ universityId: 1, role: 1, verificationStatus: 1, showInDirectory: 1 });
module.exports = mongoose.model('User', userSchema);
