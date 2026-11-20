const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const { makeAuth } = require('./middleware/auth');
const { privacyGuard, errorHandler } = require('./middleware/guards');
const { notFound } = require('./utils/httpError');
const { mongoose } = require('./config/db');

// verify is injected so tests can run without Firebase.
function createApp({ verify } = {}) {
  const app = express();
  if (env.nodeEnv === 'production' && !env.corsOrigins.length) {
    // With no allowlist the API accepts requests from any website origin. Tokens travel in a header (not a cookie), which limits the risk, but production should still name its origins.
    console.warn('WARNING: CORS_ORIGINS is empty in production. Set it to the exact admin-panel / web-app origins.');
  }
  verify = verify || require('./config/firebase').verifyCredential;
  const auth = makeAuth(verify);

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins.length ? env.corsOrigins : true }));
  // Verification uploads are base64 files (under 300 KB). Every other route keeps the small 100 KB limit.
  app.use('/api/me/verification-doc', express.json({ limit: '450kb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use(rateLimit({ windowMs: 60_000, limit: env.nodeEnv === 'test' ? 100000 : 300, standardHeaders: true, legacyHeaders: false }));
  // Stricter limits on the routes people abuse most (per IP, per minute). The global limit above still applies to everything.
  const strict = (limit) => rateLimit({ windowMs: 60_000, limit: env.nodeEnv === 'test' ? 100000 : limit, standardHeaders: true, legacyHeaders: false });
  app.use(['/api/auth/register-profile', '/api/auth/register-recruiter'], strict(10));
  app.use('/api/me/verification-doc', strict(6));
  app.use('/api/reports', strict(10));
  app.use(/^\/api\/opportunities\/[^/]+\/apply$/, strict(20));
  app.use([/^\/api\/applications\/[^/]+\/messages$/, /^\/api\/requests\/[^/]+\/messages$/], strict(40));
  app.use(privacyGuard);

  // /health = the process is up (liveness). /ready = the database is connected (readiness); use it for load-balancer checks.
  app.get('/health', (_q, r) => r.json({ ok: true }));
  app.get('/ready', (_q, r) => {
    const up = mongoose.connection.readyState === 1;
    r.status(up ? 200 : 503).json({ ready: up });
  });
  // Free scheduler hook: an outside cron (GitHub Actions or cron-job.org, both free) calls this to wake the sleeping server and run the reminders.
  app.post('/internal/tick', require('./routes/tick'));
  app.use('/api', require('./routes/core')(auth));
  // Every route module is REQUIRED. A missing file or a missing dependency inside one must stop startup with a clear error;
  // it used to be skipped silently, which left whole features returning 404 with no explanation.
  for (const name of ['learning', 'mentoring', 'opportunities', 'employer', 'hiring', 'admin', 'extras', 'journey', 'hub', 'community', 'loop', 'lab', 'career', 'analytics', 'ready', 'actions']) {
    app.use('/api', require(`./routes/${name}`)(auth));
  }
  // Launch features (passport, sprints, brief, talent pool). The public passport page lives at /p/:slug.
  const startup = require('./routes/startup')(auth);
  app.use('/api', startup);
  app.get('/p/:slug', startup.page);
  app.use((_q, _r) => { throw notFound('No such endpoint.'); });
  app.use(errorHandler);
  return app;
}
module.exports = { createApp };
