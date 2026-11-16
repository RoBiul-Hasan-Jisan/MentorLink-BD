// Job-portal helpers: auto-close, match alerts, deadline reminders, slow-employer nudges, response stats, similar jobs, applicant fit.
// Pure-ish functions; the routes and the 15-minute timer call them.
const { Opportunity, Application, SavedJob, SkillEvidence, User, OrganizationMember } = require('../models');
const { levelsFromEvidence } = require('./readiness');
const { notify } = require('../utils/helpers');
const { posterIds } = require('./posters');
const DAY = 864e5;
const ALERT_MIN_FIT = 40;   // a student is alerted only when at least this % of the job's skills are met
const ALERT_MAX = 200;      // most students told about one job
const REVIEW_HOURS = 48;    // target time for an admin to review a pending job
const SLOW_DAYS = 7;        // an applicant waiting this long in "Applied" nudges the employer

const reviewDue = (now = new Date()) => new Date(now.getTime() + REVIEW_HOURS * 36e5);

// How well a student's verified skill levels meet a job (0..100), or undefined when the job lists no skills.
function fitOf(job, have) {
  const skills = job.requiredSkills || [];
  if (!skills.length) return undefined;
  let n = 0, d = 0;
  for (const s of skills) { d += s.weight; n += s.weight * Math.min((((have || {})[s.skillKey] || {}).level || 0) / s.requiredLevel, 1); }
  return d ? Math.round((100 * n) / d) : undefined;
}

// Approved jobs whose deadline passed are closed (so employers and admins see the truth too).
async function closeExpiredJobs(now = new Date()) {
  const r = await Opportunity.updateMany({ closed: { $ne: true }, status: 'approved', applicationDeadline: { $lt: now } }, { $set: { closed: true } });
  return r.modifiedCount || 0;
}

// Tell students whose verified skills fit a newly approved job. Students can switch this off (jobAlertsOn).
async function alertMatchingStudents(job) {
  if (!job || job.status !== 'approved' || job.closed || !(job.requiredSkills || []).length) return 0;
  const keys = job.requiredSkills.map((s) => s.skillKey);
  const touched = await SkillEvidence.find({ skillKey: { $in: keys } }).select('studentId').lean();
  const ids = [...new Set(touched.map((e) => String(e.studentId)))];
  if (!ids.length) return 0;
  const students = await User.find({ _id: { $in: ids }, role: 'student', jobAlertsOn: { $ne: false }, deletedAt: null }).select('_id').lean();
  const evidence = await SkillEvidence.find({ studentId: { $in: students.map((u) => u._id) } }).lean();
  const by = new Map();
  for (const e of evidence) { const k = String(e.studentId); if (!by.has(k)) by.set(k, []); by.get(k).push(e); }
  let sent = 0;
  for (const u of students) {
    if (sent >= ALERT_MAX) break;
    const fit = fitOf(job, levelsFromEvidence(by.get(String(u._id)) || []));
    if (fit === undefined || fit < ALERT_MIN_FIT) continue;
    await notify(u._id, 'A new job fits your skills', `${job.title} (${fit}% fit)`, 'opportunity', { type: 'opportunity', id: String(job._id) });
    sent += 1;
  }
  return sent;
}

// Saved jobs closing within 48 hours: one reminder each (claimed atomically so two servers never both send).
async function remindSavedJobs(now = new Date()) {
  const soon = new Date(now.getTime() + 48 * 36e5);
  const jobs = await Opportunity.find({ status: 'approved', closed: { $ne: true }, applicationDeadline: { $gt: now, $lte: soon } }).select('_id title applicationDeadline').lean();
  if (!jobs.length) return 0;
  const byId = new Map(jobs.map((j) => [String(j._id), j]));
  const applied = new Set((await Application.find({ opportunityId: { $in: jobs.map((j) => j._id) }, stage: { $ne: 'Withdrawn' } }).select('studentId opportunityId').lean()).map((a) => `${a.studentId}:${a.opportunityId}`));
  let n = 0;
  for (const s of await SavedJob.find({ opportunityId: { $in: jobs.map((j) => j._id) }, deadlineReminded: { $ne: true } }).lean()) {
    if (applied.has(`${s.studentId}:${s.opportunityId}`)) continue;
    const got = await SavedJob.findOneAndUpdate({ _id: s._id, deadlineReminded: { $ne: true } }, { $set: { deadlineReminded: true } });
    if (!got) continue;
    const j = byId.get(String(s.opportunityId));
    await notify(s.studentId, 'A saved job closes soon', j.title, 'reminder', { type: 'opportunity', id: String(j._id) });
    n += 1;
  }
  return n;
}

