jest.mock('../src/config/firebase', () => ({
  verifyToken: async (t) => { if (!t.startsWith('test-')) throw new Error('bad'); return { uid: t.slice(5) }; },
  getAuthUser: async (uid) => ({ email: `${uid}@t.dev` }), getAuth: () => ({}),
  sendMulticast: jest.fn(async (tokens) => ({ responses: tokens.map(() => ({ success: true })) })),
}));

const http = require('http');
const request = require('supertest');
const mongoose = require('mongoose');
const ioc = require('socket.io-client');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const { createSocketServer } = require('../src/socket');
const { runReminders } = require('../src/services/reminders');
const M = (n) => require(`../src/models/${n}`);
const User = M('User'), University = M('University'), MentorProfile = M('MentorProfile'), MentorRequest = M('MentorRequest');
const Session = M('Session'), Task = M('Task'), Notification = M('Notification'), Message = M('Message'), Block = M('Block');

let mongod, app, server, io, uni;
const auth = (uid) => ({ Authorization: `Bearer test-${uid}` });
const mkUser = (uid, role, extra = {}) => User.create({ firebaseUid: uid, email: `${uid}@t.dev`, displayName: `${uid} Person`, role, universityId: uni._id, verificationStatus: 'verified', ...extra });
async function mkMentor(uid, over = {}) {
  const u = await mkUser(uid, 'mentor');
  await MentorProfile.create({ userId: u._id, industry: 'Software', roleTitle: 'Data Analyst', roleKeys: ['data-analyst'], yearsExperience: 5, weeklyCapacity: 3, activeMentees: 0,
    languages: ['bn', 'en'], availableSlots: ['Sun 20:30'], sessionsCompleted: 5, acceptedRequests: 6, ratingAvg: 4, ratingCount: 5, ...over });
  return u;
}
const reqBody = (mentorId) => ({ mentorId: String(mentorId), goalText: 'Become job-ready as an analyst', questions: ['Which SQL topics matter?', 'Can you review my dashboard?'], preferredSlots: ['Sun 20:30'], format: 'video' });
async function accepted(sUid = 's1', mUid = 'm1') {
  const s = await User.findOne({ firebaseUid: sUid }) || await mkUser(sUid, 'student');
  const m = await User.findOne({ firebaseUid: mUid }) || await mkMentor(mUid);
  const c = await request(app).post('/api/requests').set(auth(sUid)).send(reqBody(m._id));
  const a = await request(app).post(`/api/requests/${c.body.request.id}/accept`).set(auth(mUid));
  return { s, m, id: c.body.request.id, accept: a };
}
const future = (h = 24) => new Date(Date.now() + h * 3600000).toISOString();

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = createApp();
  server = http.createServer(app); io = createSocketServer(server);
  await new Promise((r) => server.listen(0, r));
});
afterAll(async () => { io.close(); server.close(); await mongoose.disconnect(); if (mongod) await mongod.stop(); });
beforeEach(async () => {
  await Promise.all(Object.keys(mongoose.models).map((n) => mongoose.models[n].deleteMany({})));
  await Promise.all(Object.keys(mongoose.models).map((n) => mongoose.models[n].syncIndexes())); // partial unique indexes
  uni = await University.create({ name: 'U', shortName: 'U', city: 'C', campus: { type: 'Point', coordinates: [90, 23] } });
});

