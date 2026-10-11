jest.mock('../src/config/firebase', () => ({
  verifyToken: async (t) => { if (!t.startsWith('test-')) throw new Error('bad'); return { uid: t.slice(5) }; },
  getAuthUser: async (uid) => ({ email: `${uid}@test.dev` }),
  getAuth: () => ({}),
}));

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const University = require('../src/models/University');
const MentorProfile = require('../src/models/MentorProfile');
const Match = require('../src/models/Match');
const Block = require('../src/models/Block');
const { seedSkills } = require('../seed/seedSkills');

let mongod, app, uni;
const auth = (uid) => ({ Authorization: `Bearer test-${uid}` });
const mkUser = (uid, role, extra = {}) => User.create({ firebaseUid: uid, email: `${uid}@t.dev`, displayName: `${uid} Person`,
  role, universityId: uni._id, verificationStatus: 'verified', ...extra });
const goal = { careerGoalRoleKey: 'data-analyst', weeklyHours: 6, languages: ['bn', 'en'], preferredSlots: ['Sun 20:30'] };
async function mkMentor(uid, over = {}, userOver = {}) {
  const u = await mkUser(uid, 'mentor', userOver);
  await MentorProfile.create({ userId: u._id, industry: 'Software', roleTitle: 'Data Analyst', roleKeys: ['data-analyst'], yearsExperience: 5,
    expertiseSkills: [{ skillKey: 'sql', level: 3 }, { skillKey: 'powerbi', level: 3 }], languages: ['bn', 'en'],
    weeklyCapacity: 3, activeMentees: 0, availableSlots: ['Sun 20:30'], sessionsCompleted: 5, acceptedRequests: 6, isRising: false, ...over });
  return u;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = createApp();
});
afterAll(async () => { await mongoose.disconnect(); if (mongod) await mongod.stop(); });
beforeEach(async () => {
  await Promise.all([User, University, MentorProfile, Match, Block, require('../src/models/StudentProfile'), require('../src/models/SkillEvidence')].map((m) => m.deleteMany({})));
  uni = await University.create({ name: 'U', shortName: 'U', city: 'C', campus: { type: 'Point', coordinates: [90, 23] } });
  await seedSkills();
});

