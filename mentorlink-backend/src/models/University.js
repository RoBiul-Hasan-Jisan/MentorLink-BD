const mongoose = require('mongoose');

const universitySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  shortName: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  country: { type: String, default: 'Bangladesh' },
  // Exact CAMPUS coordinates (GeoJSON: [lng, lat]). Two universities in one city have different points.
  campus: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  campusAddressText: { type: String, default: '' },
  emailDomains: { type: [String], default: [] },
  active: { type: Boolean, default: true },
}, { timestamps: true });

universitySchema.index({ campus: '2dsphere' });
module.exports = mongoose.model('University', universitySchema);
