require('dotenv').config();
const http = require('http');
const env = require('./config/env');
const { connect } = require('./config/db');
const { createApp } = require('./app');

(async () => {
  await connect(env.mongoUri);
  const server = http.createServer();
  const app = createApp();
  server.on('request', app);
  app.set('io', require('./realtime').attach(server));

  // Reminder job. It is safe to run on several instances at once (each reminder is claimed atomically in
  // services/reminders.js), but set RUN_SCHEDULER=false on all but one instance to avoid the extra database load.
  if (process.env.RUN_SCHEDULER !== 'false') {
    const { runReminders } = require('./services/reminders');
    const tick = () => runReminders().then((r) => { if (r.sessions || r.tasks) console.log(`reminders sent: ${r.sessions} session(s), ${r.tasks} task(s)`); }).catch((e) => console.error('reminder job failed', e.message));
    setInterval(tick, 15 * 60 * 1000).unref(); // every 15 min
  }
  server.listen(env.port, () => console.log(`MentorLink BD API on :${env.port}`));
})().catch((e) => {
  // A failed startup (database unreachable, a route module missing) must stop the process with a clear message, not hang half-started.
  console.error('MentorLink BD API failed to start:', e && e.message ? e.message : e);
  process.exit(1);
});
