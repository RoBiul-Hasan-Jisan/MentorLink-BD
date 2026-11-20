// API test for the career features with an in-memory fake of the model layer, so it runs without MongoDB.
const mockChain = (v) => { const p = Promise.resolve(v); p.select = () => p; p.limit = () => p; p.sort = () => p; p.lean = () => p; return p; };
const mockData = {
  users: {
    s1: { _id: 'u-s1', firebaseUid: 's1', role: 'student', displayName: 'Sara Khan' },
    m1: { _id: 'u-m1', firebaseUid: 'm1', role: 'mentor', displayName: 'Mina Roy' },
    d1: { _id: 'u-d1', firebaseUid: 'd1', role: 'department', universityId: 'uni1', department: 'CSE' },
    d2: { _id: 'u-d2', firebaseUid: 'd2', role: 'department' },
  },
  students: [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }],
};
jest.mock('../src/models', () => new Proxy({}, { get: (_t, name) => {
  const d = mockData;
  const tbl = {
    User: { findOne: ({ firebaseUid }) => Promise.resolve(d.users[firebaseUid] || null), find: () => mockChain(d.students) },
    StudentProfile: { findOne: () => mockChain({ userId: 'u-s1', selectedTargets: ['ml'], weeklyHours: 5 }) },
    Skill: { find: () => mockChain([{ key: 'python' }, { key: 'sql' }]) },
  };
  return tbl[name] || new Proxy({}, { get: () => () => mockChain([]) });
} }));

const request = require('supertest');
const { createApp } = require('../src/app');
const app = createApp({ verify: async (c) => ({ uid: c, email: `${c}@t.test` }) });
const as = (uid) => ({ Authorization: `Bearer ${uid}` });

describe('GET /me/graph', () => {
  test('returns the graph for the selected target with a column for every node', async () => {
    const r = await request(app).get('/api/me/graph').set(as('s1'));
    expect(r.status).toBe(200);
    expect(r.body.target.key).toBe('ml');
    expect(r.body.nodes.length).toBeGreaterThan(10);
    expect(r.body.nodes.every((n) => Number.isInteger(n.col) && n.col < r.body.columns)).toBe(true);
    expect(r.body.available.length).toBeGreaterThan(3);
  });
  test('404 for an unknown target, 403 for a mentor, 401 without sign-in', async () => {
    expect((await request(app).get('/api/me/graph?target=nope').set(as('s1'))).status).toBe(404);
    expect((await request(app).get('/api/me/graph').set(as('m1'))).status).toBe(403);
    expect((await request(app).get('/api/me/graph')).status).toBe(401);
  });
});

describe('projects, plan review and mentor routes', () => {
  const post = (b) => request(app).post('/api/me/projects').set(as('s1')).send(b);
  test('a project needs an https link, 1 to 5 skills, and no extra fields', async () => {
    const ok = { title: 'Sales dashboard', url: 'https://github.com/o/r', skillKeys: ['python'] };
    expect((await post({ ...ok, url: 'http://github.com/o/r' })).status).toBe(400);
    expect((await post({ ...ok, url: 'javascript:alert(1)' })).status).toBe(400);
    expect((await post({ ...ok, skillKeys: [] })).status).toBe(400);
    expect((await post({ ...ok, skillKeys: ['a', 'b', 'c', 'd', 'e', 'f'] })).status).toBe(400);
    expect((await post({ ...ok, title: 'ab' })).status).toBe(400);
    expect((await post({ ...ok, level: 3 })).status).toBe(400); // a student cannot set their own level
  });
  test('students cannot open the mentor queue and mentors cannot ask for a plan review', async () => {
    expect((await request(app).get('/api/mentor/plan-reviews').set(as('s1'))).status).toBe(403);
    expect((await request(app).post('/api/me/plan-review').set(as('m1')).send({ mentorId: 'x' })).status).toBe(403);
    expect((await request(app).post('/api/mentor/plan-reviews/abc').set(as('s1')).send({ decision: 'approved' })).status).toBe(403);
  });
  test('a mentor decision must be approved or changes', async () => {
    expect((await request(app).post('/api/mentor/plan-reviews/abc').set(as('m1')).send({ decision: 'maybe' })).status).toBe(400);
  });
  test('GitHub username is checked before any network call', async () => {
    const r = await request(app).post('/api/me/github/start').set(as('s1')).send({ username: 'bad name!' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('BAD_GITHUB_USERNAME');
  });
  test('help finder rejects an unknown kind of help', async () => {
    expect((await request(app).get('/api/me/help-finder/mentors?focus=nope').set(as('s1'))).status).toBe(400);
  });
});

describe('GET /department/analytics', () => {
  test('hides everything when the department has fewer than 5 students', async () => {
    const r = await request(app).get('/api/department/analytics').set(as('d1'));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ hidden: true, k: 5 });
    expect(r.body.goals).toBeUndefined();
  });
  test('needs a university and department, and is closed to students and mentors', async () => {
    expect((await request(app).get('/api/department/analytics').set(as('d2'))).status).toBe(400);
    expect((await request(app).get('/api/department/analytics').set(as('s1'))).status).toBe(403);
    expect((await request(app).get('/api/department/analytics').set(as('m1'))).status).toBe(403);
  });
});
