const mongoose = require('mongoose');
const { Schema } = mongoose;
// Everyone registers as a student. Becoming a mentor/department user needs an admin to approve this request.
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  requestedRole: { type: String, enum: ['mentor', 'department'], required: true },
  note: String,
  proofUrl: String, // link to a graduation proof hosted by the user (file upload comes later)
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' }, reviewedAt: Date, reason: String,
}, { timestamps: true });
schema.index({ userId: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
schema.index({ status: 1, createdAt: 1 });
module.exports = mongoose.model('RoleRequest', schema);
