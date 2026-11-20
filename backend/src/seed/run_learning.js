// Re-seed ONLY the learning data (skills, career goals, roadmaps, quizzes, resources). Safe to run any time: upserts, no deletes.
// Usage: npm run seed:learning
const env = require('../config/env');
const { connect } = require('../config/db');
const { seedLearning } = require('./learning');
(async () => {
  await connect(env.mongoUri || env.MONGODB_URI || process.env.MONGODB_URI);
  await seedLearning();
  console.log('Learning data seeded (career goals, roadmaps, quizzes, resources).');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
