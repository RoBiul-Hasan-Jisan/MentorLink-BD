process.env.DEPT_MIN_COHORT = '2'; // department reports: suppress cohorts smaller than 2 (read when env.js loads)
jest.mock('../src/config/firebase', () => ({
  verifyToken: async (t) => { if (!t.startsWith('test-')) throw new Error('bad'); return { uid: t.slice(5) }; },
  getAuthUser: async (uid) => ({ email: `${uid}@t.dev` }), getAuth: () => ({}),
  sendMulticast: jest.fn(async (tokens) => ({ responses: tokens.map(() => ({ success: true })) })),
}));

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const { seedSkills } = require('../seed/seedSkills');
const M = (n) => require(`../src/models/${n}`);
const User = M('User'), University = M('University'), Opportunity = M('Opportunity'), Application = M('Application'), Report = M('Report'), Notification = M('Notification');
const AuditLog = M('AuditLog'), MentorRequest = M('MentorRequest'), Session = M('Session'), SkillEvidence = M('SkillEvidence'), StudentProfile = M('StudentProfile'), Block = M('Block');
const ConsentRecord = M('ConsentRecord'), RoleRequest = M('RoleRequest'), MentorProfile = M('MentorProfile'), Match = M('Match');

let mongod, app, uni;
const auth = (uid) => ({ Authorization: `Bearer test-${uid}` });
const mkUser = (uid, role, extra = {}) => User.create({ firebaseUid: uid, email: `${uid}@t.dev`, displayName: `${uid} Person`, role, universityId: uni._id, verificationStatus: 'verified', ...extra });
const future = (d = 14) => new Date(Date.now() + d * 86400000).toISOString();
const oppBody = (o = {}) => ({ title: 'Junior Data Analyst', organization: 'Acme Software', employmentType: 'full_time', workplaceMode: 'onsite', city: 'Dhaka',
  description: 'Support the analytics team with weekly reports.', requiredSkills: [{ skillKey: 'sql', weight: 5, requiredLevel: 3 }, { skillKey: 'excel', weight: 3, requiredLevel: 2 }],
  applicationDeadline: future(), noFeeConfirmed: true, ...o });
async function approvedOpp(poster = 'm1', over = {}) {
  const c = await request(app).post('/api/opportunities').set(auth(poster)).send(oppBody(over));
  if (c.body.opportunity.status !== 'approved') await request(app).post(`/api/admin/opportunities/${c.body.opportunity.id}/approve`).set(auth('a1'));
  return c.body.opportunity.id;
}
async function mkCv(uid) {
  return (await request(app).post('/api/cv').set(auth(uid)).send({ headline: 'Data Analyst', summary: 'CSE student', education: [{ institution: 'U' }], projects: [{ title: 'p1', url: 'https://x.io' }] })).body.cv.id;
}
const consent = { shareCv: true, shareReadiness: false, shareDepartment: false };

beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); app = createApp(); });
afterAll(async () => { await mongoose.disconnect(); if (mongod) await mongod.stop(); });
beforeEach(async () => {
  await Promise.all(Object.keys(mongoose.models).map((n) => mongoose.models[n].deleteMany({})));
  await Promise.all(Object.keys(mongoose.models).map((n) => mongoose.models[n].syncIndexes()));
  uni = await University.create({ name: 'U', shortName: 'U', city: 'C', campus: { type: 'Point', coordinates: [90, 23] } });
  await seedSkills();
  await mkUser('a1', 'admin', { universityId: undefined }); await mkUser('m1', 'mentor'); await mkUser('m2', 'mentor');
  for (const s of ['s1', 's2', 's3', 's4']) await mkUser(s, 'student', { department: 'CSE' });
});

