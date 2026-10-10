const University = require('../models/University');
const User = require('../models/User');

// Counts only verified users who chose to appear in the directory.
async function memberCounts() {
  const rows = await User.aggregate([
    { $match: { verificationStatus: 'verified', showInDirectory: true, role: { $in: ['student', 'mentor'] }, universityId: { $ne: null } } },
    { $group: { _id: { u: '$universityId', r: '$role' }, n: { $sum: 1 } } },
  ]);
  const map = new Map();
  for (const { _id, n } of rows) {
    const key = String(_id.u);
    const cur = map.get(key) || { studentCount: 0, mentorCount: 0 };
    if (_id.r === 'student') cur.studentCount = n; else cur.mentorCount = n;
    map.set(key, cur);
  }
  return map;
}

// Public shape: campus point only. No per-user data.
function toPublic(u, counts = {}) {
  return {
    id: String(u._id), name: u.name, shortName: u.shortName, city: u.city,
    campus: { latitude: u.campus.coordinates[1], longitude: u.campus.coordinates[0] },
    studentCount: counts.studentCount || 0, mentorCount: counts.mentorCount || 0,
  };
}

async function listWithCounts() {
  const [unis, counts] = await Promise.all([University.find({ active: true }).sort({ name: 1 }), memberCounts()]);
  return unis.map((u) => toPublic(u, counts.get(String(u._id))));
}

module.exports = { listWithCounts, toPublic };
