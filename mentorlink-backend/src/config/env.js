require('dotenv').config();
module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 4000,
  MONGODB_URI: process.env.MONGODB_URI,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  DEMO_MODE: process.env.DEMO_MODE === 'true',
  ALLOW_PLACEHOLDER_COORDS: process.env.ALLOW_PLACEHOLDER_COORDS === 'true',
  REPORT_HIDE_THRESHOLD: Number(process.env.REPORT_HIDE_THRESHOLD) || 3, // distinct reporters before auto-hide
  DEPT_MIN_COHORT: Number(process.env.DEPT_MIN_COHORT) || 5,            // smaller cohorts are suppressed in department reports
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
};
