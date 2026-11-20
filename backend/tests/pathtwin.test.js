const request = require('supertest');
const { setup, teardown, bearer, mkUni, mkUser, models } = require('./helpers');
const { findTwins, similarity } = require('../src/services/pathtwin');
const { seedLearning } = require('../src/seed/learning');

let app, uni, S, M1, M2, M3, E;
const j = (m, u, uid, body) => request(app)[m](u).set(bearer(uid)).send(body);
const ms = (...a) => a.map(([skillKey, month, level]) => ({ skillKey, month, level }));

beforeAll(async () => {
  app = await setup(); await seedLearning();
  uni = await mkUni('EDU', 'EDU', 'Chattogram', 91.83, 22.35);
  S = await mkUser('s1', 'student', uni); M1 = await mkUser('m1', 'mentor', uni, { displayName: 'Rahim Ahmed' });
  M2 = await mkUser('m2', 'mentor', uni, { displayName: 'Kamal Uddin' }); M3 = await mkUser('m3', 'mentor', uni, { displayName: 'Hidden Person' });
  E = await mkUser('e1', 'employer', null);
  for (const m of [M1, M2, M3]) await models.MentorProfile.create({ userId: m._id, roleTitle: 'Analyst', industry: 'Fintech' });
  await models.SkillEvidence.insertMany([{ studentId: S._id, skillKey: 'excel', type: 'project', level: 3 }, { studentId: S._id, skillKey: 'sql', type: 'quiz', level: 1 }]);
});
afterAll(teardown);

describe('path twin maths', () => {
  test('identical skills give 1 and disjoint give 0', () => {
    expect(similarity({ a: 2 }, { a: 2 })).toBe(1);
    expect(similarity({ a: 2 }, { b: 2 })).toBe(0);
    expect(similarity({}, {})).toBe(0);
  });
  test('a journey with nothing after graduation is not a twin', () => {
    const r = findTwins({ excel: 3 }, [{ mentorId: 'x', milestones: ms(['excel', -2, 3]) }]);
    expect(r.twins).toHaveLength(0);
  });
  test('consensus skips skills the student already has', () => {
    const r = findTwins({ excel: 3, sql: 2 }, [{ mentorId: 'x', milestones: ms(['excel', -2, 3], ['sql', 3, 2], ['python', 6, 2]) }]);
    expect(r.consensus.map((c) => c.skillKey)).toEqual(['python']);
  });
});

describe('path twin routes', () => {
  test('only a mentor can edit a journey, with real skills and strict fields', async () => {
    expect((await j('put', '/api/me/journey', 's1', { shared: true, milestones: [] })).status).toBe(403);
    expect((await j('put', '/api/me/journey', 'm1', { shared: true, milestones: ms(['nope', 1, 2]) })).status).toBe(400);
    expect((await j('put', '/api/me/journey', 'm1', { shared: true, milestones: [], salary: 5 })).status).toBe(400);
    const ok = await j('put', '/api/me/journey', 'm1', { shared: true, firstJobMonths: 4, milestones: ms(['excel', -3, 3], ['sql', 2, 2], ['python', 6, 2]) });
    expect(ok.status).toBe(200);
    await j('put', '/api/me/journey', 'm2', { shared: true, firstJobMonths: 6, milestones: ms(['excel', -1, 2], ['sql', 4, 3]) });
    await j('put', '/api/me/journey', 'm3', { shared: false, milestones: ms(['excel', -1, 3], ['sql', 4, 3]) });
  });
  test('student sees twins in order, names shortened, unshared journeys hidden', async () => {
    const r = await j('get', '/api/me/path-twins', 's1');
    expect(r.status).toBe(200);
    expect(r.body.twins.map((t) => t.name)).toEqual(['Rahim A.', 'Kamal U.']);
    expect(r.body.twins[0].similarity).toBeGreaterThan(r.body.twins[1].similarity);
    expect(JSON.stringify(r.body)).not.toMatch(/Hidden|@t\.test/);
    expect(r.body.twins[0].next[0]).toMatchObject({ skillKey: 'sql', month: 2, youHave: false });
    expect(r.body.consensus[0].skillKey).toBe('sql');
  });
  test('only students can open it; employers are refused', async () => {
    expect((await j('get', '/api/me/path-twins', 'm1')).status).toBe(403);
    expect((await j('get', '/api/me/path-twins', 'e1')).status).toBe(403);
  });
});
