// API test for the launch features with an in-memory fake of the model layer (no MongoDB needed).
const id = (n) => String(n).padStart(24, '0');
const mockChain = (v) => { const p = Promise.resolve(v); p.select = () => p; p.limit = () => p; p.sort = () => p; p.lean = () => p; return p; };
const mockData = {
  users: {
    s1: { _id: id(1), firebaseUid: 's1', role: 'student', displayName: 'Sara Khan', verificationStatus: 'verified', universityId: id(50), department: 'CSE', email: 'sara@secret.test' },
    s2: { _id: id(2), firebaseUid: 's2', role: 'student', displayName: 'Nila Roy', verificationStatus: 'pending' },
    m1: { _id: id(3), firebaseUid: 'm1', role: 'mentor', displayName: 'Mina Roy', verificationStatus: 'verified' },
    e1: { _id: id(4), firebaseUid: 'e1', role: 'employer', displayName: 'Hasan Co' },
    e2: { _id: id(5), firebaseUid: 'e2', role: 'employer', displayName: 'Pending Co' },
  },
  passports: { goodslug123: { _id: id(60), userId: id(1), slug: 'goodslug123', enabled: true, talentPool: true, headline: '<script>alert(1)</script>', show: {} }, offslug1234: { _id: id(61), userId: id(1), slug: 'offslug1234', enabled: false } },
  evidence: [{ _id: id(70), studentId: id(1), skillKey: 'sql', type: 'quiz', level: 2 }, { _id: id(71), studentId: id(1), skillKey: 'python', type: 'self', level: 3 }],
  sprint: { _id: id(80), studentId: id(1), mentorId: id(3), status: 'submitted', skillKey: 'sql', titleEn: 'SQL sprint', proofUrl: 'https://x.y', days: [] },
};
jest.mock('../src/models', () => new Proxy({}, { get: (_t, name) => {
  const d = mockData;
  const tbl = {
    User: {
      findOne: (q) => Promise.resolve(q.firebaseUid ? d.users[q.firebaseUid] || null : Object.values(d.users).find((u) => String(u._id) === String(q._id) && (!q.role || u.role === q.role)) || null),
      findById: (i) => mockChain(Object.values(d.users).find((u) => String(u._id) === String(i)) || null),
      find: (q) => mockChain(Object.values(d.users).filter((u) => (q._id && q._id.$in || []).map(String).includes(String(u._id)))),
    },
    University: { findById: () => mockChain({ name: 'East Delta University', shortName: 'EDU', city: 'Chattogram' }) },
    Passport: {
      findOne: (q) => { const p = q.slug ? d.passports[q.slug] : Object.values(d.passports).find((x) => String(x.userId) === String(q.userId)); return mockChain(p && (q.enabled === undefined || p.enabled === q.enabled) ? p : null); },
      find: () => mockChain([d.passports.goodslug123]),
      updateOne: () => Promise.resolve({}),
    },
    SkillEvidence: { find: () => mockChain(d.evidence), create: async (x) => x },
    Skill: { find: () => mockChain([{ key: 'sql', nameEn: 'SQL', nameBn: 'এসকিউএল' }, { key: 'python', nameEn: 'Python', nameBn: 'পাইথন' }]) },
    PortfolioProject: { find: () => mockChain([]) },
    GithubLink: { findOne: () => mockChain(null) },
    Sprint: { find: () => mockChain([]), findOne: (q) => mockChain(String(q._id) === id(80) ? d.sprint : null) },
    OrganizationMember: { findOne: (q) => Promise.resolve(String(q.userId) === id(4) ? { organizationId: id(90) } : String(q.userId) === id(5) ? { organizationId: id(91) } : null) },
    Organization: { findById: (i) => Promise.resolve({ _id: i, name: 'Demo Tech', verificationStatus: String(i) === id(90) ? 'verified' : 'pending' }) },
    MentorRequest: { findOne: () => Promise.resolve({ _id: id(99) }) },
    MentorProfile: { findOne: () => mockChain({ expertiseSkills: [{ skillKey: 'sql', level: 1 }] }) },
    Notification: { create: async () => ({}) },
    AuditLog: { create: async () => ({}) },
  };
  return tbl[name] || new Proxy({}, { get: () => (..._a) => (name.endsWith('Request') ? Promise.resolve(null) : mockChain([])) });
} }));

