// Job-portal improvements: richer posts, edit/draft/repost, screening questions, ranked applicants, stats, filters,
// similar jobs, company page, match alerts, saved-job reminders, slow-employer nudges, auto-close, bulk review.
const request = require('supertest');
const { setup, teardown, bearer, mkUni, mkUser, mkEmployer, models } = require('./helpers');
const jt = require('../src/services/jobtools');
let app, edu;
const api = (m, url, who, body) => { const q = request(app)[m](`/api${url}`).set(bearer(who)); return body === undefined ? q : q.send(body); };
const job = (extra = {}) => ({ title: 'Junior Excel Analyst', description: 'Clean data and build reports for a friendly finance team.', noFeeConfirmed: true, ...extra });
const days = (n) => new Date(Date.now() + n * 864e5);

beforeAll(async () => {
  app = await setup();
  edu = await mkUni('EDU', 'EDU', 'Chattogram', 91.83, 22.35);
  await mkUser('adm', 'admin', null);
  await mkUser('mnt', 'mentor', edu);
  for (const s of ['s1', 's2', 's3']) await mkUser(s, 'student', edu);
  await mkEmployer('e1', 'Acme BD');
  await mkEmployer('e2', 'Beta BD');
  await models.Skill.create({ key: 'excel', nameEn: 'Excel', nameBn: 'Excel' });
});
afterAll(teardown);

test('richer post: salary, vacancies, experience, screening questions; bad salary refused', async () => {
  expect((await api('post', '/employer/jobs', 'e1', job({ salaryMin: 20000, salaryMax: 10000 }))).status).toBe(400);
  expect((await api('post', '/employer/jobs', 'e1', job({ screeningQuestions: ['a', 'b', 'c', 'd'] }))).status).toBe(400); // three at most
  const r = await api('post', '/employer/jobs', 'e1', job({ salaryMin: 15000, salaryMax: 25000, vacancies: 3, experienceLevel: 'fresher', screeningQuestions: ['Why do you want this job?'], locationText: 'Chattogram', requiredSkills: [{ skillKey: 'excel', requiredLevel: 2, weight: 1 }] }));
  expect(r.status).toBe(201);
  expect(r.body.job).toMatchObject({ salaryMin: 15000, salaryMax: 25000, vacancies: 3, experienceLevel: 'fresher', status: 'pending' });
  await api('post', `/admin/opportunities/${r.body.job._id}/review`, 'adm', { decision: 'approve' });
});

test('draft is private; submit sends it through the same review rules', async () => {
  const d = await api('post', '/employer/jobs', 'e1', job({ title: 'Draft Role', saveAsDraft: true, noFeeConfirmed: false }));
  expect(d.status).toBe(201); expect(d.body.job.status).toBe('draft');
  expect((await api('get', '/opportunities', 's1')).body.opportunities.map((o) => o.title)).not.toContain('Draft Role');
  expect((await api('post', `/employer/jobs/${d.body.job._id}/submit`, 'e1', { noFeeConfirmed: false })).status).toBe(400);
  const sub = await api('post', `/employer/jobs/${d.body.job._id}/submit`, 'e1', { noFeeConfirmed: true });
  expect(sub.body.job.status).toBe('pending'); // every post waits for admin approval
  expect((await api('post', `/employer/jobs/${d.body.job._id}/submit`, 'e1', { noFeeConfirmed: true })).status).toBe(409); // not a draft any more
});

test('edit: owner only; money words send a live job back to review; admin-removed jobs cannot be edited', async () => {
  const mine = (await api('get', '/employer/jobs', 'e1')).body.jobs.find((j) => j.title === 'Draft Role');
  expect((await api('patch', `/employer/jobs/${mine._id}`, 'e2', { title: 'Hacked' })).status).toBe(404);
  expect((await api('patch', `/employer/jobs/${mine._id}`, 's1', { title: 'Hacked' })).status).toBe(403);
  const ok = await api('patch', `/employer/jobs/${mine._id}`, 'e1', { title: 'Draft Role, edited', vacancies: 2 });
  expect(ok.body.job).toMatchObject({ title: 'Draft Role, edited', vacancies: 2, status: 'pending' });
  const bad = await api('patch', `/employer/jobs/${mine._id}`, 'e1', { description: 'Pay a registration fee via bKash to confirm your seat today.' });
  expect(bad.body.job.status).toBe('pending');
  await models.Opportunity.updateOne({ _id: mine._id }, { status: 'removed' });
  expect((await api('patch', `/employer/jobs/${mine._id}`, 'e1', { title: 'Again' })).status).toBe(403);
});

