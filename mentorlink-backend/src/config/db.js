const mongoose = require('mongoose');
const env = require('./env');

async function connectDb() {
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI is not set (see .env.example)');
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI);
  return mongoose.connection;
}
module.exports = { connectDb };