const request = require('supertest');
const { createApp } = require('../src/app');
const app = createApp({ verify: async (c) => ({ uid: c, email: `${c}@t.test` }) });
const as = (uid) => ({ Authorization: `Bearer ${uid}` });

describe('public passport', () => {
  test('shows proven skills only, hides contact details, works without sign-in', async () => {
    const r = await request(app).get('/api/public/passport/goodslug123');
    expect(r.status).toBe(200);
    expect(r.body.name).toBe('Sara K.');
    expect(r.body.skills.map((s) => s.skillKey)).toEqual(['sql']); // python was only self-rated
    expect(JSON.stringify(r.body)).not.toMatch(/secret\.test|email/i);
  });
  test('unknown, switched-off and malformed links all look the same (404)', async () => {
    for (const s of ['nothere123', 'offslug1234', 'x']) expect((await request(app).get(`/api/public/passport/${s}`)).status).toBe(404);
  });
  test('the HTML page escapes the owner\'s text and is not indexable', async () => {
    const r = await request(app).get('/p/goodslug123');
    expect(r.status).toBe(200);
    expect(r.text).not.toContain('<script>alert(1)</script>');
    expect(r.text).toContain('&lt;script&gt;');
    expect(r.headers['x-robots-tag']).toMatch(/noindex/);
    expect((await request(app).get('/p/offslug1234')).status).toBe(404);
  });
});

describe('sharing settings', () => {
  test('an unverified student cannot switch sharing on; unknown fields are rejected', async () => {
    expect((await request(app).put('/api/me/passport').set(as('s2')).send({ enabled: true })).status).toBe(400);
    expect((await request(app).put('/api/me/passport').set(as('s1')).send({ role: 'admin' })).status).toBe(400);
    expect((await request(app).put('/api/me/passport').set(as('m1')).send({ enabled: true })).status).toBe(403);
  });
});

describe('talent pool', () => {
  test('needs a verified company, 1-6 skills, and returns only proven matches without contact data', async () => {
    expect((await request(app).get('/api/employer/talent?skills=sql:1').set(as('s1'))).status).toBe(403);
    expect((await request(app).get('/api/employer/talent?skills=sql:1').set(as('e2'))).status).toBe(403);
    expect((await request(app).get('/api/employer/talent').set(as('e1'))).status).toBe(400);
    const ok = await request(app).get('/api/employer/talent?skills=sql:2,python:1').set(as('e1'));
    expect(ok.status).toBe(200);
    expect(ok.body.cards).toHaveLength(1);
    expect(ok.body.cards[0].matched.map((m) => m.skillKey)).toEqual(['sql']);
    expect(ok.body.cards[0].notProven[0].skillKey).toBe('python'); // self-rated python does not count
    expect(JSON.stringify(ok.body)).not.toMatch(/secret\.test|email|phone/i);
  });
  test('students and mentors cannot use the company endpoints', async () => {
    expect((await request(app).post(`/api/employer/talent/${id(1)}/invite`).set(as('s1')).send({})).status).toBe(403);
    expect((await request(app).get('/api/employer/invites').set(as('m1'))).status).toBe(403);
  });
});

describe('mentor sprint review', () => {
  test('a mentor cannot endorse above their own level; only students start sprints', async () => {
    const r = await request(app).post(`/api/mentor/sprints/${id(80)}/review`).set(as('m1')).send({ decision: 'endorse', level: 3 });
    expect(r.status).toBe(400); expect(r.body.error.code).toBe('ABOVE_YOUR_LEVEL');
    expect((await request(app).post('/api/me/sprints').set(as('m1')).send({ skillKey: 'sql' })).status).toBe(403);
    expect((await request(app).get('/api/me/brief')).status).toBe(401);
  });
});
