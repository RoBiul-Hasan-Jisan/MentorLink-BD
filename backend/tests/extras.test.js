const request = require('supertest');
const { setup, teardown, bearer, mkUni, mkUser, models } = require('./helpers');
const { weekStreak, badgeList } = require('../src/services/progress');
const { seedLearning } = require('../src/seed/learning');

const PNG = Buffer.concat([Buffer.from('89504e47', 'hex'), Buffer.alloc(60, 1)]).toString('base64');
let app, edu, su, S, S2, MN, DP, AD, EM;
const j = (m, u, uid, body) => request(app)[m](u).set(bearer(uid)).send(body);

beforeAll(async () => {
  app = await setup(); await seedLearning();
  edu = await mkUni('EDU', 'EDU', 'Chattogram', 91.83, 22.35); su = await mkUni('SU', 'SU', 'Chattogram', 91.80, 22.37);
  S = await mkUser('s1', 'student', edu, { department: 'CSE', affiliationStatus: 'pending' });
  S2 = await mkUser('s2', 'student', edu, { department: 'CSE', affiliationStatus: 'pending' });
  for (const i of [3, 4, 5]) await mkUser('s' + i, 'student', edu, { department: 'CSE', affiliationStatus: 'pending', email: `roll${i}@t.test` });
  MN = await mkUser('m1', 'mentor', edu); DP = await mkUser('d1', 'department', edu, { department: 'CSE' });
  AD = await mkUser('a1', 'admin', null); EM = await mkUser('e1', 'employer', null);
  await models.MentorProfile.create({ userId: MN._id, roleTitle: 'Data Analyst', industry: 'Telecom', roleKey: 'data-analyst', weeklyCapacity: 5, availableSlots: ['sun-20'] });
  await models.StudentProfile.create({ userId: S._id, careerGoalRoleKey: 'data-analyst', weeklyHours: 6 });
});
afterAll(teardown);

describe('pure helpers', () => {
  test('week streak counts consecutive weeks', () => {
    const now = new Date('2026-10-14T10:00:00Z'); const wk = (n) => new Date(now.getTime() - n * 7 * 864e5);
    expect(weekStreak([wk(0), wk(1), wk(2)], now)).toBe(3);
    expect(weekStreak([wk(1), wk(2)], now)).toBe(2); // this week not started yet: streak not broken
    expect(weekStreak([wk(0), wk(2)], now)).toBe(1);
    expect(weekStreak([], now)).toBe(0);
  });
  test('8 badges, evidence based', () => {
    const none = badgeList({ sessionsDone: 0, quizEvidence: 0, streakWeeks: 0, applications: 0, projectEvidence: 0, cvReviewed: false, mocksDone: 0, readiness: 0 });
    expect(none).toHaveLength(8); expect(none.every((b) => !b.earned)).toBe(true);
    const some = badgeList({ sessionsDone: 1, quizEvidence: 1, streakWeeks: 3, applications: 1, projectEvidence: 1, cvReviewed: true, mocksDone: 1, readiness: 75 });
    expect(some.every((b) => b.earned)).toBe(true);
    expect(badgeList({ sessionsDone: 0, quizEvidence: 0, streakWeeks: 0, applications: 0, projectEvidence: 0, cvReviewed: false, mocksDone: 0, readiness: 99 }).find((b) => b.id === 'interview_ready').earned).toBe(false); // needs a mock too
  });
});

