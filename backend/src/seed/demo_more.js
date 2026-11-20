// Extra DEMO people so the campus map, directory, matching and fairness check have something to show.
// All names are invented. Every account uses password Demo@12345 and is clearly marked isDemo.
const { User, University, StudentProfile, MentorProfile, SkillEvidence } = require('../models');

const UNI = { EDU: 'East Delta University', SUB: 'Southern University Bangladesh', DU: 'University of Dhaka', BUET: 'Bangladesh University of Engineering and Technology', NSU: 'North South University', BRACU: 'BRAC University', CUET: 'Chittagong University of Engineering and Technology' };
const PW = 'Demo@12345';
const ev = (type, level) => ({ type, level });

// email, name, uni, dept, batch, goal role, weekly hours, evidence {skill: [type, level]}
const STUDENTS = [
  ['student.du@demo.mentorlink.bd', 'Nusrat Jahan', 'DU', 'CSE', 2023, 'data-analyst', 9, { sql: ev('quiz', 2), excel: ev('project', 3), python: ev('self', 1), statistics: ev('self', 1) }],
  ['student.buet@demo.mentorlink.bd', 'Tanvir Ahmed', 'BUET', 'EEE', 2022, 'junior-developer', 8, { git: ev('project', 2), dsa: ev('quiz', 2), backend: ev('self', 1) }],
  ['student.nsu@demo.mentorlink.bd', 'Farhana Akter', 'NSU', 'BBA', 2023, 'banking-trainee', 6, { accounting: ev('quiz', 2), banking: ev('self', 1), communication: ev('quiz', 2) }],
  ['student.bracu@demo.mentorlink.bd', 'Rakib Hasan', 'BRACU', 'CSE', 2024, 'qa-engineer', 7, { testing: ev('quiz', 1), git: ev('self', 1), communication: ev('self', 2) }],
  ['student.cuet@demo.mentorlink.bd', 'Sadia Islam', 'CUET', 'CSE', 2022, 'junior-developer', 10, { dsa: ev('project', 3), git: ev('project', 2), backend: ev('quiz', 2), sql: ev('self', 1) }],
  ['student2.edu@demo.mentorlink.bd', 'Mahmudul Karim', 'EDU', 'BBA', 2023, 'management-trainee', 5, { communication: ev('quiz', 2), leadership: ev('self', 1), excel: ev('quiz', 2) }],
  ['student2.su@demo.mentorlink.bd', 'Anika Tabassum', 'SUB', 'English', 2022, 'higher-study', 8, { ielts: ev('self', 2), research: ev('self', 1), communication: ev('quiz', 2) }],
  ['student2.du@demo.mentorlink.bd', 'Imran Hossain', 'DU', 'Statistics', 2023, 'data-analyst', 6, { statistics: ev('project', 3), python: ev('quiz', 2), sql: ev('self', 1) }],
  ['student2.nsu@demo.mentorlink.bd', 'Jannatul Ferdous', 'NSU', 'CSE', 2024, 'data-analyst', 7, { excel: ev('quiz', 2), sql: ev('self', 1), dashboard: ev('self', 1) }],
  ['student2.bracu@demo.mentorlink.bd', 'Shakib Rahman', 'BRACU', 'BBA', 2023, 'banking-trainee', 5, { accounting: ev('self', 1), excel: ev('quiz', 2), communication: ev('self', 2) }],
];

