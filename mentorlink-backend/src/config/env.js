// Reads environment variables once, in one place.
require('dotenv').config();

const bool = (v, d = false) => (v === undefined ? d : String(v).toLowerCase() === 'true');

module.exports = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mentorlink',
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  demoMode: bool(process.env.DEMO_MODE, false),
  allowPlaceholderCoords: bool(process.env.ALLOW_PLACEHOLDER_COORDS, false),
  reportHideThreshold: Number(process.env.REPORT_HIDE_THRESHOLD || 3),
  geoIndex: bool(process.env.MONGO_GEO_INDEX, true),
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || undefined,
};
