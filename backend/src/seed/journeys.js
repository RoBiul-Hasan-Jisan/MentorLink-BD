// DEMO Path Twin journeys for the demo mentors (invented, skills and months only). Idempotent.
const M = require('../models');

// email -> [firstJobMonths, milestones [skill, month, level], note]. month 0 = graduation.
const J = {
  'mentor1@demo.mentorlink.bd': [3, [['excel', -6, 2], ['sql', -2, 1], ['communication', 0, 2], ['sql', 2, 2], ['dashboard', 4, 2], ['statistics', 7, 2], ['python', 10, 2], ['sql', 12, 3]], 'I got my first job after building two dashboards from public data.'],
  'mentor.nsu@demo.mentorlink.bd': [5, [['excel', -8, 3], ['communication', -3, 2], ['sql', 0, 1], ['sql', 3, 2], ['dashboard', 6, 3], ['statistics', 9, 2], ['python', 14, 2]], 'Excel got me interviews. SQL got me the offer.'],
  'mentor.buet@demo.mentorlink.bd': [4, [['dsa', -10, 2], ['git', -4, 2], ['backend', -1, 1], ['backend', 3, 2], ['sql', 5, 2], ['dsa', 8, 3], ['testing', 11, 2]], 'Two small backend projects on GitHub changed the interviews.'],
  'mentor.cuet@demo.mentorlink.bd': [6, [['dsa', -9, 3], ['git', -5, 2], ['sql', -1, 1], ['backend', 2, 2], ['backend', 8, 3], ['sql', 10, 3]], ''],
  'mentor.bracu@demo.mentorlink.bd': [2, [['testing', -5, 1], ['git', -2, 1], ['communication', 0, 2], ['testing', 4, 2], ['git', 6, 2], ['testing', 9, 3]], ''],
  'mentor.du@demo.mentorlink.bd': [4, [['accounting', -8, 2], ['communication', -2, 2], ['banking', 1, 1], ['banking', 5, 2], ['excel', 7, 2], ['banking', 12, 3]], ''],
};

async function seedJourneys() {
  for (const [email, [firstJobMonths, ms, note]] of Object.entries(J)) {
    const u = await M.User.findOne({ email });
    if (!u) continue;
    await M.Journey.updateOne({ mentorId: u._id }, { $set: { shared: true, firstJobMonths, note, milestones: ms.map(([skillKey, month, level]) => ({ skillKey, month, level })) } }, { upsert: true });
  }
}
module.exports = { seedJourneys };
