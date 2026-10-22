const { setup, teardown, models } = require('./helpers');
const env = require('../src/config/env');
const { seedDemo } = require('../src/seed/demo');

function fakeAuth() {
  const users = new Map(); let n = 0;
  return {
    users,
    getUserByEmail: async (e) => { if (!users.has(e)) { const err = new Error('x'); err.code = 'auth/user-not-found'; throw err; } return users.get(e); },
    createUser: async ({ email }) => { const u = { uid: `uid${++n}`, email }; users.set(email, u); return u; },
    updateUser: async () => {},
  };
}
beforeAll(async () => { await setup(); });
afterAll(teardown);

test('refuses without DEMO_MODE', async () => {
  env.demoMode = false;
  await expect(seedDemo({ auth: fakeAuth() })).rejects.toThrow(/DEMO_MODE/);
});
test('seeds all accounts, is idempotent, EDU and Southern differ', async () => {
  env.demoMode = true;
  const auth = fakeAuth();
  const t = await seedDemo({ auth });
  await seedDemo({ auth });
  expect(t).toHaveLength(7);
  expect(await models.User.countDocuments({ isDemo: true })).toBe(7);
  expect(auth.users.size).toBe(7);
  const edu = await models.University.findOne({ shortName: 'EDU' });
  const su = await models.University.findOne({ shortName: 'SUB' });
  expect(edu.campus.coordinates).not.toEqual(su.campus.coordinates);
  expect((await models.User.findOne({ email: 'student.edu@demo.mentorlink.bd' })).displayName).toBe('Robiul');
  expect(await models.Organization.countDocuments({ verificationStatus: 'verified' })).toBe(1);
  expect(await models.OrganizationMember.countDocuments({ status: 'active' })).toBe(1);
  expect(await models.Opportunity.countDocuments({ status: 'approved' })).toBe(2);
});