describe('mentor requests', () => {
  test('student sends a request; mentor sees it (short name, snapshot, no email); mentor is notified', async () => {
    await mkUser('s1', 'student', { displayName: 'Robiul Hasan', department: 'CSE' }); const m = await mkMentor('m1');
    const res = await request(app).post('/api/requests').set(auth('s1')).send(reqBody(m._id));
    expect(res.status).toBe(201);
    const list = await request(app).get('/api/requests?status=pending').set(auth('m1'));
    expect(list.body.items[0].student).toMatchObject({ displayName: 'Robiul H.', department: 'CSE' });
    expect(JSON.stringify(list.body)).not.toContain('@t.dev');
    expect(await Notification.countDocuments({ userId: m._id, type: 'request_new' })).toBe(1);
  });
  test('validation: needs 2 to 3 questions, a verified student, a real mentor', async () => {
    await mkUser('s1', 'student'); await mkUser('p1', 'student', { verificationStatus: 'pending' }); const m = await mkMentor('m1');
    expect((await request(app).post('/api/requests').set(auth('s1')).send({ ...reqBody(m._id), questions: ['only one?'] })).status).toBe(400);
    expect((await request(app).post('/api/requests').set(auth('s1')).send({ ...reqBody(m._id), role: 'admin' })).status).toBe(400);
    expect((await request(app).post('/api/requests').set(auth('p1')).send(reqBody(m._id))).body.error.code).toBe('NOT_VERIFIED');
    expect((await request(app).post('/api/requests').set(auth('s1')).send(reqBody(new mongoose.Types.ObjectId()))).status).toBe(404);
  });
  test('duplicate pending, full mentor, blocked mentor, mentor-role caller', async () => {
    const s = await mkUser('s1', 'student'); const m = await mkMentor('m1');
    expect((await request(app).post('/api/requests').set(auth('s1')).send(reqBody(m._id))).status).toBe(201);
    expect((await request(app).post('/api/requests').set(auth('s1')).send(reqBody(m._id))).status).toBe(409);
    const full = await mkMentor('m2', { activeMentees: 3 });
    expect((await request(app).post('/api/requests').set(auth('s1')).send(reqBody(full._id))).body.error.code).toBe('MENTOR_AT_CAPACITY');
    const bl = await mkMentor('m3'); await Block.create({ blockerId: s._id, blockedId: bl._id });
    expect((await request(app).post('/api/requests').set(auth('s1')).send(reqBody(bl._id))).body.error.code).toBe('MENTOR_UNAVAILABLE');
    expect((await request(app).post('/api/requests').set(auth('m1')).send(reqBody(m._id))).status).toBe(403);
  });
  test('only the two people on a request can read it (others get 404)', async () => {
    const { id } = await accepted(); await mkUser('s2', 'student'); await mkMentor('m2');
    expect((await request(app).get(`/api/requests/${id}`).set(auth('s1'))).status).toBe(200);
    expect((await request(app).get(`/api/requests/${id}`).set(auth('m1'))).status).toBe(200);
    expect((await request(app).get(`/api/requests/${id}`).set(auth('s2'))).status).toBe(404);
    expect((await request(app).get(`/api/requests/${id}`).set(auth('m2'))).status).toBe(404);
    expect((await request(app).get('/api/requests').set(auth('s2'))).body.total).toBe(0);
  });
  test('accept: capacity counted; the last slot auto-pauses; the next accept is refused', async () => {
    const m = await mkMentor('m1', { weeklyCapacity: 1 });
    const ids = [];
    for (const u of ['s1', 's2']) { await mkUser(u, 'student'); ids.push((await request(app).post('/api/requests').set(auth(u)).send(reqBody(m._id))).body.request.id); }
    const a1 = await request(app).post(`/api/requests/${ids[0]}/accept`).set(auth('m1'));
    expect(a1.body.capacity).toEqual({ used: 1, weekly: 1, paused: true });
    const a2 = await request(app).post(`/api/requests/${ids[1]}/accept`).set(auth('m1'));
    expect(a2.status).toBe(409); expect(a2.body.error.code).toBe('AT_CAPACITY');
    expect((await MentorProfile.findOne({ userId: m._id })).activeMentees).toBe(1);
  });
  test('two simultaneous accepts cannot overshoot a capacity of 1', async () => {
    const m = await mkMentor('m1', { weeklyCapacity: 1 }); const ids = [];
    for (const u of ['s1', 's2']) { await mkUser(u, 'student'); ids.push((await request(app).post('/api/requests').set(auth(u)).send(reqBody(m._id))).body.request.id); }
    const rs = await Promise.all(ids.map((id) => request(app).post(`/api/requests/${id}/accept`).set(auth('m1'))));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
    expect((await MentorProfile.findOne({ userId: m._id })).activeMentees).toBe(1);
  });
  test('decline needs a reason, notifies the student; student can cancel only while pending', async () => {
    const s = await mkUser('s1', 'student'); const m = await mkMentor('m1');
    const id = (await request(app).post('/api/requests').set(auth('s1')).send(reqBody(m._id))).body.request.id;
    expect((await request(app).post(`/api/requests/${id}/decline`).set(auth('m1')).send({})).status).toBe(400);
    const d = await request(app).post(`/api/requests/${id}/decline`).set(auth('m1')).send({ reason: 'time_conflict' });
    expect(d.body.request).toMatchObject({ status: 'declined', declineReason: 'time_conflict' });
    expect(await Notification.countDocuments({ userId: s._id, type: 'request_declined' })).toBe(1);
    expect((await request(app).post(`/api/requests/${id}/cancel`).set(auth('s1'))).status).toBe(409);
  });
  test('stale pending requests expire after 7 days', async () => {
    await mkUser('s1', 'student'); const m = await mkMentor('m1');
    const id = (await request(app).post('/api/requests').set(auth('s1')).send(reqBody(m._id))).body.request.id;
    // createdAt is immutable in Mongoose, so back-date through the raw collection
    await MentorRequest.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { createdAt: new Date(Date.now() - 8 * 86400000) } });
    expect((await request(app).get(`/api/requests?status=expired`).set(auth('s1'))).body.total).toBe(1);
  });
});

