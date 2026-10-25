// Reminders: in-app notification (and push, if configured) for sessions starting within 24 h
// and unfinished tasks due within 48 h. Each item is reminded once (reminderSent flag), so running this often is safe.
const { Session, Task } = require('../models');
const { notify } = require('../utils/helpers');

async function runReminders(now = new Date()) {
  let sessions = 0, tasks = 0;
  const soon = new Date(now.getTime() + 24 * 36e5);
  for (const s of await Session.find({ status: 'scheduled', reminderSent: false, startsAt: { $gt: now, $lte: soon } })) {
    const when = s.startsAt.toISOString();
    await notify(s.studentId, 'Session coming up', `Your mentor session starts at ${when}.`, 'reminder');
    await notify(s.mentorId, 'Session coming up', `A mentor session starts at ${when}.`, 'reminder');
    s.reminderSent = true; await s.save(); sessions += 1;
  }
  const due = new Date(now.getTime() + 48 * 36e5);
  for (const t of await Task.find({ status: 'todo', reminderSent: false, dueDate: { $gt: now, $lte: due } })) {
    await notify(t.studentId, 'Task due soon', t.title, 'reminder');
    t.reminderSent = true; await t.save(); tasks += 1;
  }
  return { sessions, tasks };
}
module.exports = { runReminders };
