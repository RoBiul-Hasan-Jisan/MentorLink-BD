const mongoose = require('mongoose');
const { Schema } = mongoose;
const schema = new Schema({
  requestId: { type: Schema.Types.ObjectId, ref: 'MentorRequest', required: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true },
  clientId: String,          // set by the app so a retry after "message queued" is not duplicated
  flagged: { type: Boolean, default: false }, flaggedTerms: [String], // suspicious-keyword flag for admin review
  readAt: Date,
}, { timestamps: true });
schema.index({ requestId: 1, createdAt: -1 });
schema.index({ requestId: 1, senderId: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } });
schema.index({ receiverId: 1, readAt: 1 });
module.exports = mongoose.model('Message', schema);
