// Pure tests (no database, no internet): graph builder, GitHub mapping and ownership check, analytics bands.
const { TARGETS, analyse } = require('../src/data/targets');
const { buildGraph } = require('../src/services/pathgraph');
const github = require('../src/services/github');
const { bandCounts } = require('../src/routes/analytics');

const ml = TARGETS.find((t) => t.key === 'ml');
const state = (known = [], evidence = {}) => analyse(ml, new Set(known), evidence, 5);

describe('career pathway graph', () => {
  test('has one node per topic, one target node, and every edge points at a real node', () => {
    const g = buildGraph(ml, state(), { quizSkills: new Set(['python', 'statistics']) });
    const ids = new Set(g.nodes.map((n) => n.id));
    expect(g.nodes.filter((n) => n.type === 'topic')).toHaveLength(ml.topics.length);
    expect(g.nodes.filter((n) => n.type === 'target')).toHaveLength(1);
    for (const e of g.edges) { expect(ids.has(e.from)).toBe(true); expect(ids.has(e.to)).toBe(true); }
  });
  test('prerequisites sit in an earlier column than the topic that needs them', () => {
    const g = buildGraph(ml, state());
    const col = new Map(g.nodes.map((n) => [n.id, n.col]));
    for (const e of g.edges.filter((x) => x.kind === 'prerequisite_of')) expect(col.get(e.from)).toBeLessThan(col.get(e.to));
    expect(g.nodes.find((n) => n.type === 'target').col).toBe(g.columns - 1);
  });
  test('shows what to do first: ready, locked, known and verified', () => {
    const g = buildGraph(ml, state(['py'], { statistics: 2 }));
    const st = (k) => g.nodes.find((n) => n.id === `t:${k}`).status;
    expect(st('py')).toBe('known');
    expect(st('stats')).toBe('verified'); // quiz/project/mentor evidence at the needed level
    expect(st('linreg')).toBe('locked');
    expect(['ready', 'known', 'verified']).toContain(st('linalg'));
    expect(g.counts.verified + g.counts.known + g.counts.ready + g.counts.locked).toBe(ml.topics.length);
    expect(g.nextKey).toBeTruthy();
  });
  test('assessment nodes appear only for skills that have a quiz', () => {
    const none = buildGraph(ml, state(), { quizSkills: new Set() });
    expect(none.nodes.some((n) => n.type === 'assessment')).toBe(false);
    const some = buildGraph(ml, state(), { quizSkills: new Set(['python']) });
    expect(some.nodes.some((n) => n.type === 'assessment' && n.skillKey === 'python')).toBe(true);
  });
  test('every target and pathway builds without error', () => {
    for (const t of TARGETS) expect(() => buildGraph(t, analyse(t, new Set(), {}, 0))).not.toThrow();
  });
});

describe('GitHub link', () => {
  const realGet = github.client.get;
  afterEach(() => { github.client.get = realGet; });
  test('accepts only valid usernames and makes a fresh code', () => {
    expect(github.checkUsername('octo-cat')).toBe('octo-cat');
    for (const bad of ['', '-x', 'a b', 'x/../y', 'a'.repeat(40)]) expect(() => github.checkUsername(bad)).toThrow();
    expect(github.newCode()).toMatch(/^mentorlink-[0-9a-f]{6}$/);
    expect(github.newCode()).not.toBe(github.newCode());
  });
  test('verifies when the code is in the bio and keeps only own (non-fork) repos', async () => {
    github.client.get = async (p) => p.endsWith('/repos?per_page=100&sort=pushed')
      ? [{ name: 'a', html_url: 'https://github.com/o/a', language: 'Python', topics: ['pandas'], fork: false, stargazers_count: 2 }, { name: 'f', html_url: 'https://github.com/o/f', fork: true }]
      : { bio: 'student, mentorlink-abc123' };
    const repos = await github.verifyOwnership('o', 'mentorlink-abc123');
    expect(repos.map((x) => x.name)).toEqual(['a']);
  });
  test('refuses when the code is missing, and says what to do', async () => {
    github.client.get = async () => ({ bio: 'hello' });
    await expect(github.verifyOwnership('o', 'mentorlink-abc123')).rejects.toMatchObject({ status: 400, code: 'CODE_NOT_FOUND', message: expect.stringContaining('mentorlink-abc123') });
  });
  test('maps language and topics to skills (a repo only suggests; it is not proof of level)', () => {
    expect(github.skillsForRepo({ language: 'Python', topics: ['sql', 'unknown'] }).sort()).toEqual(['python', 'sql']);
    expect(github.skillsForRepo({ language: 'Brainf', topics: [] })).toEqual([]);
  });
});

describe('department analytics', () => {
  test('bands count students and hide groups smaller than 5', () => {
    const b = bandCounts([10, 20, 30, 35, 38, 50, 90]);
    expect(b.find((x) => x.key === 'low').count).toBe(5);
    expect(b.find((x) => x.key === 'mid').count).toBeNull(); // 1 student: hidden
    expect(b.find((x) => x.key === 'high').count).toBeNull(); // 1 student: hidden
  });
});
