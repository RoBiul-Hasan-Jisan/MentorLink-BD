const request = require('supertest');
const { setup, teardown, bearer, mkUni, mkUser, models } = require('./helpers');
let app, edu, mentor, mp, stu1, stu2, stu3;
const body = (mid) => ({ mentorId: String(mid), goalText: 'I want to be a data analyst', questions: ['How do I start?'] });
beforeAll(async () => {
  app = await setup();
  edu = await mkUni('EDU', 'EDU', 'Chattogram', 91.83, 22.35);
  mentor = await mkUser('mnt', 'mentor', edu);
  mp = await models.MentorProfile.create({ userId: mentor._id, weeklyCapacity: 2 });
  stu1 = await mkUser('s1', 'student', edu); stu2 = await mkUser('s2', 'student', edu); stu3 = await mkUser('s3', 'student', edu);
  await mkUser('other', 'mentor', edu);
});
afterAll(teardown);

let reqId;
test('request, accept, chat only after accept', async () => {
  const r = await request(app).post('/api/requests').set(bearer('s1')).send(body(mentor._id));
  expect(r.status).toBe(201); reqId = r.body.request._id;
  expect((await request(app).post('/api/requests').set(bearer('s1')).send(body(mentor._id))).body.error.code).toBe('REQUEST_EXISTS');
  expect((await request(app).get(`/api/requests/${reqId}/messages`).set(bearer('s1'))).status).toBe(403); // not accepted
  expect((await request(app).post(`/api/requests/${reqId}/decision`).set(bearer('s1')).send({ decision: 'accept' })).status).toBe(403); // student cannot accept
  expect((await request(app).post(`/api/requests/${reqId}/decision`).set(bearer('mnt')).send({ decision: 'accept' })).status).toBe(200);
  expect((await request(app).post(`/api/requests/${reqId}/messages`).set(bearer('s1')).send({ text: 'Hello' })).status).toBe(201);
  expect((await request(app).get(`/api/requests/${reqId}/messages`).set(bearer('mnt'))).body.messages).toHaveLength(1);
});
test('outsiders cannot read the chat', async () => {
  expect((await request(app).get(`/api/requests/${reqId}/messages`).set(bearer('s2'))).status).toBe(404);
  expect((await request(app).get(`/api/requests/${reqId}/messages`).set(bearer('other'))).status).toBe(404);
});
test('session -> notes -> tasks in four-week plan; student marks done', async () => {
  const s = await request(app).post('/api/sessions').set(bearer('mnt')).send({ requestId: reqId, startsAt: new Date(Date.now() + 864e5).toISOString() });
  expect(s.status).toBe(201);
  const c = await request(app).post(`/api/sessions/${s.body.session._id}/complete`).set(bearer('mnt')).send({ notes: 'Good start', nextSteps: [{ text: 'Finish SQL joins course', week: 1 }, { text: 'Build one dashboard', week: 3 }] });
  expect(c.status).toBe(200);
  const plan = await request(app).get('/api/me/plan').set(bearer('s1'));
  expect(plan.body.tasks).toHaveLength(2);
  const tid = plan.body.tasks[0]._id;
  expect((await request(app).patch(`/api/tasks/${tid}`).set(bearer('mnt')).send({ status: 'done' })).status).toBe(403);
  expect((await request(app).patch(`/api/tasks/${tid}`).set(bearer('mnt')).send({ mentorComment: 'Nice' })).status).toBe(200);
  expect((await request(app).patch(`/api/tasks/${tid}`).set(bearer('s1')).send({ status: 'done' })).status).toBe(200);
  expect((await request(app).get('/api/me/plan').set(bearer('s1'))).body.progress).toBe(50);
  expect((await request(app).get('/api/me/plan').set(bearer('s1'))).body.streak).toBe(1); // one task completed today
  const sl = await request(app).get('/api/sessions').set(bearer('s1'));
  expect(sl.body.sessions[0].withName).toBeTruthy(); // mentor name shown on the Home card
  expect((await request(app).get('/api/me/plan').set(bearer('s2'))).body.tasks).toHaveLength(0);
});
test('capacity cap and auto-pause', async () => {
  const r2 = await request(app).post('/api/requests').set(bearer('s2')).send(body(mentor._id));
  expect(r2.status).toBe(201);
  await request(app).post(`/api/requests/${r2.body.request._id}/decision`).set(bearer('mnt')).send({ decision: 'accept' });
  expect((await models.MentorProfile.findOne({ userId: mentor._id })).paused).toBe(true);
  const r3 = await request(app).post('/api/requests').set(bearer('s3')).send(body(mentor._id));
  expect(r3.status).toBe(409);
});
test('student cannot set reliability counters via mentor profile', async () => {
  expect((await request(app).put('/api/me/mentor-profile').set(bearer('mnt')).send({ sessionsCompleted: 99 })).status).toBe(400);
  expect((await request(app).put('/api/me/mentor-profile').set(bearer('s1')).send({ paused: false })).status).toBe(403);
});