describe('posting rules', () => {
  test('students cannot post; the no-fee declaration is mandatory', async () => {
    expect((await request(app).post('/api/opportunities').set(auth('s1')).send(oppBody())).status).toBe(403);
    expect((await request(app).post('/api/opportunities').set(auth('m1')).send(oppBody({ noFeeConfirmed: false }))).status).toBe(400);
    const { noFeeConfirmed, ...missing } = oppBody();
    expect((await request(app).post('/api/opportunities').set(auth('m1')).send(missing)).status).toBe(400);
    expect((await request(app).post('/api/opportunities').set(auth('m1')).send(oppBody({ requiredSkills: [{ skillKey: 'nope', weight: 1, requiredLevel: 1 }] }))).status).toBe(400);
  });
  test('first post waits for admin review; later clean posts go live; flagged posts always wait', async () => {
    const first = await request(app).post('/api/opportunities').set(auth('m1')).send(oppBody());
    expect(first.status).toBe(201); expect(first.body.opportunity.status).toBe('pending');
    expect((await request(app).get('/api/opportunities').set(auth('s1'))).body.total).toBe(0); // invisible until approved
    const ap = await request(app).post(`/api/admin/opportunities/${first.body.opportunity.id}/approve`).set(auth('a1'));
    expect(ap.body.status).toBe('approved');
    const second = await request(app).post('/api/opportunities').set(auth('m1')).send(oppBody({ title: 'Data Analyst Intern' }));
    expect(second.body.opportunity.status).toBe('approved');
    const flagged = await request(app).post('/api/opportunities').set(auth('m1')).send(oppBody({ title: 'Easy job', description: 'Pay a registration fee to start working' }));
    expect(flagged.body.opportunity.status).toBe('pending'); expect(flagged.body.opportunity.flags).toContain('registration fee');
  });
  test('labels keep three separate claims; editing a live post sends it back to review', async () => {
    const id = await approvedOpp();
    const s = (await request(app).get(`/api/opportunities/${id}`).set(auth('s1'))).body.opportunity;
    expect(s.labels).toEqual({ source: 'verified_alumni', listingReviewed: true, noFeeDeclared: true, organizationVerified: false });
    const edit = await request(app).patch(`/api/opportunities/${id}`).set(auth('m1')).send({ description: 'A different description of the role.' });
    expect(edit.body.opportunity.status).toBe('pending');
    expect((await request(app).get(`/api/opportunities/${id}`).set(auth('s1'))).status).toBe(404);
    expect((await request(app).patch(`/api/opportunities/${id}`).set(auth('m2')).send({ title: 'Hijack' })).status).toBe(404); // not the poster
  });
  test('employers cannot see the board', async () => {
    await mkUser('e1', 'employer', { universityId: undefined });
    expect((await request(app).get('/api/opportunities').set(auth('e1'))).status).toBe(403);
  });
});

describe('board and explainable fit', () => {
  test('fit shows met / gap / not_provided per skill and what closing the gaps would give', async () => {
    const id = await approvedOpp();
    const s1 = await User.findOne({ firebaseUid: 's1' });
    await SkillEvidence.create({ studentId: s1._id, skillKey: 'excel', type: 'quiz', level: 2, verified: true });
    await SkillEvidence.create({ studentId: s1._id, skillKey: 'sql', type: 'self', level: 1 });
    const o = (await request(app).get(`/api/opportunities/${id}`).set(auth('s1'))).body.opportunity;
    expect(Object.fromEntries(o.fit.skills.map((x) => [x.skillKey, x.state]))).toEqual({ sql: 'gap', excel: 'met' });
    expect(o.fit.fitPercent).toBe(Math.round(100 * (5 / 3 + 3) / 8));
    const noEvidence = (await request(app).get(`/api/opportunities/${id}`).set(auth('s2'))).body.opportunity;
    expect(noEvidence.fit.skills.every((x) => x.state === 'not_provided')).toBe(true);
    const list = await request(app).get('/api/opportunities?employmentType=full_time').set(auth('s1'));
    expect(list.body.items[0].fit.fitPercent).toBe(o.fit.fitPercent);
    expect((await request(app).get('/api/opportunities?employmentType=internship').set(auth('s1'))).body.total).toBe(0);
  });
});

