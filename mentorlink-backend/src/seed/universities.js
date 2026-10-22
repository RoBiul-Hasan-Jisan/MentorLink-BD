// Seeds universities. Coordinates marked verified:false are APPROXIMATE placeholders: confirm on a map before the demo.
// Refuses [0,0] and points outside Bangladesh. Idempotent (upsert by name).
const data = require('./universities.json');
const env = require('../config/env');
const { University } = require('../models');

const inBangladesh = (lat, lng) => lat >= 20.5 && lat <= 26.7 && lng >= 88 && lng <= 92.8;

async function seedUniversities() {
  for (const u of data) {
    if (!inBangladesh(u.lat, u.lng)) throw new Error(`Bad coordinates for ${u.name}: refusing [${u.lng},${u.lat}]`);
    if (!u.verified && !env.allowPlaceholderCoords) {
      throw new Error(`${u.name} has unverified placeholder coordinates. Verify them or set ALLOW_PLACEHOLDER_COORDS=true.`);
    }
    await University.updateOne(
      { name: u.name },
      { $set: { shortName: u.shortName, city: u.city, campus: { type: 'Point', coordinates: [u.lng, u.lat] }, campusAddressText: u.campusAddressText, emailDomains: u.emailDomains, active: true } },
      { upsert: true }
    );
  }
  return data.length;
}
module.exports = { seedUniversities };

if (require.main === module) {
  require('dotenv').config();
  const { connect, mongoose } = require('../config/db');
  connect(env.mongoUri).then(seedUniversities).then((n) => { console.log(`Seeded ${n} universities`); return mongoose.disconnect(); }).catch((e) => { console.error(e.message); process.exit(1); });
}
