const request = require('supertest');
const { setup, teardown, bearer, mkUni, mkUser, models } = require('./helpers');
const { seedLearning } = require('../src/seed/learning');
const { seedQuizzes } = require('../src/seed/quizzes');
const { levelName } = require('../src/data/levels');

let app, uni, S, MN;
const j = (m, u, uid, body) => request(app)[m](u).set(bearer(uid)).send(body);

beforeAll(async () => {
  app = await setup(); await seedLearning(); await seedQuizzes();
  uni = await mkUni('EDU', 'EDU', 'Chattogram', 91.83, 22.35);
  S = await mkUser('s1', 'student', uni); MN = await mkUser('m1', 'mentor', uni, { displayName: 'Rahim Ahmed' });
  await models.MentorProfile.create({ userId: MN._id, roleTitle: 'Machine Learning Engineer', industry: 'Software', expertiseSkills: [{ skillKey: 'python', level: 3 }, { skillKey: 'statistics', level: 2 }] });
});
afterAll(teardown);

test('level names: four named levels', () => {
  expect([0, 1, 2, 3].map((l) => levelName(l).en)).toEqual(['Beginner', 'Elementary', 'Intermediate', 'Advanced']);
});

test('quiz result names the level and splits strong and weak topics', async () => {
  const q = await models.Quiz.findOne({ skillKey: 'sql' });
  const answers = q.questions.map((x, i) => (i < 4 ? x.answer : (x.answer + 1) % 4)); // first 4 right, last 4 wrong
  const r = await j('post', '/api/quizzes/sql/submit', 's1', { answers });
  expect(r.status).toBe(200);
  expect(r.body.percent).toBe(50);
  expect(r.body.levelName.en).toBe('Elementary');
  expect(r.body.weak.length).toBeGreaterThan(0);
  expect(r.body.strong.length).toBeGreaterThan(0);
  expect(r.body.topics.reduce((s, t) => s + t.total, 0)).toBe(8);
  expect(JSON.stringify(r.body)).not.toMatch(/"answer"/);
});

test('choose up to 5 targets; unknown or too many are refused', async () => {
  expect((await j('put', '/api/me/targets', 's1', { keys: ['nope'] })).status).toBe(400);
  expect((await j('put', '/api/me/targets', 's1', { keys: ['ml', 'web-dev', 'cybersecurity', 'ui-ux', 'networking', 'bcs'] })).status).toBe(400);
  expect((await j('put', '/api/me/targets', 's1', { keys: ['ml', 'web-dev'] })).status).toBe(200);
  expect((await j('put', '/api/me/targets', 'm1', { keys: ['ml'] })).status).toBe(403);
});

test('dashboard has one card per chosen target and named skill levels', async () => {
  await j('put', '/api/targets/ml/topics/py', 's1', { known: true });
  const r = await j('get', '/api/me/dashboard', 's1');
  expect(r.status).toBe(200);
  expect(r.body.selected.map((c) => c.key)).toEqual(['ml', 'web-dev']);
  expect(r.body.selected[0].percent).toBeGreaterThan(0);
  expect(r.body.selected[0].next).toBeTruthy();
  expect(r.body.skills.find((s) => s.skillKey === 'sql').levelEn).toBe('Elementary');
  expect(r.body.nextStep).toBeTruthy();
});

test('mentors are suggested per chosen target with reasons, names shortened', async () => {
  const r = await j('get', '/api/me/target-mentors', 's1');
  expect(r.status).toBe(200);
  const ml = r.body.targets.find((t) => t.key === 'ml');
  expect(ml.mentors[0].name).toBe('Rahim A.');
  expect(ml.mentors[0].why.map((w) => w.skillKey)).toEqual(expect.arrayContaining(['python']));
  expect(r.body.targets.find((t) => t.key === 'web-dev').mentors.length).toBeLessThanOrEqual(3);
});
