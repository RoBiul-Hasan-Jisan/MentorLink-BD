const request = require('supertest');
const { setup, teardown, bearer, mkUni, mkUser, models } = require('./helpers');
let app, edu, sub;
beforeAll(async () => {
  app = await setup();
  edu = await mkUni('East Delta University', 'EDU', 'Chattogram', 91.831, 22.359);
  sub = await mkUni('Southern University', 'SUB', 'Chattogram', 91.80, 22.364);
  await mkUser('s1', 'student', edu, { displayName: 'Robiul Hasan Jisan' });
  await mkUser('s2', 'student', sub);
  await mkUser('m1', 'mentor', edu, { displayName: 'Abrar Hossain' });
  await mkUser('hidden', 'student', edu, { showInDirectory: false });
  await mkUser('pend', 'student', edu, { verificationStatus: 'pending' });
  await mkUser('emp', 'employer', null);
  await mkUser('adm', 'admin', null);
});
afterAll(teardown);

test('no token -> 401, bad token -> 401', async () => {
  expect((await request(app).get('/api/me')).status).toBe(401);
  expect((await request(app).get('/api/me').set('Authorization', 'Bearer junk')).status).toBe(401);
});
test('register requires a university', async () => {
  const r = await request(app).post('/api/auth/register-profile').set(bearer('new1')).send({ displayName: 'New One' });
  expect(r.status).toBe(400);
});
test('register works and role is forced to student; cannot send role', async () => {
  const bad = await request(app).post('/api/auth/register-profile').set(bearer('new2')).send({ displayName: 'Sneaky', universityId: String(edu._id), role: 'admin' });
  expect(bad.status).toBe(400);
  const ok = await request(app).post('/api/auth/register-profile').set(bearer('new3')).send({ displayName: 'Real Student', universityId: String(edu._id) });
  expect(ok.status).toBe(201);
  expect(ok.body.user.role).toBe('student');
  expect(ok.body.user.university.shortName).toBe('EDU');
});
test('privacy guard rejects lat/lng/location/address on profile requests', async () => {
  for (const body of [{ lat: 1 }, { longitude: 2 }, { location: 'x' }, { address: 'home' }, { gps: {} }]) {
    const r = await request(app).patch('/api/me/privacy').set(bearer('s1')).send(body);
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('PRIVACY_FIELD_REJECTED');
  }
});
test('same-city universities have different coordinates', async () => {
  const r = await request(app).get('/api/universities');
  const a = r.body.universities.find((u) => u.shortName === 'EDU').campus;
  const b = r.body.universities.find((u) => u.shortName === 'SUB').campus;
  expect(a).not.toEqual(b);
  expect(a.lat).toBeCloseTo(22.359);
});
test('directory shows only verified + opted-in members, first name + initial', async () => {
  const r = await request(app).get(`/api/directory/universities/${edu._id}/members`).set(bearer('s1'));
  expect(r.status).toBe(200);
  const names = r.body.members.map((m) => m.name);
  expect(names).toContain('Robiul H.');
  expect(names).toContain('Abrar H.');
  expect(r.body.members.length).toBe(2); // hidden + pending excluded
  expect(JSON.stringify(r.body.members)).not.toMatch(/email|firebaseUid|lat|lng/);
});
test('employer gets 403 on directory', async () => {
  expect((await request(app).get('/api/directory/universities').set(bearer('emp'))).status).toBe(403);
  expect((await request(app).get(`/api/directory/universities/${edu._id}/members`).set(bearer('emp'))).status).toBe(403);
});
test('student can opt out of the directory', async () => {
  await request(app).patch('/api/me/privacy').set(bearer('s2')).send({ showInDirectory: false });
  const r = await request(app).get(`/api/directory/universities/${sub._id}/members`).set(bearer('s1'));
  expect(r.body.members.length).toBe(0);
});
test('student cannot become mentor by themselves, only apply', async () => {
  const r = await request(app).post('/api/me/mentor-application').set(bearer('s1')).send({ roleTitle: 'Dev', industry: 'IT', yearsExperience: 3 });
  expect(r.status).toBe(201);
  const u = await models.User.findOne({ firebaseUid: 's1' });
  expect(u.role).toBe('student');
  expect(u.mentorApplication.status).toBe('pending');
});