describe('anti-scam reports', () => {
  test('one person reporting repeatedly counts once', async () => {
    const id = await approvedOpp();
    const r1 = await request(app).post(`/api/opportunities/${id}/report`).set(auth('s1')).send({ reason: 'fee_requested' });
    const r2 = await request(app).post(`/api/opportunities/${id}/report`).set(auth('s1')).send({ reason: 'fee_requested' });
    const r3 = await request(app).post(`/api/opportunities/${id}/report`).set(auth('s1')).send({ reason: 'misleading' });
    expect(r1.status).toBe(201); expect(r2.body.alreadyReported).toBe(true); expect(r3.body.alreadyReported).toBe(true);
    expect((await Opportunity.findById(id)).reportCount).toBe(1);
    expect((await Opportunity.findById(id)).status).toBe('approved');
    expect(await Report.countDocuments({ targetId: id })).toBe(1);
  });
  test('3 different people hide the post; it is audit-logged; reporters see a stub; admin can restore', async () => {
    const id = await approvedOpp();
    for (const u of ['s1', 's2']) await request(app).post(`/api/opportunities/${id}/report`).set(auth(u)).send({ reason: 'fee_requested' });
    expect((await Opportunity.findById(id)).status).toBe('approved');
    const third = await request(app).post(`/api/opportunities/${id}/report`).set(auth('s3')).send({ reason: 'fake_company' });
    expect(third.body.hidden).toBe(true);
    expect((await Opportunity.findById(id)).status).toBe('hidden');
    expect(await AuditLog.countDocuments({ action: 'opportunity.auto_hide', system: true })).toBe(1);
    expect((await request(app).get(`/api/opportunities/${id}`).set(auth('s4'))).status).toBe(404);
    const board = await request(app).get('/api/opportunities').set(auth('s1'));
    expect(board.body.items).toHaveLength(0);
    expect(board.body.hiddenByYourReport[0]).toEqual({ id, title: 'Junior Data Analyst', status: 'hidden', reportCount: 3 });
    expect(Object.keys((await request(app).get('/api/opportunities').set(auth('s4'))).body.hiddenByYourReport)).toHaveLength(0); // non-reporters see nothing

    const q = await request(app).get('/api/admin/reports').set(auth('a1'));
    expect(q.body.items[0]).toMatchObject({ targetType: 'opportunity', reporters: 3, autoHidden: true });
    const restored = await request(app).post(`/api/admin/opportunities/${id}/restore`).set(auth('a1'));
    expect(restored.body.status).toBe('approved');
    expect((await Opportunity.findById(id)).reportCount).toBe(0);
    expect(await Report.countDocuments({ targetId: id, status: 'open' })).toBe(0);
    expect(await AuditLog.countDocuments({ action: 'opportunity.restore' })).toBe(1);
  });
  test('cannot report your own post; "remove and warn" notifies the poster', async () => {
    const id = await approvedOpp();
    expect((await request(app).post(`/api/opportunities/${id}/report`).set(auth('m1')).send({ reason: 'other' })).status).toBe(400);
    const m1 = await User.findOne({ firebaseUid: 'm1' });
    expect((await request(app).post(`/api/admin/opportunities/${id}/remove`).set(auth('s1')).send({})).status).toBe(403);
    const rm = await request(app).post(`/api/admin/opportunities/${id}/remove`).set(auth('a1')).send({ warn: true, note: 'Asked for a fee' });
    expect(rm.body.status).toBe('removed');
    expect(await Notification.countDocuments({ userId: m1._id, type: 'post_removed' })).toBe(1);
  });
});

