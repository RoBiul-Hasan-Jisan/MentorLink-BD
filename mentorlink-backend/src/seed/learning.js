const { Skill, RoleTemplate, Resource } = require('../models');
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
];
// Real, free, public learning pages (English). Add Bangla-language resources from the admin panel.
const RESOURCES = [
  ['sql', 'Relational Database course (freeCodeCamp)', 'https://www.freecodecamp.org/learn/relational-database/', 'course'],
  ['sql', 'SQL Tutorial (W3Schools)', 'https://www.w3schools.com/sql/', 'practice'],
  ['python', 'The Python Tutorial (python.org)', 'https://docs.python.org/3/tutorial/', 'article'],
  ['statistics', 'Statistics and probability (Khan Academy)', 'https://www.khanacademy.org/math/statistics-probability', 'course'],
  ['dashboard', 'Power BI training (Microsoft Learn)', 'https://learn.microsoft.com/en-us/training/powerbi/', 'course'],
  ['excel', 'Excel help and learning (Microsoft Support)', 'https://support.microsoft.com/en-us/excel', 'article'],
  ['git', 'Pro Git book (git-scm.com)', 'https://git-scm.com/book/en/v2', 'article'],
];
async function seedLearning() {
  for (const [skillKey, title, url, kind] of RESOURCES) await Resource.updateOne({ url }, { $set: { skillKey, title, kind, language: 'en', free: true, status: 'approved' } }, { upsert: true });
  for (const [key, nameEn, nameBn, learningHours] of S) await Skill.updateOne({ key }, { $set: { nameEn, nameBn, learningHours } }, { upsert: true });
  for (const r of ROLES) await RoleTemplate.updateOne({ key: r.key }, { $set: r }, { upsert: true });
  return { skills: S.length, roles: ROLES.length };
}
module.exports = { seedLearning };
