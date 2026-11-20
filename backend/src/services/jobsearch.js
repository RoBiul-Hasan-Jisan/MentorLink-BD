// Job search rules (pure functions, no database). The route loads approved jobs and calls these.
// Explainable on purpose: a text match, three filters, three sort orders. No hidden ranking.
const { bad } = require('../utils/httpError');

const TYPES = ['job', 'internship', 'other'];
const MODES = ['onsite', 'hybrid', 'remote'];
const SORTS = ['newest', 'deadline', 'fit'];
const DAY = 864e5;
const CLOSING_SOON_DAYS = 7;

const norm = (s) => String(s == null ? '' : s).normalize('NFKC').toLowerCase().trim();

const intIn = (v, name, min, max, dflt) => {
  if (v === undefined || v === null || v === '') return dflt;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw bad('BAD_QUERY', `${name} must be a whole number from ${min} to ${max}.`);
  return n;
};
const oneOf = (v, list, name) => {
  if (v === undefined || v === null || v === '') return undefined;
  if (!list.includes(v)) throw bad('BAD_QUERY', `${name} must be one of: ${list.join(', ')}.`);
  return v;
};
const flag = (v) => v === true || v === 'true' || v === '1';

// Reads the query string. Anything unexpected is a clear 400, never silently ignored.
function parseParams(query = {}) {
  const q = norm(query.q);
  if (q.length > 80) throw bad('BAD_QUERY', 'Search text is too long (80 characters at most).');
  return {
    q,
    type: oneOf(query.type, TYPES, 'type'),
    mode: oneOf(query.mode, MODES, 'mode'),
    sort: oneOf(query.sort, SORTS, 'sort') || 'newest',
    minFit: intIn(query.minFit, 'minFit', 0, 100, 0),
    minSalary: intIn(query.minSalary, 'minSalary', 0, 10000000, 0),
    city: norm(query.city).slice(0, 40),
    experience: oneOf(query.experience, ['fresher', 'junior', 'mid'], 'experience'),
    closingSoon: flag(query.closingSoon),
    hideApplied: flag(query.hideApplied),
    savedOnly: flag(query.savedOnly),
    page: intIn(query.page, 'page', 1, 1000, 1),
    limit: intIn(query.limit, 'limit', 1, 50, 20),
  };
}

// Every word typed must appear in the title, organization, location or description (so "data analyst dhaka" narrows, never widens).
function matchesText(job, q) {
  if (!q) return true;
  const hay = norm(`${job.title} ${job.organization} ${job.locationText || ''} ${job.description || ''}`);
  return q.split(/\s+/).every((w) => hay.includes(w));
}

function daysLeft(job, now = new Date()) {
  if (!job.applicationDeadline) return null;
  return Math.ceil((new Date(job.applicationDeadline).getTime() - now.getTime()) / DAY);
}

// ctx = { fit: Map(jobId -> 0..100), applied: Set(jobId), saved: Set(jobId), now: Date }
function filterJobs(jobs, p, ctx = {}) {
  const now = ctx.now || new Date();
  const fit = ctx.fit || new Map();
  const applied = ctx.applied || new Set();
  const saved = ctx.saved || new Set();
  return jobs.filter((j) => {
    const id = String(j._id || j.id);
    if (j.closed) return false;
    // A job whose deadline has passed is not offered any more (applying would fail with DEADLINE_PASSED anyway).
    if (j.applicationDeadline && new Date(j.applicationDeadline) < now) return false;
    if (p.type && j.type !== p.type) return false;
    if (p.mode && j.workplaceMode !== p.mode) return false;
    if (!matchesText(j, p.q)) return false;
    if (p.city && !norm(j.locationText).includes(p.city)) return false;
    if (p.experience && j.experienceLevel !== p.experience) return false;
    // A salary filter keeps only jobs that list a salary at or above it (jobs with no salary shown are not guessed).
    if (p.minSalary > 0 && !((j.salaryMax || j.salaryMin || 0) >= p.minSalary)) return false;
    if (p.savedOnly && !saved.has(id)) return false;
    if (p.hideApplied && applied.has(id)) return false;
    if (p.closingSoon) {
      const d = daysLeft(j, now);
      if (d === null || d > CLOSING_SOON_DAYS) return false;
    }
    if (p.minFit > 0) {
      const f = fit.get(id);
      // A job with no listed skills has no fit number; it is not hidden by a fit filter, it is simply not scored.
      if (f !== undefined && f < p.minFit) return false;
      if (f === undefined && j.requiredSkills && j.requiredSkills.length) return false;
    }
    return true;
  });
}

const created = (j) => new Date(j.createdAt || 0).getTime();
function sortJobs(jobs, sort, ctx = {}) {
  const fit = ctx.fit || new Map();
  const id = (j) => String(j._id || j.id);
  const copy = [...jobs];
  if (sort === 'deadline') {
    // Soonest deadline first; jobs without a deadline go last (newest first among them).
    copy.sort((a, b) => {
      const da = a.applicationDeadline ? new Date(a.applicationDeadline).getTime() : Infinity;
      const db = b.applicationDeadline ? new Date(b.applicationDeadline).getTime() : Infinity;
      return da === db ? created(b) - created(a) : da < db ? -1 : 1;
    });
  } else if (sort === 'fit') {
    copy.sort((a, b) => {
      const fa = fit.has(id(a)) ? fit.get(id(a)) : -1; // unscored jobs go after scored ones
      const fb = fit.has(id(b)) ? fit.get(id(b)) : -1;
      return fb - fa || created(b) - created(a);
    });
  } else copy.sort((a, b) => created(b) - created(a));
  return copy;
}

function paginate(items, page, limit) {
  const total = items.length;
  const start = (page - 1) * limit;
  return { items: items.slice(start, start + limit), total, page, limit, hasMore: start + limit < total };
}

module.exports = { parseParams, matchesText, filterJobs, sortJobs, paginate, daysLeft, TYPES, MODES, SORTS, CLOSING_SOON_DAYS };
