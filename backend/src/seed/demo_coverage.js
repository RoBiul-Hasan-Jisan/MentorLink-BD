// DEMO mentors so EVERY career goal has mentors for EVERY skill it asks for.
// Before this file, no demo mentor listed machinelearning, mathematics, htmlcss, javascript, uiux, appdev, programming,
// graphicdesign, digitalmarketing, cybersecurity, networking or clouddevops, so "Find a mentor for Machine Learning" was always empty.
// Each of those skills now has at least 2 mentors at level 2 or 3. All names are invented, password Demo@12345, isDemo.
// Safe to run again: accounts and profiles are upserted by email.
const { MentorProfile } = require('../models');
const { upsertUser } = require('./demo_more');

const HELP_TECH = ['technical_interview', 'portfolio_review', 'roadmap_review', 'cv_review'];
const HELP_GEN = ['roadmap_review', 'cv_review', 'career_switch'];

// email, name, uni, dept, batch, roleKey, related roles, title, industry, years, expertise, languages, slots, accepted, completed, rising, helpsWith
const COVERAGE_MENTORS = [
  // Data science / machine learning / maths
  ['mentor.c01@demo.mentorlink.bd', 'Tanzila Haque', 'BUET', 'CSE', 2017, 'data-scientist', ['data-analyst'], 'Machine Learning Engineer', 'AI / Telecom', 6, { machinelearning: 3, python: 3, statistics: 3, mathematics: 2, sql: 2 }, ['bn', 'en'], ['sun-20', 'wed-21'], 2, 2, false, HELP_TECH],
  ['mentor.c02@demo.mentorlink.bd', 'Dr. Mushfiq Rahman', 'DU', 'Statistics', 2012, 'data-scientist', ['research-assistant', 'higher-study'], 'Senior Data Scientist', 'Fintech', 10, { machinelearning: 3, statistics: 3, mathematics: 3, python: 2 }, ['en'], ['tue-21', 'sat-19'], 3, 3, false, HELP_TECH],
  ['mentor.c03@demo.mentorlink.bd', 'Aminul Karim', 'NSU', 'Math', 2019, 'data-scientist', ['data-analyst'], 'Applied Scientist', 'E-commerce', 4, { machinelearning: 2, mathematics: 3, statistics: 2, python: 3 }, ['bn', 'en'], ['mon-20', 'thu-21'], 1, 1, true, HELP_TECH],
  // Web / frontend / design
  ['mentor.c04@demo.mentorlink.bd', 'Sumaiya Akhter', 'BRACU', 'CSE', 2018, 'frontend-developer', ['ui-ux-designer'], 'Frontend Engineer', 'SaaS', 5, { htmlcss: 3, javascript: 3, uiux: 2, git: 2 }, ['bn', 'en'], ['sun-21', 'tue-20'], 2, 2, false, HELP_TECH],
  ['mentor.c05@demo.mentorlink.bd', 'Rafiq Uddin', 'CUET', 'CSE', 2016, 'frontend-developer', ['junior-developer'], 'Senior Web Developer', 'Agency', 7, { javascript: 3, htmlcss: 3, git: 3, programming: 2 }, ['bn'], ['wed-20', 'fri-21'], 3, 3, false, HELP_TECH],
  ['mentor.c06@demo.mentorlink.bd', 'Nahida Parvin', 'DU', 'Design', 2017, 'ui-ux-designer', ['frontend-developer'], 'Product Designer', 'Fintech', 6, { uiux: 3, graphicdesign: 3, htmlcss: 2, communication: 3 }, ['bn', 'en'], ['mon-19', 'thu-20'], 2, 2, false, ['portfolio_review', 'roadmap_review', 'cv_review']],
  ['mentor.c07@demo.mentorlink.bd', 'Shuvo Dey', 'EDU', 'CSE', 2020, 'ui-ux-designer', ['digital-marketing-executive'], 'UI Designer', 'Startup', 3, { uiux: 2, graphicdesign: 3, communication: 2 }, ['bn', 'en'], ['sat-18', 'sun-20'], 1, 1, true, ['portfolio_review', 'roadmap_review']],
  // Mobile / programming
  ['mentor.c08@demo.mentorlink.bd', 'Mahfuz Alam', 'SUB', 'CSE', 2017, 'mobile-app-developer', ['junior-developer'], 'Flutter Developer', 'Fintech', 5, { appdev: 3, programming: 3, git: 2, backend: 2 }, ['bn', 'en'], ['tue-21', 'fri-20'], 2, 2, false, HELP_TECH],
  ['mentor.c09@demo.mentorlink.bd', 'Lamia Siddika', 'BUET', 'CSE', 2018, 'mobile-app-developer', ['junior-developer'], 'Android Engineer', 'Software', 5, { appdev: 3, programming: 3, dsa: 2 }, ['en'], ['sun-20', 'wed-21'], 1, 1, false, HELP_TECH],
  // Marketing
  ['mentor.c10@demo.mentorlink.bd', 'Tamanna Rahim', 'BRACU', 'BBA', 2018, 'digital-marketing-executive', ['management-trainee'], 'Digital Marketing Manager', 'E-commerce', 6, { digitalmarketing: 3, communication: 3, excel: 2 }, ['bn', 'en'], ['mon-20', 'thu-21'], 2, 2, false, HELP_GEN],
  ['mentor.c11@demo.mentorlink.bd', 'Arif Chowdhury', 'NSU', 'BBA', 2019, 'digital-marketing-executive', [], 'Performance Marketer', 'Agency', 4, { digitalmarketing: 3, communication: 2, graphicdesign: 2 }, ['bn', 'en'], ['sun-21', 'tue-20'], 1, 1, true, HELP_GEN],
  // Security / networking / cloud
  ['mentor.c12@demo.mentorlink.bd', 'Kabir Hossain', 'BUET', 'EEE', 2015, 'cybersecurity-analyst', ['devops-engineer'], 'Security Analyst', 'Banking', 8, { cybersecurity: 3, networking: 3, programming: 2 }, ['bn', 'en'], ['tue-21', 'sat-19'], 3, 3, false, HELP_TECH],
  ['mentor.c13@demo.mentorlink.bd', 'Sadiya Noor', 'DU', 'CSE', 2018, 'cybersecurity-analyst', [], 'SOC Analyst', 'Telecom', 5, { cybersecurity: 3, networking: 2, programming: 2 }, ['en'], ['mon-19', 'wed-20'], 1, 1, false, HELP_TECH],
  ['mentor.c14@demo.mentorlink.bd', 'Jahid Hasan', 'CUET', 'CSE', 2016, 'devops-engineer', ['backend-developer'], 'Cloud Engineer', 'Cloud', 7, { clouddevops: 3, networking: 3, git: 3, backend: 2 }, ['bn', 'en'], ['thu-21', 'fri-20'], 3, 3, false, HELP_TECH],
  ['mentor.c15@demo.mentorlink.bd', 'Ishrat Jahan', 'NSU', 'CSE', 2019, 'devops-engineer', ['backend-developer'], 'DevOps Engineer', 'SaaS', 4, { clouddevops: 2, networking: 2, git: 3, testing: 2 }, ['en'], ['sun-20', 'tue-21'], 1, 1, true, HELP_TECH],
];

async function seedCoverageMentors({ auth }) {
  for (const [email, name, uni, dept, batch, roleKey, related, title, industry, years, expertise, languages, slots, accepted, completed, rising, helpsWith] of COVERAGE_MENTORS) {
    const u = await upsertUser(auth, email, name, 'mentor', uni, dept, batch);
    await MentorProfile.updateOne({ userId: u._id }, { $set: { roleKey, relatedRoleKeys: related, roleTitle: title, industry, yearsExperience: years, expertiseSkills: Object.entries(expertise).map(([skillKey, level]) => ({ skillKey, level })), languages, weeklyCapacity: accepted + 4, availableSlots: slots, acceptedRequests: accepted, sessionsCompleted: completed, isRising: rising, helpsWith, paused: false } }, { upsert: true });
  }
  return COVERAGE_MENTORS.length;
}
module.exports = { seedCoverageMentors, COVERAGE_MENTORS };
