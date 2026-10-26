const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const { makeAuth } = require('./middleware/auth');
const { privacyGuard, errorHandler } = require('./middleware/guards');
const { notFound } = require('./utils/httpError');

// verify is injected so tests can run without Firebase.
function createApp({ verify } = {}) {
  const app = express();
  verify = verify || require('./config/firebase').verifyCredential;
  const auth = makeAuth(verify);

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins.length ? env.corsOrigins : true }));
  // Verification uploads are base64 files (under 300 KB). Every other route keeps the small 100 KB limit.
  app.use('/api/me/verification-doc', express.json({ limit: '450kb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use(rateLimit({ windowMs: 60_000, limit: env.nodeEnv === 'test' ? 100000 : 300, standardHeaders: true, legacyHeaders: false }));
  app.use(privacyGuard);

  app.get('/health', (_q, r) => r.json({ ok: true }));
  app.use('/api', require('./routes/core')(auth));
  for (const name of ['learning', 'mentoring', 'opportunities', 'employer', 'admin', 'extras', 'journey', 'hub', 'community', 'loop']) {
    try { app.use('/api', require(`./routes/${name}`)(auth)); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  }
  app.use((_q, _r) => { throw notFound('No such endpoint.'); });
  app.use(errorHandler);
  return app;
}
module.exports = { createApp };