describe('sessions, ratings, notes, plan', () => {
  test('mentor schedules; a stranger or a student cannot; participants can read', async () => {
    const { id } = await accepted(); await mkMentor('m2'); await mkUser('s2', 'student');
    expect((await request(app).post('/api/sessions').set(auth('s1')).send({ requestId: id, scheduledAt: future() })).status).toBe(403);
    expect((await request(app).post('/api/sessions').set(auth('m2')).send({ requestId: id, scheduledAt: future() })).status).toBe(404);
    expect((await request(app).post('/api/sessions').set(auth('m1')).send({ requestId: id, scheduledAt: new Date(Date.now() - 1000).toISOString() })).status).toBe(400);
    const c = await request(app).post('/api/sessions').set(auth('m1')).send({ requestId: id, scheduledAt: future(), meetingLink: 'meet.example.org/x', topic: 'SQL joins' });
    expect(c.status).toBe(201);
    const sid = c.body.session.id;
    expect((await request(app).get(`/api/sessions/${sid}`).set(auth('s1'))).status).toBe(200);
    expect((await request(app).get(`/api/sessions/${sid}`).set(auth('s2'))).status).toBe(404);
    expect((await request(app).get('/api/sessions').set(auth('s1'))).body.total).toBe(1);
  });
  test('cancel marks late cancels; complete only after start; rate once and mentor average updates', async () => {
    const { id, s, m } = await accepted();
    const soon = (await request(app).post('/api/sessions').set(auth('m1')).send({ requestId: id, scheduledAt: future(1) })).body.session.id;
    const c = await request(app).post(`/api/sessions/${soon}/cancel`).set(auth('s1'));
    expect(c.body.session).toMatchObject({ status: 'cancelled', lateCancel: true });

    const past = await Session.create({ requestId: id, studentId: s._id, mentorId: m._id, scheduledAt: new Date(Date.now() - 3600000) });
    const futureS = (await request(app).post('/api/sessions').set(auth('m1')).send({ requestId: id, scheduledAt: future() })).body.session.id;
    expect((await request(app).post(`/api/sessions/${futureS}/complete`).set(auth('m1'))).status).toBe(409);
    expect((await request(app).post(`/api/sessions/${past._id}/complete`).set(auth('m1'))).status).toBe(200);
    expect((await MentorProfile.findOne({ userId: m._id })).sessionsCompleted).toBe(6);
    expect((await request(app).post(`/api/sessions/${past._id}/rate`).set(auth('m1')).send({ rating: 5 })).status).toBe(403);
    expect((await request(app).post(`/api/sessions/${past._id}/rate`).set(auth('s1')).send({ rating: 5 })).status).toBe(200);
    expect((await request(app).post(`/api/sessions/${past._id}/rate`).set(auth('s1')).send({ rating: 1 })).status).toBe(409);
    const p = await MentorProfile.findOne({ userId: m._id });
    expect(p.ratingAvg).toBeCloseTo((4 * 5 + 5) / 6, 1); expect(p.ratingCount).toBe(6);
  });
  test('notes -> next step becomes a plan task; tapping twice gives the same task; plan view computes progress', async () => {
    const { id, s, m } = await accepted();
    const sess = await Session.create({ requestId: id, studentId: s._id, mentorId: m._id, scheduledAt: new Date(Date.now() - 3600000), status: 'completed' });
    const n = await request(app).post(`/api/sessions/${sess._id}/notes`).set(auth('m1')).send({ summary: 'Focus on joins and GROUP BY first.', tags: ['SQL'],
      nextSteps: [{ title: 'Finish SQL joins module', weekNumber: 1 }, { title: 'Build a Power BI dashboard', weekNumber: 2 }] });
    expect(n.status).toBe(201);
    expect((await request(app).post(`/api/sessions/${sess._id}/notes`).set(auth('m1')).send({ summary: 'again again' })).status).toBe(409);
    const stepId = n.body.note.nextSteps[0].id;
    const a1 = await request(app).post(`/api/sessions/${sess._id}/notes/steps/${stepId}/add-to-plan`).set(auth('s1'));
    const a2 = await request(app).post(`/api/sessions/${sess._id}/notes/steps/${stepId}/add-to-plan`).set(auth('s1'));
    expect(a1.status).toBe(201); expect(a2.body.alreadyAdded).toBe(true);
    expect(String(a2.body.task._id)).toBe(String(a1.body.task._id));
    expect(await Task.countDocuments({ studentId: s._id })).toBe(1);
    expect((await request(app).post(`/api/sessions/${sess._id}/notes/steps/${stepId}/add-to-plan`).set(auth('m1'))).status).toBe(403);
    expect((await request(app).get(`/api/sessions/${sess._id}/notes`).set(auth('s1'))).body.note.nextSteps[0].added).toBe(true);

    const tid = a1.body.task._id;
    await request(app).patch(`/api/plan/tasks/${tid}`).set(auth('s1')).send({ status: 'done' });
    const plan = (await request(app).get('/api/plan').set(auth('s1'))).body;
    expect(plan.overallProgress).toBe(100); expect(plan.weeks).toHaveLength(4);
  });
  test('plan ownership: a student cannot edit another student\'s task; mentor comments only on mentees', async () => {
    await accepted(); await mkUser('s2', 'student'); await mkMentor('m2');
    const t = (await request(app).post('/api/plan/tasks').set(auth('s1')).send({ title: 'Solve 10 GROUP BY problems', weekNumber: 2 })).body.task;
    expect((await request(app).patch(`/api/plan/tasks/${t.id}`).set(auth('s2')).send({ status: 'done' })).status).toBe(404);
    expect((await request(app).delete(`/api/plan/tasks/${t.id}`).set(auth('s2'))).status).toBe(404);
    expect((await request(app).post(`/api/plan/tasks/${t.id}/comments`).set(auth('m2')).send({ text: 'Looks good' })).status).toBe(404);
    expect((await request(app).post(`/api/plan/tasks/${t.id}/comments`).set(auth('m1')).send({ text: 'Keep it simple' })).status).toBe(201);
    expect((await request(app).get('/api/plan').set(auth('s1'))).body.tasks[0].mentorComments).toHaveLength(1);
  });
  test('reminders: due tasks and sessions starting within the hour notify once', async () => {
    const { id, s, m } = await accepted();
    await Task.create({ planId: new mongoose.Types.ObjectId(), studentId: s._id, title: 'Share link', weekNumber: 1, reminderAt: new Date(Date.now() - 1000) });
    await Session.create({ requestId: id, studentId: s._id, mentorId: m._id, scheduledAt: new Date(Date.now() + 1800000) });
    expect(await runReminders()).toBe(2);
    expect(await runReminders()).toBe(0); // already sent
    expect(await Notification.countDocuments({ type: 'task_reminder' })).toBe(1);
    expect(await Notification.countDocuments({ type: 'session_reminder' })).toBe(2); // student + mentor
  });
});