describe('matching info, dismiss, request/session flow', () => {
  let rq, ses;
  test('matching info weights sum to 1 and match the code', async () => {
    const r = await j('get', '/api/matching/info', 's1');
    expect(r.body.factors).toHaveLength(6);
    expect(r.body.factors.reduce((t, f) => t + f.weight, 0)).toBeCloseTo(1, 5);
  });
  test('request with format, cancel while pending', async () => {
    const c = await j('post', '/api/requests', 's1', { mentorId: String(MN._id), goalText: 'Become a data analyst', questions: ['Which SQL topics matter?'], format: 'phone' });
    expect(c.status).toBe(201); expect(c.body.request.format).toBe('phone');
    expect((await j('post', `/api/requests/${c.body.request._id}/cancel`, 's2')).status).toBe(404); // not yours
    expect((await j('post', `/api/requests/${c.body.request._id}/cancel`, 's1')).status).toBe(200);
    expect((await j('post', `/api/requests/${c.body.request._id}/cancel`, 's1')).status).toBe(409);
  });
  test('dismissed mentor disappears from matches', async () => {
    expect((await j('get', '/api/matches', 's1')).body.matches.length).toBe(1);
    expect((await j('post', `/api/matches/${MN._id}/dismiss`, 's1')).status).toBe(200);
    expect((await j('get', '/api/matches', 's1')).body.matches.length).toBe(0);
  });
  test('cancel rule (2 hours), rate once, mentor no-show', async () => {
    rq = await models.MentorRequest.create({ studentId: S._id, mentorId: MN._id, goalText: 'x goal', questions: ['q one'], status: 'accepted' });
    const soon = await j('post', '/api/sessions', 'm1', { requestId: String(rq._id), startsAt: new Date(Date.now() + 3600e3).toISOString() });
    expect((await j('post', `/api/sessions/${soon.body.session._id}/cancel`, 's1')).status).toBe(409); // under 2 h
    const later = await j('post', '/api/sessions', 'm1', { requestId: String(rq._id), startsAt: new Date(Date.now() + 5 * 864e5).toISOString() });
    expect((await j('post', `/api/sessions/${later.body.session._id}/cancel`, 's2')).status).toBe(404);
    expect((await j('post', `/api/sessions/${later.body.session._id}/cancel`, 's1')).status).toBe(200);
    ses = soon.body.session;
    expect((await j('post', `/api/sessions/${ses._id}/rate`, 's1', { stars: 5 })).status).toBe(409); // not completed yet
    expect((await j('post', `/api/sessions/${ses._id}/complete`, 'm1', { notes: 'n', nextSteps: [{ text: 'Do joins', week: 1 }], durationMin: 60 })).status).toBe(200);
    expect((await j('post', `/api/sessions/${ses._id}/rate`, 's1', { stars: 4, comment: 'good' })).status).toBe(200);
    expect((await j('post', `/api/sessions/${ses._id}/rate`, 's1', { stars: 5 })).status).toBe(409); // once only
    expect((await j('post', `/api/sessions/${ses._id}/rate`, 'm1', { stars: 5 })).status).toBe(403);
    expect((await models.MentorProfile.findOne({ userId: MN._id })).ratingAvg).toBe(4);
    const ns = await models.Session.create({ requestId: rq._id, studentId: S._id, mentorId: MN._id, startsAt: new Date(Date.now() - 3600e3) });
    expect((await j('post', `/api/sessions/${ns._id}/mentor-no-show`, 's1')).status).toBe(200);
    expect((await models.MentorProfile.findOne({ userId: MN._id })).noShows).toBe(1);
  });
  test('mock interview: only with an accepted mentor, rubric feedback, overall is the mean', async () => {
    const t = new Date(Date.now() + 864e5).toISOString();
    expect((await j('post', '/api/mock-interviews', 's2', { mentorId: String(MN._id), startsAt: t })).status).toBe(403);
    const b = await j('post', '/api/mock-interviews', 's1', { mentorId: String(MN._id), startsAt: t });
    expect(b.status).toBe(201);
    expect((await j('post', `/api/mock-interviews/${b.body.mockInterview._id}/feedback`, 's1', { communication: 4, technical: 3, problemSolving: 3, confidence: 4 })).status).toBe(403);
    const f = await j('post', `/api/mock-interviews/${b.body.mockInterview._id}/feedback`, 'm1', { communication: 4, technical: 3, problemSolving: 3, confidence: 4, note: 'ok' });
    expect(f.body.mockInterview.overall).toBe(3.5);
    expect((await j('get', '/api/mock-interviews', 's1')).body.mockInterviews).toHaveLength(1);
  });
  test('progress: snapshot history, badges, private', async () => {
    const p = await j('get', '/api/me/progress', 's1');
    expect(p.status).toBe(200); expect(p.body.badges).toHaveLength(8);
    expect(p.body.badges.find((b) => b.id === 'first_session').earned).toBe(true);
    expect(p.body.badges.find((b) => b.id === 'mock').earned).toBe(true);
    expect(p.body.history).toHaveLength(1);
    expect((await j('get', '/api/me/progress', 'm1')).status).toBe(403);
  });
});

