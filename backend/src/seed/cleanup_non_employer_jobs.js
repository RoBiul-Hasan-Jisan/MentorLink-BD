// RULE: only an EMPLOYER (role=employer, active member of a verified company) can post a job.
// This removes every job that was posted by anybody else (student, mentor/alumnus, department, admin), plus everything attached to it
// (applications, interviews, papers, offers, messages, saved-job marks, reports). Safe to run again: it only touches those jobs.
//
//   npm run cleanup:jobs        (uses MONGODB_URI from .env)
const M = require('../models');

async function removeNonEmployerJobs() {
  const employerIds = (await M.User.find({ role: 'employer' }).select('_id').lean()).map((u) => u._id);
  const bad = await M.Opportunity.find({ $or: [{ sourceLabel: { $ne: 'employer' } }, { organizationId: { $exists: false } }, { postedBy: { $nin: employerIds } }] }).select('_id title sourceLabel').lean();
  if (!bad.length) return { jobs: 0, applications: 0 };
  const jobIds = bad.map((j) => j._id);
  const apps = await M.Application.find({ opportunityId: { $in: jobIds } }).select('_id').lean();
  const appIds = apps.map((a) => a._id);
  await Promise.all([
    M.Interview.deleteMany({ applicationId: { $in: appIds } }),
    M.AppMessage.deleteMany({ applicationId: { $in: appIds } }),
    M.DocumentRequest.deleteMany({ applicationId: { $in: appIds } }),
    M.Offer.deleteMany({ applicationId: { $in: appIds } }),
    M.Application.deleteMany({ _id: { $in: appIds } }),
    M.SavedJob.deleteMany({ opportunityId: { $in: jobIds } }),
    M.Report.deleteMany({ targetType: 'opportunity', targetId: { $in: jobIds } }),
  ]);
  await M.Opportunity.deleteMany({ _id: { $in: jobIds } });
  return { jobs: bad.length, applications: appIds.length, removed: bad.map((j) => `${j.title} (${j.sourceLabel})`) };
}
module.exports = { removeNonEmployerJobs };

if (require.main === module) {
  require('dotenv').config();
  (async () => {
    const { connect, mongoose } = require('../config/db');
    await connect(require('../config/env').mongoUri);
    console.log(await removeNonEmployerJobs());
    await mongoose.disconnect();
  })().catch((e) => { console.error(e); process.exit(1); });
}
