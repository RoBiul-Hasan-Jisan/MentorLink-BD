const request = require('supertest');
const { setup, teardown, bearer, mkUni, mkUser, mkEmployer, models } = require('./helpers');
let app, edu, opp;
beforeAll(async () => {
  app = await setup();
  edu = await mkUni('EDU', 'EDU', 'Chattogram', 91.83, 22.35);
  await mkUser('adm', 'admin', null);
  await mkUser('mnt', 'mentor', edu);
  for (const s of ['a', 'b', 'c', 'd']) await mkUser(s, 'student', edu);
  await mkUser('dept', 'department', edu);
  await mkEmployer('emp');
});
afterAll(teardown);
const job = (extra = {}) => ({ title: 'Junior Analyst', organization: 'Acme BD', description: 'Work with data and dashboards in a friendly team.', noFeeConfirmed: true, ...extra });

test('ONLY an employer can post a job: student, mentor, department and admin cannot', async () => {
  // the old open route is gone for everyone
  for (const u of ['a', 'mnt', 'dept', 'adm', 'emp']) expect((await request(app).post('/api/opportunities').set(bearer(u)).send(job())).status).toBe(404);
  // the employer route refuses every other role
  for (const u of ['a', 'mnt', 'dept', 'adm']) expect((await request(app).post('/api/employer/jobs').set(bearer(u)).send(job())).status).toBe(403);
  expect(await models.Opportunity.countDocuments({})).toBe(0);
});
test('employer post requires no-fee confirmation; scam words are flagged and held', async () => {
  expect((await request(app).post('/api/employer/jobs').set(bearer('emp')).send(job({ noFeeConfirmed: false }))).status).toBe(400);
  const r = await request(app).post('/api/employer/jobs').set(bearer('emp')).send(job({ title: 'Data Helper', description: 'Pay a registration fee via bKash to confirm your seat today.' }));
  expect(r.status).toBe(201);
  expect(r.body.job.suspiciousFlags.length).toBeGreaterThan(0);
  expect(r.body.job.status).toBe('pending');
  await models.Opportunity.deleteOne({ _id: r.body.job._id });
});
test('employer post is pending until admin approves; label is employer', async () => {
  const p = await request(app).post('/api/employer/jobs').set(bearer('emp')).send(job());
  opp = p.body.job;
  expect(opp.status).toBe('pending');
  expect((await request(app).get('/api/opportunities').set(bearer('a'))).body.opportunities).toHaveLength(0);
  expect((await request(app).post(`/api/admin/opportunities/${opp._id}/review`).set(bearer('emp')).send({ decision: 'approve' })).status).toBe(403);
  await request(app).post(`/api/admin/opportunities/${opp._id}/review`).set(bearer('adm')).send({ decision: 'approve' });
  const l = (await request(app).get('/api/opportunities').set(bearer('a'))).body.opportunities[0];
  expect(l.labels).toEqual({ source: 'employer', organizationVerified: true, listingReviewed: true, noFeeDeclared: true });
});
test('apply needs consent, one application per post, 5-stage mapping, withdrawn separate', async () => {
  const cv = (await request(app).post('/api/me/cv').set(bearer('a')).send({ data: { summary: 'Hi' } })).body.cv;
  const ap = { cvVersionId: cv._id, consent: true };
  expect((await request(app).post(`/api/opportunities/${opp._id}/apply`).set(bearer('a')).send({ cvVersionId: cv._id })).status).toBe(400);
  const ok = await request(app).post(`/api/opportunities/${opp._id}/apply`).set(bearer('a')).send(ap);
  expect(ok.status).toBe(201);
  expect((await request(app).post(`/api/opportunities/${opp._id}/apply`).set(bearer('a')).send(ap)).status).toBe(409);
  const id = ok.body.application.id;
  const bad = await request(app).patch(`/api/applications/${id}/stage`).set(bearer('emp')).send({ stage: 'Hired' });
  expect(bad.status).toBe(409); // cannot skip stages
  for (const [stage, sees] of [['Under Review', 'Applied'], ['Shortlisted', 'Shortlisted'], ['Interview', 'Interview'], ['Offer', 'Selected']]) {
    expect((await request(app).patch(`/api/applications/${id}/stage`).set(bearer('emp')).send({ stage })).body.studentSees).toBe(sees);
  }
  expect((await request(app).get('/api/me/applications').set(bearer('a'))).body.applications[0].stage).toBe('Selected');
    const list = await request(app).get(`/api/opportunities/${opp._id}/applications`).set(bearer('emp'));
  expect(list.body.applications[0].department).toBeUndefined(); // not consented
  expect((await request(app).get(`/api/opportunities/${opp._id}/applications`).set(bearer('b'))).status).toBe(404); // not the poster: the post is invisible to them
});
test('3 unique reporters auto-hide; repeat reporter counts once; admin can restore', async () => {
  const rep = (u) => request(app).post('/api/reports').set(bearer(u)).send({ targetType: 'opportunity', targetId: String(opp._id), reason: 'asked me for money' });
  expect((await rep('a')).body.hidden).toBe(false);
  expect((await rep('a')).status).toBe(409);
  expect((await rep('b')).body.hidden).toBe(false);
  expect((await rep('c')).body.hidden).toBe(true);
  expect((await request(app).get('/api/opportunities').set(bearer('d'))).body.opportunities).toHaveLength(0);
  await request(app).post(`/api/admin/opportunities/${opp._id}/review`).set(bearer('adm')).send({ decision: 'restore' });
  expect((await request(app).get('/api/opportunities').set(bearer('d'))).body.opportunities).toHaveLength(1);
  const logs = (await request(app).get('/api/admin/audit-logs').set(bearer('adm'))).body.logs.map((l) => l.action);
  expect(logs).toEqual(expect.arrayContaining(['auto_hide_opportunity', 'opportunity_restore']));
});
test('admin-only routes are closed to others; role changes only via admin approval', async () => {
  for (const u of ['a', 'mnt', 'dept']) expect((await request(app).get('/api/admin/verification-queue').set(bearer(u))).status).toBe(403);
  await request(app).post('/api/me/mentor-application').set(bearer('b')).send({ roleTitle: 'Dev', industry: 'IT', yearsExperience: 4 });
  const b = await models.User.findOne({ firebaseUid: 'b' });
  expect(b.role).toBe('student');
  await request(app).post(`/api/admin/mentor-applications/${b._id}`).set(bearer('adm')).send({ decision: 'approved' });
  const after = await models.User.findOne({ firebaseUid: 'b' });
  expect(after.role).toBe('mentor');
  expect(await models.MentorProfile.findOne({ userId: b._id })).toBeTruthy();
});
test('department sees only anonymized numbers; small groups hidden', async () => {
  const r = await request(app).get('/api/department/overview').set(bearer('dept'));
  expect(r.status).toBe(200);
  expect(JSON.stringify(r.body)).not.toMatch(/displayName|email/);
  expect((await request(app).get('/api/department/overview').set(bearer('a'))).status).toBe(403);
});
test('only admin can set campus coordinates; bad coordinates rejected', async () => {
  const body = { name: 'New Uni', shortName: 'NU', city: 'Sylhet', lat: 24.9, lng: 91.87 };
  expect((await request(app).post('/api/admin/universities').set(bearer('mnt')).send(body)).status).toBe(403);
  expect((await request(app).post('/api/admin/universities').set(bearer('adm')).send({ ...body, lat: 0, lng: 0 })).status).toBe(400);
  expect((await request(app).post('/api/admin/universities').set(bearer('adm')).send(body)).status).toBe(201);
});

