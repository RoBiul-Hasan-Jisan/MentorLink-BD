const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mentorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  score: Number,
  factorScores: mongoose.Schema.Types.Mixed, // saved so every result can be explained later
  reasons: mongoose.Schema.Types.Mixed,
}, { timestamps: true });
schema.index({ studentId: 1, mentorId: 1 }, { unique: true }); // one row per pair; createdAt = first time recommended
schema.index({ createdAt: 1, mentorId: 1 });
module.exports = mongoose.model('Match', schema);
