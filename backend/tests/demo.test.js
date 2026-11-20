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
  expect(await models.User.countDocuments({ isDemo: true })).toBe(60); // main accounts, extra students and mentors, study and coverage mentors, pending-approval records (no login) and 4 more employers
  expect(auth.users.size).toBe(57);
  // people spread over all 7 universities, each under its own campus pin
  const unis = await models.User.distinct('universityId', { isDemo: true, role: { $in: ['student', 'mentor'] } });
  expect(unis).toHaveLength(7);
  expect(await models.MentorProfile.countDocuments()).toBe(38);
  const edu = await models.University.findOne({ shortName: 'EDU' });
  const su = await models.University.findOne({ shortName: 'SUB' });
  expect(edu.campus.coordinates).not.toEqual(su.campus.coordinates);
  expect((await models.User.findOne({ email: 'student.edu@demo.mentorlink.bd' })).displayName).toBe('Robiul');
  expect(await models.Organization.countDocuments({ verificationStatus: 'verified' })).toBe(4); // Demo Tech + three more companies (a fifth is waiting for the admin)
  expect(await models.OrganizationMember.countDocuments({ status: 'active' })).toBe(5); // Demo Tech has an owner and a recruiter
  expect(await models.Opportunity.countDocuments({ status: 'approved' })).toBe(17); // ONLY employer jobs: base + more + hiring seed, including 1 closed
  expect(await models.Opportunity.countDocuments({ status: 'pending' })).toBe(2); // two employer posts waiting for the admin (a first post of a company, and the backend post)
  expect(await models.Opportunity.countDocuments({ closed: true })).toBe(1);
});