// email, name, uni, dept, batch, roleKey, related roles, title, industry, years, expertise, languages, slots, accepted, completed, rising
const MENTORS = [
  ['mentor.nsu@demo.mentorlink.bd', 'Rahim Ahmed', 'NSU', 'CSE', 2015, 'data-analyst', ['junior-developer'], 'Data Analyst', 'Fintech', 8, { sql: 3, excel: 3, dashboard: 3, statistics: 2 }, ['bn', 'en'], ['sun-20', 'tue-21'], 12, 11, false],
  ['mentor.du@demo.mentorlink.bd', 'Samira Chowdhury', 'DU', 'Finance', 2013, 'banking-trainee', ['management-trainee'], 'Senior Officer, Retail Banking', 'Banking', 9, { banking: 3, accounting: 3, communication: 3 }, ['bn', 'en'], ['mon-19', 'thu-20'], 15, 14, false],
  ['mentor.buet@demo.mentorlink.bd', 'Kamal Uddin', 'BUET', 'CSE', 2014, 'junior-developer', ['qa-engineer'], 'Software Engineer', 'Software', 9, { dsa: 3, backend: 3, git: 3, sql: 2 }, ['bn', 'en'], ['fri-21', 'sat-20'], 10, 9, false],
  ['mentor.bracu@demo.mentorlink.bd', 'Tasnim Rahman', 'BRACU', 'CSE', 2017, 'qa-engineer', ['junior-developer'], 'QA Lead', 'Software', 6, { testing: 3, git: 2, communication: 3 }, ['bn', 'en'], ['sun-21', 'wed-20'], 6, 5, false],
  ['mentor.cuet@demo.mentorlink.bd', 'Farid Hossain', 'CUET', 'CSE', 2016, 'junior-developer', ['data-analyst'], 'Backend Engineer', 'E-commerce', 7, { backend: 3, sql: 3, dsa: 2, git: 3 }, ['bn'], ['tue-20', 'thu-21'], 8, 7, false],
  ['mentor.edu@demo.mentorlink.bd', 'Lutfun Nahar', 'EDU', 'BBA', 2018, 'management-trainee', ['banking-trainee'], 'HR Manager', 'Consumer goods', 5, { communication: 3, leadership: 3 }, ['bn', 'en'], ['mon-20'], 3, 2, true],
  ['mentor.su@demo.mentorlink.bd', 'Zahid Hasan', 'SUB', 'CSE', 2019, 'data-analyst', ['junior-developer'], 'Data Scientist', 'Telecom', 4, { python: 3, statistics: 3, sql: 3 }, ['en'], ['wed-21', 'fri-20'], 2, 1, true],
  ['mentor2.du@demo.mentorlink.bd', 'Mehnaz Sultana', 'DU', 'Economics', 2015, 'higher-study', [], 'Research Associate', 'Research', 8, { research: 3, ielts: 3, statistics: 2, communication: 2 }, ['bn', 'en'], ['sat-19', 'sun-19'], 6, 6, false],
];

async function ensure(auth, email, name) {
  try { const u = await auth.getUserByEmail(email); await auth.updateUser(u.uid, { password: PW, displayName: name, emailVerified: true }); return u.uid; }
  catch (e) { if (e.code !== 'auth/user-not-found') throw e; return (await auth.createUser({ email, password: PW, displayName: name, emailVerified: true })).uid; }
}
async function upsertUser(auth, email, name, role, uniKey, dept, batch) {
  const uid = await ensure(auth, email, name);
  const uni = await University.findOne({ name: UNI[uniKey] });
  if (!uni) throw new Error(`University missing for demo data: ${UNI[uniKey]}`);
  return User.findOneAndUpdate({ firebaseUid: uid }, { $set: { firebaseUid: uid, email, displayName: name, role, universityId: uni._id, department: dept, batchYear: batch, verificationStatus: 'verified', showInDirectory: true, isDemo: true, language: 'en' } }, { upsert: true, returnDocument: 'after' });
}

async function seedMoreDemo({ auth }) {
  for (const [email, name, uni, dept, batch, goal, hours, evidence] of STUDENTS) {
    const u = await upsertUser(auth, email, name, 'student', uni, dept, batch);
    await StudentProfile.updateOne({ userId: u._id }, { $set: { careerGoalRoleKey: goal, goalText: `I want to become a ${goal.replace(/-/g, ' ')}`, weeklyHours: hours, languages: ['bn', 'en'], requestedSlots: ['sun-20', 'tue-21'] } }, { upsert: true });
    await SkillEvidence.deleteMany({ studentId: u._id });
    await SkillEvidence.insertMany(Object.entries(evidence).map(([skillKey, e]) => ({ studentId: u._id, skillKey, type: e.type, level: e.level })));
  }
  for (const [email, name, uni, dept, batch, roleKey, related, title, industry, years, expertise, languages, slots, accepted, completed, rising] of MENTORS) {
    const u = await upsertUser(auth, email, name, 'mentor', uni, dept, batch);
    await MentorProfile.updateOne({ userId: u._id }, { $set: { roleKey, relatedRoleKeys: related, roleTitle: title, industry, yearsExperience: years, expertiseSkills: Object.entries(expertise).map(([skillKey, level]) => ({ skillKey, level })), languages, weeklyCapacity: Math.max(4, accepted + 3), availableSlots: slots, acceptedRequests: accepted, sessionsCompleted: completed, isRising: rising, paused: false } }, { upsert: true });
  }
  return { students: STUDENTS.length, mentors: MENTORS.length };
}
module.exports = { seedMoreDemo, STUDENTS, MENTORS, upsertUser, UNI };
