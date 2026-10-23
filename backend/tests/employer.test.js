const request = require('supertest');
const { setup, teardown, bearer, mkUni, mkUser, models } = require('./helpers');
let app, edu;
const org = (name) => ({ name, website: 'https://acme.example', industry: 'Software', city: 'Dhaka', workEmail: 'hr@acme.example', verificationEvidence: 'Trade licence no. 12345' });
const job = (extra = {}) => ({ title: 'Junior Developer', description: 'Build features with a friendly engineering team.', noFeeConfirmed: true, ...extra });
beforeAll(async () => {
  app = await setup();
  edu = await mkUni('EDU', 'EDU', 'Chattogram', 91.83, 22.35);
  await mkUser('adm', 'admin', null);
  for (const s of ['own1', 'own2', 'stu', 'stu2']) await mkUser(s, 'student', edu);
});
afterAll(teardown);

test('company flow: register -> no tools until admin verifies -> role promoted by server', async () => {
  const bodyWithRole = await request(app).post('/api/orgs/register').set(bearer('own1')).send({ ...org('Acme'), role: 'employer' });
  expect(bodyWithRole.status).toBe(400);
  const reg = await request(app).post('/api/orgs/register').set(bearer('own1')).send(org('Acme'));
  expect(reg.status).toBe(201);
  expect((await models.User.findOne({ firebaseUid: 'own1' })).role).toBe('student');
  expect((await request(app).get('/api/employer/jobs').set(bearer('own1'))).status).toBe(403);
  expect((await request(app).post(`/api/admin/organizations/${reg.body.id}/review`).set(bearer('own1')).send({ decision: 'verified' })).status).toBe(403);
  await request(app).post(`/api/admin/organizations/${reg.body.id}/review`).set(bearer('adm')).send({ decision: 'verified' });
  expect((await models.User.findOne({ firebaseUid: 'own1' })).role).toBe('employer');
  const reg2 = await request(app).post('/api/orgs/register').set(bearer('own2')).send(org('Beta Ltd'));
  await request(app).post(`/api/admin/organizations/${reg2.body.id}/review`).set(bearer('adm')).send({ decision: 'verified' });
});

test('first job is reviewed by admin; later clean jobs auto-approve; scam words are held', async () => {
  const j1 = await request(app).post('/api/employer/jobs').set(bearer('own1')).send(job());
  expect(j1.body.job.status).toBe('pending');
  expect((await request(app).post('/api/employer/jobs').set(bearer('own1')).send(job({ noFeeConfirmed: false }))).status).toBe(400);
  await request(app).post(`/api/admin/opportunities/${j1.body.job._id}/review`).set(bearer('adm')).send({ decision: 'approve' });
  expect((await request(app).post('/api/employer/jobs').set(bearer('own1')).send(job({ title: 'Backend Developer' }))).body.job.status).toBe('approved');
  expect((await request(app).post('/api/employer/jobs').set(bearer('own1')).send(job({ title: 'QA Tester', description: 'Pay a registration fee via bKash to secure this seat now.' }))).body.job.status).toBe('pending');
});

test('students apply with consent; employer sees only consented data; stage rules enforced', async () => {
  const jobs = (await request(app).get('/api/employer/jobs').set(bearer('own1'))).body.jobs;
  const target = jobs.find((j) => j.title === 'Junior Developer');
  const cv = (await request(app).post('/api/me/cv').set(bearer('stu')).send({ data: { summary: 'Hi' } })).body.cv;
  const ap = await request(app).post(`/api/opportunities/${target._id}/apply`).set(bearer('stu')).send({ cvVersionId: cv._id, consent: true, sharedFields: ['name', 'cv'] });
  expect(ap.status).toBe(201);
  const list = (await request(app).get(`/api/employer/jobs/${target._id}/applicants`).set(bearer('own1'))).body.applicants;
  expect(list[0].name).toBe('User stu'); expect(list[0].department).toBeUndefined();
  expect(JSON.stringify(list)).not.toMatch(/email|firebaseUid/);
  const id = ap.body.application.id;
  expect((await request(app).patch(`/api/employer/applications/${id}/stage`).set(bearer('own1')).send({ stage: 'Hired' })).status).toBe(409);
  expect((await request(app).patch(`/api/employer/applications/${id}/stage`).set(bearer('own1')).send({ stage: 'Shortlisted' })).body.studentSees).toBe('Shortlisted');
  const hist = (await models.Application.findById(id)).stageHistory.map((h) => h.stage);
  expect(hist).toEqual(['Applied', 'Shortlisted']);
});

test('cross-organization isolation', async () => {
  const jobs = (await request(app).get('/api/employer/jobs').set(bearer('own1'))).body.jobs;
  const target = jobs.find((j) => j.title === 'Junior Developer');
  expect((await request(app).get(`/api/employer/jobs/${target._id}/applicants`).set(bearer('own2'))).status).toBe(404);
  expect((await request(app).post(`/api/employer/jobs/${target._id}/close`).set(bearer('own2'))).status).toBe(404);
  const apps = await models.Application.find({ opportunityId: target._id });
  expect((await request(app).patch(`/api/employer/applications/${apps[0]._id}/stage`).set(bearer('own2')).send({ stage: 'Interview' })).status).toBe(404);
  expect((await request(app).get('/api/employer/jobs').set(bearer('own2'))).body.jobs).toHaveLength(0);
});

test('employer cannot reach the directory, chats, or student-only endpoints', async () => {
  expect((await request(app).get('/api/directory/universities').set(bearer('own1'))).status).toBe(403);
  expect((await request(app).get(`/api/directory/universities/${edu._id}/members`).set(bearer('own1'))).status).toBe(403);
  expect((await request(app).get('/api/me/plan').set(bearer('own1'))).status).toBe(403);
  expect((await request(app).get('/api/matches').set(bearer('own1'))).status).toBe(403);
  expect((await request(app).get('/api/admin/organizations').set(bearer('own1'))).status).toBe(403);
});

test('private verification evidence is never shown to employers; suspend hides jobs', async () => {
  const mine = await request(app).get('/api/employer/org').set(bearer('own1'));
  expect(JSON.stringify(mine.body)).not.toMatch(/Trade licence/);
  const orgDoc = await models.Organization.findOne({ name: 'Acme' });
  await request(app).post(`/api/admin/organizations/${orgDoc._id}/review`).set(bearer('adm')).send({ decision: 'suspended' });
  expect((await request(app).get('/api/opportunities').set(bearer('stu2'))).body.opportunities.filter((o) => o.organization === 'Acme')).toHaveLength(0);
});
