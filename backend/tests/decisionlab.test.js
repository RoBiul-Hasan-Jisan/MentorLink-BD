// Pure-function tests: no database needed.
const { skillPrereqs, rankSkills, analyzeRole, compareRoles, simulate, MIN_POSTINGS } = require('../src/services/decisionlab');
const { TARGETS } = require('../src/data/targets');

const role = { key: 'data-analyst', titleEn: 'Data Analyst', titleBn: 'ডেটা অ্যানালিস্ট', requiredSkills: [
  { skillKey: 'sql', weight: 3, requiredLevel: 3 }, { skillKey: 'excel', weight: 2, requiredLevel: 3 }, { skillKey: 'python', weight: 2, requiredLevel: 2 },
  { skillKey: 'statistics', weight: 2, requiredLevel: 2 }, { skillKey: 'dashboard', weight: 2, requiredLevel: 2 }, { skillKey: 'communication', weight: 1, requiredLevel: 2 } ] };
const skills = [['sql', 25], ['excel', 15], ['python', 30], ['statistics', 25], ['dashboard', 15], ['communication', 12]].map(([key, learningHours]) => ({ key, nameEn: key, nameBn: key, learningHours }));
const post = (title, ...s) => ({ title, requiredSkills: s.map(([skillKey, requiredLevel]) => ({ skillKey, requiredLevel })) });
const ev = (skillKey, type, level) => ({ skillKey, type, level });
const prereqs = skillPrereqs(TARGETS);

describe('skill prerequisites from the topic graph', () => {
  test('dashboards need SQL 1 and Excel 2; Python needs Statistics 2', () => {
    expect(prereqs.get('dashboard').get('sql')).toBe(1);
    expect(prereqs.get('dashboard').get('excel')).toBe(2);
    expect(prereqs.get('python').get('statistics')).toBe(2);
  });
  test('no skill needs itself and no pair needs each other', () => {
    for (const [a, m] of prereqs) { expect(m.has(a)).toBe(false); for (const b of m.keys()) expect((prereqs.get(b) || new Map()).has(a)).toBe(false); }
  });
});

describe('priority P = D x W x G', () => {
  test('with enough postings, D is the posting share', () => {
    const posts = [post('Data Analyst', ['sql', 3], ['excel', 3]), post('Junior Data Analyst', ['sql', 3]), post('Data Analyst Intern', ['sql', 3], ['dashboard', 2])];
    const { rows, basis } = rankSkills({ role, evidence: [], postings: posts, prereqs });
    expect(basis).toBe('postings');
    const sql = rows.find((x) => x.skillKey === 'sql');
    expect(sql).toMatchObject({ D: 1, W: 1, G: 1, priority: 1 });
    const excel = rows.find((x) => x.skillKey === 'excel');
    expect(excel.D).toBe(0.33); expect(excel.W).toBe(0.67); expect(excel.priority).toBe(0.22);
  });
  test('with too few postings it falls back to the role template (D = 1) and says so', () => {
    const { rows, basis } = rankSkills({ role, evidence: [], postings: [post('Data Analyst', ['sql', 3])], prereqs });
    expect(MIN_POSTINGS).toBe(3);
    expect(basis).toBe('role_template');
    expect(rows.every((x) => x.D === 1)).toBe(true);
  });
  test('a skill already at the required level is not ranked', () => {
    const { rows } = rankSkills({ role, evidence: [ev('sql', 'quiz', 3)], postings: [], prereqs });
    expect(rows.find((x) => x.skillKey === 'sql')).toBeUndefined();
  });
  test('G uses the current level: half-way gives 0.5 or less', () => {
    const { rows } = rankSkills({ role, evidence: [ev('sql', 'quiz', 2)], postings: [], prereqs });
    expect(rows.find((x) => x.skillKey === 'sql').G).toBe(0.33);
  });
});

describe('prerequisite-aware next step', () => {
  test('a blocked skill is not recommended; the reason is listed', () => {
    const a = analyzeRole({ role, evidence: [], skills, weeklyHours: 5, allPostings: [], prereqs });
    const dash = a.skills.find((x) => x.skillKey === 'dashboard');
    expect(dash.startable).toBe(false);
    expect(dash.learnFirst.map((x) => x.skillKey).sort()).toEqual(['excel', 'sql']);
    expect(a.next.startable).toBe(true);
    expect(a.next.skillKey).not.toBe('dashboard');
  });
  test('proof changes the next action: proving Excel and SQL unlocks dashboards', () => {
    const before = analyzeRole({ role, evidence: [], skills, weeklyHours: 5, allPostings: [], prereqs });
    const after = analyzeRole({ role, evidence: [ev('sql', 'quiz', 3), ev('excel', 'quiz', 3)], skills, weeklyHours: 5, allPostings: [], prereqs });
    expect(before.skills.find((x) => x.skillKey === 'dashboard').startable).toBe(false);
    expect(after.skills.find((x) => x.skillKey === 'dashboard').startable).toBe(true);
    expect(after.readiness).toBeGreaterThan(before.readiness);
  });
  test('proven readiness ignores self ratings', () => {
    const a = analyzeRole({ role, evidence: [ev('sql', 'self', 3), ev('excel', 'quiz', 3)], skills, weeklyHours: 0, allPostings: [], prereqs });
    expect(a.readiness).toBeGreaterThan(a.provenReadiness);
  });
});

describe('what-if simulation', () => {
  const evid = [ev('sql', 'quiz', 2)];
  test('shows a higher score and the study hours it would cost, labelled hypothetical', () => {
    const s = simulate({ role, evidence: evid, skills, weeklyHours: 5, learn: [{ skillKey: 'sql', level: 3 }, { skillKey: 'excel', level: 3 }] });
    expect(s.hypothetical).toBe(true);
    expect(s.delta).toBeGreaterThan(0);
    expect(s.after.readiness).toBeGreaterThan(s.before.readiness);
    expect(s.studyHoursNeeded).toBe(25 + 45); // sql 2->3 = 25h, excel 0->3 = 3 x 15h
    expect(s.label).toMatch(/Simulation only/);
  });
  test('it never raises the proven score', () => {
    const s = simulate({ role, evidence: evid, skills, weeklyHours: 5, learn: [{ skillKey: 'excel', level: 3 }] });
    expect(s.provenReadiness.after).toBe(s.provenReadiness.before);
  });
  test('learning something you already have changes nothing', () => {
    const s = simulate({ role, evidence: evid, skills, weeklyHours: 5, learn: [{ skillKey: 'sql', level: 2 }] });
    expect(s.delta).toBe(0); expect(s.studyHoursNeeded).toBe(0);
  });
});

describe('role comparison', () => {
  test('ranks by readiness, then by hours left', () => {
    const items = [{ readiness: 40, totalHours: 100 }, { readiness: 70, totalHours: 80 }, { readiness: 70, totalHours: 50 }];
    expect(compareRoles(items).map((x) => [x.fitRank, x.totalHours])).toEqual([[1, 50], [2, 80], [3, 100]]);
  });
});
