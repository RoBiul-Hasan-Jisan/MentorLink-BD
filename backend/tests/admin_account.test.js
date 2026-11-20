// Needs MongoDB (TEST_MONGODB_URI, database name ending _test), like the other API suites.
const request = require('supertest');
const { setup, teardown, bearer, mkUni, mkUser, models } = require('./helpers');
let app, stu, adm, adm2;
beforeAll(async () => {
  app = await setup();
  const uni = await mkUni('Acct Uni', 'ACU', 'Dhaka', 90.4, 23.7);
  stu = await mkUser('ac_stu', 'student', uni);
  adm = await mkUser('ac_adm', 'admin', uni);
  adm2 = await mkUser('ac_adm2', 'admin', uni);
});
afterAll(teardown);

test('admin can change a user email; it is logged without any password', async () => {
  const r = await request(app).post(`/api/admin/users/${stu._id}/account`).set(bearer('ac_adm')).send({ email: 'New.Email@Example.com', newPassword: 'Newpass#123' });
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ ok: true, email: 'new.email@example.com', emailChanged: true, passwordChanged: true });
  const log = await models.AuditLog.findOne({ action: 'admin_account_change' }).lean();
  expect(JSON.stringify(log)).not.toContain('Newpass');
});

test('non-admins are refused, other admins are protected, empty and short inputs are rejected', async () => {
  expect((await request(app).post(`/api/admin/users/${stu._id}/account`).set(bearer('ac_stu')).send({ newPassword: 'Another#123' })).status).toBe(403);
  expect((await request(app).post(`/api/admin/users/${adm2._id}/account`).set(bearer('ac_adm')).send({ newPassword: 'Another#123' })).status).toBe(403);
  expect((await request(app).post(`/api/admin/users/${stu._id}/account`).set(bearer('ac_adm')).send({})).status).toBe(400);
  expect((await request(app).post(`/api/admin/users/${stu._id}/account`).set(bearer('ac_adm')).send({ newPassword: 'short' })).status).toBe(400);
});