describe('privacy: consent, export, delete, uploads', () => {
  test('settings persist and validate', async () => {
    const r = await j('patch', '/api/me/privacy', 's2', { remindersOn: false, quietHours: { from: 23, to: 6 }, shareProgressWithDept: true });
    expect(r.body.user.remindersOn).toBe(false); expect(r.body.user.quietHours.from).toBe(23);
    expect((await j('patch', '/api/me/privacy', 's2', { quietHours: { from: 30, to: 6 } })).status).toBe(400);
    expect((await j('patch', '/api/me/privacy', 's2', { role: 'admin' })).status).toBe(400);
  });
  test('export contains my data only; consent record', async () => {
    const e = await j('get', '/api/me/export', 's1');
    expect(e.status).toBe(200); expect(e.body.account.email).toBe('s1@t.test');
    expect(JSON.stringify(e.body)).not.toContain('s2@t.test');
    expect(e.body.deviceTokens).toBeUndefined();
    expect((await j('get', '/api/me/consents', 's1')).body.signupConsent).toBeTruthy();
  });
  test('verification upload: type sniffing, size, privacy, delete on reject', async () => {
    expect((await j('post', '/api/me/verification-doc', 's2', { kind: 'student_id', mime: 'image/png', dataBase64: PNG })).status).toBe(201);
    expect((await j('post', '/api/me/verification-doc', 's2', { kind: 'student_id', mime: 'image/jpeg', dataBase64: PNG })).status).toBe(400); // wrong type
    expect((await j('post', '/api/me/verification-doc', 's2', { kind: 'student_id', mime: 'image/png', dataBase64: Buffer.alloc(320000, 1).toString('base64') })).status).toBe(400); // too big
    expect((await j('get', `/api/admin/verification-docs/${S2._id}`, 's1')).status).toBe(403);
    const a = await j('get', `/api/admin/verification-docs/${S2._id}`, 'a1');
    expect(a.body.docs).toHaveLength(1); expect((await j('get', '/api/me/verification-docs', 's2')).body.docs[0].data).toBeUndefined();
    await j('post', `/api/admin/users/${S2._id}/verify`, 'a1', { decision: 'rejected' });
    expect(await models.VerificationDoc.countDocuments({ userId: S2._id })).toBe(0);
  });
  test('delete needs the confirm word and wipes personal data', async () => {
    const u = await mkUser('del1', 'student', edu, { displayName: 'To Delete' });
    await models.StudentProfile.create({ userId: u._id, careerGoalRoleKey: 'data-analyst' });
    expect((await j('delete', '/api/me', 'del1', {})).status).toBe(400);
    expect((await j('delete', '/api/me', 'del1', { confirm: 'DELETE' })).status).toBe(200);
    expect(await models.StudentProfile.countDocuments({ userId: u._id })).toBe(0);
    const after = await models.User.findById(u._id); expect(after.displayName).toBe('Deleted user'); expect(after.email).toContain('deleted');
    expect((await j('get', '/api/me', 'del1')).status).toBe(403); // cannot sign back in to a deleted profile
    expect((await j('delete', '/api/me', 'a1', { confirm: 'DELETE' })).status).toBe(403);
  });
});

describe('workshops and Q&A', () => {
  test('workshop seats are enforced atomically, once per student', async () => {
    const w = await j('post', '/api/workshops', 'm1', { title: 'SQL basics', startsAt: new Date(Date.now() + 864e5).toISOString(), seats: 2 });
    expect(w.status).toBe(201); const id = w.body.workshop.id;
    expect((await j('post', '/api/workshops', 's1', { title: 'x'.repeat(5), startsAt: new Date(Date.now() + 864e5).toISOString(), seats: 5 })).status).toBe(403);
    expect((await j('post', `/api/workshops/${id}/join`, 's1')).status).toBe(200);
    expect((await j('post', `/api/workshops/${id}/join`, 's1')).status).toBe(409);
    expect((await j('post', `/api/workshops/${id}/join`, 's2')).status).toBe(200);
    expect((await j('post', `/api/workshops/${id}/join`, 's3')).status).toBe(409); // full
    expect((await j('get', '/api/workshops', 'e1')).status).toBe(403); // employers do not see university features
    expect((await j('get', '/api/workshops', 's1')).body.workshops[0].joined).toBe(true);
  });
  test('Q&A: ask, answer with mentor flag, scam text blocked, 3 unique reporters hide, one person counts once', async () => {
    const q = await j('post', '/api/qa', 's1', { title: 'How do I explain a gap year?', body: 'Interview soon' });
    expect(q.status).toBe(201); const id = q.body.id;
    expect((await j('post', '/api/qa', 's1', { title: 'Pay registration fee to join my group' })).status).toBe(400);
    expect((await j('post', `/api/qa/${id}/answers`, 'm1', { body: 'Be honest and show what you learned.' })).status).toBe(201);
    const d = await j('get', `/api/qa/${id}`, 's2');
    expect(d.body.answers[0].verifiedMentor).toBe(true); expect(d.body.by).toBe('User S.'); // first name + initial only
    for (let i = 0; i < 3; i++) await j('post', `/api/qa/${id}/report`, 's2'); // same person three times
    expect((await j('get', `/api/qa/${id}`, 's1')).status).toBe(200);
    await j('post', `/api/qa/${id}/report`, 's3'); const last = await j('post', `/api/qa/${id}/report`, 's4');
    expect(last.body.hidden).toBe(true);
    expect((await j('get', `/api/qa/${id}`, 's1')).status).toBe(404);
    expect((await j('post', `/api/admin/qa/${id}/moderate`, 's1', { decision: 'restore' })).status).toBe(403);
    expect((await j('post', `/api/admin/qa/${id}/moderate`, 'a1', { decision: 'restore' })).status).toBe(200);
    expect((await j('get', `/api/qa/${id}`, 's1')).status).toBe(200);
  });
});