describe('chat (REST)', () => {
  test('closed until accepted; then both can chat; strangers get 404; blocks close it', async () => {
    await mkUser('s1', 'student'); const m = await mkMentor('m1'); await mkUser('s2', 'student');
    const id = (await request(app).post('/api/requests').set(auth('s1')).send(reqBody(m._id))).body.request.id;
    const closed = await request(app).post(`/api/chats/${id}/messages`).set(auth('s1')).send({ body: 'hello' });
    expect(closed.status).toBe(403); expect(closed.body.error.code).toBe('CHAT_NOT_OPEN');
    await request(app).post(`/api/requests/${id}/accept`).set(auth('m1'));
    expect((await request(app).post(`/api/chats/${id}/messages`).set(auth('s1')).send({ body: 'Assalamu alaikum' })).status).toBe(201);
    expect((await request(app).post(`/api/chats/${id}/messages`).set(auth('m1')).send({ body: 'Walaikum assalam' })).status).toBe(201);
    expect((await request(app).get(`/api/chats/${id}/messages`).set(auth('s2'))).status).toBe(404);
    const msgs = await request(app).get(`/api/chats/${id}/messages`).set(auth('s1'));
    expect(msgs.body.items.map((x) => x.body)).toEqual(['Assalamu alaikum', 'Walaikum assalam']);
    const s1 = await User.findOne({ firebaseUid: 's1' });
    await Block.create({ blockerId: m._id, blockedId: s1._id });
    expect((await request(app).post(`/api/chats/${id}/messages`).set(auth('s1')).send({ body: 'hi' })).body.error.code).toBe('CHAT_BLOCKED');
  });
  test('retry with the same clientId does not duplicate; fee requests are flagged; unread + read work', async () => {
    const { id } = await accepted();
    const a = await request(app).post(`/api/chats/${id}/messages`).set(auth('s1')).send({ body: 'queued msg', clientId: 'c-1' });
    const b = await request(app).post(`/api/chats/${id}/messages`).set(auth('s1')).send({ body: 'queued msg', clientId: 'c-1' });
    expect(b.body.message.id).toBe(a.body.message.id);
    expect(await Message.countDocuments()).toBe(1);
    const f = await request(app).post(`/api/chats/${id}/messages`).set(auth('m1')).send({ body: 'Please pay a registration fee' });
    expect(f.body.message.flagged).toBe(true);
    expect((await request(app).get('/api/chats').set(auth('m1'))).body.items[0].unread).toBe(1);
    await request(app).post(`/api/chats/${id}/read`).set(auth('m1'));
    expect((await request(app).get('/api/chats').set(auth('m1'))).body.items[0].unread).toBe(0);
  });
});

