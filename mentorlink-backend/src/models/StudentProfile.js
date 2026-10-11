const mongoose = require('mongoose');
module.exports = mongoose.model('StudentProfile', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  careerGoalRoleKey: String,
  goalText: { type: String, default: '' },
  weeklyHours: { type: Number, default: 0 },
  languages: { type: [String], default: [] },       // 'bn' | 'en'
  preferredSlots: { type: [String], default: [] },  // e.g. "Sun 20:30"
}, { timestamps: true }));
