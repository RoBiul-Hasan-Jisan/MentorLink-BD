const mongoose = require('mongoose');
const { Schema } = mongoose;
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  title: { en: String, bn: String },
  body: { en: String, bn: String },
  data: Schema.Types.Mixed,
  readAt: Date,
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ userId: 1, createdAt: -1 });
module.exports = mongoose.model('Notification', schema);