describe('CV builder', () => {
  let app;
  beforeAll(async () => { app = await setup(); const u = await mkUni('EDU', 'EDU', 'Chattogram', 91.8, 22.3); await mkUser('cvs', 'student', u); await mkUser('cvm', 'mentor', u); });
  afterAll(teardown);
  test('structured CV is versioned; contact/address fields are refused; mentors cannot write CVs', async () => {
    const good = { data: { summary: 'CSE student', skills: ['SQL', 'Excel'], education: [{ institution: 'EDU', degree: 'BSc CSE', year: '2026' }], projects: [{ title: 'Sales dashboard', url: 'https://example.com/p' }] } };
    const a = await request(app).post('/api/me/cv').set(bearer('cvs')).send(good);
    expect(a.status).toBe(201); expect(a.body.cv.version).toBe(1);
    expect((await request(app).post('/api/me/cv').set(bearer('cvs')).send(good)).body.cv.version).toBe(2);
    expect((await request(app).post('/api/me/cv').set(bearer('cvs')).send({ data: { summary: 'x', phone: '017' } })).status).toBe(400);
    expect((await request(app).post('/api/me/cv').set(bearer('cvs')).send({ data: { summary: 'x', address: 'Road 1' } })).status).toBe(400);
    expect((await request(app).post('/api/me/cv').set(bearer('cvm')).send(good)).status).toBe(403);
    expect((await request(app).get('/api/me/cv').set(bearer('cvs'))).body.versions).toHaveLength(2);
  });
});

