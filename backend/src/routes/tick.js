// POST /internal/tick: runs the reminder / job-upkeep job once. It exists so a FREE outside scheduler can do the work
// that setInterval cannot do on a free host that goes to sleep. Calling it also wakes the server.
//
// Protected by a shared secret in the `x-cron-secret` header (env CRON_SECRET). If CRON_SECRET is not set the route is OFF (404).
// Safe to call as often as you like: every reminder is claimed atomically, so nothing is sent twice.
const crypto = require('crypto');
const { runReminders } = require('../services/reminders');

const same = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

module.exports = async function tick(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No such endpoint.' } });
  if (!same(req.get('x-cron-secret') || '', secret)) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Bad secret.' } });
  try { res.json({ ok: true, ...(await runReminders()) }); }
  catch (e) { console.error('tick failed', e.message); res.status(500).json({ error: { code: 'TICK_FAILED', message: 'The job failed. Try again.' } }); }
};