describe('mentor impact, department, admin', () => {
  test('impact shows student progress only with consent', async () => {
    let r = await j('get', '/api/me/impact', 'm1');
    expect(r.body.sessionsHeld).toBe(1); expect(r.body.hoursGiven).toBe(1); expect(r.body.progress).toHaveLength(0);
    await j('patch', '/api/me/privacy', 's1', { shareProgressWithMentors: true });
    r = await j('get', '/api/me/impact', 'm1'); expect(r.body.progress).toHaveLength(1);
    expect((await j('get', '/api/me/impact', 's1')).status).toBe(403);
    expect((await j('get', '/api/me/impact/certificate', 'm1')).body.certificate.sessions).toBeGreaterThanOrEqual(0);
  });
  test('department: scoped approvals, bulk CSV, hidden small groups, report', async () => {
    const ap = await j('get', '/api/department/approvals', 'd1');
    expect(ap.body.pending.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(ap.body)).not.toContain('@t.test'); // no emails shown
    expect((await j('get', '/api/department/approvals', 's1')).status).toBe(403);
    const one = ap.body.pending[0].id;
    expect((await j('post', `/api/department/approvals/${one}`, 'd1', { decision: 'approved' })).status).toBe(200);
    const other = await mkUser('s9', 'student', su, { department: 'CSE', affiliationStatus: 'pending' });
    expect((await j('post', `/api/department/approvals/${other._id}`, 'd1', { decision: 'approved' })).status).toBe(404); // another university
    const bulk = await j('post', '/api/department/bulk-approve', 'd1', { emails: ['roll3@t.test', 'roll4@t.test', 'nobody@t.test'] });
    expect(bulk.body.listed).toBe(3); expect(bulk.body.approved).toBe(2);
    const w = await j('get', '/api/department/weekly', 'd1'); expect(w.body.weeks).toHaveLength(6);
    const csv = await j('get', '/api/department/report.csv', 'd1');
    expect(csv.status).toBe(200); expect(csv.text).toContain('active_students'); expect(csv.text).not.toContain('@');
    expect(await models.AuditLog.countDocuments({ action: 'department_report_export' })).toBe(1);
  });
  test('admin: role change rules, preview is logged, department application', async () => {
    expect((await j('patch', `/api/admin/users/${S2._id}/role`, 's1', { role: 'mentor' })).status).toBe(403);
    expect((await j('patch', `/api/admin/users/${S2._id}/role`, 'a1', { role: 'admin' })).status).toBe(400);
    expect((await j('patch', `/api/admin/users/${AD._id}/role`, 'a1', { role: 'student' })).status).toBe(403); // not yourself
    expect((await j('patch', `/api/admin/users/${EM._id}/role`, 'a1', { role: 'student' })).status).toBe(403); // employer is not changed here
    expect((await j('patch', `/api/admin/users/${S2._id}/role`, 'a1', { role: 'department' })).body.role).toBe('department');
    expect(await models.AuditLog.countDocuments({ action: 'role_change' })).toBe(1);
    const pv = await j('post', '/api/admin/preview', 'a1', { role: 'student' });
    expect(pv.body.readOnly).toBe(true); expect(await models.AuditLog.countDocuments({ action: 'preview_role' })).toBe(1);
    expect((await j('post', '/api/admin/preview', 'm1', { role: 'student' })).status).toBe(403);
    expect((await j('post', '/api/me/department-application', 's3', { note: 'HoD office' })).status).toBe(201);
    expect((await j('post', `/api/admin/department-applications/${(await models.User.findOne({ firebaseUid: 's3' }))._id}`, 'a1', { decision: 'approved' })).body.role).toBe('department');
  });
  test('pathways appear next to careers', async () => {
    const l = await j('get', '/api/targets', 's1');
    expect(l.body.targets.filter((t) => t.kind === 'pathway').map((t) => t.key).sort()).toEqual(['bcs', 'entrepreneurship', 'freelancing', 'higher-study']);
  });
});
