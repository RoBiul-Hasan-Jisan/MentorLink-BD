// Needs MongoDB (like the other API tests): actions, tracker, practice feedback, employer analytics.
const request = require('supertest');
const { setup, teardown, bearer, mkUni, mkUser, mkEmployer, models } = require('./helpers');
let app, stu, emp, org, job, mentor;
beforeAll(async () => {
  app = await setup();
  const uni = await mkUni('Test Uni', 'TU', 'Dhaka', 90.4, 23.7);
  stu = await mkUser('stuA', 'student', uni);
  mentor = await mkUser('menA', 'mentor', uni);
  emp = await mkEmployer('empA');
  org = await models.Organization.findOne({ name: 'Acme BD' });
  job = await models.Opportunity.create({ title: 'Job A', description: 'x'.repeat(30), type: 'job', postedBy: emp._id, organizationId: org._id, organization: 'Acme BD', status: 'approved', sourceLabel: 'employer', views: 10 });
});
afterAll(teardown);

test('actions: a new student is told to choose a goal; other roles get 403', async () => {
  const r = await request(app).get('/api/me/actions').set(bearer('stuA'));
  expect(r.status).toBe(200);
  expect(r.body.actions[0].key).toBe('goal');
  expect((await request(app).get('/api/me/actions').set(bearer('empA'))).status).toBe(403);
});

test('tracker: applied job shows in the applied column and turns stale after 7 days', async () => {
  const cv = await models.CvVersion.create({ studentId: stu._id, version: 1, data: {} });
  await models.Application.create({ studentId: stu._id, opportunityId: job._id, cvVersionId: cv._id, consentSnapshot: { sharedFields: ['name'], consentedAt: new Date() }, stage: 'Applied', createdAt: new Date(Date.now() - 9 * 864e5) });
  const r = await request(app).get('/api/me/tracker').set(bearer('stuA'));
  expect(r.status).toBe(200);
  const applied = r.body.columns.find((c) => c.key === 'applied');
  expect(applied.count).toBe(1);
  expect(applied.cards[0].stale).toBe(true);
  expect(r.body.staleCount).toBe(1);
});

test('practice feedback: student asks, mentor answers once, student reads it', async () => {
  await models.MentorRequest.create({ studentId: stu._id, mentorId: mentor._id, status: 'accepted', goalText: 'Get ready', questions: ['How do I start?'] });
  await models.RoleTemplate.create({ key: 'backend_dev', titleEn: 'Backend', titleBn: 'ব্যাকএন্ড', requiredSkills: [] });
  await models.StudentProfile.updateOne({ userId: stu._id }, { careerGoalRoleKey: 'backend_dev' }, { upsert: true });
  const JR = require('../src/services/jobready');
  const q = JR.questionsFor('backend_dev')[0];
  await request(app).post('/api/me/interview-practice').set(bearer('stuA')).send({ questionId: q.id, rating: 3 });
  const ask = await request(app).post('/api/me/interview-practice/request-feedback').set(bearer('stuA')).send({ mentorId: String(mentor._id) });
  expect(ask.status).toBe(200);
  const inbox = await request(app).get('/api/mentor/practice-requests').set(bearer('menA'));
  expect(inbox.body.requests.length).toBe(1);
  const id = inbox.body.requests[0].id;
  expect((await request(app).post(`/api/mentor/practice-requests/${id}/feedback`).set(bearer('stuA')).send({ score: 4, improve: 'Use numbers' })).status).toBe(403);
  expect((await request(app).post(`/api/mentor/practice-requests/${id}/feedback`).set(bearer('menA')).send({ score: 4, improve: 'Use numbers' })).status).toBe(200);
  expect((await request(app).post(`/api/mentor/practice-requests/${id}/feedback`).set(bearer('menA')).send({ score: 5, improve: 'Again please' })).status).toBe(409);
  const mine = await request(app).get('/api/me/practice-feedback').set(bearer('stuA'));
  expect(mine.body.feedback[0]).toMatchObject({ status: 'done', mentorScore: 4 });
});

test('employer analytics: funnel and per-job row; students cannot read it', async () => {
  const r = await request(app).get('/api/employer/analytics').set(bearer('empA'));
  expect(r.status).toBe(200);
  expect(r.body.company.total).toBe(1);
  expect(r.body.jobs[0]).toMatchObject({ title: 'Job A', applications: 1, views: 10, applyRatePercent: 10 });
  expect(JSON.stringify(r.body)).not.toMatch(/displayName|email/);
  expect((await request(app).get('/api/employer/analytics').set(bearer('stuA'))).status).toBe(403);
});