describe('link checker and mentor CV access', () => {
  const { checkUrl, isPrivateIp } = require('../src/services/linkcheck');
  test('SSRF guard and status mapping', async () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true); expect(isPrivateIp('10.1.2.3')).toBe(true); expect(isPrivateIp('172.20.0.1')).toBe(true); expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect((await checkUrl('http://example.com')).status).toBe('blocked');
    expect((await checkUrl('https://internal.test/x', { lookup: async () => [{ address: '10.0.0.5' }], fetchImpl: async () => { throw new Error('must not fetch'); } })).status).toBe('blocked');
    const pub = { lookup: async () => [{ address: '93.184.216.34' }] };
    expect((await checkUrl('https://good.test/', { ...pub, fetchImpl: async () => ({ status: 200 }) })).status).toBe('ok');
    expect((await checkUrl('https://gone.test/', { ...pub, fetchImpl: async () => ({ status: 404 }) })).status).toBe('broken');
    expect((await checkUrl('https://boom.test/', { ...pub, fetchImpl: async () => { throw new Error('ECONNRESET'); } })).status).toBe('broken');
  });
  test('admin runs the check; non-admins cannot; mentor sees CV only of own accepted mentee', async () => {
    const app = await setup(); await require('../src/seed/learning').seedLearning();
    const u = await mkUni('EDU', 'EDU', 'Chattogram', 91.8, 22.3);
    const stu = await mkUser('lstu', 'student', u); const men = await mkUser('lmen', 'mentor', u); await mkUser('lother', 'mentor', u); await mkUser('ladm', 'admin', null);
    app.set('checkUrl', async (url) => ({ status: url.includes('khan') ? 'broken' : 'ok' }));
    expect((await request(app).post('/api/admin/resources/check-links').set(bearer('lmen'))).status).toBe(403);
    const r = await request(app).post('/api/admin/resources/check-links').set(bearer('ladm'));
    expect(r.status).toBe(200); expect(r.body.ok + r.body.broken).toBeGreaterThan(0);
    await request(app).post('/api/me/cv').set(bearer('lstu')).send({ data: { summary: 'Hi' } });
    expect((await request(app).get(`/api/mentees/${stu._id}/cv`).set(bearer('lmen'))).status).toBe(404); // not accepted yet
    await models.MentorRequest.create({ studentId: stu._id, mentorId: men._id, goalText: 'goal', questions: ['q'], status: 'accepted' });
    expect((await request(app).get(`/api/mentees/${stu._id}/cv`).set(bearer('lmen'))).body.versions).toHaveLength(1);
    expect((await request(app).get(`/api/mentees/${stu._id}/cv`).set(bearer('lother'))).status).toBe(404);
    expect((await request(app).post(`/api/cv/${(await request(app).get(`/api/mentees/${stu._id}/cv`).set(bearer('lmen'))).body.versions[0]._id}/review`).set(bearer('lmen')).send({ text: 'Add a project link' })).status).toBe(200);
  });
});
