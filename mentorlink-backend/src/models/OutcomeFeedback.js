const mongoose = require('mongoose');
module.exports = mongoose.model('OutcomeFeedback', new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  mentoringHelped: { type: String, enum: ['a_lot', 'a_little', 'not_yet'], required: true },
}, { timestamps: true })); // self-reported; used to evaluate recommendations, never to claim causation
