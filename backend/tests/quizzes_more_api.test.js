const request = require('supertest');
const { setup, teardown, bearer, mkUni, mkUser } = require('./helpers');
const { seedLearning } = require('../src/seed/learning');
const { MORE_QUIZZES } = require('../src/seed/quizzes_more');

let app;
beforeAll(async () => {
  app = await setup(); await seedLearning();
  const uni = await mkUni('EDU', 'EDU', 'Chattogram', 91.83, 22.35);
  await mkUser('s1', 'student', uni);
});
afterAll(teardown);

test('an extra quiz is served without answers and graded on the server', async () => {
  const g = await request(app).get('/api/quizzes/cybersecurity').set(bearer('s1'));
  expect(g.status).toBe(200);
  expect(g.body.questions).toHaveLength(MORE_QUIZZES.cybersecurity.length);
  expect(JSON.stringify(g.body)).not.toContain('answer');
  const right = MORE_QUIZZES.cybersecurity.map((x) => x.answer);
  const r = await request(app).post('/api/quizzes/cybersecurity/submit').set(bearer('s1')).send({ answers: right });
  expect(r.status).toBe(200);
  expect(r.body.percent).toBe(100);
  expect(r.body.levelAwarded).toBeGreaterThan(0);
});
