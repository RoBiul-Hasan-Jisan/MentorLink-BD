// Demo data for the extra screens. Idempotent. Everything here belongs to DEMO accounts or is clearly invented.
const M = require('../models');
const { dayKey } = require('../services/progress');

async function seedExtras() {
  const by = async (email) => M.User.findOne({ email });
  const robiul = await by('student.edu@demo.mentorlink.bd'), abrar = await by('mentor1@demo.mentorlink.bd');
  if (!robiul || !abrar) return;
  await M.User.updateOne({ _id: robiul._id }, { shareProgressWithMentors: true, shareProgressWithDept: true });

  // Readiness history for Robiul (invented demo numbers, shown as his own progress screen).
  const hist = [[42, 31], [35, 36], [28, 41], [21, 47], [14, 52], [7, 55], [0, 58]];
  for (const [ago, pct] of hist) {
    const day = dayKey(new Date(Date.now() - ago * 864e5));
    await M.ProgressSnapshot.updateOne({ studentId: robiul._id, day }, { $set: { roleKey: 'data-analyst', percent: pct } }, { upsert: true });
  }

  // Three students waiting for the department to confirm affiliation (no Firebase login: names only).
  for (const [i, name] of [[1, 'Demo Pending One'], [2, 'Demo Pending Two'], [3, 'Demo Pending Three']]) {
    await M.User.updateOne({ firebaseUid: `demo-pending-${i}` }, { $setOnInsert: { firebaseUid: `demo-pending-${i}`, email: `pending${i}@demo.mentorlink.bd`, displayName: name, role: 'student', universityId: robiul.universityId, department: robiul.department, batchYear: 2024, verificationStatus: 'verified', isDemo: true, affiliationStatus: 'pending' } }, { upsert: true });
  }

  if (!(await M.Workshop.findOne({ title: 'SQL basics (demo)' }))) {
    await M.Workshop.create({ hostId: abrar._id, title: 'SQL basics (demo)', description: 'SELECT, WHERE, GROUP BY and one JOIN, with practice questions.', skillKey: 'sql', startsAt: new Date(Date.now() + 5 * 864e5), seats: 10 });
  }
  const qa = [
    ['How do I explain a gap year in an interview?', 'Be honest, name what you learned, and connect it to the job.'],
    ['Is Power BI or Tableau better for a first job?', 'Check the job posts you want. Learn one well, the concepts transfer.'],
  ];
  for (const [title, answer] of qa) {
    let q = await M.Question.findOne({ title });
    if (!q) { q = await M.Question.create({ authorId: robiul._id, title, body: '' }); await M.Answer.create({ questionId: q._id, authorId: abrar._id, authorRole: 'mentor', body: answer }); }
  }
  if (!(await M.MockInterview.findOne({ studentId: robiul._id, mentorId: abrar._id }))) {
    await M.MockInterview.create({ studentId: robiul._id, mentorId: abrar._id, startsAt: new Date(Date.now() - 9 * 864e5), status: 'done', rubric: { communication: 4, technical: 3, problemSolving: 3, confidence: 4 }, overall: 3.5, note: 'Clear speaker. Explain your SQL steps aloud before writing the query.' });
    await M.MockInterview.create({ studentId: robiul._id, mentorId: abrar._id, startsAt: new Date(Date.now() + 4 * 864e5), status: 'booked' });
  }
}
module.exports = { seedExtras };
