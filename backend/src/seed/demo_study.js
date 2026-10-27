// 13 more DEMO mentors (all names invented, password Demo@12345, isDemo) so a mentor-matching test has real variety:
// several mentors per career goal, different industries and universities, and two "keyword decoys" whose job title
// matches a goal ("Data Entry Analyst") but whose skills do not. A plain keyword search likes decoys; a gap-aware ranking should not.
// With the 10 mentors from seed:demo this gives 23 verified mentors. These are for TESTING the study pipeline only:
// the real pilot must use real volunteer students and real mentors, never demo accounts.
const { MentorProfile } = require('../models');
const { upsertUser } = require('./demo_more');

// email, name, uni, dept, batch, roleKey, related roles, title, industry, years, expertise, languages, slots, accepted, completed, rising
const STUDY_MENTORS = [
  ['mentor.s01@demo.mentorlink.bd', 'Nabila Karim', 'NSU', 'CSE', 2018, 'data-analyst', ['management-trainee'], 'Business Analyst', 'E-commerce', 6, { sql: 3, excel: 3, dashboard: 2, communication: 3 }, ['bn', 'en'], ['sun-20', 'mon-19'], 2, 2, false],
  ['mentor.s02@demo.mentorlink.bd', 'Ariful Islam', 'BUET', 'CSE', 2016, 'data-analyst', ['junior-developer'], 'BI Developer', 'Telecom', 7, { sql: 3, dashboard: 3, python: 2, statistics: 2 }, ['en'], ['tue-21', 'thu-20'], 3, 3, false],
  ['mentor.s03@demo.mentorlink.bd', 'Shirin Akter', 'BRACU', 'BBA', 2019, 'data-analyst', ['management-trainee'], 'Marketing Analyst', 'Retail', 4, { excel: 3, dashboard: 2, statistics: 2, communication: 2 }, ['bn', 'en'], ['sun-20', 'tue-21'], 1, 1, true],
  ['mentor.s04@demo.mentorlink.bd', 'Rubel Mia', 'EDU', 'BBA', 2022, 'management-trainee', [], 'Data Entry Analyst', 'Retail', 1, { excel: 1, communication: 1 }, ['bn'], ['sat-10'], 0, 0, false], // keyword decoy
  ['mentor.s05@demo.mentorlink.bd', 'Mehedi Hasan', 'CUET', 'CSE', 2018, 'junior-developer', ['qa-engineer'], 'Full-Stack Developer', 'Startup', 5, { backend: 3, git: 3, dsa: 2, sql: 2 }, ['bn', 'en'], ['tue-21', 'fri-20'], 2, 2, false],
  ['mentor.s06@demo.mentorlink.bd', 'Tahmina Rahman', 'DU', 'CSE', 2019, 'junior-developer', ['data-analyst'], 'Mobile App Developer', 'Fintech', 4, { backend: 2, git: 3, dsa: 2, communication: 2 }, ['en'], ['sun-20', 'wed-20'], 1, 1, true],
  ['mentor.s07@demo.mentorlink.bd', 'Sajid Chowdhury', 'BUET', 'EEE', 2015, 'junior-developer', ['qa-engineer'], 'DevOps Engineer', 'Cloud', 8, { git: 3, backend: 3, testing: 2, sql: 2 }, ['en'], ['mon-20'], 4, 4, false],
  ['mentor.s08@demo.mentorlink.bd', 'Nusrat Sultana', 'BRACU', 'CSE', 2017, 'qa-engineer', ['junior-developer'], 'SDET', 'Software', 5, { testing: 3, git: 3, backend: 2, communication: 2 }, ['bn', 'en'], ['sun-21', 'wed-20'], 2, 2, false],
  ['mentor.s09@demo.mentorlink.bd', 'Imtiaz Ahmed', 'NSU', 'Finance', 2016, 'banking-trainee', ['data-analyst'], 'Credit Analyst', 'Banking', 6, { banking: 3, accounting: 3, excel: 3, communication: 2 }, ['bn', 'en'], ['mon-19', 'thu-20'], 3, 3, false],
  ['mentor.s10@demo.mentorlink.bd', 'Rumana Haque', 'DU', 'Finance', 2014, 'banking-trainee', ['management-trainee'], 'Relationship Manager', 'Banking', 8, { banking: 3, communication: 3, accounting: 2 }, ['bn', 'en'], ['sun-20', 'tue-21'], 5, 5, false],
  ['mentor.s11@demo.mentorlink.bd', 'Fahim Reza', 'EDU', 'BBA', 2013, 'management-trainee', ['banking-trainee'], 'Operations Manager', 'Logistics', 9, { leadership: 3, communication: 3, excel: 2 }, ['bn', 'en'], ['tue-21'], 4, 4, false],
  ['mentor.s12@demo.mentorlink.bd', 'Mitu Barua', 'SUB', 'BBA', 2018, 'management-trainee', ['banking-trainee'], 'Business Development Lead', 'FMCG', 5, { communication: 3, leadership: 2, excel: 2 }, ['bn', 'en'], ['sun-20', 'thu-21'], 2, 2, false],
  ['mentor.s13@demo.mentorlink.bd', 'Parvez Alam', 'DU', 'Statistics', 2017, 'higher-study', ['data-analyst'], 'PhD Candidate', 'Academia', 5, { research: 3, ielts: 3, statistics: 3, communication: 2 }, ['en'], ['sat-19', 'sun-19'], 1, 1, false],
];

async function seedStudyMentors({ auth }) {
  for (const [email, name, uni, dept, batch, roleKey, related, title, industry, years, expertise, languages, slots, accepted, completed, rising] of STUDY_MENTORS) {
    const u = await upsertUser(auth, email, name, 'mentor', uni, dept, batch);
    await MentorProfile.updateOne({ userId: u._id }, { $set: { roleKey, relatedRoleKeys: related, roleTitle: title, industry, yearsExperience: years, expertiseSkills: Object.entries(expertise).map(([skillKey, level]) => ({ skillKey, level })), languages, weeklyCapacity: accepted + 4, availableSlots: slots, acceptedRequests: accepted, sessionsCompleted: completed, isRising: rising, paused: false } }, { upsert: true });
  }
  return STUDY_MENTORS.length;
}
module.exports = { seedStudyMentors, STUDY_MENTORS };
