const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const rate = require('./middleware/rateLimit');
const errorHandler = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : false })); // allow-list only
  app.use(express.json({ limit: '100kb' }));
  if (env.NODE_ENV !== 'test') app.use(morgan('tiny'));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api', rate.general);
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/me', require('./routes/me'));
  app.use('/api/universities', require('./routes/universities'));
  app.use('/api/directory', require('./routes/directory'));
  app.use('/api', require('./routes/catalog'));
  app.use('/api/matches', require('./routes/matches'));
  app.use('/api/admin', require('./routes/admin'));

  app.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
  app.use(errorHandler);
  return app;
}
module.exports = { createApp };
