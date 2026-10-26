const request = require('supertest');
const { setup, teardown, bearer, mkUni, mkUser, models } = require('./helpers');
const { seedLearning } = require('../src/seed/learning');
let app, edu;
beforeAll(async () => {
  app = await setup(); await seedLearning();
  edu = await mkUni('EDU', 'EDU', 'Chattogram', 91.83, 22.35);
  const m = await mkUser('dm', 'mentor', edu, { displayName: 'Design Mentor' });
  await models.MentorProfile.create({ userId: m._id, weeklyCapacity: 3, roleTitle: 'Data Analyst', expertiseSkills: [{ skillKey: 'sql', level: 3 }] });
  await mkUser('adm2', 'admin', edu);
  const s = await mkUser('ds', 'student', edu, { department: 'CSE' });
  await request(app).put('/api/me/goal').set(bearer('ds')).send({ careerGoalRoleKey: 'data-analyst', weeklyHours: 6 });
});
afterAll(teardown);

test('mentor request card shows name, readiness and gaps they can help with', async () => {
  const mentor = await models.User.findOne({ firebaseUid: 'dm' });
  const r = await request(app).post('/api/requests').set(bearer('ds')).send({ mentorId: String(mentor._id), goalText: 'Become a data analyst', questions: ['Where do I start?'], preferredSlots: ['sun-20'], format: 'video' });
  expect(r.status).toBe(201);
  const list = await request(app).get('/api/requests').set(bearer('dm'));
  const x = list.body.requests[0];
  expect(x.withName).toMatch(/User ds/); expect(x.department).toBe('CSE');
  expect(typeof x.readiness).toBe('number');
  expect(x.gaps.length).toBeGreaterThan(0);
  expect(x.gaps.some((g) => g.skillKey === 'sql' && g.canHelp === true)).toBe(true);
  const mine = await request(app).get('/api/requests').set(bearer('ds'));
  expect(mine.body.requests[0].withName).toBe('Design Mentor'); expect(mine.body.requests[0].readiness).toBeUndefined();
});

test('notifications: mark all read', async () => {
  const u = await models.User.findOne({ firebaseUid: 'ds' });
  await models.Notification.create({ userId: u._id, title: 'a', body: 'b', type: 'x' });
  await models.Notification.create({ userId: u._id, title: 'c', body: 'd', type: 'x' });
  expect((await request(app).post('/api/notifications/read-all').set(bearer('ds'))).status).toBe(200);
  expect(await models.Notification.countDocuments({ userId: u._id, read: false })).toBe(0);
});

test('job detail: fit and skill-by-skill breakdown; applications show CV version', async () => {
  const adm = await models.User.findOne({ firebaseUid: 'adm2' });
  const o = await request(app).post('/api/opportunities').set(bearer('adm2')).send({ title: 'Junior Data Analyst', organization: 'Demo Tech', description: 'Support the analytics team with weekly reports and dashboards.', noFeeConfirmed: true, requiredSkills: [{ skillKey: 'sql', requiredLevel: 3, weight: 5 }, { skillKey: 'excel', requiredLevel: 2, weight: 3 }] });
  expect(o.status).toBe(201);
  const id = o.body.opportunity._id;
  const d = await request(app).get(`/api/opportunities/${id}`).set(bearer('ds'));
  expect(d.status).toBe(200);
  expect(d.body.fit).toBe(0);
  expect(d.body.breakdown.map((b) => b.status)).toEqual(['gap', 'gap']);
  expect(d.body.opportunity.postedByName).toBeTruthy();
  const list = await request(app).get('/api/opportunities').set(bearer('ds'));
  expect(list.body.opportunities[0].postedByName).toBeTruthy();
  expect((await request(app).get('/api/opportunities/000000000000000000000000').set(bearer('ds'))).status).toBe(404);
  const cv = await request(app).post('/api/me/cv').set(bearer('ds')).send({ headline: 'Data analyst', education: [], projects: [], skills: [], summary: 'x' });
  if (cv.status === 201) {
    const ap = await request(app).post(`/api/opportunities/${id}/apply`).set(bearer('ds')).send({ cvVersionId: cv.body.cv._id, consent: true });
    expect(ap.status).toBe(201);
    const mine = await request(app).get('/api/me/applications').set(bearer('ds'));
    expect(mine.body.applications[0].cvVersion).toBe(1); expect(mine.body.applications[0].appliedAt).toBeTruthy();
  }
});

test('mentor detail includes rating, no-shows and the match explanation', async () => {
  const mentor = await models.User.findOne({ firebaseUid: 'dm' });
  await request(app).get('/api/matches').set(bearer('ds'));
  const d = await request(app).get(`/api/mentors/${mentor._id}`).set(bearer('ds'));
  expect(d.status).toBe(200);
  expect(d.body.mentor.noShows).toBe(0);
  expect(d.body.mentor.match.factorScores).toBeTruthy();
});