describe('notifications', () => {
  test('list, unread count, mark read (own only), device token lifecycle', async () => {
    const { s } = await accepted();
    const l = await request(app).get('/api/notifications').set(auth('s1'));
    expect(l.body.unread).toBeGreaterThan(0);
    const nid = l.body.items[0].id;
    expect((await request(app).post(`/api/notifications/${nid}/read`).set(auth('m1'))).status).toBe(404); // not theirs
    expect((await request(app).post(`/api/notifications/${nid}/read`).set(auth('s1'))).status).toBe(200);
    expect((await request(app).post('/api/notifications/read-all').set(auth('s1'))).status).toBe(200);
    expect((await request(app).get('/api/notifications').set(auth('s1'))).body.unread).toBe(0);
    const token = 'x'.repeat(40);
    expect((await request(app).post('/api/notifications/device-token').set(auth('s1')).send({ token })).status).toBe(204);
    expect(await M('DeviceToken').countDocuments({ userId: s._id })).toBe(1);
    expect((await request(app).delete('/api/notifications/device-token').set(auth('s1')).send({ token })).status).toBe(204);
  });
});

describe('Socket.IO chat', () => {
  const connect = (uid) => new Promise((resolve, reject) => {
    const c = ioc(`http://localhost:${server.address().port}`, { auth: { token: `test-${uid}` }, transports: ['websocket'], reconnection: false });
    c.on('connect', () => resolve(c)); c.on('connect_error', reject);
  });
  const emit = (c, ev, p) => new Promise((r) => c.emit(ev, p, r));

  test('bad credential is refused', async () => {
    await expect(connect('nobody')).rejects.toBeTruthy();
  });
  test('join needs an accepted request; messages reach the other person live', async () => {
    const { id } = await accepted(); await mkUser('s2', 'student');
    const [cs, cm, cx] = await Promise.all([connect('s1'), connect('m1'), connect('s2')]);
    expect((await emit(cx, 'join', { requestId: id })).ok).toBe(false);   // stranger
    expect((await emit(cs, 'join', { requestId: id })).ok).toBe(true);
    expect((await emit(cm, 'join', { requestId: id })).ok).toBe(true);
    const got = new Promise((r) => cm.on('message', r));
    const ack = await emit(cs, 'message', { requestId: id, body: 'Done with module 2', clientId: 'k1' });
    expect(ack.ok).toBe(true);
    expect((await got).body).toBe('Done with module 2');
    [cs, cm, cx].forEach((c) => c.close());
  });
  test('live notification arrives in the user room', async () => {
    await mkUser('s1', 'student'); const m = await mkMentor('m1');
    const cm = await connect('m1');
    const got = new Promise((r) => cm.on('notification', r));
    await request(app).post('/api/requests').set(auth('s1')).send(reqBody(m._id));
    expect((await got).type).toBe('request_new');
    cm.close();
  });
});
