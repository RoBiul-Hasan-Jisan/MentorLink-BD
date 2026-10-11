const mongoose = require('mongoose');
const { Schema } = mongoose;
module.exports = mongoose.model('SessionNote', new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true, unique: true },
  mentorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  summary: { type: String, required: true },
  tags: { type: [String], default: [] },
  mentorComment: String,
  // Each next step can become a task in the student's four-week plan (taskId is set when added).
  nextSteps: [{ title: String, weekNumber: { type: Number, min: 1, max: 4 }, dueDate: Date, taskId: { type: Schema.Types.ObjectId, ref: 'Task' } }],
}, { timestamps: true }));
