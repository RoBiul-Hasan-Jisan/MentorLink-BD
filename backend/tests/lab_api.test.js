// API test for the Decision Lab with an in-memory fake of the model layer, so it runs without MongoDB.
const mockChain = (v) => { const p = Promise.resolve(v); p.select = () => p; p.limit = () => p; p.lean = () => p; return p; };
const mockData = {
  users: { s1: { _id: 'u-s1', firebaseUid: 's1', role: 'student' }, m1: { _id: 'u-m1', firebaseUid: 'm1', role: 'mentor' } },
  profile: { userId: 'u-s1', careerGoalRoleKey: 'data-analyst', weeklyHours: 5 },
  roles: [
    { key: 'data-analyst', titleEn: 'Data Analyst', titleBn: 'ডেটা অ্যানালিস্ট', requiredSkills: [{ skillKey: 'sql', weight: 3, requiredLevel: 3 }, { skillKey: 'excel', weight: 2, requiredLevel: 3 }, { skillKey: 'dashboard', weight: 2, requiredLevel: 2 }] },
    { key: 'qa-engineer', titleEn: 'QA Engineer', titleBn: 'কিউএ', requiredSkills: [{ skillKey: 'testing', weight: 3, requiredLevel: 3 }, { skillKey: 'sql', weight: 1, requiredLevel: 2 }] },
    { key: 'management-trainee', titleEn: 'Management Trainee', titleBn: 'ম্যানেজমেন্ট', requiredSkills: [{ skillKey: 'communication', weight: 3, requiredLevel: 3 }] },
    { key: 'banking-trainee', titleEn: 'Banking', titleBn: 'ব্যাংকিং', requiredSkills: [{ skillKey: 'banking', weight: 3, requiredLevel: 2 }] },
  ],
  skills: ['sql', 'excel', 'dashboard', 'testing', 'communication', 'banking'].map((key) => ({ key, nameEn: key.toUpperCase(), nameBn: key, learningHours: 20 })),
  evidence: [{ skillKey: 'sql', type: 'quiz', level: 2 }],
  postings: [],
  mentors: [{ _id: 'u-m1', blockedBy: [] }],
  mentorProfiles: [{ userId: 'u-m1', expertiseSkills: [{ skillKey: 'excel', level: 3 }], weeklyCapacity: 3, acceptedRequests: 0 }],
};
jest.mock('../src/models', () => new Proxy({}, { get: (_t, name) => {
  const d = mockData;
  const tbl = {
    User: { findOne: ({ firebaseUid }) => Promise.resolve(d.users[firebaseUid] || null), find: () => mockChain(d.mentors) },
    StudentProfile: { findOne: () => mockChain(d.profile) },
    RoleTemplate: { find: () => mockChain(d.roles) }, Skill: { find: () => mockChain(d.skills) },
    SkillEvidence: { find: () => mockChain(d.evidence) }, Opportunity: { find: () => mockChain(d.postings) },
    Quiz: { find: () => mockChain([{ skillKey: 'excel' }]) }, MentorProfile: { find: () => mockChain(d.mentorProfiles) },
  };
  return tbl[name] || new Proxy({}, { get: () => () => mockChain([]) });
} }));

const request = require('supertest');
const { createApp } = require('../src/app');
const verify = async (c) => ({ uid: c, email: `${c}@t.test` });
const app = createApp({ verify });
const as = (uid) => ({ Authorization: `Bearer ${uid}` });

describe('GET /me/decision-lab', () => {
  test('compares my goal with the closest other roles and explains the next step', async () => {
    const r = await request(app).get('/api/me/decision-lab').set(as('s1'));
    expect(r.status).toBe(200);
    expect(r.body.roles).toHaveLength(3);
    expect(r.body.roles.map((x) => x.fitRank)).toEqual([1, 2, 3]);
    const da = r.body.roles.find((x) => x.role.key === 'data-analyst');
    expect(da.next).toMatchObject({ skillKey: 'excel', action: 'quiz', mentorsAvailable: 1 });
    expect(da.skills.find((x) => x.skillKey === 'dashboard')).toMatchObject({ startable: false });
    expect(da.postingNote).toMatch(/Only 0 approved posting/);
    expect(r.body.note).toMatch(/not a chance of getting a job/);
  });
  test('reports my goal separately from the ranking, and my saved weekly hours', async () => {
    const r = await request(app).get('/api/me/decision-lab?roles=management-trainee,qa-engineer,data-analyst').set(as('s1'));
    expect(r.status).toBe(200);
    expect(r.body.goalRoleKey).toBe('data-analyst');
    expect(r.body.weeklyHours).toBe(5);
    expect(r.body.roles.map((x) => x.role.key).sort()).toEqual(['data-analyst', 'management-trainee', 'qa-engineer']);
    for (const x of r.body.roles) {
      expect(typeof x.provenReadiness).toBe('number');
      expect(typeof x.confidence).toBe('number');
      expect(x.postings).toHaveProperty('used');
    }
  });
  test('weeklyHours is null (not a made-up default) when the profile has none', async () => {
    const saved = mockData.profile;
    mockData.profile = { userId: 'u-s1', careerGoalRoleKey: 'data-analyst' };
    try {
      const r = await request(app).get('/api/me/decision-lab').set(as('s1'));
      expect(r.body.weeklyHours).toBeNull();
      expect(r.body.roles.every((x) => x.timeToReadyWeeks === null)).toBe(true);
    } finally { mockData.profile = saved; }
  });
  test('rejects unknown roles and more than three roles', async () => {
    expect((await request(app).get('/api/me/decision-lab?roles=nope').set(as('s1'))).status).toBe(400);
    expect((await request(app).get('/api/me/decision-lab?roles=data-analyst,qa-engineer,management-trainee,banking-trainee').set(as('s1'))).status).toBe(400);
  });
  test('only students may call it', async () => {
    expect((await request(app).get('/api/me/decision-lab').set(as('m1'))).status).toBe(403);
    expect((await request(app).get('/api/me/decision-lab')).status).toBe(401);
  });
});