describe('catalog, goal, evidence, readiness', () => {
  test('roles list has the 6 seeded roles with skills', async () => {
    await mkUser('s1', 'student');
    const res = await request(app).get('/api/roles').set(auth('s1'));
    expect(res.body.roles).toHaveLength(6);
    expect(res.body.roles.find((r) => r.key === 'data-analyst').requiredSkills.length).toBe(6);
  });
  test('readiness before a goal -> 400 GOAL_REQUIRED', async () => {
    await mkUser('s1', 'student');
    const res = await request(app).get('/api/me/readiness').set(auth('s1'));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('GOAL_REQUIRED');
  });
  test('goal -> 0% readiness, gaps ordered SQL, Power BI; time-to-ready is a number', async () => {
    await mkUser('s1', 'student');
    expect((await request(app).put('/api/me/goal').set(auth('s1')).send(goal)).status).toBe(200);
    const { readiness } = (await request(app).get('/api/me/readiness').set(auth('s1'))).body;
    expect(readiness.readinessPercent).toBe(0);
    expect(readiness.gaps.slice(0, 2).map((g) => g.skillKey)).toEqual(['sql', 'powerbi']);
    expect(typeof readiness.timeToReadyWeeks).toBe('number');
  });
  test('weeklyHours 0 -> timeToReadyWeeks null with a note', async () => {
    await mkUser('s1', 'student');
    await request(app).put('/api/me/goal').set(auth('s1')).send({ ...goal, weeklyHours: 0 });
    const { readiness } = (await request(app).get('/api/me/readiness').set(auth('s1'))).body;
    expect(readiness.timeToReadyWeeks).toBeNull();
    expect(readiness.timeToReadyNote).toBeTruthy();
  });
  test('a self-rating of 3 only counts as level 1 (no self-inflated readiness)', async () => {
    await mkUser('s1', 'student');
    await request(app).put('/api/me/goal').set(auth('s1')).send(goal);
    await request(app).post('/api/me/evidence').set(auth('s1')).send({ skillKey: 'sql', type: 'self', level: 3 });
    const { readiness } = (await request(app).get('/api/me/readiness').set(auth('s1'))).body;
    expect(readiness.skills.find((s) => s.skillKey === 'sql')).toMatchObject({ currentLevel: 1, verified: false });
  });
  test('student cannot submit quiz/endorsement evidence or set verified', async () => {
    await mkUser('s1', 'student');
    for (const body of [{ skillKey: 'sql', type: 'quiz', level: 3 }, { skillKey: 'sql', type: 'endorsement', level: 3 },
      { skillKey: 'sql', type: 'self', level: 3, verified: true }]) {
      expect((await request(app).post('/api/me/evidence').set(auth('s1')).send(body)).status).toBe(400);
    }
  });
  test('project needs a url; unknown skill rejected; evidence is unverified', async () => {
    await mkUser('s1', 'student');
    expect((await request(app).post('/api/me/evidence').set(auth('s1')).send({ skillKey: 'sql', type: 'project', level: 2 })).status).toBe(400);
    expect((await request(app).post('/api/me/evidence').set(auth('s1')).send({ skillKey: 'nope', type: 'self', level: 1 })).status).toBe(400);
    const ok = await request(app).post('/api/me/evidence').set(auth('s1')).send({ skillKey: 'sql', type: 'project', level: 2, url: 'https://example.com/p' });
    expect(ok.status).toBe(201);
    expect(ok.body.evidence.verified).toBe(false);
  });
  test('role checks: mentor cannot use student endpoints, student cannot edit mentor profile', async () => {
    await mkUser('m1', 'mentor'); await mkUser('s1', 'student');
    expect((await request(app).get('/api/me/readiness').set(auth('m1'))).status).toBe(403);
    expect((await request(app).get('/api/matches').set(auth('m1'))).status).toBe(403);
    expect((await request(app).put('/api/me/mentor-profile').set(auth('s1')).send({})).status).toBe(403);
  });
  test('mentor cannot send server-maintained stats', async () => {
    await mkUser('m1', 'mentor');
    const res = await request(app).put('/api/me/mentor-profile').set(auth('m1')).send({
      industry: 'X', roleTitle: 'Analyst', roleKeys: [], yearsExperience: 3, expertiseSkills: [], languages: ['en'],
      weeklyCapacity: 3, availableSlots: [], ratingAvg: 5, isRising: false });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/matches', () => {
  async function studentWithGoal() { await mkUser('s1', 'student'); await request(app).put('/api/me/goal').set(auth('s1')).send(goal); }

  test('returns at most 5 mentors with scores, factor scores and reasons in both languages', async () => {
    await studentWithGoal();
    for (let i = 0; i < 7; i++) await mkMentor(`m${i}`, { yearsExperience: i + 1 });
    const res = await request(app).get('/api/matches').set(auth('s1'));
    expect(res.status).toBe(200);
    expect(res.body.matches.length).toBeLessThanOrEqual(5);
    const m = res.body.matches[0];
    expect(m.score).toBeGreaterThan(0);
    expect(Object.keys(m.factorScores).sort()).toEqual(['career', 'experience', 'gaps', 'language', 'reliability', 'schedule']);
    expect(m.reasons.en).toMatch(/Recommended because/);
    expect(m.reasons.bn).toBeTruthy();
    expect(res.body.baseline.length).toBeGreaterThan(0);
  });
  test('paused, full, unverified and blocked mentors are excluded', async () => {
    await studentWithGoal();
    const ok = await mkMentor('ok');
    await mkMentor('paused', { paused: true });
    await mkMentor('full', { activeMentees: 3 });
    await mkMentor('unver', {}, { verificationStatus: 'pending' });
    const blocked = await mkMentor('blocked');
    const s = await User.findOne({ firebaseUid: 's1' });
    await Block.create({ blockerId: s._id, blockedId: blocked._id });
    const res = await request(app).get('/api/matches').set(auth('s1'));
    expect(res.body.matches.map((m) => m.mentorId)).toEqual([String(ok._id)]);
  });
  test('saves factor scores once per pair (repeat calls do not duplicate)', async () => {
    await studentWithGoal(); await mkMentor('m1');
    await request(app).get('/api/matches').set(auth('s1'));
    await request(app).get('/api/matches').set(auth('s1'));
    expect(await Match.countDocuments()).toBe(1);
    expect((await Match.findOne()).factorScores.gaps).toBe(1);
  });
  test('a rising mentor appears even when stronger mentors fill the top 5', async () => {
    await studentWithGoal();
    for (let i = 0; i < 6; i++) await mkMentor(`strong${i}`, { yearsExperience: 10 });
    await mkMentor('rise', { isRising: true, yearsExperience: 1, sessionsCompleted: 0, acceptedRequests: 0, availableSlots: [] });
    const res = await request(app).get('/api/matches').set(auth('s1'));
    expect(res.body.matches.some((m) => m.isRising)).toBe(true);
    expect(res.body.matches).toHaveLength(5);
  });
});
