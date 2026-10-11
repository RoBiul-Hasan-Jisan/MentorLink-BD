const mongoose = require('mongoose');
module.exports = mongoose.model('Skill', new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  nameEn: { type: String, required: true },
  nameBn: { type: String, required: true },
  // Rubric: estimated study hours to gain ONE level. Uncalibrated v0 - calibrate with pilot data.
  hoursPerLevel: { type: Number, default: 5 },
}));
