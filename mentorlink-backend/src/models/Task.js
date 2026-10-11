const mongoose = require('mongoose');
const { Schema } = mongoose;
const schema = new Schema({
  planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  weekNumber: { type: Number, min: 1, max: 4, required: true },
  dueDate: Date,
  status: { type: String, enum: ['todo', 'done'], default: 'todo' },
  doneAt: Date,
  source: { type: String, enum: ['self', 'session_note'], default: 'self' },
  sourceStepId: Schema.Types.ObjectId,
  mentorComments: [{ authorId: { type: Schema.Types.ObjectId, ref: 'User' }, text: String, createdAt: { type: Date, default: Date.now } }],
  resourceIds: [{ type: Schema.Types.ObjectId }], // Phase 2: links to approved learning resources
  reminderAt: Date, reminderSent: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ studentId: 1, weekNumber: 1 });
schema.index({ status: 1, reminderSent: 1, reminderAt: 1 });
schema.index({ studentId: 1, sourceStepId: 1 }, { unique: true, partialFilterExpression: { sourceStepId: { $exists: true } } });
module.exports = mongoose.model('Task', schema);
