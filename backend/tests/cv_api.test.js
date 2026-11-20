// CV routes with an in-memory fake of the models (no MongoDB).
const mockId = (n) => String(n).padStart(24, '0');
const mockChain = (v) => { const p = Promise.resolve(v); p.select = () => p; p.limit = () => p; p.sort = () => p; p.lean = () => p; return p; };
const mockSaved = [];
const mockStored = { studentId: mockId(1), version: 1, data: { v: 2, summary: 'Hello', contact: { email: 'sara@secret.test', phone: '01700000000', city: 'Dhaka', links: [] } } };
const mockUsers = { s1: { _id: mockId(1), firebaseUid: 's1', role: 'student', displayName: 'Sara Khan' }, m1: { _id: mockId(3), firebaseUid: 'm1', role: 'mentor', displayName: 'Mina Roy' } };
jest.mock('../src/models', () => new Proxy({}, { get: (_t, name) => {
  const tbl = {
    User: { findOne: (q) => Promise.resolve(mockUsers[q.firebaseUid] || null), findById: () => mockChain({ displayName: 'Sara Khan' }) },
    CvVersion: { findOne: () => mockChain(null), create: async (x) => { mockSaved.push(x); return x; }, find: () => mockChain([mockStored]) },
    MentorRequest: { findOne: () => Promise.resolve({ _id: mockId(9) }) },
  };
  return tbl[name] || new Proxy({}, { get: () => () => mockChain([]) });
} }));
const request = require('supertest');
const { createApp } = require('../src/app');
const app = createApp({ verify: async (c) => ({ uid: c, email: `${c}@t.test` }) });
const as = (u) => ({ Authorization: `Bearer ${u}` });

test('saving a CV stores the v2 shape and rejects a bad email or phone', async () => {
  const ok = await request(app).post('/api/me/cv').set(as('s1')).send({ data: { v: 2, headline: 'Data Analyst', contact: { email: 'a@b.co', phone: '+8801700000000' }, skills: [{ label: 'Tools', items: ['SQL'] }] } });
  expect(ok.status).toBe(201); expect(mockSaved[0].data.v).toBe(2); expect(mockSaved[0].version).toBe(1);
  expect((await request(app).post('/api/me/cv').set(as('s1')).send({ data: { contact: { email: 'nope' } } })).status).toBe(400);
  expect((await request(app).post('/api/me/cv').set(as('s1')).send({ data: { contact: { phone: 'abc' } } })).status).toBe(400);
  expect((await request(app).post('/api/me/cv').set(as('s1')).send({ data: {}, role: 'admin' })).status).toBe(400);
  expect((await request(app).post('/api/me/cv').set(as('m1')).send({ data: {} })).status).toBe(403);
});
test('tips are returned and nothing is mockSaved', async () => {
  const n = mockSaved.length;
  const r = await request(app).post('/api/me/cv/check').set(as('s1')).send({ data: { v: 2 } });
  expect(r.status).toBe(200); expect(r.body.tips.length).toBeGreaterThan(3); expect(mockSaved.length).toBe(n);
});
test('the owner sees their contact block; a mentor never does', async () => {
  const mine = await request(app).get('/api/me/cv').set(as('s1'));
  expect(mine.body.versions[0].data.contact.email).toBe('sara@secret.test');
  const theirs = await request(app).get(`/api/mentees/${mockId(1)}/cv`).set(as('m1'));
  expect(theirs.status).toBe(200);
  expect(JSON.stringify(theirs.body)).not.toMatch(/secret\.test|01700000000|Dhaka/);
  expect(theirs.body.versions[0].data.summary).toBe('Hello');
});
