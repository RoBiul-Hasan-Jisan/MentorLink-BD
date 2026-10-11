const DAY = 86400000;
const currentWeek = (startDate, now = new Date()) => Math.min(4, Math.max(1, Math.floor((now - new Date(startDate)) / (7 * DAY)) + 1));

// tasks: [{weekNumber, status}]
function summarize(tasks, startDate, now = new Date()) {
  const cw = currentWeek(startDate, now);
  const weeks = [1, 2, 3, 4].map((n) => {
    const t = tasks.filter((x) => x.weekNumber === n);
    const done = t.filter((x) => x.status === 'done').length;
    return { week: n, total: t.length, done, state: n < cw ? 'past' : n === cw ? 'now' : 'next' };
  });
  const done = tasks.filter((t) => t.status === 'done').length;
  const due = tasks.filter((t) => t.weekNumber <= cw);
  return {
    currentWeek: cw, weeks,
    overallProgress: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    // share of tasks scheduled up to the current week that are done (null when nothing is due yet)
    completionRate: due.length ? Math.round((due.filter((t) => t.status === 'done').length / due.length) * 100) : null,
  };
}
module.exports = { currentWeek, summarize };
