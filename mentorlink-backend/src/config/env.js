require('dotenv').config();
module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 4000,
  MONGODB_URI: process.env.MONGODB_URI,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  DEMO_MODE: process.env.DEMO_MODE === 'true',
  ALLOW_PLACEHOLDER_COORDS: process.env.ALLOW_PLACEHOLDER_COORDS === 'true',
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
};
