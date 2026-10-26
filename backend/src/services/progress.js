// Progress history, milestone badges and weekly streak. All numbers come from real records.
const { ProgressSnapshot } = require('../models');

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

// Keep ONE snapshot per student per day (the latest value of that day wins).
async function recordSnapshot(studentId, roleKey, percent) {
  await ProgressSnapshot.updateOne({ studentId, day: dayKey() }, { $set: { roleKey, percent } }, { upsert: true });
}

// Weeks in a row (ending this week or last week) in which the student finished at least one plan task.
function weekStreak(completedDates, now = new Date()) {
  const wk = (d) => Math.floor(new Date(d).getTime() / (7 * 864e5));
  const weeks = new Set(completedDates.map(wk));
  let w = wk(now);
  if (!weeks.has(w)) w -= 1; // a quiet start of the week does not break the streak yet
  let n = 0;
  while (weeks.has(w)) { n += 1; w -= 1; }
  return n;
}

// 8 milestone badges. `ctx` holds simple facts the route collected.
const BADGES = [
  ['first_session', 'First session', 'প্রথম সেশন', (c) => c.sessionsDone >= 1],
  ['quiz', 'Passed a skill quiz', 'কুইজ পাস', (c) => c.quizEvidence >= 1],
  ['streak3', '3-week streak', '৩ সপ্তাহের ধারা', (c) => c.streakWeeks >= 3],
  ['first_application', 'First application', 'প্রথম আবেদন', (c) => c.applications >= 1],
  ['first_project', 'First project shared', 'প্রথম প্রজেক্ট', (c) => c.projectEvidence >= 1],
  ['cv_reviewed', 'CV reviewed by a mentor', 'সিভি রিভিউ হয়েছে', (c) => c.cvReviewed],
  ['mock', 'Mock interview done', 'মক ইন্টারভিউ', (c) => c.mocksDone >= 1],
  ['interview_ready', 'Interview ready (70%+ and a mock done)', 'ইন্টারভিউয়ের জন্য প্রস্তুত', (c) => c.readiness >= 70 && c.mocksDone >= 1],
];
const badgeList = (ctx) => BADGES.map(([id, en, bn, test]) => ({ id, titleEn: en, titleBn: bn, earned: !!test(ctx) }));

module.exports = { recordSnapshot, weekStreak, badgeList, dayKey };
