const mongoose = require('mongoose');
const env = require('../src/config/env');
const { connectDb } = require('../src/config/db');
const { getAuth } = require('../src/config/firebase');
const University = require('../src/models/University');
const User = require('../src/models/User');
const { seedUniversities } = require('./seedUniversities');
const { seedSkills } = require('./seedSkills');
const audit = require('../src/utils/audit');
const StudentProfile = require('../src/models/StudentProfile');
const MentorProfile = require('../src/models/MentorProfile');
const SkillEvidence = require('../src/models/SkillEvidence');
const MentorRequest = require('../src/models/MentorRequest');
const Session = require('../src/models/Session');
const SessionNote = require('../src/models/SessionNote');
const Plan = require('../src/models/Plan');
const Task = require('../src/models/Task');
const { weekStart } = require('../src/services/capacity');
const CvVersion = require('../src/models/CvVersion');
const Opportunity = require('../src/models/Opportunity');
const Application = require('../src/models/Application');
const Report = require('../src/models/Report');
const RoleRequest = require('../src/models/RoleRequest');
const AuditLog = require('../src/models/AuditLog');

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
    await MentorProfile.updateOne({ userId: u._id }, { $set: { ...p, capacityWeekStart: weekStart(), ratingCount: p.sessionsCompleted } }, { upsert: true });
  }
  for (const m of EXTRA_MENTORS) {
    const uni = await University.findOne({ shortName: m.uni });
    const u = await User.findOneAndUpdate({ email: m.email }, { $set: { firebaseUid: `seed-${m.email}`, displayName: m.displayName,
      role: 'mentor', verificationStatus: 'verified', universityId: uni._id, department: 'CSE', batchYear: 2018 } }, { upsert: true, new: true });
    await MentorProfile.updateOne({ userId: u._id }, { $set: { ...m.profile, capacityWeekStart: weekStart(), ratingCount: m.profile.sessionsCompleted } }, { upsert: true });
  }
  for (const [email, { evidence, ...profile }] of Object.entries(STUDENT_PROFILES)) {
    const u = await User.findOne({ email });
    await StudentProfile.updateOne({ userId: u._id }, { $set: profile }, { upsert: true });
    for (const [skillKey, type, level, verified] of evidence) {
      await SkillEvidence.updateOne({ studentId: u._id, skillKey, type }, { $set: { level, verified } }, { upsert: true });
    }
  }

  // ---- Phase 3 demo data: requests, a session + notes, an active plan (all idempotent) ----
  const DAY = 86400000, now = Date.now();
  const [robiul, abrar, farzana] = await Promise.all(['student.edu', 'mentor1', 'mentor2'].map((x) => User.findOne({ email: `${x}@demo.mentorlink.bd` })));
  const sabbir = await User.findOneAndUpdate({ email: 'seed.sabbir@demo.mentorlink.bd' }, { $set: { firebaseUid: 'seed-sabbir', displayName: 'Sabbir Khan',
    role: 'student', verificationStatus: 'verified', universityId: robiul.universityId, department: 'EEE', batchYear: 2022 } }, { upsert: true, new: true });
  const snap = { readinessPercent: 56, roleTitleEn: 'Data Analyst', roleTitleBn: 'ডেটা অ্যানালিস্ট', matchScore: 88,
    gaps: [{ skillKey: 'sql', nameEn: 'SQL', nameBn: 'SQL' }, { skillKey: 'powerbi', nameEn: 'Power BI', nameBn: 'Power BI' }] };
  const reqBody = { goalText: 'Become job-ready as a Junior Data Analyst in 5 weeks', format: 'video', preferredSlots: ['Sun 20:30', 'Tue 21:00'],
    questions: ['Which SQL topics matter most for entry-level interviews?', 'Can you review my first Power BI dashboard?'], snapshot: snap };
  const accepted = await MentorRequest.findOneAndUpdate({ studentId: robiul._id, mentorId: abrar._id, status: 'accepted' }, { $setOnInsert: { ...reqBody, respondedAt: new Date(now - 8 * DAY) } }, { upsert: true, new: true });
  await MentorRequest.updateOne({ studentId: robiul._id, mentorId: farzana._id, status: 'pending' }, { $setOnInsert: reqBody }, { upsert: true });
  await MentorRequest.updateOne({ studentId: sabbir._id, mentorId: abrar._id, status: 'pending' }, { $setOnInsert: { ...reqBody, snapshot: { ...snap, readinessPercent: 41, matchScore: 71 } } }, { upsert: true });

  const base = { requestId: accepted._id, studentId: robiul._id, mentorId: abrar._id, format: 'video', durationMin: 30 };
  const intro = await Session.findOneAndUpdate({ requestId: accepted._id, topic: 'Intro session' }, { $setOnInsert: { ...base, scheduledAt: new Date(now - 7 * DAY), status: 'completed', completedAt: new Date(now - 7 * DAY), rating: 4 } }, { upsert: true, new: true });
  await Session.findOneAndUpdate({ requestId: accepted._id, topic: 'SQL joins and first dashboard review' }, { $setOnInsert: { ...base, scheduledAt: new Date(now + DAY), meetingLink: 'meet.example.org/abrar-robiul' } }, { upsert: true });
  await SessionNote.updateOne({ sessionId: intro._id }, { $setOnInsert: { mentorId: abrar._id, studentId: robiul._id, tags: ['SQL', 'Power BI', 'Portfolio'],
    summary: 'Focus on SQL joins and GROUP BY first. Build one Power BI dashboard from a public dataset and keep the link in your portfolio.',
    mentorComment: 'Great questions. Send me your dashboard link before Friday and I will leave inline comments.',
    nextSteps: [{ title: 'Finish SQL joins module and 20 practice queries', weekNumber: 1 }, { title: 'Build a Power BI dashboard from a public dataset', weekNumber: 2 }, { title: 'Share dashboard link for mentor review', weekNumber: 2 }] } }, { upsert: true });

  const plan = await Plan.findOneAndUpdate({ studentId: robiul._id, status: 'active' }, { $setOnInsert: { roleKey: 'data-analyst', startDate: new Date(now - 8 * DAY) } }, { upsert: true, new: true });
  for (const [title, weekNumber, status] of [['Finish SQL joins module', 1, 'done'], ['Build a Power BI dashboard', 2, 'todo'], ['Share project link with mentor', 2, 'todo'], ['Solve 10 GROUP BY problems', 2, 'todo']]) {
    await Task.updateOne({ studentId: robiul._id, title }, { $setOnInsert: { planId: plan._id, weekNumber, status, ...(status === 'done' && { doneAt: new Date() }) } }, { upsert: true });
  }

  // ---- Phase 4a demo data: CV versions, opportunities (one verified, one flagged), applications, reports, a pending alumni request ----
  const imran = await User.findOne({ email: 'seed.imran@demo.mentorlink.bd' });
  const mkStudent = (key, name, dept) => User.findOneAndUpdate({ email: `seed.${key}@demo.mentorlink.bd` }, { $set: { firebaseUid: `seed-${key}`, displayName: name, role: 'student',
    verificationStatus: 'verified', universityId: robiul.universityId, department: dept, batchYear: 2022 } }, { upsert: true, new: true });
  const anika = await mkStudent('anika', 'Anika Rahman', 'CSE');
  const nabila = await User.findOneAndUpdate({ email: 'seed.nabila@demo.mentorlink.bd' }, { $set: { firebaseUid: 'seed-nabila', displayName: 'Nabila Sultana', role: 'student',
    verificationStatus: 'pending', universityId: robiul.universityId, department: 'CSE', batchYear: 2018 } }, { upsert: true, new: true });
  await RoleRequest.updateOne({ userId: nabila._id, status: 'pending' }, { $setOnInsert: { requestedRole: 'mentor', note: 'BI Developer, graduation proof attached' } }, { upsert: true });

  const cvs = [[1, 'Aspiring analyst'], [2, 'Data Analyst (SQL, Excel)'], [3, 'Data Analyst']];
  for (const [version, headline] of cvs) {
    await CvVersion.updateOne({ studentId: robiul._id, version }, { $setOnInsert: { headline, summary: 'CSE student building data analysis skills.', language: 'en',
      education: [{ institution: 'East Delta University', degree: 'BSc in CSE', year: 2026 }], projects: [{ title: 'Sales dashboard', description: 'Excel dashboard of monthly sales', url: 'https://example.com/sales-dashboard' }] } }, { upsert: true });
  }
  const cv3 = await CvVersion.findOne({ studentId: robiul._id, version: 3 });
  const close = new Date(now + 14 * DAY);
  const mkOpp = (poster, role, title, organization, extra) => Opportunity.findOneAndUpdate({ postedBy: poster._id, title }, { $setOnInsert: { posterRole: role, organization, applicationDeadline: close, noFeeConfirmed: true, ...extra } }, { upsert: true, new: true });
  const jda = await mkOpp(abrar, 'mentor', 'Junior Data Analyst', 'Software company', { employmentType: 'full_time', type: 'job', city: 'Dhaka', workplaceMode: 'onsite', status: 'approved',
    description: 'Support the analytics team with weekly reports and dashboards. Training provided. Bangla and English communication required.',
    requiredSkills: [{ skillKey: 'sql', weight: 5, requiredLevel: 3 }, { skillKey: 'powerbi', weight: 4, requiredLevel: 2 }, { skillKey: 'excel', weight: 3, requiredLevel: 2 }, { skillKey: 'statistics', weight: 3, requiredLevel: 2 }] });
  const qa = await mkOpp(farzana, 'mentor', 'QA Engineer Intern', 'Fintech startup', { employmentType: 'internship', type: 'internship', city: 'Dhaka', workplaceMode: 'remote', status: 'approved',
    description: 'Write and run test cases for a payments app. Mentoring provided.',
    requiredSkills: [{ skillKey: 'testing', weight: 5, requiredLevel: 2 }, { skillKey: 'sql', weight: 3, requiredLevel: 2 }, { skillKey: 'communication', weight: 3, requiredLevel: 2 }] });
  const scam = await mkOpp(imran, 'mentor', 'Data Entry Job, Earn Daily', '', { employmentType: 'part_time', type: 'job', status: 'hidden', flags: ['registration fee', 'no company name', 'earn daily'], reportCount: 3,
    description: 'Earn daily from home. Pay a registration fee to start.', requiredSkills: [{ skillKey: 'excel', weight: 1, requiredLevel: 1 }] });
  for (const reporter of [robiul, sabbir, anika]) {
    await Report.updateOne({ reporterId: reporter._id, targetType: 'opportunity', targetId: scam._id }, { $setOnInsert: { reason: 'fee_requested' } }, { upsert: true });
  }
  if (!(await AuditLog.exists({ action: 'opportunity.auto_hide', targetId: String(scam._id) }))) await audit(null, 'opportunity.auto_hide', 'Opportunity', scam._id, { openReports: 3, threshold: 3 });

  const apply = (opp, stage, history, message, fields) => Application.updateOne({ studentId: robiul._id, opportunityId: opp._id }, { $setOnInsert: { cvVersionId: cv3._id, stage, statusMessage: message,
    consentSnapshot: { fields, cvVersionId: cv3._id, consentedAt: new Date(now - 3 * DAY), version: 'v1' }, stageHistory: history.map((h) => ({ stage: h, by: abrar._id })) } }, { upsert: true });
  await apply(jda, 'Shortlisted', ['Applied', 'Shortlisted'], 'You are on the shortlist. Interview invite expected soon.', ['displayName', 'university', 'cv', 'fit']);
  await apply(qa, 'Applied', ['Applied'], 'Reviewing applications until 20 Oct.', ['displayName', 'university', 'cv']);
  console.log('\nDemo accounts (safe to re-run). Extra seed mentors (Tanvir, Imran, Sadia) exist in MongoDB only and cannot log in.');
  console.table(DEMO.map(({ label, email, password, role, uni }) => ({ label, email, password, role, university: uni || 'n/a' })));
}
module.exports = { seedDemo };

if (require.main === module) {
  connectDb().then(seedDemo).then(() => mongoose.disconnect())
    .catch((e) => { console.error(e.message); process.exit(1); });
}