describe('applications and consent', () => {
  test('apply needs consent, an own CV, a verified student and a live deadline; no double applying', async () => {
    const id = await approvedOpp(); const cv1 = await mkCv('s1'); const cv2 = await mkCv('s2');
    const body = { cvVersionId: cv1, consent };
    expect((await request(app).post(`/api/opportunities/${id}/apply`).set(auth('s1')).send({ cvVersionId: cv1 })).status).toBe(400);
    expect((await request(app).post(`/api/opportunities/${id}/apply`).set(auth('s1')).send({ cvVersionId: cv1, consent: { ...consent, shareCv: false } })).status).toBe(400);
    expect((await request(app).post(`/api/opportunities/${id}/apply`).set(auth('s1')).send({ cvVersionId: cv2, consent })).body.error.code).toBe('CV_NOT_FOUND'); // someone else's CV
    await mkUser('p1', 'student', { verificationStatus: 'pending' });
    expect((await request(app).post(`/api/opportunities/${id}/apply`).set(auth('p1')).send(body)).status).toBe(403);
    const ok = await request(app).post(`/api/opportunities/${id}/apply`).set(auth('s1')).send(body);
    expect(ok.status).toBe(201); expect(ok.body.application).toMatchObject({ stage: 'Applied', uiStage: 'Applied', sharedFields: ['displayName', 'university', 'cv'] });
    expect((await request(app).post(`/api/opportunities/${id}/apply`).set(auth('s1')).send(body)).body.error.code).toBe('ALREADY_APPLIED');
    expect(await Application.countDocuments()).toBe(1);
    expect(await ConsentRecord.countDocuments({ key: 'application_share' })).toBe(1);
    await Opportunity.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { applicationDeadline: new Date(Date.now() - 1000) } });
    expect((await request(app).post(`/api/opportunities/${id}/apply`).set(auth('s2')).send({ cvVersionId: cv2, consent })).body.error.code).toBe('DEADLINE_PASSED');
  });
  test('cannot apply to a pending or hidden post', async () => {
    const pend = (await request(app).post('/api/opportunities').set(auth('m1')).send(oppBody())).body.opportunity.id;
    const cv = await mkCv('s1');
    expect((await request(app).post(`/api/opportunities/${pend}/apply`).set(auth('s1')).send({ cvVersionId: cv, consent })).status).toBe(404);
  });
  test('the poster sees ONLY what each student consented to, and never an email or phone', async () => {
    const id = await approvedOpp(); const cv1 = await mkCv('s1'); const cv2 = await mkCv('s2');
    await request(app).post(`/api/opportunities/${id}/apply`).set(auth('s1')).send({ cvVersionId: cv1, consent });
    await request(app).post(`/api/opportunities/${id}/apply`).set(auth('s2')).send({ cvVersionId: cv2, consent: { shareCv: true, shareReadiness: true, shareDepartment: true } });
    const res = await request(app).get(`/api/opportunities/${id}/applications`).set(auth('m1'));
    expect(res.status).toBe(200); expect(res.body.total).toBe(2);
    const by = Object.fromEntries(res.body.items.map((i) => [i.applicant.displayName, i]));
    expect(by['s1 P.'].applicant.department).toBeUndefined(); expect(by['s1 P.'].fit).toBeNull();
    expect(by['s2 P.'].applicant.department).toBe('CSE'); expect(by['s2 P.'].fit.fitPercent).toBeDefined();
    expect(by['s1 P.'].cv.headline).toBe('Data Analyst');
    const text = JSON.stringify(res.body);
    expect(text).not.toContain('@t.dev'); expect(text).not.toMatch(/phone|email/i);
    expect((await request(app).get(`/api/opportunities/${id}/applications`).set(auth('m2'))).status).toBe(404);   // another mentor
    expect((await request(app).get(`/api/opportunities/${id}/applications`).set(auth('s1'))).status).toBe(403);   // a student
    await request(app).get(`/api/opportunities/${id}/applications`).set(auth('a1'));
    expect(await AuditLog.countDocuments({ action: 'applications.view' })).toBe(1);                              // admin reads are logged
  });
});

