const mongoose = require('mongoose');
const { connectDb } = require('../src/config/db');
const Skill = require('../src/models/Skill');
const RoleTemplate = require('../src/models/RoleTemplate');
const data = require('./skillsAndRoles.json');

// Idempotent: upserts by key.
async function seedSkills() {
  for (const s of data.skills) await Skill.updateOne({ key: s.key }, { $set: s }, { upsert: true });
  for (const r of data.roles) await RoleTemplate.updateOne({ key: r.key }, { $set: r }, { upsert: true });
  return { skills: data.skills.length, roles: data.roles.length };
}
module.exports = { seedSkills };

if (require.main === module) {
  connectDb().then(seedSkills).then((n) => { console.log('Seeded', n); return mongoose.disconnect(); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
