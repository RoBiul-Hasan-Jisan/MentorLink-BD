// Job search rules: pure logic, no database.
const { parseParams, matchesText, filterJobs, sortJobs, paginate, daysLeft } = require('../src/services/jobsearch');

const NOW = new Date('2026-10-25T12:00:00Z');
const day = (n) => new Date(NOW.getTime() + n * 864e5).toISOString();
const job = (id, o = {}) => ({ _id: id, title: 'Data Analyst', organization: 'Acme', type: 'job', workplaceMode: 'onsite', description: 'Build dashboards with SQL.', requiredSkills: [], createdAt: day(-1), ...o });

describe('parseParams', () => {
  test('defaults', () => {
    expect(parseParams({})).toEqual({ q: '', type: undefined, mode: undefined, sort: 'newest', minFit: 0, closingSoon: false, hideApplied: false, savedOnly: false, page: 1, limit: 20 });
  });
  test('reads and lower-cases values', () => {
    const p = parseParams({ q: '  Data   ANALYST ', type: 'internship', mode: 'remote', sort: 'fit', minFit: '60', closingSoon: 'true', hideApplied: '1', savedOnly: 'true', page: '2', limit: '10' });
    expect(p).toMatchObject({ q: 'data   analyst', type: 'internship', mode: 'remote', sort: 'fit', minFit: 60, closingSoon: true, hideApplied: true, savedOnly: true, page: 2, limit: 10 });
  });
  test('bad values are a clear 400, not ignored', () => {
    for (const bad of [{ type: 'nope' }, { mode: 'moon' }, { sort: 'random' }, { minFit: '101' }, { minFit: 'x' }, { page: '0' }, { limit: '51' }, { limit: '1.5' }, { q: 'a'.repeat(81) }]) {
      expect(() => parseParams(bad)).toThrow('BAD_QUERY');
    }
  });
});

describe('matchesText', () => {
  test('every word must match somewhere in title, organization, location or description', () => {
    const j = job('1', { organization: 'Grameen Tech', locationText: 'Chattogram' });
    expect(matchesText(j, 'sql')).toBe(true);
    expect(matchesText(j, 'analyst chattogram')).toBe(true);
    expect(matchesText(j, 'analyst dhaka')).toBe(false);
    expect(matchesText(j, '')).toBe(true);
  });
  test('works for Bangla text', () => {
    expect(matchesText(job('1', { title: 'ডেটা অ্যানালিস্ট' }), 'ডেটা')).toBe(true);
  });
});

describe('filterJobs', () => {
  const jobs = [
    job('a', { type: 'internship', workplaceMode: 'remote', applicationDeadline: day(3) }),
    job('b', { type: 'job', applicationDeadline: day(30) }),
    job('c', { type: 'job', applicationDeadline: day(-1) }), // deadline passed
    job('d', { type: 'job', closed: true }),
    job('e', { type: 'other', requiredSkills: [{ skillKey: 'sql' }] }),
  ];
  const ids = (l) => l.map((j) => j._id);
  const base = parseParams({});
  test('closed jobs and jobs past their deadline never appear', () => {
    expect(ids(filterJobs(jobs, base, { now: NOW }))).toEqual(['a', 'b', 'e']);
  });
  test('type and mode', () => {
    expect(ids(filterJobs(jobs, parseParams({ type: 'internship' }), { now: NOW }))).toEqual(['a']);
    expect(ids(filterJobs(jobs, parseParams({ mode: 'remote' }), { now: NOW }))).toEqual(['a']);
  });
  test('closing soon means a deadline within 7 days; no deadline is not closing soon', () => {
    expect(ids(filterJobs(jobs, parseParams({ closingSoon: 'true' }), { now: NOW }))).toEqual(['a']);
  });
  test('hide applied and saved only use the student sets', () => {
    expect(ids(filterJobs(jobs, parseParams({ hideApplied: 'true' }), { now: NOW, applied: new Set(['a']) }))).toEqual(['b', 'e']);
    expect(ids(filterJobs(jobs, parseParams({ savedOnly: 'true' }), { now: NOW, saved: new Set(['b', 'c']) }))).toEqual(['b']);
  });
  test('minimum fit keeps scored jobs at or above it, keeps jobs with no listed skills, drops unscored jobs that list skills', () => {
    const fit = new Map([['a', 80], ['b', 40]]);
    // e lists skills but has no fit entry (not scored) so it is dropped; a passes; b is too low.
    expect(ids(filterJobs(jobs, parseParams({ minFit: '60' }), { now: NOW, fit }))).toEqual(['a']);
  });
  test('filters combine', () => {
    expect(ids(filterJobs(jobs, parseParams({ q: 'sql', type: 'other' }), { now: NOW }))).toEqual(['e']);
    expect(ids(filterJobs(jobs, parseParams({ q: 'sql', type: 'internship', mode: 'remote' }), { now: NOW }))).toEqual(['a']);
    expect(ids(filterJobs(jobs, parseParams({ q: 'sql', type: 'internship', mode: 'hybrid' }), { now: NOW }))).toEqual([]);
  });
});

describe('sortJobs', () => {
  const jobs = [
    job('old', { createdAt: day(-10), applicationDeadline: day(20) }),
    job('new', { createdAt: day(-1) }),
    job('soon', { createdAt: day(-5), applicationDeadline: day(2) }),
  ];
  const ids = (l) => l.map((j) => j._id);
  test('newest first by default', () => expect(ids(sortJobs(jobs, 'newest'))).toEqual(['new', 'soon', 'old']));
  test('deadline: soonest first, no deadline last', () => expect(ids(sortJobs(jobs, 'deadline'))).toEqual(['soon', 'old', 'new']));
  test('fit: highest first, unscored last, ties by newest', () => {
    const fit = new Map([['old', 70], ['soon', 70]]);
    expect(ids(sortJobs(jobs, 'fit', { fit }))).toEqual(['soon', 'old', 'new']);
  });
  test('does not change the input array', () => {
    const before = ids(jobs);
    sortJobs(jobs, 'deadline');
    expect(ids(jobs)).toEqual(before);
  });
});

describe('paginate and daysLeft', () => {
  const items = Array.from({ length: 45 }, (_, i) => i);
  test('pages', () => {
    expect(paginate(items, 1, 20)).toMatchObject({ total: 45, page: 1, limit: 20, hasMore: true });
    expect(paginate(items, 3, 20).items).toEqual([40, 41, 42, 43, 44]);
    expect(paginate(items, 3, 20).hasMore).toBe(false);
    expect(paginate(items, 9, 20).items).toEqual([]);
  });
  test('daysLeft rounds up and is null without a deadline', () => {
    expect(daysLeft(job('x', { applicationDeadline: day(2.2) }), NOW)).toBe(3);
    expect(daysLeft(job('x'), NOW)).toBeNull();
  });
});