describe('application stages', () => {
  async function applied() { const id = await approvedOpp(); const cv = await mkCv('s1');
    const a = await request(app).post(`/api/opportunities/${id}/apply`).set(auth('s1')).send({ cvVersionId: cv, consent }); return { id, appId: a.body.application.id }; }
  test('server validates moves, records history, and tells the student', async () => {
    const { appId } = await applied(); const s1 = await User.findOne({ firebaseUid: 's1' });
    const bad = await request(app).patch(`/api/applications/${appId}/stage`).set(auth('m1')).send({ stage: 'Interview' });
    expect(bad.status).toBe(409); expect(bad.body.error.code).toBe('INVALID_TRANSITION');
    expect((await request(app).patch(`/api/applications/${appId}/stage`).set(auth('m2')).send({ stage: 'Shortlisted' })).status).toBe(404); // not the poster
    expect((await request(app).patch(`/api/applications/${appId}/stage`).set(auth('s1')).send({ stage: 'Shortlisted' })).status).toBe(403); // student
    const ok = await request(app).patch(`/api/applications/${appId}/stage`).set(auth('m1')).send({ stage: 'Shortlisted', message: 'Interview invite soon' });
    expect(ok.body.application).toMatchObject({ stage: 'Shortlisted', uiStage: 'Shortlisted' });
    expect(await Notification.countDocuments({ userId: s1._id, type: 'application_stage' })).toBe(1);
    await request(app).patch(`/api/applications/${appId}/stage`).set(auth('m1')).send({ stage: 'Interview' });
    const mine = (await request(app).get('/api/applications').set(auth('s1'))).body;
    expect(mine.items[0].uiStage).toBe('Interview'); expect(mine.items[0].history.map((h) => h.stage)).toEqual(['Applied', 'Shortlisted', 'Interview']);
    expect(mine.items[0].timeline.map((t) => t.state)).toEqual(['done', 'done', 'current', 'todo']);
    expect((await request(app).get('/api/applications').set(auth('s2'))).body.total).toBe(0); // own only
  });
  test('Offer and Hired both show as "Selected"; Rejected is terminal', async () => {
    const { appId } = await applied();
    for (const st of ['Shortlisted', 'Interview', 'Offer']) await request(app).patch(`/api/applications/${appId}/stage`).set(auth('m1')).send({ stage: st });
    expect((await request(app).get(`/api/applications/${appId}`).set(auth('s1'))).body.application.uiStage).toBe('Selected');
    await request(app).patch(`/api/applications/${appId}/stage`).set(auth('m1')).send({ stage: 'Rejected' });
    expect((await request(app).patch(`/api/applications/${appId}/stage`).set(auth('m1')).send({ stage: 'Hired' })).status).toBe(409);
    expect((await request(app).get(`/api/applications/${appId}`).set(auth('s1'))).body.application.uiStage).toBe('Not selected');
  });
  test('student can withdraw once; others cannot touch the application', async () => {
    const { appId } = await applied();
    expect((await request(app).post(`/api/applications/${appId}/withdraw`).set(auth('s2'))).status).toBe(404);
    expect((await request(app).post(`/api/applications/${appId}/withdraw`).set(auth('s1'))).body.application.uiStage).toBe('Withdrawn');
    expect((await request(app).post(`/api/applications/${appId}/withdraw`).set(auth('s1'))).status).toBe(409);
  });
});

