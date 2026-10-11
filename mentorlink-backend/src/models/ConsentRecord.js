const mongoose = require('mongoose');
module.exports = mongoose.model('ConsentRecord', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  key: { type: String, required: true }, // e.g. departmentProgress, mentorOutcomes, application_share
  value: mongoose.Schema.Types.Mixed,
  meta: mongoose.Schema.Types.Mixed,
}, { timestamps: { createdAt: true, updatedAt: false } }));
