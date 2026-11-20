// DEMO data for the launch features: a shared Career Passport, sprints, and a company invitation.
// Everything is invented. Idempotent. For TESTING only, never for the real pilot.
const { User, Passport, Sprint, TalentInvite, SkillEvidence, Skill, Organization, MentorRequest } = require('../models');
const { sprintDays } = require('../services/startup');

const DEMO_SLUG = 'demo-robiul-passport'; // fixed so the QR code in a demo always works

async function seedStartupDemo() {
  const stu = await User.findOne({ email: 'student.edu@demo.mentorlink.bd' });
  const stu2 = await User.findOne({ email: 'student.du@demo.mentorlink.bd' });
  const mentor = await User.findOne({ email: 'mentor1@demo.mentorlink.bd' });
  const emp = await User.findOne({ email: 'employer@demo.mentorlink.bd' });
  if (!stu || !mentor) return;

  // Robiul: some proof so the passport is not empty (quiz + mentor endorsement), shared on, in the talent pool.
  const proof = async (studentId, skillKey, type, level, extra = {}) => {
    if (!(await SkillEvidence.findOne({ studentId, skillKey, type, level }))) await SkillEvidence.create({ studentId, skillKey, type, level, ...extra });
  };
  await proof(stu._id, 'sql', 'quiz', 2);
  await proof(stu._id, 'excel', 'quiz', 2);
  await proof(stu._id, 'sql', 'endorsement', 2, { endorsedBy: mentor._id, url: 'https://github.com/demo-student/loan-dashboard' });
  await Passport.updateOne({ userId: stu._id }, { $set: { slug: DEMO_SLUG, enabled: true, talentPool: true, headline: 'Aspiring data analyst: SQL, Excel, dashboards' } }, { upsert: true });

  // A finished sprint (endorsed) and a running one, so both states can be shown.
  const sql = await Skill.findOne({ key: 'sql' }).lean(); const py = await Skill.findOne({ key: 'python' }).lean();
  if (sql && !(await Sprint.findOne({ studentId: stu._id, skillKey: 'sql' }))) {
    const days = sprintDays(sql).map((d) => ({ ...d, done: true, doneAt: new Date(Date.now() - (8 - d.n) * 864e5) }));
    await Sprint.create({ studentId: stu._id, mentorId: mentor._id, skillKey: 'sql', titleEn: 'SQL sprint', titleBn: `${sql.nameBn} স্প্রিন্ট`, status: 'completed', startedAt: new Date(Date.now() - 9 * 864e5), days, proofUrl: 'https://github.com/demo-student/loan-dashboard', review: { decision: 'endorse', level: 2, note: 'Clean joins and a clear README.', at: new Date() }, badge: true });
  }
  if (py && !(await Sprint.findOne({ studentId: stu._id, skillKey: 'python' }))) {
    const days = sprintDays(py).map((d) => (d.n <= 2 ? { ...d, done: true, doneAt: new Date(Date.now() - (3 - d.n) * 864e5) } : d));
    await Sprint.create({ studentId: stu._id, mentorId: mentor._id, skillKey: 'python', titleEn: 'Python sprint', titleBn: `${py.nameBn} স্প্রিন্ট`, status: 'active', startedAt: new Date(Date.now() - 2 * 864e5), days });
  }

  // A second student in the talent pool, so the company search shows more than one card.
  if (stu2) {
    await proof(stu2._id, 'sql', 'quiz', 2);
    await proof(stu2._id, 'python', 'quiz', 1);
    await Passport.updateOne({ userId: stu2._id }, { $set: { slug: 'demo-nusrat-passport', enabled: true, talentPool: true, headline: 'Data analysis and reporting' } }, { upsert: true });
  }

  // One invitation from the demo company to Robiul (pending, so Robiul can accept or decline it).
  const org = await Organization.findOne({ name: 'Demo Tech Ltd' });
  if (org && emp) {
    await TalentInvite.updateOne({ studentId: stu._id, organizationId: org._id, opportunityId: null }, { $setOnInsert: { invitedBy: emp._id, message: 'We liked your SQL sprint. Would you like to talk about our junior analyst internship?', status: 'pending' } }, { upsert: true });
  }
  await MentorRequest.updateOne({ studentId: stu._id, mentorId: mentor._id }, { $set: { status: 'accepted' } });
}
module.exports = { seedStartupDemo, DEMO_SLUG };
