const mongoose = require('mongoose');
module.exports = mongoose.model('MentorProfile', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  industry: { type: String, default: '' },
  roleTitle: { type: String, default: '' },
  roleKeys: { type: [String], default: [] },        // taxonomy tags (roleTemplates.key)
  yearsExperience: { type: Number, default: 0 },
  expertiseSkills: [{ _id: false, skillKey: String, level: { type: Number, min: 1, max: 3 } }],
  languages: { type: [String], default: [] },
  weeklyCapacity: { type: Number, default: 3 },
  activeMentees: { type: Number, default: 0 },      // server-maintained (Phase 3)
  paused: { type: Boolean, default: false },
  availableSlots: { type: [String], default: [] },
  // Server-maintained stats: a mentor can NOT edit these through the API.
  responseRate: { type: Number, default: 0 },
  ratingAvg: { type: Number, default: 0 },
  sessionsCompleted: { type: Number, default: 0 },
  acceptedRequests: { type: Number, default: 0 },
  isRising: { type: Boolean, default: true },
}, { timestamps: true }));