test('students see salary / city / experience filters, similar jobs and the company page', async () => {
  const board = (q) => api('get', `/opportunities?${q}`, 's1').then((r) => r.body.opportunities.map((o) => o.title));
  expect(await board('minSalary=20000')).toEqual(['Junior Excel Analyst']);
  expect(await board('minSalary=90000')).toEqual([]);
  expect(await board('city=chattogram')).toEqual(['Junior Excel Analyst']);
  expect(await board('city=dhaka')).toEqual([]);
  expect(await board('experience=fresher')).toEqual(['Junior Excel Analyst']);
  expect((await api('get', '/opportunities?experience=wizard', 's1')).status).toBe(400);
  const j = (await api('get', '/opportunities', 's1')).body.opportunities[0];
  expect(j.companyId).toBeTruthy();
  const co = await api('get', `/companies/${j.companyId}`, 's1');
  expect(co.status).toBe(200);
  expect(co.body.company.name).toBe('Acme BD');
  expect(JSON.stringify(co.body)).not.toMatch(/verificationEvidence|workEmail|hr@acme/); // never the private proof
  expect(co.body.jobs.map((x) => x.title)).toContain('Junior Excel Analyst');
  expect((await api('get', `/companies/${j.companyId}`, 'e1')).status).toBe(403); // employers do not browse other companies
  expect((await api('get', `/opportunities/${j.id}/similar`, 's1')).status).toBe(200);
});

test('screening questions must be answered; employer sees answers and ranked fit only when the student shared skills', async () => {
  const j = (await api('get', '/opportunities', 's1')).body.opportunities[0];
  const apply = async (who, body) => { const cv = (await api('post', '/me/cv', who, { data: { summary: who } })).body.cv; return api('post', `/opportunities/${j.id}/apply`, who, { cvVersionId: cv._id, consent: true, ...body }); };
  expect((await apply('s1', { answers: [] })).status).toBe(400); // question not answered
  const stu = async (u) => (await models.User.findOne({ firebaseUid: u }))._id;
  await models.SkillEvidence.create({ studentId: await stu('s1'), skillKey: 'excel', type: 'quiz', level: 3 });
  await models.SkillEvidence.create({ studentId: await stu('s2'), skillKey: 'excel', type: 'self', level: 1 });
  expect((await apply('s1', { answers: ['I like data.'], sharedFields: ['name', 'cv', 'skills'] })).status).toBe(201);
  expect((await apply('s2', { answers: ['I need experience.'], sharedFields: ['name', 'cv', 'skills'] })).status).toBe(201);
  expect((await apply('s3', { answers: ['Hello there.'], sharedFields: ['name', 'cv'] })).status).toBe(201); // did not share skills
  const list = (await api('get', `/employer/jobs/${j.id}/applicants`, 'e1')).body;
  expect(list.job.screeningQuestions).toHaveLength(1);
  expect(list.applicants.map((a) => a.fit)).toEqual([100, 50, undefined]); // best fit first; no fit without consent
  expect(list.applicants[0].answers).toEqual(['I like data.']);
  expect((await api('get', `/employer/jobs/${j.id}/applicants?stage=Shortlisted`, 'e1')).body.applicants).toHaveLength(0);
  expect((await api('get', `/employer/jobs/${j.id}/applicants?sort=magic`, 'e1')).status).toBe(400);
  // stats: views counted when students open the job
  await api('get', `/opportunities/${j.id}`, 's1');
  const st = (await api('get', `/employer/jobs/${j.id}/stats`, 'e1')).body;
  expect(st.applications).toBe(3); expect(st.views).toBeGreaterThanOrEqual(1);
  expect((await api('get', `/employer/jobs/${j.id}/stats`, 'e2')).status).toBe(404);
});

test('match alert goes to students whose skills fit, not to others, and respects the switch', async () => {
  await models.User.updateOne({ firebaseUid: 's2' }, { jobAlertsOn: false });
  const created = (await api('post', '/employer/jobs', 'e1', job({ title: 'Excel Reporting Intern', requiredSkills: [{ skillKey: 'excel', requiredLevel: 2, weight: 1 }] }))).body.job;
  expect(created.status).toBe('pending'); // goes live only after admin approval
  await models.Opportunity.updateOne({ _id: created._id }, { status: 'approved' });
  await require('../src/services/jobtools').alertMatchingStudents(await models.Opportunity.findById(created._id)); // what the admin approve step triggers
  const got = async (u) => models.Notification.countDocuments({ userId: (await models.User.findOne({ firebaseUid: u }))._id, title: /fits your skills/ });
  expect(await got('s1')).toBe(1);
  expect(await got('s2')).toBe(0); // switched off
  expect(await got('s3')).toBe(0); // no matching skills
});

