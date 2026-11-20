// API tests for the audit fixes. These need MongoDB (TEST_MONGODB_URI, database name ending _test), like the other suites.
const request = require('supertest');
const { setup, teardown, bearer, mkUni, mkUser, models } = require('./helpers');
let app, uni, stu, mnt, adm, req1;
beforeAll(async () => {
  app = await setup();
  uni = await mkUni('Audit Uni', 'AU', 'Dhaka', 90.4, 23.7);
  stu = await mkUser('a_stu', 'student', uni);
  mnt = await mkUser('a_mnt', 'mentor', uni);
  adm = await mkUser('a_adm', 'admin', uni);
  await models.MentorProfile.create({ userId: mnt._id, weeklyCapacity: 5, roleTitle: 'Dev', industry: 'IT' });
  req1 = await models.MentorRequest.create({ studentId: stu._id, mentorId: mnt._id, goalText: 'learn sql', questions: ['how?'], status: 'accepted' });
});
afterAll(teardown);

test('sessions: https meeting link required, past time refused', async () => {
  const future = new Date(Date.now() + 864e5).toISOString();
  const base = { requestId: String(req1._id), startsAt: future };
  expect((await request(app).post('/api/sessions').set(bearer('a_mnt')).send({ ...base, meetingLink: 'javascript:alert(1)' })).status).toBe(400);
  expect((await request(app).post('/api/sessions').set(bearer('a_mnt')).send({ ...base, startsAt: new Date(Date.now() - 1e5).toISOString() })).status).toBe(400);
  const ok = await request(app).post('/api/sessions').set(bearer('a_mnt')).send({ ...base, meetingLink: 'meet.google.com/abc' });
  expect(ok.status).toBe(201);
  expect(ok.body.session.meetingLink).toBe('https://meet.google.com/abc');
});

test('notifications carry a target and an unread count', async () => {
  const r = await request(app).get('/api/notifications').set(bearer('a_stu'));
  expect(r.status).toBe(200);
  expect(typeof r.body.unreadCount).toBe('number');
  const n = r.body.notifications.find((x) => x.title === 'Session scheduled');
  expect(n.target.type).toBe('session');
});

test('reports: target must exist, no self report, admin queue hides reporter', async () => {
  const bad = await request(app).post('/api/reports').set(bearer('a_stu')).send({ targetType: 'user', targetId: '64b0c0ffee64b0c0ffee1234', reason: 'spam spam' });
  expect(bad.status).toBe(404);
  expect((await request(app).post('/api/reports').set(bearer('a_stu')).send({ targetType: 'user', targetId: String(stu._id), reason: 'myself' })).status).toBe(400);
  expect((await request(app).post('/api/reports').set(bearer('a_stu')).send({ targetType: 'user', targetId: String(mnt._id), reason: 'asked for money' })).status).toBe(201);
  expect((await request(app).get('/api/admin/reports').set(bearer('a_stu'))).status).toBe(403);
  const q = await request(app).get('/api/admin/reports').set(bearer('a_adm'));
  expect(q.status).toBe(200);
  expect(JSON.stringify(q.body)).not.toContain(String(stu._id));
  const id = q.body.reports[0].id;
  expect((await request(app).post(`/api/admin/reports/${id}/resolve`).set(bearer('a_adm')).send({ decision: 'actioned' })).status).toBe(200);
  expect((await request(app).post(`/api/admin/reports/${id}/resolve`).set(bearer('a_adm')).send({ decision: 'actioned' })).status).toBe(404);
});

test('request decision is applied once; /ready reports database state', async () => {
  const r2 = await models.MentorRequest.create({ studentId: stu._id, mentorId: mnt._id, goalText: 'second', questions: ['q?'] });
  const [a, b] = await Promise.all([1, 2].map(() => request(app).post(`/api/requests/${r2._id}/decision`).set(bearer('a_mnt')).send({ decision: 'accept' })));
  expect([a.status, b.status].sort()).toEqual([200, 409]);
  expect((await request(app).get('/ready')).status).toBe(200);
});
