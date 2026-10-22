const request = require('supertest');
const { setup, teardown, bearer, mkUni, mkUser, models } = require('./helpers');
let app, edu, opp;
beforeAll(async () => {
  app = await setup();
  edu = await mkUni('EDU', 'EDU', 'Chattogram', 91.83, 22.35);
  await mkUser('adm', 'admin', null);
  await mkUser('mnt', 'mentor', edu);
  for (const s of ['a', 'b', 'c', 'd']) await mkUser(s, 'student', edu);
  await mkUser('dept', 'department', edu);
});
afterAll(teardown);
const job = (extra = {}) => ({ title: 'Junior Analyst', organization: 'Acme BD', description: 'Work with data and dashboards in a friendly team.', noFeeConfirmed: true, ...extra });

test('post requires no-fee confirmation; scam words are flagged and held', async () => {
  expect((await request(app).post('/api/opportunities').set(bearer('mnt')).send(job({ noFeeConfirmed: false }))).status).toBe(400);
  expect((await request(app).post('/api/opportunities').set(bearer('a')).send(job())).status).toBe(403);
  const r = await request(app).post('/api/opportunities').set(bearer('adm')).send(job({ description: 'Pay a registration fee via bKash to confirm your seat today.' }));
  expect(r.body.opportunity.suspiciousFlags.length).toBeGreaterThan(0);
  expect(r.body.opportunity.status).toBe('pending');
});
test('mentor post pending until admin approves; labels are separate', async () => {
  const p = await request(app).post('/api/opportunities').set(bearer('mnt')).send(job());
  opp = p.body.opportunity;
  expect(opp.status).toBe('pending');
  expect((await request(app).get('/api/opportunities').set(bearer('a'))).body.opportunities).toHaveLength(0);
  expect((await request(app).post(`/api/admin/opportunities/${opp._id}/review`).set(bearer('mnt')).send({ decision: 'approve' })).status).toBe(403);
  await request(app).post(`/api/admin/opportunities/${opp._id}/review`).set(bearer('adm')).send({ decision: 'approve' });
  const l = (await request(app).get('/api/opportunities').set(bearer('a'))).body.opportunities[0];
  expect(l.labels).toEqual({ source: 'verified_alumni', listingReviewed: true, noFeeDeclared: true });
});
test('apply needs consent, one application per post, 5-stage mapping, withdrawn separate', async () => {
  const cv = (await request(app).post('/api/me/cv').set(bearer('a')).send({ data: { summary: 'Hi' } })).body.cv;
  const ap = { cvVersionId: cv._id, consent: true };
  expect((await request(app).post(`/api/opportunities/${opp._id}/apply`).set(bearer('a')).send({ cvVersionId: cv._id })).status).toBe(400);
  const ok = await request(app).post(`/api/opportunities/${opp._id}/apply`).set(bearer('a')).send(ap);
  expect(ok.status).toBe(201);
  expect((await request(app).post(`/api/opportunities/${opp._id}/apply`).set(bearer('a')).send(ap)).status).toBe(409);
  const id = ok.body.application.id;
  const st = await request(app).patch(`/api/applications/${id}/stage`).set(bearer('mnt')).send({ stage: 'Hired' });
  expect(st.body.studentSees).toBe('Selected');
  await request(app).patch(`/api/applications/${id}/stage`).set(bearer('mnt')).send({ stage: 'Under Review' });
  expect((await request(app).get('/api/me/applications').set(bearer('a'))).body.applications[0].stage).toBe('Applied');
  const list = await request(app).get(`/api/opportunities/${opp._id}/applications`).set(bearer('mnt'));
  expect(list.body.applications[0].department).toBeUndefined(); // not consented
  expect((await request(app).get(`/api/opportunities/${opp._id}/applications`).set(bearer('b'))).status).toBe(403);
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
