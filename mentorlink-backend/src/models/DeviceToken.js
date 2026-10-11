const mongoose = require('mongoose');
module.exports = mongoose.model('DeviceToken', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  token: { type: String, required: true, unique: true }, // FCM registration token
  platform: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
}, { timestamps: true }));
