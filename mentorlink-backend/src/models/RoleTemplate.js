const mongoose = require('mongoose');
module.exports = mongoose.model('RoleTemplate', new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  titleEn: { type: String, required: true },
  titleBn: { type: String, required: true },
  requiredSkills: [{
    _id: false,
    skillKey: { type: String, required: true },
    weight: { type: Number, required: true, min: 1 },
    requiredLevel: { type: Number, required: true, min: 1, max: 3 },
  }],
  relatedRoleKeys: { type: [String], default: [] }, // used for "related role" in experience fit
}));
