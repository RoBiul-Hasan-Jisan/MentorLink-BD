// Who runs a job. Shared by the application routes and the hiring routes.
// The people who run a job: whoever posted it plus, for a company job, every ACTIVE member of a VERIFIED company.
const { Organization, OrganizationMember } = require('../models');
const idStr = (x) => String(x && x._id ? x._id : x);

async function posterIds(opp) {
  const ids = new Set([idStr(opp.postedBy)]);
  if (opp.organizationId) {
    const org = await Organization.findById(opp.organizationId).select('verificationStatus').lean();
    if (org && org.verificationStatus === 'verified') {
      for (const m of await OrganizationMember.find({ organizationId: opp.organizationId, status: 'active' }).select('userId').lean()) ids.add(idStr(m.userId));
    }
  }
  return [...ids];
}
async function isPoster(user, opp) {
  if (idStr(opp.postedBy) === idStr(user._id)) return true;
  return (await posterIds(opp)).includes(idStr(user._id));
}
module.exports = { posterIds, isPoster, idStr };
