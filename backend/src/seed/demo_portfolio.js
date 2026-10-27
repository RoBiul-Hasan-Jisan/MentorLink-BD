// DEMO data for the portfolio, GitHub link, plan review and department analytics screens.
// Everything is invented (example repos, no real GitHub account). Idempotent. For TESTING only, never for the real pilot.
const { User, PortfolioProject, GithubLink, PlanReview, SkillEvidence, StudentProfile, MentorRequest } = require('../models');

const PROJECTS = [
  ['Loan default dashboard', 'https://github.com/demo-student/loan-dashboard', 'Excel and SQL dashboard on a public loan dataset.', ['sql', 'excel', 'dashboard'], 'manual'],
  ['Sales cleaning notebook', 'https://github.com/demo-student/sales-cleaning', 'Cleaning and summarising a public sales CSV in Python.', ['python', 'statistics'], 'github'],
];
const REPOS = [
  { name: 'loan-dashboard', url: 'https://github.com/demo-student/loan-dashboard', language: 'PLpgSQL', topics: ['sql', 'dashboard'], description: 'Demo repo', stars: 3 },
  { name: 'sales-cleaning', url: 'https://github.com/demo-student/sales-cleaning', language: 'Jupyter Notebook', topics: ['pandas'], description: 'Demo repo', stars: 1 },
  { name: 'api-practice', url: 'https://github.com/demo-student/api-practice', language: 'JavaScript', topics: ['rest-api', 'testing'], description: 'Demo repo', stars: 0 },
  { name: 'dsa-notes', url: 'https://github.com/demo-student/dsa-notes', language: 'C++', topics: ['algorithms'], description: 'Demo repo', stars: 2 },
];

async function seedPortfolioDemo() {
  const stu = await User.findOne({ email: 'student.edu@demo.mentorlink.bd' });
  const mentor = await User.findOne({ email: 'mentor1@demo.mentorlink.bd' });
  if (!stu || !mentor) return;
  const old = await PortfolioProject.find({ studentId: stu._id }).select('evidenceIds');
  await SkillEvidence.deleteMany({ _id: { $in: old.flatMap((p) => p.evidenceIds) } });
  await PortfolioProject.deleteMany({ studentId: stu._id });
  for (const [title, url, description, skillKeys, source] of PROJECTS) {
    const ids = [];
    for (const skillKey of skillKeys) ids.push((await SkillEvidence.create({ studentId: stu._id, skillKey, type: 'project', level: 1, url })).id);
    await PortfolioProject.create({ studentId: stu._id, title, url, description, skillKeys, source, evidenceIds: ids });
  }
  await GithubLink.updateOne({ userId: stu._id }, { $set: { username: 'demo-student', code: 'mentorlink-demo00', verified: true, checkedAt: new Date(), repos: REPOS } }, { upsert: true });
  // The demo mentor must have an accepted request, otherwise the student cannot ask them for a review.
  await MentorRequest.updateOne({ studentId: stu._id, mentorId: mentor._id }, { $setOnInsert: { goalText: 'Demo request for the portfolio demo.', questions: ['Can you review my plan and projects?'] }, $set: { status: 'accepted' } }, { upsert: true });
  await StudentProfile.updateOne({ userId: stu._id }, { $set: { selectedTargets: ['ml'] } });
  await PlanReview.deleteMany({ studentId: stu._id });
  await PlanReview.create({ studentId: stu._id, mentorId: mentor._id, status: 'requested', studentNote: 'Is week 2 too heavy for 6 hours a week?', tasksTotal: 6, tasksDone: 2 });
}
module.exports = { seedPortfolioDemo, PROJECTS, REPOS };
