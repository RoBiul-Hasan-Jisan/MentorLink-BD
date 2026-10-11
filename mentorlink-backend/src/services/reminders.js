const Task = require('../models/Task');
const Session = require('../models/Session');
const { notify } = require('./notify');

const hhmm = (d) => d.toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Run every minute from server.js. Each reminder is "claimed" with an atomic update first,
// so two server instances can never send the same reminder twice.
async function runReminders(now = new Date()) {
  let sent = 0;
  const tasks = await Task.find({ status: 'todo', reminderSent: false, reminderAt: { $lte: now } }).limit(200);
  for (const t of tasks) {
    const claim = await Task.updateOne({ _id: t._id, reminderSent: false }, { $set: { reminderSent: true } });
    if (!claim.modifiedCount) continue;
    await notify(t.studentId, { type: 'task_reminder', title: { en: 'Task reminder', bn: 'কাজের রিমাইন্ডার' },
      body: { en: t.title, bn: t.title }, data: { taskId: String(t._id) } });
    sent++;
  }
  const soon = new Date(now.getTime() + 3600 * 1000); // sessions starting within the next hour
  const sessions = await Session.find({ status: 'scheduled', reminderSent: false, scheduledAt: { $gt: now, $lte: soon } }).limit(200);
  for (const s of sessions) {
    const claim = await Session.updateOne({ _id: s._id, reminderSent: false }, { $set: { reminderSent: true } });
    if (!claim.modifiedCount) continue;
    const when = hhmm(s.scheduledAt);
    for (const uid of [s.studentId, s.mentorId]) {
      await notify(uid, { type: 'session_reminder', title: { en: 'Session starting soon', bn: 'সেশন শিগগিরই শুরু হবে' },
        body: { en: `Your session is at ${when}`, bn: `আপনার সেশন ${when}` }, data: { sessionId: String(s._id) } });
    }
    sent++;
  }
  return sent;
}
module.exports = { runReminders };