// Applicants who wait more than a week with no reply: the employer team gets one nudge per job.
async function nudgeSlowEmployers(now = new Date()) {
  const old = new Date(now.getTime() - SLOW_DAYS * DAY);
  const waiting = await Application.find({ stage: 'Applied', createdAt: { $lt: old }, nudgedAt: { $exists: false } }).select('_id opportunityId').lean();
  const perJob = new Map();
  for (const a of waiting) {
    const got = await Application.findOneAndUpdate({ _id: a._id, nudgedAt: { $exists: false } }, { $set: { nudgedAt: now } });
    if (!got) continue;
    const k = String(a.opportunityId); perJob.set(k, (perJob.get(k) || 0) + 1);
  }
  let jobs = 0;
  for (const [id, count] of perJob) {
    const job = await Opportunity.findById(id).select('title postedBy organizationId status').lean();
    if (!job || job.status !== 'approved') continue;
    for (const uid of await posterIds(job)) await notify(uid, 'Applicants are waiting', `${count} applicant(s) for "${job.title}" have waited over ${SLOW_DAYS} days.`, 'application');
    jobs += 1;
  }
  return jobs;
}

// How responsive a company is: share of applications older than 3 days that got a reply, and the average days to the first reply.
// Shown only when there are at least 3 such applications (a tiny sample would mislead).
async function responseStats(organizationId) {
  const jobs = await Opportunity.find({ organizationId }).select('_id').lean();
  const apps = await Application.find({ opportunityId: { $in: jobs.map((j) => j._id) }, stage: { $ne: 'Withdrawn' }, createdAt: { $lt: new Date(Date.now() - 3 * DAY) } }).select('stage createdAt stageHistory').lean();
  if (apps.length < 3) return { responseRate: null, avgReplyDays: null, sample: apps.length };
  const answered = apps.filter((a) => a.stage !== 'Applied');
  const days = answered.map((a) => { const h = (a.stageHistory || []).find((x, i) => i > 0); return h ? Math.max(0, (new Date(h.at) - new Date(a.createdAt)) / DAY) : null; }).filter((d) => d !== null);
  return { responseRate: Math.round((100 * answered.length) / apps.length), avgReplyDays: days.length ? Math.round((days.reduce((s, d) => s + d, 0) / days.length) * 10) / 10 : null, sample: apps.length };
}

// Jobs like this one: shared skills first, then same type and work mode.
function similarJobs(job, candidates, limit = 5) {
  const keys = new Set((job.requiredSkills || []).map((s) => s.skillKey));
  return candidates
    .filter((c) => String(c._id) !== String(job._id))
    .map((c) => ({ c, score: (c.requiredSkills || []).filter((s) => keys.has(s.skillKey)).length * 3 + (c.type === job.type ? 1 : 0) + (c.workplaceMode === job.workplaceMode ? 1 : 0) + (job.organizationId && String(c.organizationId) === String(job.organizationId) ? 1 : 0) }))
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.c);
}

module.exports = { fitOf, closeExpiredJobs, alertMatchingStudents, remindSavedJobs, nudgeSlowEmployers, responseStats, similarJobs, reviewDue, ALERT_MIN_FIT, REVIEW_HOURS, SLOW_DAYS };