test('upkeep: expired jobs close; saved-job and slow-applicant reminders are sent once', async () => {
  const o = await models.Opportunity.create({ postedBy: (await models.User.findOne({ firebaseUid: 'e1' }))._id, organizationId: (await models.Organization.findOne({ name: 'Acme BD' }))._id, organization: 'Acme BD', title: 'Closing soon', description: 'x'.repeat(30), sourceLabel: 'employer', status: 'approved', applicationDeadline: days(1) });
  const s2 = await models.User.findOne({ firebaseUid: 's2' });
  await models.SavedJob.create({ studentId: s2._id, opportunityId: o._id });
  expect(await jt.remindSavedJobs()).toBe(1);
  expect(await jt.remindSavedJobs()).toBe(0); // once only
  await models.Opportunity.updateOne({ _id: o._id }, { applicationDeadline: days(-1) });
  expect(await jt.closeExpiredJobs()).toBeGreaterThanOrEqual(1);
  expect((await models.Opportunity.findById(o._id)).closed).toBe(true);
  // an applicant waiting 10 days in "Applied" nudges the employer once per job
  const j = (await api('get', '/opportunities', 's1')).body.opportunities.find((x) => x.title === 'Excel Reporting Intern');
  const cv = (await api('post', '/me/cv', 's3', { data: { summary: 's3' } })).body.cv;
  await api('post', `/opportunities/${j.id}/apply`, 's3', { cvVersionId: cv._id, consent: true });
  await models.Application.updateMany({ opportunityId: j.id }, { createdAt: days(-10) });
  expect(await jt.nudgeSlowEmployers()).toBe(1);
  expect(await jt.nudgeSlowEmployers()).toBe(0);
});

test('response stats need at least 3 old applications; then show a reply rate', async () => {
  const org = await models.Organization.findOne({ name: 'Beta BD' });
  expect((await jt.responseStats(org._id)).responseRate).toBeNull();
});

test('admin bulk review: pending only, audited, poster told; others cannot', async () => {
  const a = (await api('post', '/employer/jobs', 'e2', job({ title: 'Bulk A' }))).body.job;
  const b = (await api('post', '/employer/jobs', 'e2', job({ title: 'Bulk B', description: 'Pay a registration fee via bKash to confirm your seat today.' }))).body.job;
  expect([a.status, b.status]).toEqual(['pending', 'pending']);
  expect((await api('post', '/admin/opportunities/bulk-review', 'e2', { ids: [a._id], decision: 'approve' })).status).toBe(403);
  const r = await api('post', '/admin/opportunities/bulk-review', 'adm', { ids: [a._id, b._id, a._id], decision: 'approve' });
  expect(r.body.done).toBe(2); expect(r.body.skipped).toHaveLength(1); // the repeated id is already approved
  const q = (await api('get', '/admin/verification-queue', 'adm')).body;
  expect(q.opportunities.every((o) => typeof o.overdue === 'boolean')).toBe(true);
  expect(await models.AuditLog.countDocuments({ action: 'opportunity_approve' })).toBeGreaterThanOrEqual(2);
});

// ---------------------------------------------------------------- who can do what
describe('access matrix: each role reaches only its own functions; admin reaches the admin ones', () => {
  const roles = { student: 's1', mentor: 'mnt', employer: 'e1', admin: 'adm' };
  const cases = [
    // [method, path, roles that may call it (anyone else must get 403)]
    ['get', '/employer/jobs', ['employer']],
    ['post', '/employer/jobs', ['employer']],
    ['get', '/me/jobs', ['employer']],
    ['get', '/admin/verification-queue', ['admin']],
    ['post', '/admin/opportunities/bulk-review', ['admin']],
    ['get', '/admin/organizations', ['admin']],
    ['get', '/me/applications', ['student']],
    ['get', '/roadmaps', ['student', 'mentor', 'admin']],
    ['get', '/resources', ['student', 'mentor', 'admin']],
    ['get', '/directory/universities', ['student', 'mentor', 'admin']],
    ['get', '/feed', ['student', 'mentor', 'admin']],
    ['get', '/opportunities', ['student', 'mentor', 'admin']],
    ['get', '/department/analytics', ['admin']],
  ];
  for (const [method, path, allowed] of cases) {
    test(`${method.toUpperCase()} ${path} -> ${allowed.join(', ')}`, async () => {
      for (const [role, uid] of Object.entries(roles)) {
        const res = await api(method, path, uid, method === 'get' ? undefined : {});
        if (allowed.includes(role)) expect(res.status).not.toBe(403);
        else expect(res.status).toBe(403);
      }
    });
  }
  test('a signed-out request gets 401 on every one of them', async () => {
    for (const [method, path] of cases) expect((await request(app)[method](`/api${path}`)).status).toBe(401);
  });
});
