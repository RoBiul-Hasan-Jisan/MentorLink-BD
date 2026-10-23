const request = require('supertest');
const { computeReadiness } = require('../src/services/readiness');
const { rankMentors } = require('../src/services/matching');
const { setup, teardown, bearer, mkUni, mkUser, models } = require('./helpers');
const { seedLearning } = require('../src/seed/learning');

const role = { key: 'data-analyst', requiredSkills: [{ skillKey: 'sql', weight: 3, requiredLevel: 3 }, { skillKey: 'excel', weight: 2, requiredLevel: 3 }, { skillKey: 'python', weight: 2, requiredLevel: 2 }] };
const skills = [{ key: 'sql', learningHours: 25, nameEn: 'SQL' }, { key: 'excel', learningHours: 15 }, { key: 'python', learningHours: 30 }];

describe('readiness maths', () => {
  test('formula, gap order, hours', () => {
    const ev = [{ skillKey: 'sql', level: 2, type: 'quiz' }, { skillKey: 'excel', level: 3, type: 'self' }];
    const r = computeReadiness({ role, evidence: ev, skills, weeklyHours: 6 });
    // (3*2/3 + 2*1 + 2*0)/7 = 4/7 = 57%
    expect(r.readiness).toBe(57);
    expect(r.gaps[0].skillKey).toBe('python'); // 2*2=4 beats sql 3*1=3
    expect(r.totalHours).toBe(25 + 60);
    expect(r.timeToReadyWeeks).toBe(Math.ceil(85 / 6));
    expect(r.confidence).toBe(33); // only sql has non-self evidence (1 of 3)
  });
  test('zero weekly hours -> null with note', () => {
    const r = computeReadiness({ role, evidence: [], skills, weeklyHours: 0 });
    expect(r.timeToReadyWeeks).toBeNull();
    expect(r.timeNote).toBeTruthy();
  });
});

describe('matching', () => {
  const mk = (id, extra = {}, prof = {}) => ({
    user: { _id: id, verificationStatus: 'verified', blockedBy: [], ...extra },
    profile: { roleKey: 'data-analyst', relatedRoleKeys: [], roleTitle: 'Data Analyst', industry: 'Fintech', yearsExperience: 8, expertiseSkills: [{ skillKey: 'sql', level: 3 }, { skillKey: 'python', level: 2 }], languages: ['bn', 'en'], availableSlots: ['sun-20', 'tue-21'], acceptedRequests: 10, sessionsCompleted: 9, paused: false, ...prof },
  });
  const student = { user: { _id: 'stu', blockedBy: [] }, profile: { careerGoalRoleKey: 'data-analyst', goalText: 'data analyst fintech', languages: ['bn'], requestedSlots: ['sun-20', 'tue-21'] } };
  const gaps = [{ skillKey: 'sql', required: 3, priority: 3, nameEn: 'SQL' }, { skillKey: 'python', required: 2, priority: 4, nameEn: 'Python' }];

  test('strong match scores high with bilingual reasons', () => {
    const [m] = rankMentors({ student, role: { titleEn: 'Data Analyst' }, gaps, mentors: [mk('a')] });
    expect(m.score).toBeGreaterThanOrEqual(85);
    expect(m.reasons.length).toBeGreaterThan(2);
    expect(m.reasons[0].bn).toBeTruthy();
  });
  test('paused, unverified, blocked mentors are excluded', () => {
    const out = rankMentors({ student, role: { titleEn: 'Data Analyst' }, gaps, mentors: [mk('p', {}, { paused: true }), mk('u', { verificationStatus: 'pending' }), mk('b', { blockedBy: ['stu'] })] });
    expect(out).toHaveLength(0);
  });
  test('new mentor reliability is 0.5; related-field mentor ranks below same-field', () => {
    const out = rankMentors({ student, role: { titleEn: 'Data Analyst' }, gaps, mentors: [mk('n', {}, { acceptedRequests: 0, sessionsCompleted: 0 }), mk('rel', {}, { roleKey: 'x', relatedRoleKeys: ['data-analyst'] })] });
    expect(out[0].mentorId).toBe('n');
    expect(out.find((o) => o.mentorId === 'n').factorScores.reliability).toBe(50);
  });
  test('fair re-rank demotes an over-exposed mentor and keeps a rising slot', () => {
    const mentors = [mk('top'), mk('b'), mk('c'), mk('d'), mk('e'), mk('f'), mk('rise', {}, { isRising: true, yearsExperience: 0, expertiseSkills: [] })];
    const out = rankMentors({ student, role: { titleEn: 'Data Analyst' }, gaps, mentors, recentCounts: { top: 9, b: 1 }, limit: 5 });
    expect(out[0].mentorId).not.toBe('top');
    expect(out.some((o) => o.mentorId === 'rise')).toBe(true);
  });
});

