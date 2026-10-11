const http = require('http');
const { createApp } = require('./app');
const { connectDb } = require('./config/db');
const { createSocketServer } = require('./socket');
const { runReminders } = require('./services/reminders');
const env = require('./config/env');

connectDb()
  .then(() => {
    const server = http.createServer(createApp());
    createSocketServer(server);
    server.listen(env.PORT, () => console.log(`MentorLink API + sockets on :${env.PORT}`));
    setInterval(() => runReminders().catch((e) => console.error('reminders:', e.message)), 60 * 1000); // task + session reminders
  })
  .catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
