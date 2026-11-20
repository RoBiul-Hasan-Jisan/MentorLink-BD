const request = require('supertest');
const { setup, teardown, bearer, mkUni, mkUser, models } = require('./helpers');
const { seedLearning } = require('../src/seed/learning');

let app, uni, S, S2, MN, MN2, AD, ev;
const j = (m, u, uid, body) => request(app)[m](u).set(bearer(uid)).send(body);

beforeAll(async () => {
  app = await setup(); await seedLearning();
  uni = await mkUni('EDU', 'EDU', 'Chattogram', 91.83, 22.35);
  S = await mkUser('s1', 'student', uni, { displayName: 'Nusrat Jahan' }); S2 = await mkUser('s2', 'student', uni);
  MN = await mkUser('m1', 'mentor', uni, { displayName: 'Rahim Ahmed' }); MN2 = await mkUser('m2', 'mentor', uni, { displayName: 'Kamal Uddin' }); AD = await mkUser('a1', 'admin', null);
  await models.MentorProfile.create({ userId: MN._id, roleTitle: 'Data Analyst', industry: 'Fintech', weeklyCapacity: 5, helpsWith: ['portfolio_review'], expertiseSkills: [{ skillKey: 'sql', level: 2 }, { skillKey: 'excel', level: 3 }], ratingAvg: 4.8, ratingCount: 6 });
  await models.MentorProfile.create({ userId: MN2._id, roleTitle: 'QA Lead', industry: 'Software', weeklyCapacity: 5, helpsWith: ['technical_interview'], expertiseSkills: [{ skillKey: 'testing', level: 3 }] });
  await models.StudentProfile.create({ userId: S._id, careerGoalRoleKey: 'data-analyst', weeklyHours: 6 });
  await models.MentorRequest.create({ studentId: S._id, mentorId: MN._id, goalText: 'Review my SQL project', questions: ['How?'], status: 'accepted' });
  ev = (await j('post', '/api/me/evidence', 's1', { skillKey: 'sql', type: 'project', level: 2, url: 'https://github.com/x/y' })).body.evidence;
});
afterAll(teardown);

test('student can only ask an accepted mentor to review their own project', async () => {
  expect((await j('post', `/api/me/evidence/${ev._id}/request-review`, 's1', { mentorId: String(MN2._id) })).status).toBe(400);
  expect((await j('post', `/api/me/evidence/${ev._id}/request-review`, 's2', { mentorId: String(MN._id) })).status).toBe(404);
  expect((await j('post', `/api/me/evidence/${ev._id}/request-review`, 's1', { mentorId: String(MN._id) })).status).toBe(200);
  const q = await j('get', '/api/mentor/review-queue', 'm1');
  expect(q.body.reviews).toHaveLength(1);
  expect(q.body.reviews[0].student).toBe('Nusrat J.');
});

test('mentor access needs an accepted request', async () => {
  expect((await j('get', `/api/mentees/${S._id}/review-pack`, 'm2')).status).toBe(403);
  const p = await j('get', `/api/mentees/${S._id}/review-pack`, 'm1');
  expect(p.status).toBe(200);
  expect(p.body.evidence[0].reviewStatus).toBe('requested');
});

test('endorsement is capped at the mentor own level and becomes visible evidence', async () => {
  expect((await j('post', `/api/mentees/${S._id}/evidence/${ev._id}/review`, 'm1', { decision: 'endorse', level: 3 })).status).toBe(400); // mentor is level 2 in SQL
  const bad = await j('post', `/api/mentees/${S._id}/evidence/${ev._id}/review`, 'm1', { decision: 'needs_work', note: 'Add a README' });
  expect(bad.body.reviewStatus).toBe('needs_work');
  expect(await models.SkillEvidence.countDocuments({ studentId: S._id, type: 'endorsement' })).toBe(0);
  const ok = await j('post', `/api/mentees/${S._id}/evidence/${ev._id}/review`, 'm1', { decision: 'endorse', level: 2, note: 'Clear and correct' });
  expect(ok.body.reviewStatus).toBe('endorsed');
  const e = await models.SkillEvidence.findOne({ studentId: S._id, type: 'endorsement' });
  expect(String(e.endorsedBy)).toBe(String(MN._id));
});

test('roadmap advice shows on the target and does not change the score', async () => {
  const before = (await j('get', '/api/targets/data-analysis', 's1')).body.percent;
  expect((await j('post', `/api/mentees/${S._id}/advice`, 'm1', { targetKey: 'data-analysis', action: 'prioritize' })).status).toBe(400);
  expect((await j('post', `/api/mentees/${S._id}/advice`, 'm1', { targetKey: 'data-analysis', topicKey: 'sql2', action: 'prioritize', note: 'Do JOINs before dashboards' })).status).toBe(201);
  expect((await j('post', `/api/mentees/${S._id}/advice`, 'm2', { targetKey: 'data-analysis', topicKey: 'sql2', action: 'note', note: 'x' })).status).toBe(403);
  const t = (await j('get', '/api/targets/data-analysis', 's1')).body;
  expect(t.advice[0]).toMatchObject({ topicKey: 'sql2', action: 'prioritize', mentor: 'Rahim A.' });
  expect(t.percent).toBe(before);
  const rv = await j('get', '/api/me/reviews', 's1');
  expect(rv.body.reviews.length).toBeGreaterThanOrEqual(3);
});

test('gap-to-mentor ranks for one skill and gives evidence', async () => {
  const r = await j('get', '/api/me/gaps/sql/mentors', 's1');
  expect(r.status).toBe(200);
  expect(r.body.mentors.map((m) => m.name)).toEqual(['Rahim A.']);
  const kinds = r.body.mentors[0].evidence.map((e) => e.kind);
  expect(kinds).toEqual(expect.arrayContaining(['expertise', 'endorsements']));
  const f = await j('get', '/api/me/gaps/sql/mentors?focus=technical_interview', 's1');
  expect(f.body.mentors.map((m) => m.name)).toEqual(expect.arrayContaining(['Kamal U.'])); // offers that exact help
  expect((await j('get', '/api/me/gaps/sql/mentors?focus=nope', 's1')).status).toBe(400);
});

test('loop and outcome tracker reflect real activity', async () => {
  await j('get', '/api/me/readiness', 's1');
  const l = (await j('get', '/api/me/loop', 's1')).body;
  expect(l.steps.map((s) => s.key)).toEqual(['assess', 'plan', 'practice', 'review', 'reassess']);
  expect(l.steps[0].done).toBe(true); expect(l.steps[3].done).toBe(true);
  const t = (await j('get', '/api/me/outcome-tracker', 's1')).body;
  expect(t.portfolio[0]).toMatchObject({ skillKey: 'sql', reviewStatus: 'endorsed' });
  expect(t.competencies.find((c) => c.skillKey === 'sql').proven).toBe(true);
  expect(t.sharingForResearch).toBe(false);
});

test('impact: only consenting students, small groups hidden, admin only', async () => {
  expect((await j('get', '/api/admin/impact', 's1')).status).toBe(403);
  let r = await j('get', '/api/admin/impact', 'a1');
  expect(r.body.consentingStudents).toBeNull();
  expect(r.body.groups.every((g) => g.students === null)).toBe(true);
  expect((await j('put', '/api/me/outcome-sharing', 's1', { on: true })).body.on).toBe(true);
  r = await j('get', '/api/admin/impact', 'a1');
  expect(JSON.stringify(r.body)).not.toMatch(/Nusrat|s1@/);
  expect(r.body.caveat).toMatch(/not prove/);
});
