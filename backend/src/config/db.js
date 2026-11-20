const mongoose = require('mongoose');

async function connect(uri) {
  await mongoose.connect(uri);
  return mongoose;
}
module.exports = { connect, mongoose };
