// Admin overview of ALL job posts (any status) with who applied. Pure functions; the route loads the rows.
// Admins see names, department, stage and date. They never see the CV, the note, or contact details (those stay with what the student consented to share with the poster).
const { bad } = require('../utils/httpError');
const { matchesText, paginate } = require('./jobsearch');

const STATUSES = ['draft', 'pending', 'approved', 'hidden', 'removed'];
const STAGE_ORDER = ['Applied', 'Under Review', 'Shortlisted', 'Interview', 'Offer', 'Hired', 'Rejected', 'Withdrawn'];

function parseAdminParams(query = {}) {
  const status = query.status === undefined || query.status === '' || query.status === 'all' ? 'all' : query.status;
  if (status !== 'all' && !STATUSES.includes(status)) throw bad('BAD_QUERY', `status must be all or one of: ${STATUSES.join(', ')}.`);
  const q = String(query.q || '').normalize('NFKC').toLowerCase().trim();
  if (q.length > 80) throw bad('BAD_QUERY', 'Search text is too long (80 characters at most).');
  const int = (v, name, min, max, d) => {
    if (v === undefined || v === '') return d;
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw bad('BAD_QUERY', `${name} must be a whole number from ${min} to ${max}.`);
    return n;
  };
  return { status, q, page: int(query.page, 'page', 1, 1000, 1), limit: int(query.limit, 'limit', 1, 100, 30) };
}

// { Applied: 3, Interview: 1 } for one job. Stages with no one are left out.
function countByStage(apps) {
  const out = {};
  for (const a of apps) out[a.stage] = (out[a.stage] || 0) + 1;
  return out;
}

// Groups application rows by job id once, so the route does one query instead of one per job.
function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows) { const k = String(r[key]); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return m;
}

// The shape one row of the admin list has.
function jobRow(job, apps = [], saves = 0, posterName = '') {
  const active = apps.filter((a) => a.stage !== 'Withdrawn');
  return {
    id: job._id, title: job.title, organization: job.organization, type: job.type, workplaceMode: job.workplaceMode, status: job.status,
    closed: !!job.closed, sourceLabel: job.sourceLabel, postedByName: posterName, createdAt: job.createdAt, applicationDeadline: job.applicationDeadline,
    suspiciousFlags: job.suspiciousFlags || [], reportCount: job.reportCount || 0, views: job.views || 0, reviewDueAt: job.reviewDueAt, overdue: job.status === 'pending' && !!job.reviewDueAt && new Date(job.reviewDueAt) < new Date(),
    applications: { total: apps.length, active: active.length, byStage: countByStage(apps) },
    saved: saves,
  };
}

// Totals for the cards at the top of the screen (computed over ALL jobs, not just the current page).
function totals(jobs, appsByJob, savesByJob) {
  const byStatus = {};
  let applications = 0, saved = 0;
  for (const j of jobs) {
    byStatus[j.status] = (byStatus[j.status] || 0) + 1;
    applications += (appsByJob.get(String(j._id)) || []).length;
    saved += (savesByJob.get(String(j._id)) || []).length;
  }
  return { jobs: jobs.length, byStatus, applications, saved };
}

function filterAdminJobs(jobs, p) {
  return jobs.filter((j) => (p.status === 'all' || j.status === p.status) && matchesText(j, p.q));
}

// An applicant as the admin sees them: no CV, no note, no contact.
const applicantRow = (a, student = {}) => ({
  id: a._id, name: student.displayName || 'Deleted user', department: student.department || '', stage: a.stage, withdrawn: a.stage === 'Withdrawn', appliedAt: a.createdAt,
});

module.exports = { STATUSES, STAGE_ORDER, parseAdminParams, countByStage, groupBy, jobRow, totals, filterAdminJobs, applicantRow, paginate };
