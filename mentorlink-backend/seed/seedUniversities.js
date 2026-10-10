const mongoose = require('mongoose');
const env = require('../src/config/env');
const { connectDb } = require('../src/config/db');
const University = require('../src/models/University');
const list = require('./universities.json');

// Idempotent: upserts by name. Refuses placeholder [0,0] unless ALLOW_PLACEHOLDER_COORDS=true.
async function seedUniversities() {
  const placeholders = list.filter((u) => u.campus.coordinates.every((c) => c === 0));
  if (placeholders.length && !env.ALLOW_PLACEHOLDER_COORDS) {
    throw new Error(`Refusing to seed: ${placeholders.length} universities still have [0,0] coordinates. ` +
      'Fill in real campus coordinates (verify on Google Maps) or set ALLOW_PLACEHOLDER_COORDS=true for local testing.');
  }
  for (const { _todo, ...u } of list) await University.updateOne({ name: u.name }, { $set: u }, { upsert: true });
  return list.length;
}
module.exports = { seedUniversities };

if (require.main === module) {
  connectDb()
    .then(seedUniversities)
    .then((n) => { console.log(`Seeded ${n} universities`); return mongoose.disconnect(); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
