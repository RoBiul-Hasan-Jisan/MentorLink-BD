const { createApp } = require('./app');
const { connectDb } = require('./config/db');
const env = require('./config/env');

connectDb()
  .then(() => createApp().listen(env.PORT, () => console.log(`MentorLink API on :${env.PORT}`)))
  .catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