describe('role requests (alumni verification queue)', () => {
  test('a student cannot become a mentor by asking; only an admin approval changes the role', async () => {
    expect((await request(app).post('/api/role-requests').set(auth('s1')).send({ requestedRole: 'mentor', role: 'admin' })).status).toBe(400);
    expect((await request(app).post('/api/role-requests').set(auth('s1')).send({ requestedRole: 'admin' })).status).toBe(400);
    const rr = await request(app).post('/api/role-requests').set(auth('s1')).send({ requestedRole: 'mentor', note: 'BI Developer, graduation proof attached' });
    expect(rr.status).toBe(201);
    expect((await request(app).post('/api/role-requests').set(auth('s1')).send({ requestedRole: 'mentor' })).status).toBe(409); // already pending
    expect((await User.findOne({ firebaseUid: 's1' })).role).toBe('student'); // still a student while pending
    expect((await request(app).post(`/api/admin/role-requests/${rr.body.roleRequest.id}/approve`).set(auth('m1')).send({})).status).toBe(403);
    expect((await request(app).get('/api/admin/role-requests').set(auth('a1'))).body.items[0].user.displayName).toBe('s1 Person');
    const ok = await request(app).post(`/api/admin/role-requests/${rr.body.roleRequest.id}/approve`).set(auth('a1')).send({});
    expect(ok.body.role).toBe('mentor');
    const u = await User.findOne({ firebaseUid: 's1' });
    expect(u).toMatchObject({ role: 'mentor', verificationStatus: 'verified' });
    expect(await MentorProfile.countDocuments({ userId: u._id })).toBe(1);
    expect(await AuditLog.countDocuments({ action: 'role.approve' })).toBe(1);
    expect((await request(app).post(`/api/admin/role-requests/${rr.body.roleRequest.id}/approve`).set(auth('a1')).send({})).status).toBe(409); // already reviewed
  });
  test('rejection needs a reason and leaves the role unchanged', async () => {
    const rr = (await request(app).post('/api/role-requests').set(auth('s2')).send({ requestedRole: 'mentor' })).body.roleRequest;
    expect((await request(app).post(`/api/admin/role-requests/${rr.id}/reject`).set(auth('a1')).send({})).status).toBe(400);
    expect((await request(app).post(`/api/admin/role-requests/${rr.id}/reject`).set(auth('a1')).send({ reason: 'Proof is unreadable' })).body.status).toBe('rejected');
    expect((await User.findOne({ firebaseUid: 's2' })).role).toBe('student');
    const sum = (await request(app).get('/api/admin/summary').set(auth('a1'))).body;
    expect(sum.toVerify).toBe(0);
  });
});

describe('department', () => {
  test('approves only pending students of its own university and department', async () => {
    await mkUser('d1', 'department', { department: 'CSE' });
    await mkUser('p1', 'student', { verificationStatus: 'pending', department: 'cse' }); // case-insensitive match
    await mkUser('x1', 'student', { verificationStatus: 'pending', department: 'EEE' });
    const list = await request(app).get('/api/department/affiliations').set(auth('d1'));
    expect(list.body.items.map((i) => i.displayName)).toEqual(['p1 P.']);
    expect(JSON.stringify(list.body)).not.toContain('@t.dev');
    const x1 = await User.findOne({ firebaseUid: 'x1' }), p1 = await User.findOne({ firebaseUid: 'p1' });
    expect((await request(app).post(`/api/department/affiliations/${x1._id}/approve`).set(auth('d1'))).status).toBe(404);
    expect((await request(app).post(`/api/department/affiliations/${p1._id}/approve`).set(auth('d1'))).status).toBe(200);
    expect((await User.findById(p1._id)).verificationStatus).toBe('verified');
    expect((await request(app).get('/api/department/affiliations').set(auth('s1'))).status).toBe(403);
  });
  test('overview is anonymized, honours consent, and hides tiny cohorts', async () => {
    await mkUser('d1', 'department', { department: 'CSE' });
    const [s1, s2] = await Promise.all(['s1', 's2'].map((u) => User.findOne({ firebaseUid: u })));
    await StudentProfile.create({ userId: s1._id, careerGoalRoleKey: 'data-analyst' });
    const ov = await request(app).get('/api/department/overview').set(auth('d1'));
    expect(ov.body).toMatchObject({ suppressed: false, anonymized: true, activeStudents: 1 });
    expect(ov.body.sessionsPerWeek).toHaveLength(6);
    expect(JSON.stringify(ov.body)).not.toMatch(/Person|@t\.dev|firebase/);
    for (const u of ['s1', 's2', 's3', 's4']) await request(app).patch('/api/me/consents').set(auth(u)).send({ departmentProgress: false });
    expect((await request(app).get('/api/department/overview').set(auth('d1'))).body.suppressed).toBe(true);
    expect(await ConsentRecord.countDocuments({ key: 'departmentProgress', value: false })).toBe(4);
  });
});

