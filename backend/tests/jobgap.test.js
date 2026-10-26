const request = require('supertest');
const { relevantPostings, demand, compare } = require('../src/services/jobgap');
const { setup, teardown, bearer, mkUni, mkUser, models } = require('./helpers');
const { seedLearning } = require('../src/seed/learning');

const role = { titleEn: 'Data Analyst', requiredSkills: [{ skillKey: 'sql' }, { skillKey: 'excel' }, { skillKey: 'statistics' }] };
const post = (title, ...s) => ({ title, requiredSkills: s.map(([skillKey, requiredLevel]) => ({ skillKey, requiredLevel })) });

describe('job gap maths', () => {
  const posts = [post('Junior Data Analyst', ['sql', 2], ['excel', 2]), post('Data Analyst Intern', ['sql', 1], ['dashboard', 2]), post('Barista', ['communication', 1])];
  test('relevant postings only', () => { expect(relevantPostings(posts, role).map((p) => p.title)).toEqual(['Junior Data Analyst', 'Data Analyst Intern']); });
  test('demand share and median level', () => {
    const d = demand(relevantPostings(posts, role));
    expect(d[0]).toMatchObject({ skillKey: 'sql', share: 1 });
    expect(d.find((x) => x.skillKey === 'excel').share).toBe(0.5);
  });
  test('proven vs self-rated vs missing', () => {
    const d = demand([post('A', ['sql', 2], ['excel', 2], ['dashboard', 2])]);
    const c = compare(d, [{ skillKey: 'sql', type: 'quiz', level: 2 }, { skillKey: 'excel', type: 'self', level: 3 }]);
    expect(c.strengths.map((x) => x.skillKey)).toEqual(['sql']);
    expect(c.evidenceNeeded.map((x) => x.skillKey)).toEqual(['excel']);
    expect(c.missing.map((x) => x.skillKey)).toEqual(['dashboard']);
  });
});

describe('GET /me/job-gaps', () => {
  let app, uni;
  beforeAll(async () => {
    app = await setup(); await seedLearning();
    uni = await mkUni('EDU', 'EDU', 'Chattogram', 91.83, 22.35);
    const s = await mkUser('s1', 'student', uni); const ad = await mkUser('a1', 'admin', null);
    await models.StudentProfile.create({ userId: s._id, careerGoalRoleKey: 'data-analyst' });
    await models.SkillEvidence.create({ studentId: s._id, skillKey: 'excel', type: 'project', level: 3 });
    await models.Opportunity.create({ postedBy: ad._id, title: 'Junior Data Analyst', organization: 'Demo Ltd', type: 'job', description: 'x'.repeat(30), sourceLabel: 'admin', status: 'approved', requiredSkills: [{ skillKey: 'sql', requiredLevel: 2 }, { skillKey: 'excel', requiredLevel: 2 }] });
  });
  afterAll(teardown);
  test('returns strengths, missing and an honest sample note', async () => {
    const r = await request(app).get('/api/me/job-gaps').set(bearer('s1'));
    expect(r.status).toBe(200);
    expect(r.body.strengths.map((x) => x.skillKey)).toContain('excel');
    expect(r.body.missing.map((x) => x.skillKey)).toContain('sql');
    expect(r.body.postingsUsed).toBe(1);
    expect(r.body.note).toMatch(/only 1 approved/);
  });
  test('employers and mentors cannot call it', async () => {
    await mkUser('m1', 'mentor', uni);
    expect((await request(app).get('/api/me/job-gaps').set(bearer('m1'))).status).toBe(403);
  });
});
