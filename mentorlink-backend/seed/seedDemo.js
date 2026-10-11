const mongoose = require('mongoose');
const env = require('../src/config/env');
const { connectDb } = require('../src/config/db');
const { getAuth } = require('../src/config/firebase');
const University = require('../src/models/University');
const User = require('../src/models/User');
const { seedUniversities } = require('./seedUniversities');
const { seedSkills } = require('./seedSkills');
const StudentProfile = require('../src/models/StudentProfile');
const MentorProfile = require('../src/models/MentorProfile');
const SkillEvidence = require('../src/models/SkillEvidence');

// Mentor profiles. The first two belong to demo logins; the rest are Mongo-only seed mentors (no Firebase login)
// so that a student sees 5 matches, including one rising mentor.
const SLOTS = ['Sun 20:30', 'Tue 21:00', 'Fri 16:00'];
const MENTOR_PROFILES = {
  'mentor1@demo.mentorlink.bd': { industry: 'Telecom', roleTitle: 'Senior Data Analyst', roleKeys: ['data-analyst'], yearsExperience: 6,
    expertiseSkills: [{ skillKey: 'sql', level: 3 }, { skillKey: 'powerbi', level: 3 }, { skillKey: 'excel', level: 2 }],
    languages: ['bn', 'en'], weeklyCapacity: 3, activeMentees: 2, availableSlots: SLOTS, sessionsCompleted: 14, acceptedRequests: 15, ratingAvg: 4.8, isRising: false },
  'mentor2@demo.mentorlink.bd': { industry: 'Banking', roleTitle: 'BI Developer', roleKeys: ['data-analyst'], yearsExperience: 5,
    expertiseSkills: [{ skillKey: 'powerbi', level: 3 }, { skillKey: 'sql', level: 2 }, { skillKey: 'excel', level: 3 }],
    languages: ['bn', 'en'], weeklyCapacity: 3, activeMentees: 1, availableSlots: ['Sun 20:30', 'Thu 20:00'], sessionsCompleted: 9, acceptedRequests: 10, ratingAvg: 4.6, isRising: false },
};
const EXTRA_MENTORS = [
  { email: 'seed.tanvir@demo.mentorlink.bd', displayName: 'Tanvir Hasan', uni: 'EDU', profile: { industry: 'Software', roleTitle: 'Data Analyst', roleKeys: ['data-analyst'], yearsExperience: 2,
    expertiseSkills: [{ skillKey: 'sql', level: 3 }, { skillKey: 'python', level: 3 }, { skillKey: 'powerbi', level: 2 }],
    languages: ['bn', 'en'], weeklyCapacity: 3, activeMentees: 0, availableSlots: ['Tue 21:00', 'Thu 20:00'], sessionsCompleted: 2, acceptedRequests: 3, ratingAvg: 4.4, isRising: true } },
  { email: 'seed.imran@demo.mentorlink.bd', displayName: 'Imran Kabir', uni: 'SU', profile: { industry: 'Fintech', roleTitle: 'Software Engineer', roleKeys: ['junior-developer'], yearsExperience: 8,
    expertiseSkills: [{ skillKey: 'javascript', level: 3 }, { skillKey: 'git', level: 3 }, { skillKey: 'sql', level: 2 }],
    languages: ['en'], weeklyCapacity: 2, activeMentees: 1, availableSlots: ['Fri 16:00'], sessionsCompleted: 11, acceptedRequests: 12, ratingAvg: 4.7, isRising: false } },
  { email: 'seed.sadia@demo.mentorlink.bd', displayName: 'Sadia Rahman', uni: 'EDU', profile: { industry: 'E-commerce', roleTitle: 'QA Lead', roleKeys: ['qa-engineer'], yearsExperience: 7,
    expertiseSkills: [{ skillKey: 'testing', level: 3 }, { skillKey: 'automation', level: 3 }, { skillKey: 'sql', level: 2 }],
    languages: ['bn', 'en'], weeklyCapacity: 3, activeMentees: 1, availableSlots: ['Sun 20:30'], sessionsCompleted: 6, acceptedRequests: 7, ratingAvg: 4.5, isRising: false } },
];
const STUDENT_PROFILES = {
  'student.edu@demo.mentorlink.bd': { careerGoalRoleKey: 'data-analyst', goalText: 'Become job-ready as a Junior Data Analyst in 5 weeks', weeklyHours: 6,
    languages: ['bn', 'en'], preferredSlots: ['Sun 20:30', 'Tue 21:00', 'Thu 20:00'],
    // quiz/endorsement = verified; self = unverified (capped at level 1 by the readiness rule)
    evidence: [['sql', 'self', 1, false], ['python', 'self', 1, false], ['excel', 'quiz', 2, true],
      ['statistics', 'endorsement', 2, true], ['communication', 'endorsement', 2, true]] },
  'student.su@demo.mentorlink.bd': { careerGoalRoleKey: 'junior-developer', goalText: 'Get an entry-level web developer job', weeklyHours: 10,
    languages: ['en'], preferredSlots: ['Fri 16:00'], evidence: [['javascript', 'self', 1, false], ['git', 'quiz', 1, true]] },
};

