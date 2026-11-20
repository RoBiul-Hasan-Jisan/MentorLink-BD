// Admin job overview rules (pure logic, no database).
const { parseAdminParams, countByStage, groupBy, jobRow, totals, filterAdminJobs, applicantRow } = require('../src/services/adminjobs');

const job = (id, o = {}) => ({ _id: id, title: 'Data Analyst', organization: 'Acme', status: 'approved', description: 'SQL reports', ...o });

describe('parseAdminParams', () => {
  test('defaults to all statuses, first page of 30', () => {
    expect(parseAdminParams({})).toEqual({ status: 'all', q: '', page: 1, limit: 30 });
  });
  test('accepts a real status and text', () => {
    expect(parseAdminParams({ status: 'hidden', q: ' ACME ', page: '2', limit: '100' })).toEqual({ status: 'hidden', q: 'acme', page: 2, limit: 100 });
  });
  test('rejects bad values with BAD_QUERY', () => {
    for (const b of [{ status: 'nope' }, { page: '0' }, { limit: '101' }, { q: 'a'.repeat(81) }]) expect(() => parseAdminParams(b)).toThrow('BAD_QUERY');
  });
});

describe('counting', () => {
  const apps = [{ opportunityId: 'a', stage: 'Applied' }, { opportunityId: 'a', stage: 'Applied' }, { opportunityId: 'a', stage: 'Withdrawn' }, { opportunityId: 'b', stage: 'Interview' }];
  test('countByStage leaves out empty stages', () => {
    expect(countByStage(apps.filter((a) => a.opportunityId === 'a'))).toEqual({ Applied: 2, Withdrawn: 1 });
    expect(countByStage([])).toEqual({});
  });
  test('groupBy groups rows by job id (ids compared as strings)', () => {
    const g = groupBy(apps, 'opportunityId');
    expect(g.get('a')).toHaveLength(3);
    expect(g.get('b')).toHaveLength(1);
    expect(g.get('zzz')).toBeUndefined();
  });
});

describe('jobRow', () => {
  test('active applications exclude withdrawn ones; total includes them', () => {
    const r = jobRow(job('a'), [{ stage: 'Applied' }, { stage: 'Withdrawn' }], 3, 'Mina');
    expect(r.applications).toEqual({ total: 2, active: 1, byStage: { Applied: 1, Withdrawn: 1 } });
    expect(r.saved).toBe(3);
    expect(r.postedByName).toBe('Mina');
  });
  test('a job nobody applied to has zeros, not undefined', () => {
    const r = jobRow(job('b'));
    expect(r.applications).toEqual({ total: 0, active: 0, byStage: {} });
    expect(r.suspiciousFlags).toEqual([]);
    expect(r.reportCount).toBe(0);
  });
});

describe('totals and filter', () => {
  const jobs = [job('a'), job('b', { status: 'pending' }), job('c', { status: 'hidden', title: 'Designer' })];
  const appsBy = new Map([['a', [{}, {}]], ['c', [{}]]]);
  const savesBy = new Map([['b', [{}]]]);
  test('totals cover every job by status, with applications and saves', () => {
    expect(totals(jobs, appsBy, savesBy)).toEqual({ jobs: 3, byStatus: { approved: 1, pending: 1, hidden: 1 }, applications: 3, saved: 1 });
  });
  test('filter by status and text', () => {
    expect(filterAdminJobs(jobs, parseAdminParams({ status: 'pending' })).map((j) => j._id)).toEqual(['b']);
    expect(filterAdminJobs(jobs, parseAdminParams({ q: 'designer' })).map((j) => j._id)).toEqual(['c']);
    expect(filterAdminJobs(jobs, parseAdminParams({})).length).toBe(3);
  });
});

describe('applicantRow', () => {
  test('shows name, department, stage and date only', () => {
    const r = applicantRow({ _id: 'x', stage: 'Interview', createdAt: 'd', applicantNote: 'secret', cvVersionId: 'cv' }, { displayName: 'Sara', department: 'CSE', email: 'sara@x.com' });
    expect(r).toEqual({ id: 'x', name: 'Sara', department: 'CSE', stage: 'Interview', withdrawn: false, appliedAt: 'd' });
    expect(JSON.stringify(r)).not.toContain('secret');
    expect(JSON.stringify(r)).not.toContain('sara@x.com');
  });
  test('a deleted student is shown as Deleted user', () => {
    expect(applicantRow({ _id: 'x', stage: 'Withdrawn' }, undefined)).toMatchObject({ name: 'Deleted user', withdrawn: true });
  });
});