describe('blocks and user reports', () => {
  test('a repeat report counts once; "also block" blocks; admins cannot be reported', async () => {
    const m1 = await User.findOne({ firebaseUid: 'm1' }), a1 = await User.findOne({ firebaseUid: 'a1' });
    const r1 = await request(app).post('/api/reports/user').set(auth('s1')).send({ userId: String(m1._id), reason: 'asked_money', alsoBlock: true });
    const r2 = await request(app).post('/api/reports/user').set(auth('s1')).send({ userId: String(m1._id), reason: 'asked_money' });
    expect(r1.status).toBe(201); expect(r2.body.alreadyReported).toBe(true);
    expect(await Report.countDocuments({ targetType: 'user' })).toBe(1);
    expect(await Block.countDocuments({ blockerId: (await User.findOne({ firebaseUid: 's1' }))._id })).toBe(1);
    expect((await request(app).post('/api/reports/user').set(auth('s1')).send({ userId: String(a1._id), reason: 'other' })).status).toBe(404);
    expect((await request(app).get('/api/blocks').set(auth('s1'))).body.items[0].displayName).toBe('m1 Person');
    const q = await request(app).get('/api/admin/reports?targetType=user').set(auth('a1'));
    expect(q.body.items[0]).toMatchObject({ targetType: 'user', reporters: 1, displayName: 'm1 Person' });
    expect((await request(app).delete(`/api/blocks/${m1._id}`).set(auth('s1'))).status).toBe(204);
  });
});

describe('admin: audit log, fairness, preview, access', () => {
  test('admin-only; every action is recorded; fairness reports the top mentor share', async () => {
    const id = await approvedOpp();
    await request(app).post('/api/admin/preview').set(auth('a1')).send({ role: 'student' });
    const log = await request(app).get('/api/admin/audit').set(auth('a1'));
    expect(log.body.items.map((x) => x.action)).toEqual(expect.arrayContaining(['opportunity.approve', 'admin.preview']));
    expect(log.body.items[0].actor.displayName).toBe('a1 Person');
    for (const path of ['/api/admin/audit', '/api/admin/fairness', '/api/admin/summary', '/api/admin/reports']) {
      expect((await request(app).get(path).set(auth('m1'))).status).toBe(403);
      expect((await request(app).get(path).set(auth('s1'))).status).toBe(403);
    }
    const mentors = await Promise.all(['m1', 'm2'].map((u) => User.findOne({ firebaseUid: u })));
    const mk = (mentor, n) => Array.from({ length: n }, () => Match.create({ studentId: new mongoose.Types.ObjectId(), mentorId: mentor._id, score: 0.5 }));
    await Promise.all([...mk(mentors[0], 3), ...mk(mentors[1], 1)]);
    const f = (await request(app).get('/api/admin/fairness').set(auth('a1'))).body;
    expect(f).toMatchObject({ total: 4, highestShare: 75, compliant: false, highestMentorName: 'm1 Person', sampleTooSmall: true });
  });
});