const DEMO = [
  { label: 'Student 1', email: 'student.edu@demo.mentorlink.bd', password: 'Demo@12345', role: 'student', uni: 'EDU', displayName: 'Robiul Hasan', department: 'CSE', batchYear: 2022 },
  { label: 'Student 2', email: 'student.su@demo.mentorlink.bd', password: 'Demo@12345', role: 'student', uni: 'SU', displayName: 'Nusrat Jahan', department: 'CSE', batchYear: 2022 },
  { label: 'Alumni mentor 1', email: 'mentor1@demo.mentorlink.bd', password: 'Demo@12345', role: 'mentor', uni: 'EDU', displayName: 'Abrar Rahman', department: 'CSE', batchYear: 2018 },
  { label: 'Alumni mentor 2', email: 'mentor2@demo.mentorlink.bd', password: 'Demo@12345', role: 'mentor', uni: 'SU', displayName: 'Farzana Akter', department: 'CSE', batchYear: 2017 },
  { label: 'Department', email: 'dept@demo.mentorlink.bd', password: 'Demo@12345', role: 'department', uni: 'EDU', displayName: 'Dayan Chowdhury', department: 'CSE' },
  { label: 'Admin', email: 'admin@demo.mentorlink.bd', password: 'Admin@12345', role: 'admin', displayName: 'Ayesha Khan' },
];

async function seedDemo() {
  if (!env.DEMO_MODE) throw new Error('DEMO_MODE is not "true". Refusing to create demo accounts.');
  await seedUniversities();
  await seedSkills();
  const auth = getAuth(); // uses the Auth emulator automatically if FIREBASE_AUTH_EMULATOR_HOST is set

  for (const d of DEMO) {
    let rec;
    try {
      rec = await auth.getUserByEmail(d.email);
      await auth.updateUser(rec.uid, { password: d.password, displayName: d.displayName }); // exists -> reset password
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
      rec = await auth.createUser({ email: d.email, password: d.password, displayName: d.displayName, emailVerified: true });
    }
    const uni = d.uni ? await University.findOne({ shortName: d.uni }) : null;
    await User.findOneAndUpdate({ email: d.email }, {
      $set: {
        firebaseUid: rec.uid, displayName: d.displayName, role: d.role, verificationStatus: 'verified',
        department: d.department, batchYear: d.batchYear, showInDirectory: true,
        ...(uni && { universityId: uni._id }),
      },
    }, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
  // Phase 2a data: profiles + evidence + extra seed mentors (idempotent upserts)
  for (const [email, p] of Object.entries(MENTOR_PROFILES)) {
    const u = await User.findOne({ email });
    await MentorProfile.updateOne({ userId: u._id }, { $set: p }, { upsert: true });
  }
  for (const m of EXTRA_MENTORS) {
    const uni = await University.findOne({ shortName: m.uni });
    const u = await User.findOneAndUpdate({ email: m.email }, { $set: { firebaseUid: `seed-${m.email}`, displayName: m.displayName,
      role: 'mentor', verificationStatus: 'verified', universityId: uni._id, department: 'CSE', batchYear: 2018 } }, { upsert: true, new: true });
    await MentorProfile.updateOne({ userId: u._id }, { $set: m.profile }, { upsert: true });
  }
  for (const [email, { evidence, ...profile }] of Object.entries(STUDENT_PROFILES)) {
    const u = await User.findOne({ email });
    await StudentProfile.updateOne({ userId: u._id }, { $set: profile }, { upsert: true });
    for (const [skillKey, type, level, verified] of evidence) {
      await SkillEvidence.updateOne({ studentId: u._id, skillKey, type }, { $set: { level, verified } }, { upsert: true });
    }
  }
  console.log('\nDemo accounts (safe to re-run). Extra seed mentors (Tanvir, Imran, Sadia) exist in MongoDB only and cannot log in.');
  console.table(DEMO.map(({ label, email, password, role, uni }) => ({ label, email, password, role, university: uni || 'n/a' })));
}
module.exports = { seedDemo };

if (require.main === module) {
  connectDb().then(seedDemo).then(() => mongoose.disconnect())
    .catch((e) => { console.error(e.message); process.exit(1); });
}
