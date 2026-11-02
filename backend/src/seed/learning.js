const { Skill, RoleTemplate, Resource, Quiz, Roadmap } = require('../models');
const S = [
  ['sql', 'SQL', 'এসকিউএল', 25], ['excel', 'Excel', 'এক্সেল', 15], ['python', 'Python', 'পাইথন', 30],
  ['statistics', 'Statistics', 'পরিসংখ্যান', 25], ['dashboard', 'Dashboards', 'ড্যাশবোর্ড', 15], ['communication', 'Communication', 'যোগাযোগ', 12],
  ['git', 'Git', 'গিট', 8], ['dsa', 'Data Structures', 'ডেটা স্ট্রাকচার', 35], ['backend', 'Backend APIs', 'ব্যাকএন্ড এপিআই', 30],
  ['testing', 'Software Testing', 'সফটওয়্যার টেস্টিং', 20], ['accounting', 'Accounting Basics', 'হিসাবরক্ষণ', 20],
  ['banking', 'Banking Knowledge', 'ব্যাংকিং জ্ঞান', 20], ['leadership', 'Leadership', 'নেতৃত্ব', 15], ['ielts', 'IELTS / English', 'আইইএলটিএস', 40], ['research', 'Research Writing', 'গবেষণা লেখা', 25],
];
const R = (key, titleEn, titleBn, rs) => ({ key, titleEn, titleBn, requiredSkills: rs.map(([skillKey, weight, requiredLevel]) => ({ skillKey, weight, requiredLevel })) });
const ROLES = [
  R('junior-developer', 'Junior Developer', 'জুনিয়র ডেভেলপার', [['git', 1, 2], ['dsa', 3, 2], ['backend', 3, 2], ['sql', 2, 2], ['communication', 1, 2]]),
  R('data-analyst', 'Data Analyst', 'ডেটা অ্যানালিস্ট', [['sql', 3, 3], ['excel', 2, 3], ['python', 2, 2], ['statistics', 2, 2], ['dashboard', 2, 2], ['communication', 1, 2]]),
  R('qa-engineer', 'QA Engineer', 'কিউএ ইঞ্জিনিয়ার', [['testing', 3, 3], ['git', 1, 2], ['sql', 1, 2], ['communication', 2, 2]]),
  R('banking-trainee', 'Banking Trainee Officer', 'ব্যাংকিং ট্রেইনি অফিসার', [['banking', 3, 2], ['accounting', 3, 2], ['excel', 2, 2], ['communication', 2, 3]]),
  R('management-trainee', 'Management Trainee', 'ম্যানেজমেন্ট ট্রেইনি', [['communication', 3, 3], ['leadership', 3, 2], ['excel', 2, 2]]),
  R('higher-study', 'Higher-Study Applicant', 'উচ্চশিক্ষা আবেদনকারী', [['ielts', 3, 3], ['research', 3, 2], ['statistics', 1, 2], ['communication', 2, 2]]),
  // More goals. They only use skills that already have a roadmap, resources and a quiz.
  R('backend-developer', 'Backend Developer', 'ব্যাকএন্ড ডেভেলপার', [['backend', 3, 3], ['sql', 2, 2], ['git', 2, 2], ['dsa', 2, 2], ['testing', 1, 2]]),
  R('data-scientist', 'Data Scientist (Trainee)', 'ডেটা সায়েন্টিস্ট (ট্রেইনি)', [['python', 3, 3], ['statistics', 3, 3], ['sql', 2, 2], ['dashboard', 1, 2], ['git', 1, 2]]),
  R('business-analyst', 'Business Analyst', 'বিজনেস অ্যানালিস্ট', [['excel', 3, 3], ['sql', 2, 2], ['communication', 3, 3], ['dashboard', 2, 2], ['statistics', 1, 2]]),
  R('data-engineer', 'Junior Data Engineer', 'জুনিয়র ডেটা ইঞ্জিনিয়ার', [['python', 3, 3], ['sql', 3, 3], ['git', 2, 2], ['backend', 1, 2]]),
  R('accounts-executive', 'Accounts / Finance Executive', 'অ্যাকাউন্টস / ফাইন্যান্স এক্সিকিউটিভ', [['accounting', 3, 3], ['excel', 3, 3], ['communication', 2, 2], ['banking', 1, 2]]),
  R('operations-executive', 'Operations / Project Coordinator', 'অপারেশনস / প্রজেক্ট কোঅর্ডিনেটর', [['leadership', 3, 2], ['communication', 3, 3], ['excel', 2, 2]]),
  R('hr-executive', 'HR Executive', 'এইচআর এক্সিকিউটিভ', [['communication', 3, 3], ['leadership', 2, 2], ['excel', 2, 2]]),
  R('sales-marketing', 'Sales and Marketing Executive', 'সেলস ও মার্কেটিং এক্সিকিউটিভ', [['communication', 3, 3], ['excel', 2, 2], ['leadership', 1, 2], ['statistics', 1, 1]]),
  R('research-assistant', 'Research Assistant', 'রিসার্চ অ্যাসিস্ট্যান্ট', [['research', 3, 3], ['statistics', 2, 2], ['python', 1, 2], ['communication', 2, 2], ['ielts', 1, 2]]),
  R('bank-it-officer', 'Bank IT / Digital Banking Officer', 'ব্যাংক আইটি / ডিজিটাল ব্যাংকিং অফিসার', [['banking', 2, 2], ['sql', 2, 2], ['excel', 2, 2], ['communication', 2, 2], ['testing', 1, 2]]),
];
// Real, free, public learning pages. Every URL is UNCHECKED: a teammate must open each one before demo day (see README).
// Bangla entries are provider home pages only (no deep links invented); admins can add exact course links from the admin panel.
const RESOURCES = [
  ['sql', 'Relational Database course (freeCodeCamp)', 'https://www.freecodecamp.org/learn/relational-database/', 'course'],
  ['sql', 'SQL Tutorial (W3Schools)', 'https://www.w3schools.com/sql/', 'practice'],
  ['python', 'The Python Tutorial (python.org)', 'https://docs.python.org/3/tutorial/', 'article'],
  ['statistics', 'Statistics and probability (Khan Academy)', 'https://www.khanacademy.org/math/statistics-probability', 'course'],
  ['dashboard', 'Power BI training (Microsoft Learn)', 'https://learn.microsoft.com/en-us/training/powerbi/', 'course'],
  ['excel', 'Excel help and learning (Microsoft Support)', 'https://support.microsoft.com/en-us/excel', 'article'],
  ['git', 'Pro Git book (git-scm.com)', 'https://git-scm.com/book/en/v2', 'article'],
  ['backend', 'Learn web development (MDN)', 'https://developer.mozilla.org/en-US/docs/Learn', 'article'],
  ['backend', 'Learn Node.js (nodejs.org)', 'https://nodejs.org/en/learn', 'article'],
  ['dsa', 'VisuAlgo: visualising data structures and algorithms', 'https://visualgo.net/', 'practice'],
  ['ielts', 'LearnEnglish (British Council)', 'https://learnenglish.britishcouncil.org/', 'course'],
  ['testing', 'ISTQB (software testing certification body)', 'https://www.istqb.org/', 'article'],
  ['communication', 'Interview and workplace skills (Khan Academy: Career guidance)', 'https://www.khanacademy.org/college-careers-more', 'course'],
  ['communication', '10 Minute School (Bangla)', 'https://10minuteschool.com/', 'course', 'bn'],
  ['python', 'Programming Hero (Bangla)', 'https://www.programming-hero.com/', 'course', 'bn'],
];
async function seedLearning() {
  // A database used for an earlier experiment can hold old indexes (e.g. a unique `name_1` on skills) that block our seed.
  // syncIndexes() removes indexes our schema does not declare. It only touches indexes, never documents.
  for (const M of [Skill, RoleTemplate, Resource, Quiz, Roadmap]) {
    try { await M.syncIndexes(); } catch (e) { console.warn(`index sync for ${M.modelName} skipped: ${e.message}`); }
  }
  await require('./quizzes').seedQuizzes();
  await require('./roadmaps').seedRoadmaps();
  for (const [skillKey, title, url, kind, language] of RESOURCES) await Resource.updateOne({ url }, { $set: { skillKey, title, kind, language: language || 'en', free: true, status: 'approved' } }, { upsert: true });
  // Extra free links ported from the web version (same upsert by url as above).
  for (const [skillKey, title, url, kind, language] of require('./resources_more').MORE_RESOURCES) await Resource.updateOne({ url }, { $set: { skillKey, title, kind, language: language || 'en', free: true, status: 'approved' } }, { upsert: true });
  // S = the original skills; MORE_SKILLS = extra assessment skills ported from the web version.
  const ALL_SKILLS = [...S, ...require('./quizzes_more').MORE_SKILLS];
  for (const [key, nameEn, nameBn, learningHours] of ALL_SKILLS) await Skill.updateOne({ key }, { $set: { nameEn, nameBn, learningHours } }, { upsert: true });
  for (const r of ROLES) await RoleTemplate.updateOne({ key: r.key }, { $set: r }, { upsert: true });
  return { skills: ALL_SKILLS.length, roles: ROLES.length };
}
module.exports = { seedLearning, ROLES, SKILLS: S };
