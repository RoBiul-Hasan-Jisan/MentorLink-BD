// Reminders: in-app notification (and push, if configured) for sessions starting within 24 h
// and unfinished tasks due within 48 h. Each item is reminded once.
//
// The reminderSent flag is claimed with ONE atomic update before anything is sent, so two server instances (or an overlapping run)
// can never both send the same reminder. If sending fails after the claim, the claim is released so the next run retries.
const { Session, Task } = require('../models');
const { notify } = require('../utils/helpers');

// Returns the document only for the single caller whose update flipped reminderSent from false to true.
async function claim(Model, filter) {
  return Model.findOneAndUpdate({ ...filter, reminderSent: false }, { $set: { reminderSent: true } }, { returnDocument: 'after' });
}
async function release(Model, id) {
  await Model.updateOne({ _id: id }, { $set: { reminderSent: false } }).catch(() => {});
}

async function runReminders(now = new Date()) {
  let sessions = 0, tasks = 0;
  const soon = new Date(now.getTime() + 24 * 36e5);
  const dueSessions = await Session.find({ status: 'scheduled', reminderSent: false, startsAt: { $gt: now, $lte: soon } }).select('_id').lean();
  for (const { _id } of dueSessions) {
    const s = await claim(Session, { _id, status: 'scheduled' });
    if (!s) continue; // another run already took it
    try {
      const when = s.startsAt.toISOString();
      await notify(s.studentId, 'Session coming up', `Your mentor session starts at ${when}.`, 'reminder', { type: 'session', id: String(s._id) });
      await notify(s.mentorId, 'Session coming up', `A mentor session starts at ${when}.`, 'reminder', { type: 'session', id: String(s._id) });
      sessions += 1;
    } catch (e) { await release(Session, _id); throw e; }
  }
  const due = new Date(now.getTime() + 48 * 36e5);
  const dueTasks = await Task.find({ status: 'todo', reminderSent: false, dueDate: { $gt: now, $lte: due } }).select('_id').lean();
  for (const { _id } of dueTasks) {
    const t = await claim(Task, { _id, status: 'todo' });
    if (!t) continue;
    try {
      await notify(t.studentId, 'Task due soon', t.title, 'reminder', { type: 'plan' });
      tasks += 1;
    } catch (e) { await release(Task, _id); throw e; }
  }
  // job portal upkeep: close expired jobs, remind about saved jobs closing soon, nudge employers whose applicants wait too long
  const jt = require('./jobtools');
  const closedJobs = await jt.closeExpiredJobs(now);
  const savedJobs = await jt.remindSavedJobs(now);
  const nudges = await jt.nudgeSlowEmployers(now);
  return { sessions, tasks, closedJobs, savedJobs, nudges };
}
module.exports = { runReminders };