describe('POST /me/decision-lab/simulate', () => {
  test('returns a labelled hypothetical result', async () => {
    const r = await request(app).post('/api/me/decision-lab/simulate').set(as('s1')).send({ roleKey: 'data-analyst', learn: [{ skillKey: 'excel', level: 3 }] });
    expect(r.status).toBe(200);
    expect(r.body.hypothetical).toBe(true);
    expect(r.body.delta).toBeGreaterThan(0);
    expect(r.body.provenReadiness.after).toBe(r.body.provenReadiness.before);
  });
  test('a scenario weeklyHours changes the estimate for this call only and is never saved', async () => {
    const body = { roleKey: 'data-analyst', learn: [{ skillKey: 'excel', level: 3 }] };
    const base = await request(app).post('/api/me/decision-lab/simulate').set(as('s1')).send(body);
    const fast = await request(app).post('/api/me/decision-lab/simulate').set(as('s1')).send({ ...body, weeklyHours: 20 });
    expect(base.body.assumption).toEqual({ weeklyHours: 5, source: 'profile' });
    expect(fast.body.assumption).toEqual({ weeklyHours: 20, source: 'scenario' });
    expect(fast.body.studyWeeksNeeded).toBeLessThan(base.body.studyWeeksNeeded);
    expect(fast.body.after.readiness).toBe(base.body.after.readiness);
    expect(fast.body.provenReadiness.after).toBe(fast.body.provenReadiness.before);
    expect(mockData.profile.weeklyHours).toBe(5); // the saved profile is untouched (the mock has no write methods, so a write would have thrown)
    expect(mockData.evidence).toEqual([{ skillKey: 'sql', type: 'quiz', level: 2 }]); // no evidence was created
  });
  test('without a saved pace and without a scenario there are no week estimates; a scenario supplies them', async () => {
    const saved = mockData.profile;
    mockData.profile = { userId: 'u-s1', careerGoalRoleKey: 'data-analyst' };
    try {
      const body = { roleKey: 'data-analyst', learn: [{ skillKey: 'excel', level: 3 }] };
      const none = await request(app).post('/api/me/decision-lab/simulate').set(as('s1')).send(body);
      expect(none.body.studyWeeksNeeded).toBeNull();
      expect(none.body.assumption).toEqual({ weeklyHours: null, source: 'none' });
      const some = await request(app).post('/api/me/decision-lab/simulate').set(as('s1')).send({ ...body, weeklyHours: 10 });
      expect(some.body.studyWeeksNeeded).toBe(6); // excel 0 -> 3 = 3 x 20h = 60h at 10h/week
    } finally { mockData.profile = saved; }
  });
  test('rejects an invalid weeklyHours', async () => {
    const p = (weeklyHours) => request(app).post('/api/me/decision-lab/simulate').set(as('s1')).send({ roleKey: 'data-analyst', learn: [{ skillKey: 'excel', level: 2 }], weeklyHours });
    for (const bad of [0, -3, 81, 2.5, '5', null, 'many']) expect((await p(bad)).status).toBe(400);
    expect((await p(1)).status).toBe(200);
    expect((await p(80)).status).toBe(200);
  });
  test('validates the body strictly', async () => {
    const p = (b) => request(app).post('/api/me/decision-lab/simulate').set(as('s1')).send(b);
    expect((await p({ roleKey: 'data-analyst', learn: [] })).status).toBe(400);
    expect((await p({ roleKey: 'data-analyst', learn: [{ skillKey: 'excel', level: 9 }] })).status).toBe(400);
    expect((await p({ roleKey: 'data-analyst', learn: [{ skillKey: 'ghost', level: 2 }] })).status).toBe(400);
    expect((await p({ roleKey: 'data-analyst', role: 'admin', learn: [{ skillKey: 'excel', level: 2 }] })).status).toBe(400);
  });
});
