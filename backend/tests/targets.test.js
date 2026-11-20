const request = require('supertest');
const { TARGETS, analyse } = require('../src/data/targets');
const { setup, teardown, bearer, mkUni, mkUser, models } = require('./helpers');

describe('target data and path maths', () => {
  test('every prerequisite exists and there are no cycles', () => {
    for (const t of TARGETS) {
      const keys = new Set(t.topics.map((x) => x.key));
      expect(keys.size).toBe(t.topics.length);
      for (const x of t.topics) for (const n of x.needs) expect(keys.has(n)).toBe(true);
      const a = analyse(t, new Set(), {}, 5);
      expect(a.path).toHaveLength(t.topics.length); // a cycle or missing key would break this
      const seen = new Set();
      for (const x of a.path) { for (const n of x.needs) expect(seen.has(n)).toBe(true); seen.add(x.key); } // prerequisites always come first
    }
  });
  test('all 15 targets use known groups, and the 8 new career paths exist', () => {
    const { GROUPS } = require('../src/data/targets');
    for (const t of TARGETS) for (const x of t.topics) expect(Object.keys(GROUPS)).toContain(x.group);
    for (const k of ['web-dev', 'app-dev', 'cybersecurity', 'ui-ux', 'cloud-devops', 'networking', 'digital-marketing', 'graphic-design']) expect(TARGETS.some((t) => t.key === k && t.kind === 'career')).toBe(true);
  });
  test('worked example: ML student who knows Python, NumPy/pandas, stats and linear algebra', () => {
    const ml = TARGETS.find((t) => t.key === 'ml');
    const a = analyse(ml, new Set(['py', 'pydata', 'stats', 'linalg']), {}, 6);
    const sum = ml.topics.reduce((s, t) => s + t.w, 0);
    expect(a.percent).toBe(Math.round((100 * (3 + 3 + 3 + 3)) / sum));
    expect(a.path[0].key).toBe('mlconcepts'); // unlocks linear regression
    expect(a.topics.find((t) => t.key === 'linreg').status).toBe('locked'); // needs mlconcepts first
    expect(a.topics.find((t) => t.key === 'nn').missing).toContain('gd');
    expect(a.weeksLeft).toBe(Math.ceil(a.hoursLeft / 6));
    expect(analyse(ml, new Set(), {}, 0).weeksLeft).toBeNull(); // no weekly hours: no invented forecast
  });
  test('evidence marks a topic verified, self-tick does not', () => {
    const ml = TARGETS.find((t) => t.key === 'ml');
    const a = analyse(ml, new Set(['linalg']), { python: 2 }, 5);
    expect(a.topics.find((t) => t.key === 'pydata').status).toBe('verified');
    expect(a.topics.find((t) => t.key === 'linalg').status).toBe('known');
    expect(a.verifiedPercent).toBeLessThan(a.percent);
  });
});

describe('targets API', () => {
  let app;
  beforeAll(async () => { app = await setup(); const u = await mkUni('EDU', 'EDU', 'Chattogram', 91.83, 22.35); await mkUser('ts', 'student', u); await mkUser('ts2', 'student', u); await mkUser('tm', 'mentor', u); });
  afterAll(teardown);
  test('tick, score, order and privacy', async () => {
    const before = await request(app).get('/api/targets/ml').set(bearer('ts'));
    expect(before.status).toBe(200); expect(before.body.percent).toBe(0); expect(before.body.nextKey).toBeTruthy();
    for (const k of ['py', 'pydata', 'stats']) expect((await request(app).put(`/api/targets/ml/topics/${k}`).set(bearer('ts')).send({ known: true })).status).toBe(200);
    const after = await request(app).get('/api/targets/ml').set(bearer('ts'));
    expect(after.body.percent).toBeGreaterThan(0);
    expect(after.body.topics.find((t) => t.key === 'py').status).toBe('known');
    expect(after.body.path.find((t) => t.key === 'py')).toBeUndefined();
    expect(after.body.path[0].order).toBe(1);
    expect((await request(app).get('/api/targets/ml').set(bearer('ts2'))).body.percent).toBe(0); // private
    expect(await models.SkillEvidence.countDocuments({})).toBe(0); // ticking is never evidence
    expect((await request(app).get('/api/targets').set(bearer('ts'))).body.targets).toHaveLength(TARGETS.length);
    expect((await request(app).put('/api/targets/ml/topics/py').set(bearer('ts')).send({ known: false })).status).toBe(200);
    expect((await request(app).put('/api/targets/ml/topics/nope').set(bearer('ts')).send({ known: true })).status).toBe(404);
    expect((await request(app).get('/api/targets/nope').set(bearer('ts'))).status).toBe(404);
    expect((await request(app).get('/api/targets/ml').set(bearer('tm'))).status).toBe(403);
    expect((await request(app).put('/api/targets/ml/topics/py').set(bearer('ts')).send({ known: true, extra: 1 })).status).toBe(400);
  });
});