describe('learning API', () => {
  let app, edu;
  beforeAll(async () => {
    app = await setup(); await seedLearning();
    edu = await mkUni('East Delta University', 'EDU', 'Chattogram', 91.83, 22.35);
    const s = await mkUser('stu', 'student', edu);
    await models.StudentProfile.create({ userId: s._id });
    const m = await mkUser('abrar', 'mentor', edu, { displayName: 'Abrar Hossain' });
    await models.MentorProfile.create({ userId: m._id, roleKey: 'data-analyst', roleTitle: 'Data Analyst', industry: 'Fintech', yearsExperience: 7, expertiseSkills: [{ skillKey: 'sql', level: 3 }, { skillKey: 'excel', level: 3 }], availableSlots: ['sun-20'], acceptedRequests: 5, sessionsCompleted: 5 });
  });
  afterAll(teardown);
  test('goal -> evidence -> readiness -> matches', async () => {
    const h = bearer('stu');
    expect((await request(app).get('/api/me/readiness').set(h)).status).toBe(400);
    expect((await request(app).put('/api/me/goal').set(h).send({ careerGoalRoleKey: 'data-analyst', goalText: 'data analyst', weeklyHours: 6, requestedSlots: ['sun-20'] })).status).toBe(200);
    expect((await request(app).post('/api/me/evidence').set(h).send({ skillKey: 'excel', type: 'endorsement', level: 3 })).status).toBe(400);
    expect((await request(app).post('/api/me/evidence').set(h).send({ skillKey: 'excel', type: 'quiz', level: 2 })).status).toBe(201);
    const rd = await request(app).get('/api/me/readiness').set(h);
    expect(rd.body.readiness).toBeGreaterThan(0);
    const mt = await request(app).get('/api/matches').set(h);
    expect(mt.status).toBe(200);
    expect(mt.body.matches[0].mentor.name).toBe('Abrar Hossain');
    expect(mt.body.matches[0].reasons.length).toBeGreaterThan(0);
  });
  test('mentor cannot call student-only endpoints', async () => {
    expect((await request(app).get('/api/matches').set(bearer('abrar'))).status).toBe(403);
  });
  test('mentor profile detail: student sees public data only, mentor and unknown ids are refused', async () => {
    const mt = await request(app).get('/api/matches').set(bearer('stu'));
    const id = mt.body.matches[0].mentor.id;
    const d = await request(app).get(`/api/mentors/${id}`).set(bearer('stu'));
    expect(d.status).toBe(200);
    expect(d.body.mentor.name).toBe('Abrar Hossain');
    expect(d.body.mentor.expertise.map((e) => e.skillKey)).toContain('sql');
    expect(JSON.stringify(d.body)).not.toMatch(/email|firebaseUid/);
    expect((await request(app).get(`/api/mentors/${id}`).set(bearer('abrar'))).status).toBe(403);
    expect((await request(app).get('/api/mentors/000000000000000000000000').set(bearer('stu'))).status).toBe(404);
  });
});

