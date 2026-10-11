const mongoose = require('mongoose');
const { Schema } = mongoose;
// Structured CV. Deliberately NO phone, email or address fields: contact details are never stored in a CV.
const schema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  version: { type: Number, required: true },
  language: { type: String, enum: ['bn', 'en'], default: 'en' },
  headline: { type: String, default: '' },
  summary: { type: String, default: '' },
  education: [{ _id: false, institution: String, degree: String, year: Number }],
  projects: [{ _id: false, title: String, description: String, url: String, result: String }],
  reviewRequestedFrom: { type: Schema.Types.ObjectId, ref: 'User' },
  comments: [{ authorId: { type: Schema.Types.ObjectId, ref: 'User' }, section: String, line: Number, text: String,
    status: { type: String, enum: ['open', 'resolved'], default: 'open' }, createdAt: { type: Date, default: Date.now } }],
}, { timestamps: true });
schema.index({ studentId: 1, version: 1 }, { unique: true });
module.exports = mongoose.model('CvVersion', schema);