describe('CV', () => {
  test('versions count up; no contact fields; mentors comment only on their mentees', async () => {
    const c1 = await request(app).post('/api/cv').set(auth('s1')).send({ headline: 'Analyst', summary: 'x', education: [{ institution: 'U' }] });
    const c2 = await request(app).post('/api/cv').set(auth('s1')).send({ headline: 'Analyst 2', summary: 'x' });
    expect([c1.body.cv.version, c2.body.cv.version]).toEqual([1, 2]);
    expect((await request(app).post('/api/cv').set(auth('s1')).send({ headline: 'x', phone: '017' })).status).toBe(400);
    expect((await request(app).post('/api/cv').set(auth('s1')).send({ projects: [{ title: 'p', url: 'javascript:alert(1)' }] })).status).toBe(400);
    const id = c1.body.cv.id;
    expect((await request(app).get(`/api/cv/${id}`).set(auth('s2'))).status).toBe(404);
    expect((await request(app).get(`/api/cv/${id}`).set(auth('m1'))).status).toBe(404); // not a mentee
    expect((await request(app).post(`/api/cv/${id}/comments`).set(auth('m1')).send({ section: 'projects', line: 2, text: 'Add the result' })).status).toBe(404);
    const [s1, m1] = await Promise.all([User.findOne({ firebaseUid: 's1' }), User.findOne({ firebaseUid: 'm1' })]);
    await MentorRequest.create({ studentId: s1._id, mentorId: m1._id, goalText: 'goal goal', status: 'accepted' });
    expect((await request(app).post(`/api/cv/${id}/comments`).set(auth('m1')).send({ section: 'projects', line: 2, text: 'Add the result, like "cut report time by 30%"' })).status).toBe(201);
    const mine = (await request(app).get(`/api/cv/${id}`).set(auth('s1'))).body.cv;
    expect(mine.openComments).toBe(1);
    expect((await request(app).patch(`/api/cv/${id}/comments/${mine.comments[0].id}/resolve`).set(auth('s1'))).status).toBe(200);
    expect((await request(app).get('/api/cv').set(auth('s1'))).body.items.find((i) => i.version === 1).openComments).toBe(0);
  });
});

describe('mentor impact and outcome consent', () => {
  test('counts own sessions; outcomes only from mentees who agreed to share them', async () => {
    const [s1, s2, m1] = await Promise.all(['s1', 's2', 'm1'].map((u) => User.findOne({ firebaseUid: u })));
    for (const s of [s1, s2]) await MentorRequest.create({ studentId: s._id, mentorId: m1._id, goalText: 'goal goal', status: 'accepted' });
    const req1 = (await MentorRequest.findOne({ studentId: s1._id }))._id;
    await Session.create([0, 1].map((i) => ({ requestId: req1, studentId: s1._id, mentorId: m1._id, scheduledAt: new Date(Date.now() - (i + 1) * 86400000), durationMin: 30, status: 'completed' })));
    const app1 = { cvVersionId: new mongoose.Types.ObjectId(), consentSnapshot: { fields: ['cv'] } };
    const opp = new mongoose.Types.ObjectId();
    await Application.create({ studentId: s1._id, opportunityId: opp, stage: 'Interview', ...app1 });
    await Application.create({ studentId: s2._id, opportunityId: opp, stage: 'Shortlisted', ...app1 });
    let imp = (await request(app).get('/api/mentor/impact').set(auth('m1'))).body;
    expect(imp).toMatchObject({ sessionsHeld: 2, studentsHelped: 1, hoursGiven: 1, trustedMentor: false });
    expect(imp.reportedOutcomes).toMatchObject({ interviews: 0, shortlists: 0, menteesSharing: 0, selfReported: true }); // nobody consented
    await request(app).patch('/api/me/consents').set(auth('s1')).send({ mentorOutcomes: true });
    imp = (await request(app).get('/api/mentor/impact').set(auth('m1'))).body;
    expect(imp.reportedOutcomes).toMatchObject({ interviews: 1, shortlists: 0, menteesSharing: 1 });
    expect((await request(app).get('/api/mentor/impact').set(auth('s1'))).status).toBe(403);
    expect((await request(app).post('/api/me/outcome-feedback').set(auth('s1')).send({ mentoringHelped: 'a_lot' })).status).toBe(201);
  });
});
