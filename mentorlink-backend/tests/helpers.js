const { connect, mongoose } = require('../src/config/db');
const { createApp } = require('../src/app');
const models = require('../src/models');

// Fake Firebase: the credential string is "uid:email".
const verify = async (c) => { if (!c.includes(':')) throw new Error('bad'); const [uid, email] = c.split(':'); return { uid, email }; };
const bearer = (uid, email = `${uid}@t.test`) => ({ Authorization: `Bearer ${uid}:${email}` });

async function setup() {
  // SAFETY: tests wipe their database, so they NEVER use MONGODB_URI (your real data).
  const uri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/mentorlink_test';
  const dbName = new URL(uri).pathname.replace('/', '');
  if (!dbName.endsWith('_test')) throw new Error('Refusing to run tests: TEST_MONGODB_URI database name must end with _test');
  await connect(uri);
  await mongoose.connection.dropDatabase();
  return createApp({ verify });
}
async function teardown() { await mongoose.disconnect(); }

async function mkUni(name, short, city, lng, lat) {
  return models.University.create({ name, shortName: short, city, campus: { type: 'Point', coordinates: [lng, lat] } });
}
async function mkUser(uid, role, uni, extra = {}) {
  return models.User.create({ firebaseUid: uid, email: `${uid}@t.test`, displayName: extra.displayName || `User ${uid}`, role, universityId: uni && uni._id, verificationStatus: 'verified', ...extra });
}
module.exports = { setup, teardown, bearer, mkUni, mkUser, models };
