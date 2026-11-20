// The demo world for hiring: several employers (the only people who post jobs) and applicants in every state.
// Seeds through the real seed (with a fake Firebase), then reads it back through the real API.
const request = require('supertest');
const { setup, teardown, models } = require('./helpers');
const env = require('../src/config/env');
const { seedDemo } = require('../src/seed/demo');
const { createApp } = require('../src/app');

function fakeAuth() {
  const users = new Map(); let n = 0;
  return {
    users,
    getUserByEmail: async (e) => { if (!users.has(e)) { const err = new Error('x'); err.code = 'auth/user-not-found'; throw err; } return users.get(e); },
    createUser: async ({ email }) => { const u = { uid: `uid${++n}`, email }; users.set(email, u); return u; },
    updateUser: async () => {},
  };
}
let app, auth;
const as = (email) => ({ Authorization: `Bearer ${auth.users.get(email).uid}:${email}` });
const get = (email, url) => request(app).get(`/api${url}`).set(as(email));
const verify = async (c) => { const [uid, email] = c.split(':'); return { uid, email }; };

beforeAll(async () => {
  await setup();
  env.demoMode = true;
  auth = fakeAuth();
  await seedDemo({ auth });
  const cnt = async () => JSON.stringify(await Promise.all(['User', 'Opportunity', 'Application', 'Interview', 'DocumentRequest', 'Offer', 'AppMessage', 'Report'].map((m) => models[m].countDocuments())));
  const first = await cnt();
  await seedDemo({ auth }); // second run must change nothing
  expect(await cnt()).toBe(first);
  app = createApp({ verify });
}, 120000);
afterAll(teardown);

test('several employers, each at their own verified company; one company has two recruiters', async () => {
  expect(await models.User.countDocuments({ role: 'employer' })).toBe(5);
  expect(await models.Organization.countDocuments({ verificationStatus: 'verified' })).toBe(4);
  expect(await models.Organization.countDocuments({ verificationStatus: 'pending' })).toBe(1);
  const tech = await models.Organization.findOne({ name: 'Demo Tech Ltd' });
  expect(await models.OrganizationMember.countDocuments({ organizationId: tech._id, status: 'active' })).toBe(2);
  // every employer can really sign in to the recruiter tools
  for (const e of ['employer', 'employer.hr', 'employer2', 'employer3', 'employer4']) expect((await get(`${e}@demo.mentorlink.bd`, '/employer/org')).status).toBe(200);
  // the recruiter sees the owner's jobs
  const owner = (await get('employer@demo.mentorlink.bd', '/me/jobs')).body.jobs.map((j) => j.title);
  const second = (await get('employer.hr@demo.mentorlink.bd', '/me/jobs')).body.jobs.map((j) => j.title);
  expect(second).toEqual(expect.arrayContaining(owner));
});

test('EVERY job is posted by an employer at a verified company; nobody else posts', async () => {
  const jobs = await models.Opportunity.find({}).lean();
  expect(jobs.length).toBe(19); // see README: which employer posted which job
  expect(jobs.every((j) => j.sourceLabel === 'employer' && j.organizationId)).toBe(true);
  const posters = await models.User.find({ _id: { $in: jobs.map((j) => j.postedBy) } }).select('role').lean();
  expect(posters.every((u) => u.role === 'employer')).toBe(true);
  const board = [];
  for (let page = 1; page <= 5; page++) board.push(...(await get('student.edu@demo.mentorlink.bd', `/opportunities?limit=50&page=${page}`)).body.opportunities);
  expect(board.every((o) => o.labels.source === 'employer')).toBe(true);
  expect(board.map((o) => o.title)).not.toContain('Textile Quality Inspector (Demo)'); // still waiting for the admin
});

test('Robiul (main demo student) has things waiting: an interview to confirm, a paper to send, an unread message', async () => {
  const inbox = (await get('student.edu@demo.mentorlink.bd', '/me/hiring/inbox')).body;
  expect(inbox.applicant.interviews.length).toBe(1);
  expect(inbox.applicant.interviews[0].status).toBe('scheduled');
  expect(inbox.applicant.documents.length).toBe(1);
  expect(inbox.applicant.unreadMessages).toBe(1);
  expect((await get('student.edu@demo.mentorlink.bd', '/me/jobs')).status).toBe(403); // students have no employer tools: they cannot post
});

test('every kind of state is present somewhere in the demo', async () => {
  const states = async (M, f) => (await models[M].distinct(f)).sort();
  expect(await states('Application', 'stage')).toEqual(['Applied', 'Hired', 'Interview', 'Offer', 'Rejected', 'Shortlisted', 'Under Review', 'Withdrawn']);
  expect(await states('Interview', 'status')).toEqual(expect.arrayContaining(['scheduled', 'confirmed', 'reschedule_requested', 'completed']));
  expect(await states('Interview', 'kind')).toEqual(expect.arrayContaining(['phone', 'video', 'onsite']));
  expect(await states('DocumentRequest', 'status')).toEqual(['accepted', 'needs_fix', 'requested', 'submitted']);
  expect(await states('Offer', 'status')).toEqual(['accepted', 'declined', 'sent']);
  expect(await models.AppMessage.countDocuments({ 'flags.0': { $exists: true } })).toBe(1);
});

test('an employer sees only their own company; the other company gets 404', async () => {
  const mine = (await get('employer2@demo.mentorlink.bd', '/me/jobs')).body.jobs;
  expect(mine.every((j) => j.organization === 'Demo Bay Analytics Ltd')).toBe(true);
  const other = (await get('employer3@demo.mentorlink.bd', '/me/jobs')).body.jobs.find((j) => j.title === 'Accounts Executive (Demo)');
  expect((await get('employer2@demo.mentorlink.bd', `/jobs/${other.id}/pipeline`)).status).toBe(404);
  const inbox = (await get('employer2@demo.mentorlink.bd', '/me/hiring/inbox')).body;
  expect(inbox.poster.newApplicants).toBeGreaterThan(0);
});

test('the admin sees all of it: overview, feed, and any job end to end', async () => {
  const adm = 'admin@demo.mentorlink.bd';
  const o = (await get(adm, '/admin/hiring/overview')).body;
  expect(Object.keys(o.jobs.bySource)).toEqual(['employer']);
  expect(o.applications.byStage.Hired).toBeGreaterThan(3);
  expect(o.attention.jobsToReview).toBeGreaterThanOrEqual(2); // two employer posts wait for review
  expect(o.attention.flaggedMessages).toBe(1);
  expect(o.topPosters.every((p) => p.role === 'employer')).toBe(true);
  expect(o.topPosters.some((p) => p.role === 'employer')).toBe(true);
  expect((await get(adm, '/admin/hiring/activity')).body.events.length).toBeGreaterThan(10);
  const tech = (await models.Opportunity.findOne({ title: 'Frontend Developer (Demo)' }));
  const p = (await get(adm, `/admin/hiring/jobs/${tech._id}`)).body;
  expect(p.poster.team).toHaveLength(2);
  expect(p.applications).toHaveLength(5);
  const hired = p.applications.find((a) => a.stage === 'Hired');
  const t = (await get(adm, `/admin/hiring/applications/${hired.id}`)).body;
  expect(t.timeline.length).toBeGreaterThan(10);
  expect(t.timeline.map((e) => e.type)).toEqual(expect.arrayContaining(['applied', 'stage', 'interview', 'document', 'offer', 'message']));
});
