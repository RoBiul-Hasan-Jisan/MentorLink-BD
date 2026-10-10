// Fake Firebase: token "test-<uid>" -> uid. No network, no real Firebase needed.
jest.mock('../src/config/firebase', () => ({
  verifyToken: async (t) => {
    if (!t.startsWith('test-')) throw new Error('bad token');
    return { uid: t.slice(5) };
  },
  getAuthUser: async (uid) => ({ email: `${uid}@test.dev`, displayName: 'Test' }),
  getAuth: () => ({}),
}));

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const University = require('../src/models/University');

let mongod, app, edu, su;
const auth = (uid) => ({ Authorization: `Bearer test-${uid}` });
const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });

async function mkUser(uid, role, uni, extra = {}) {
  return User.create({
    firebaseUid: uid, email: `${uid}@test.dev`, displayName: `${uid} Person`, role,
    universityId: uni ? uni._id : undefined, verificationStatus: 'verified', ...extra,
  });
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = createApp();
});
afterAll(async () => { await mongoose.disconnect(); if (mongod) await mongod.stop(); });
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), University.deleteMany({})]);
  // Same city, DIFFERENT campus coordinates
  edu = await University.create({ name: 'East Delta University', shortName: 'EDU', city: 'Chattogram', campus: point(91.80, 22.35) });
  su = await University.create({ name: 'Southern University', shortName: 'SU', city: 'Chattogram', campus: point(91.83, 22.37) });
});

describe('A7 (a) same city, different campus coordinates', () => {
  test('each user appears under their own campus', async () => {
    await mkUser('s1', 'student', edu, { displayName: 'Robiul Hasan' });
    await mkUser('s2', 'student', su, { displayName: 'Nusrat Jahan' });

    const map = await request(app).get('/api/directory/map').set(auth('s1'));
    expect(map.status).toBe(200);
    const e = map.body.universities.find((u) => u.shortName === 'EDU');
    const s = map.body.universities.find((u) => u.shortName === 'SU');
    expect(e.campus).not.toEqual(s.campus);
    expect(e.isYourCampus).toBe(true);
    expect(s.isYourCampus).toBe(false);

    const eduMembers = await request(app).get(`/api/directory/universities/${edu._id}/members`).set(auth('s1'));
    expect(eduMembers.body.items[0]).toMatchObject({ displayName: 'Robiul H.', isYou: true, universityName: 'East Delta University' });
    const suMembers = await request(app).get(`/api/directory/universities/${su._id}/members`).set(auth('s1'));
    expect(suMembers.body.items.map((i) => i.displayName)).toEqual(['Nusrat J.']);
  });
});

