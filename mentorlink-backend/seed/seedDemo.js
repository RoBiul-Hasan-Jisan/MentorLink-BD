const mongoose = require('mongoose');
const env = require('../src/config/env');
const { connectDb } = require('../src/config/db');
const { getAuth } = require('../src/config/firebase');
const University = require('../src/models/University');
const User = require('../src/models/User');
const { seedUniversities } = require('./seedUniversities');

const DEMO = [
  { label: 'Student 1', email: 'student.edu@demo.mentorlink.bd', password: 'Demo@12345', role: 'student', uni: 'EDU', displayName: 'Robiul Hasan', department: 'CSE', batchYear: 2022 },
  { label: 'Student 2', email: 'student.su@demo.mentorlink.bd', password: 'Demo@12345', role: 'student', uni: 'SU', displayName: 'Nusrat Jahan', department: 'CSE', batchYear: 2022 },
  { label: 'Alumni mentor 1', email: 'mentor1@demo.mentorlink.bd', password: 'Demo@12345', role: 'mentor', uni: 'EDU', displayName: 'Abrar Rahman', department: 'CSE', batchYear: 2018 },
  { label: 'Alumni mentor 2', email: 'mentor2@demo.mentorlink.bd', password: 'Demo@12345', role: 'mentor', uni: 'SU', displayName: 'Farzana Akter', department: 'CSE', batchYear: 2017 },
  { label: 'Department', email: 'dept@demo.mentorlink.bd', password: 'Demo@12345', role: 'department', uni: 'EDU', displayName: 'Dayan Chowdhury', department: 'CSE' },
  { label: 'Admin', email: 'admin@demo.mentorlink.bd', password: 'Admin@12345', role: 'admin', displayName: 'Ayesha Khan' },
];

async function seedDemo() {
  if (!env.DEMO_MODE) throw new Error('DEMO_MODE is not "true". Refusing to create demo accounts.');
  await seedUniversities();
  const auth = getAuth(); // uses the Auth emulator automatically if FIREBASE_AUTH_EMULATOR_HOST is set

  for (const d of DEMO) {
    let rec;
    try {
      rec = await auth.getUserByEmail(d.email);
      await auth.updateUser(rec.uid, { password: d.password, displayName: d.displayName }); // exists -> reset password
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
      rec = await auth.createUser({ email: d.email, password: d.password, displayName: d.displayName, emailVerified: true });
    }
    const uni = d.uni ? await University.findOne({ shortName: d.uni }) : null;
    await User.findOneAndUpdate({ email: d.email }, {
      $set: {
        firebaseUid: rec.uid, displayName: d.displayName, role: d.role, verificationStatus: 'verified',
        department: d.department, batchYear: d.batchYear, showInDirectory: true,
        ...(uni && { universityId: uni._id }),
      },
    }, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
  console.log('\nDemo accounts (safe to re-run):');
  console.table(DEMO.map(({ label, email, password, role, uni }) => ({ label, email, password, role, university: uni || 'n/a' })));
}
module.exports = { seedDemo };

if (require.main === module) {
  connectDb().then(seedDemo).then(() => mongoose.disconnect())
    .catch((e) => { console.error(e.message); process.exit(1); });
}
