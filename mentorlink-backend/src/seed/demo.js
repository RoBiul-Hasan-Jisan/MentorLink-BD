// Demo accounts. Idempotent: run it as often as you like. Refuses to run unless DEMO_MODE=true.
// Works against real Firebase (service account) or the Firebase Auth Emulator (FIREBASE_AUTH_EMULATOR_HOST).
const env = require('../config/env');
const { User, University, StudentProfile, MentorProfile, SkillEvidence, Opportunity, CvVersion } = require('../models');
const { seedLearning } = require('./learning');
const { seedUniversities } = require('./universities');

const PW = 'Demo@12345';
const ACCOUNTS = [
  { email: 'student.edu@demo.mentorlink.bd', name: 'Robiul', role: 'student', uni: 'East Delta University', dept: 'CSE', batch: 2023, pw: PW },
  { email: 'student.su@demo.mentorlink.bd', name: 'Demo Student (Southern)', role: 'student', uni: 'Southern University Bangladesh', dept: 'BBA', batch: 2022, pw: PW },
  { email: 'mentor1@demo.mentorlink.bd', name: 'Abrar', role: 'mentor', uni: 'East Delta University', dept: 'CSE', batch: 2016, pw: PW },
  { email: 'mentor2@demo.mentorlink.bd', name: 'Demo Mentor (Southern)', role: 'mentor', uni: 'Southern University Bangladesh', dept: 'BBA', batch: 2014, pw: PW },
  { email: 'dept@demo.mentorlink.bd', name: 'Dayan', role: 'department', uni: 'East Delta University', dept: 'CSE', pw: PW },
  { email: 'admin@demo.mentorlink.bd', name: 'Ayesha', role: 'admin', pw: 'Admin@12345' },
  { email: 'employer@demo.mentorlink.bd', name: 'Demo Employer (Phase 2)', role: 'employer', pw: PW },
];

async function ensureFirebaseUser(auth, a) {
  try {
    const u = await auth.getUserByEmail(a.email);
    await auth.updateUser(u.uid, { password: a.pw, displayName: a.name, emailVerified: true });
    return u.uid;
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    return (await auth.createUser({ email: a.email, password: a.pw, displayName: a.name, emailVerified: true })).uid;
  }
}

async function seedDemo({ auth }) {
  if (!env.demoMode) throw new Error('Refusing to seed demo accounts: set DEMO_MODE=true.');
  process.env.ALLOW_PLACEHOLDER_COORDS = 'true';
  env.allowPlaceholderCoords = true;
  await seedUniversities();
  await seedLearning();
  const ids = {};
  for (const a of ACCOUNTS) {
    const uid = await ensureFirebaseUser(auth, a);
    const uni = a.uni ? await University.findOne({ name: a.uni }) : null;
    const u = await User.findOneAndUpdate({ firebaseUid: uid }, { $set: {
      firebaseUid: uid, email: a.email, displayName: a.name, role: a.role, universityId: uni && uni._id, department: a.dept, batchYear: a.batch,
      verificationStatus: 'verified', showInDirectory: true, isDemo: true, language: 'en',
    } }, { upsert: true, returnDocument: 'after' });
    ids[a.email] = u;
  }
  const stu = ids['student.edu@demo.mentorlink.bd'];
  await StudentProfile.updateOne({ userId: stu._id }, { $set: { careerGoalRoleKey: 'data-analyst', goalText: 'I want to become a data analyst in fintech', weeklyHours: 6, languages: ['bn', 'en'], requestedSlots: ['sun-20', 'tue-21'] } }, { upsert: true });
  await SkillEvidence.deleteMany({ studentId: stu._id });
  await SkillEvidence.insertMany([
    { studentId: stu._id, skillKey: 'excel', type: 'project', level: 3 }, { studentId: stu._id, skillKey: 'sql', type: 'quiz', level: 2 },
    { studentId: stu._id, skillKey: 'communication', type: 'self', level: 2 }, { studentId: stu._id, skillKey: 'python', type: 'self', level: 1 },
  ]);
  await StudentProfile.updateOne({ userId: ids['student.su@demo.mentorlink.bd']._id }, { $set: { careerGoalRoleKey: 'management-trainee', weeklyHours: 4 } }, { upsert: true });
  const m1 = ids['mentor1@demo.mentorlink.bd'], m2 = ids['mentor2@demo.mentorlink.bd'];
  await MentorProfile.updateOne({ userId: m1._id }, { $set: { roleKey: 'data-analyst', relatedRoleKeys: ['junior-developer'], roleTitle: 'Senior Data Analyst', industry: 'Fintech', yearsExperience: 8, expertiseSkills: [{ skillKey: 'sql', level: 3 }, { skillKey: 'python', level: 2 }, { skillKey: 'excel', level: 3 }, { skillKey: 'dashboard', level: 3 }, { skillKey: 'statistics', level: 2 }], languages: ['bn', 'en'], weeklyCapacity: 5, availableSlots: ['sun-20', 'tue-21'], acceptedRequests: 8, sessionsCompleted: 7, paused: false } }, { upsert: true });
  await MentorProfile.updateOne({ userId: m2._id }, { $set: { roleKey: 'management-trainee', relatedRoleKeys: ['banking-trainee'], roleTitle: 'Management Trainee Lead', industry: 'FMCG', yearsExperience: 3, expertiseSkills: [{ skillKey: 'communication', level: 3 }, { skillKey: 'leadership', level: 2 }], languages: ['bn'], weeklyCapacity: 4, availableSlots: ['wed-20'], isRising: true, paused: false } }, { upsert: true });
  await CvVersion.updateOne({ studentId: stu._id, version: 1 }, { $set: { data: { summary: 'CSE student, interested in data.', education: 'East Delta University, CSE' } } }, { upsert: true });
  const adm = ids['admin@demo.mentorlink.bd'];
  if (!(await Opportunity.findOne({ title: 'Junior Data Analyst (Demo)' }))) {
    await Opportunity.create({ postedBy: adm._id, title: 'Junior Data Analyst (Demo)', organization: 'Demo Fintech Ltd', type: 'job', workplaceMode: 'hybrid', locationText: 'Chattogram', description: 'Support the analytics team with SQL reports and dashboards. No fee is ever asked from applicants.', requiredSkills: [{ skillKey: 'sql', requiredLevel: 2, weight: 3 }, { skillKey: 'excel', requiredLevel: 2, weight: 2 }], noFeeConfirmed: true, sourceLabel: 'admin', listingReviewed: true, status: 'approved' });
  }
  return ACCOUNTS.map((a) => ({ role: a.role, email: a.email, password: a.pw, university: a.uni || '-' }));
}
module.exports = { seedDemo, ACCOUNTS };

if (require.main === module) {
  require('dotenv').config();
  (async () => {
    const { connect, mongoose } = require('../config/db');
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp({ projectId: env.firebaseProjectId || 'demo-mentorlink' });
    await connect(env.mongoUri);
    console.table(await seedDemo({ auth: admin.auth() }));
    await mongoose.disconnect();
  })().catch((e) => { console.error(e.message); process.exit(1); });
}