describe('resource hub', () => {
  let app, edu;
  beforeAll(async () => {
    app = await setup(); await seedLearning();
    edu = await mkUni('EDU', 'EDU', 'Chattogram', 91.83, 22.35);
    await mkUser('stu', 'student', edu); await mkUser('adm', 'admin', null); await mkUser('mnt', 'mentor', edu);
  });
  afterAll(teardown);
  test('list by skill, mark done, progress does not change readiness', async () => {
    const l = await request(app).get('/api/resources?skillKey=sql').set(bearer('stu'));
    expect(l.body.resources.length).toBeGreaterThan(0);
    expect(l.body.resources.every((x) => x.url.startsWith('https://'))).toBe(true);
    const id = l.body.resources[0].id;
    expect((await request(app).post(`/api/resources/${id}/complete`).set(bearer('stu'))).status).toBe(200);
    expect((await request(app).post(`/api/resources/${id}/complete`).set(bearer('stu'))).status).toBe(200); // idempotent
    expect((await request(app).get('/api/resources?skillKey=sql').set(bearer('stu'))).body.resources[0].done).toBe(true);
    expect(await models.SkillEvidence.countDocuments()).toBe(0);
  });
  test('saved / in-progress states, private per student, and report auto-hides at 3 unique reporters', async () => {
    const id = (await request(app).get('/api/resources?skillKey=sql').set(bearer('stu'))).body.resources[0].id;
    expect((await request(app).put(`/api/resources/${id}/progress`).set(bearer('stu')).send({ status: 'in_progress' })).status).toBe(200);
    expect((await request(app).get('/api/resources?skillKey=sql').set(bearer('stu'))).body.resources[0].status).toBe('in_progress');
    expect((await request(app).put(`/api/resources/${id}/progress`).set(bearer('stu')).send({ status: 'bogus' })).status).toBe(400);
    expect((await request(app).put(`/api/resources/${id}/progress`).set(bearer('mnt')).send({ status: 'saved' })).status).toBe(403);
    expect((await request(app).delete(`/api/resources/${id}/progress`).set(bearer('stu'))).status).toBe(200);
    expect((await request(app).get('/api/resources?skillKey=sql').set(bearer('stu'))).body.resources[0].status).toBe(null);
    const r1 = await request(app).post(`/api/resources/${id}/report`).set(bearer('stu')).send({ reason: 'Broken link' });
    expect(r1.status).toBe(201);
    expect((await request(app).post(`/api/resources/${id}/report`).set(bearer('stu')).send({ reason: 'Broken link' })).status).toBe(409); // same person counts once
    for (const k of ['s2', 's3']) { await mkUser(k, 'student', edu); await request(app).post(`/api/resources/${id}/report`).set(bearer(k)).send({ reason: 'Broken link' }); }
    expect((await request(app).get('/api/resources?skillKey=sql').set(bearer('stu'))).body.resources.find((x) => x.id === id)).toBeUndefined();
  });
  test('only admin adds resources, https only', async () => {
    const body = { title: 'SQL in Bangla', url: 'https://example.com/sql-bn', skillKey: 'sql', language: 'bn' };
    expect((await request(app).post('/api/admin/resources').set(bearer('mnt')).send(body)).status).toBe(403);
    expect((await request(app).post('/api/admin/resources').set(bearer('adm')).send({ ...body, url: 'http://example.com' })).status).toBe(400);
    expect((await request(app).post('/api/admin/resources').set(bearer('adm')).send(body)).status).toBe(201);
    expect((await request(app).get('/api/resources?language=bn').set(bearer('stu'))).body.resources).toHaveLength(1);
  });
});

describe('quizzes', () => {
  let app, edu;
  beforeAll(async () => { app = await setup(); await seedLearning(); edu = await mkUni('EDU', 'EDU', 'Chattogram', 91.83, 22.35); await mkUser('stu', 'student', edu); await mkUser('mnt', 'mentor', edu); });
  afterAll(teardown);
  test('quiz hides answers, server grades, passing adds quiz evidence', async () => {
    const q = await request(app).get('/api/quizzes/sql').set(bearer('stu'));
    expect(q.status).toBe(200);
    expect(JSON.stringify(q.body)).not.toMatch(/"answer"/);
    const r = await request(app).post('/api/quizzes/sql/submit').set(bearer('stu')).send({ answers: [1, 1, 1, 1, 1] });
    expect(r.body).toMatchObject({ correct: 5, percent: 100, levelAwarded: 3 });
    expect(await models.SkillEvidence.countDocuments({ skillKey: 'sql', type: 'quiz' })).toBe(1);
    const low = await request(app).post('/api/quizzes/excel/submit').set(bearer('stu')).send({ answers: [3, 3, 3, 3, 3] });
    expect(low.body.levelAwarded).toBe(0);
    expect((await request(app).post('/api/quizzes/sql/submit').set(bearer('stu')).send({ answers: [1] })).status).toBe(400);
    expect((await request(app).get('/api/quizzes/sql').set(bearer('mnt'))).status).toBe(403);
  });
});