describe('A7 (b) location fields rejected', () => {
  test.each(['latitude', 'gps', 'address', 'lng'])('register-profile rejects %s', async (field) => {
    const res = await request(app).post('/api/auth/register-profile').set(auth('new1'))
      .send({ displayName: 'New User', universityId: String(edu._id), [field]: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LOCATION_NOT_ALLOWED');
  });
  test('PATCH /me/privacy rejects nested location', async () => {
    await mkUser('s1', 'student', edu);
    const res = await request(app).patch('/api/me/privacy').set(auth('s1')).send({ showInDirectory: true, extra: { gps: [1, 2] } });
    expect(res.status).toBe(400);
  });
});

describe('A7 (c) showInDirectory=false', () => {
  test('hidden from others, visible to self', async () => {
    await mkUser('s1', 'student', edu, { displayName: 'Hidden Student', showInDirectory: false });
    await mkUser('s3', 'student', edu, { displayName: 'Other Student' });
    const url = `/api/directory/universities/${edu._id}/members`;
    const other = await request(app).get(url).set(auth('s3'));
    expect(other.body.items.map((i) => i.displayName)).toEqual(['Other S.']);
    const self = await request(app).get(url).set(auth('s1'));
    expect(self.body.items[0]).toMatchObject({ displayName: 'Hidden S.', isYou: true });
  });
  test('toggle works through the API', async () => {
    const u = await mkUser('s1', 'student', edu);
    const res = await request(app).patch('/api/me/privacy').set(auth('s1')).send({ showInDirectory: false });
    expect(res.status).toBe(200);
    expect((await User.findById(u._id)).showInDirectory).toBe(false);
  });
});

describe('A7 (d) map has no per-user data', () => {
  test('only campus-level fields, no emails/ids of users', async () => {
    const s1 = await mkUser('s1', 'student', edu);
    const res = await request(app).get('/api/directory/map').set(auth('s1'));
    const allowed = ['id', 'name', 'shortName', 'city', 'campus', 'studentCount', 'mentorCount', 'isYourCampus'];
    for (const u of res.body.universities) {
      expect(Object.keys(u).sort()).toEqual([...allowed].sort());
      expect(Object.keys(u.campus).sort()).toEqual(['latitude', 'longitude']);
    }
    const text = JSON.stringify(res.body);
    expect(text).not.toContain('@test.dev');
    expect(text).not.toContain(String(s1._id));
  });
});

describe('A7 (e) employer gets 403 on every directory endpoint', () => {
  test('map and members', async () => {
    await mkUser('e1', 'employer', null);
    expect((await request(app).get('/api/directory/map').set(auth('e1'))).status).toBe(403);
    expect((await request(app).get(`/api/directory/universities/${edu._id}/members`).set(auth('e1'))).status).toBe(403);
  });
  test('department sees counts only (no member cards)', async () => {
    await mkUser('d1', 'department', edu);
    expect((await request(app).get('/api/directory/map').set(auth('d1'))).status).toBe(200);
    expect((await request(app).get(`/api/directory/universities/${edu._id}/members`).set(auth('d1'))).status).toBe(403);
  });
});

describe('roles cannot be self-assigned', () => {
  test.each(['mentor', 'employer', 'admin'])('register-profile with role=%s is rejected', async (role) => {
    const res = await request(app).post('/api/auth/register-profile').set(auth('new1'))
      .send({ displayName: 'Sneaky User', universityId: String(edu._id), role });
    expect(res.status).toBe(400);
    expect(await User.countDocuments({ firebaseUid: 'new1' })).toBe(0);
  });
  test('valid registration is always a pending student; email comes from Firebase', async () => {
    const res = await request(app).post('/api/auth/register-profile').set(auth('new2'))
      .send({ displayName: 'Real Student', universityId: String(edu._id), department: 'CSE', batchYear: 2022 });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ role: 'student', verificationStatus: 'pending', email: 'new2@test.dev' });
  });
  test('university is required and must exist', async () => {
    expect((await request(app).post('/api/auth/register-profile').set(auth('n3')).send({ displayName: 'No Uni' })).status).toBe(400);
    const fake = new mongoose.Types.ObjectId();
    expect((await request(app).post('/api/auth/register-profile').set(auth('n3')).send({ displayName: 'Bad Uni', universityId: String(fake) })).status).toBe(400);
  });
  test('student and mentor cannot call admin endpoints; role is read from MongoDB', async () => {
    await mkUser('s1', 'student', edu);
    await mkUser('m1', 'mentor', edu);
    const body = { name: 'X University', shortName: 'X', city: 'Dhaka', campus: { latitude: 23.7, longitude: 90.4 } };
    expect((await request(app).post('/api/admin/universities').set(auth('s1')).send(body)).status).toBe(403);
    expect((await request(app).post('/api/admin/universities').set(auth('m1')).send(body)).status).toBe(403);
  });
});

describe('auth basics', () => {
  test('no credential -> 401, bad credential -> 401, no profile -> 403', async () => {
    expect((await request(app).get('/api/me')).status).toBe(401);
    expect((await request(app).get('/api/me').set('Authorization', 'Bearer nope')).status).toBe(401);
    expect((await request(app).get('/api/me').set(auth('ghost'))).status).toBe(403);
  });
  test('GET /api/me returns role and university', async () => {
    await mkUser('m1', 'mentor', su);
    const res = await request(app).get('/api/me').set(auth('m1'));
    expect(res.body.user).toMatchObject({ role: 'mentor', university: { shortName: 'SU' } });
  });
  test('GET /api/universities is public and lists campus + counts', async () => {
    await mkUser('s1', 'student', edu);
    const res = await request(app).get('/api/universities');
    expect(res.status).toBe(200);
    expect(res.body.universities.find((u) => u.shortName === 'EDU')).toMatchObject({ studentCount: 1, mentorCount: 0 });
  });
});

describe('admin universities (audit-logged, no 0,0)', () => {
  test('admin can create/correct a campus; 0,0 refused', async () => {
    await mkUser('a1', 'admin', null);
    const ok = await request(app).patch(`/api/admin/universities/${edu._id}`).set(auth('a1')).send({ campus: { latitude: 22.34, longitude: 91.81 } });
    expect(ok.status).toBe(200);
    expect(ok.body.university.campus).toEqual({ latitude: 22.34, longitude: 91.81 });
    const bad = await request(app).patch(`/api/admin/universities/${edu._id}`).set(auth('a1')).send({ campus: { latitude: 0, longitude: 0 } });
    expect(bad.status).toBe(400);
    const AuditLog = require('../src/models/AuditLog');
    expect(await AuditLog.countDocuments({ action: 'university.update' })).toBe(1);
  });
});
