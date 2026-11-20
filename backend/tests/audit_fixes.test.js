// Needs MongoDB (same as the other API tests).
const request = require('supertest');
const { setup, teardown, bearer, mkUni, mkUser, mkEmployer, models } = require('./helpers');
let app;
beforeAll(async () => { app = await setup(); });
afterAll(teardown);

test('admin cannot verify or reject another admin account', async () => {
  await mkUser('adm1', 'admin', null);
  const other = await mkUser('adm2', 'admin', null);
  const r = await request(app).post(`/api/admin/users/${other._id}/verify`).set(bearer('adm1')).send({ decision: 'rejected' });
  expect(r.status).toBe(403);
});

test('a finished application cannot be withdrawn; an open one can', async () => {
  const uni = await mkUni('Test Uni', 'TU', 'Dhaka', 90.4, 23.7);
  const stu = await mkUser('stu1', 'student', uni);
  const emp = await mkEmployer('emp1');
  const org = await models.Organization.findOne({ name: 'Acme BD' });
  const job = await models.Opportunity.create({ title: 'Job', description: 'x', type: 'job', postedBy: emp._id, organizationId: org._id, organization: 'Acme BD', status: 'approved', sourceLabel: 'employer' });
  const mkApp = (stage) => models.Application.create({ opportunityId: job._id, studentId: stu._id, stage, consentSnapshot: { sharedFields: ['name'] } });
  const hired = await mkApp('Hired');
  expect((await request(app).post(`/api/applications/${hired._id}/withdraw`).set(bearer('stu1'))).status).toBe(409);
  await models.Application.deleteOne({ _id: hired._id });
  const open = await mkApp('Applied');
  expect((await request(app).post(`/api/applications/${open._id}/withdraw`).set(bearer('stu1'))).status).toBe(200);
});

test('applicant list survives a deleted student', async () => {
  const emp = await models.User.findOne({ firebaseUid: 'emp1' });
  const job = await models.Opportunity.findOne({ title: 'Job' });
  const ghost = new (require('mongoose').Types.ObjectId)();
  await models.Application.collection.insertOne({ opportunityId: job._id, studentId: ghost, stage: 'Applied', consentSnapshot: { sharedFields: ['name'] }, stageHistory: [], createdAt: new Date(), updatedAt: new Date() });
  const r = await request(app).get(`/api/employer/jobs/${job._id}/applicants`).set(bearer('emp1'));
  expect(r.status).toBe(200);
});
