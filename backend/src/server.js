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
  server.listen(env.port, () => console.log(`MentorLink BD API on :${env.port}`));
})();
