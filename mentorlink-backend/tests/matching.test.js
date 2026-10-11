const { tokenize, buildTfidf, cosine } = require('../src/services/matching/textSim');
const F = require('../src/services/matching/factors');
const { isEligible, fairRerank, keywordBaseline, rankMentors } = require('../src/services/matching/rank');

describe('text similarity', () => {
  test('tokenizer keeps Bangla letters with their vowel signs', () => {
    expect(tokenize('ডেটা অ্যানালিস্ট, SQL!')).toEqual(['ডেটা', 'অ্যানালিস্ট', 'sql']);
  });
  test('identical docs ~1, disjoint docs 0', () => {
    const [a, b, c] = buildTfidf(['data analyst sql', 'data analyst sql', 'banking officer']);
    expect(cosine(a, b)).toBeCloseTo(1, 5);
    expect(cosine(a, c)).toBe(0);
  });
  test('more overlap -> higher similarity', () => {
    const [s, m1, m2] = buildTfidf(['data analyst sql powerbi', 'senior data analyst sql powerbi telecom', 'qa engineer testing']);
    expect(cosine(s, m1)).toBeGreaterThan(cosine(s, m2));
  });
});

describe('factors', () => {
  test('career alignment: bonus for exact tag, capped at 1', () => {
    expect(F.careerAlignment(0.5, true)).toBeCloseTo(0.65);
    expect(F.careerAlignment(0.95, true)).toBe(1);
  });
  test('gap coverage counts only level 3 in the top gaps', () => {
    expect(F.skillGapCoverage(['sql', 'powerbi'], { sql: 3, powerbi: 3 })).toBe(1);
    expect(F.skillGapCoverage(['sql', 'powerbi'], { sql: 3, powerbi: 2 })).toBe(0.5);
    expect(F.skillGapCoverage([], { sql: 3 })).toBe(0);
  });
  test('experience fit = min(years/10,1) x relevance', () => {
    expect(F.experienceFit(6, 1.0)).toBeCloseTo(0.6);
    expect(F.experienceFit(20, 0.6)).toBeCloseTo(0.6);
    expect(F.roleRelevance('data-analyst', ['junior-developer'], ['data-analyst'])).toBe(1);
    expect(F.roleRelevance('data-analyst', ['junior-developer'], ['junior-developer'])).toBe(0.6);
    expect(F.roleRelevance('data-analyst', ['junior-developer'], ['banker'])).toBe(0.3);
  });
  test('language: all=1, one=0.5, none=0', () => {
    expect(F.languageFit(['bn', 'en'], ['bn', 'en'])).toBe(1);
    expect(F.languageFit(['bn', 'en'], ['en'])).toBe(0.5);
    expect(F.languageFit(['bn', 'en'], [])).toBe(0);
  });
  test('schedule: overlap / requested, capped', () => {
    expect(F.scheduleFit(['a', 'b', 'c'], ['a', 'b', 'x'])).toBeCloseTo(2 / 3);
    expect(F.scheduleFit([], ['a'])).toBe(0.5);
  });
  test('reliability: new mentor 0.5, formula (c+2)/(a+4)', () => {
    expect(F.reliability(0, 0)).toBe(0.5);
    expect(F.reliability(14, 15)).toBeCloseTo(16 / 19);
  });
  test('weights add up to 100%', () => {
    expect(Object.values(F.WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});

describe('worked example: Data Analyst student, gaps SQL and Power BI, mentor Rahim Ahmed ~88%', () => {
  test('weighted sum', () => {
    const factors = {
      career: 0.97,                                 // TF-IDF + tag bonus (taken from the design)
      gaps: F.skillGapCoverage(['sql', 'powerbi'], { sql: 3, powerbi: 3, excel: 2 }),   // 1.0
      experience: F.experienceFit(6, 1.0),          // 0.6
      language: F.languageFit(['bn', 'en'], ['bn', 'en']), // 1.0
      schedule: F.scheduleFit(['Sun 20:30', 'Tue 21:00', 'Thu 20:00'], ['Sun 20:30', 'Tue 21:00', 'Fri 16:00']), // 2/3
      reliability: F.reliability(14, 15),           // 16/19
    };
    const r = F.weightedScore(factors);
    expect(r.points).toMatchObject({ career: 29.1, gaps: 25, experience: 9, language: 10, schedule: 6.7, reliability: 8.4 });
    expect(r.percent).toBe(88);
  });
});

const mk = (id, over = {}) => ({
  mentorId: id, displayName: id, roleTitle: 'Data Analyst', industry: 'Software', roleKeys: ['data-analyst'],
  yearsExperience: 5, skills: { sql: 3, powerbi: 3 }, languages: ['bn', 'en'], availableSlots: ['Sun 20:30'],
  sessionsCompleted: 5, acceptedRequests: 6, isRising: false, ratingAvg: 4.5, weeklyCapacity: 3, activeMentees: 1,
  paused: false, verified: true, blocked: false, doc: 'data analyst software sql powerbi', ...over,
});

describe('eligibility filter', () => {
  test('removes unverified, paused, full or blocked mentors', () => {
    expect(isEligible(mk('ok'))).toBe(true);
    expect(isEligible(mk('a', { verified: false }))).toBe(false);
    expect(isEligible(mk('b', { paused: true }))).toBe(false);
    expect(isEligible(mk('c', { activeMentees: 3 }))).toBe(false);
    expect(isEligible(mk('d', { blocked: true }))).toBe(false);
  });
});

describe('fair re-ranking', () => {
  const scored = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'].map((id, i) => mk(id, { score: 0.9 - i * 0.05 }));
  test('a mentor above the 25% cap is pushed out of the top 5', () => {
    const history = { total: 40, byMentor: { m1: 15 } }; // (15+1)/41 = 39% > 25%
    const { list, cappedOut } = fairRerank(scored, history);
    expect(list.map((m) => m.mentorId)).not.toContain('m1');
    expect(list).toHaveLength(5);
    expect(cappedOut).toContain('m1');
  });
  test('cap is not applied while there are too few recommendations to judge', () => {
    const { list } = fairRerank(scored, { total: 3, byMentor: { m1: 3 } });
    expect(list[0].mentorId).toBe('m1');
  });
  test('a rising mentor gets a slot when none is in the top 5', () => {
    const withRising = [...scored.slice(0, 5), mk('rise', { score: 0.5, isRising: true })];
    const { list, risingSlotAdded } = fairRerank(withRising, { total: 0, byMentor: {} });
    expect(list.some((m) => m.mentorId === 'rise')).toBe(true);
    expect(list).toHaveLength(5);
    expect(risingSlotAdded).toBe(true);
  });
  test('never returns fewer mentors than exist', () => {
    expect(fairRerank(scored.slice(0, 2), { total: 100, byMentor: { m1: 50, m2: 50 } }).list).toHaveLength(2);
  });
});

describe('rankMentors end to end (pure)', () => {
  const student = {
    goalRoleKey: 'data-analyst', relatedRoleKeys: ['junior-developer'], doc: 'data analyst sql powerbi',
    languages: ['bn', 'en'], preferredSlots: ['Sun 20:30'], gapKeys: ['sql', 'powerbi', 'python'],
    skillNames: { sql: { nameEn: 'SQL', nameBn: 'SQL' }, powerbi: { nameEn: 'Power BI', nameBn: 'Power BI' } },
  };
  const mentors = [
    mk('good'), mk('weak', { roleKeys: ['banker'], skills: {}, doc: 'banker teller loans', languages: ['en'], availableSlots: [] }),
    mk('full', { activeMentees: 3 }),
  ];
  test('best mentor first, full mentor excluded, reasons are plain words in both languages', () => {
    const { top, baseline } = rankMentors(student, mentors, { total: 0, byMentor: {} });
    expect(top.map((m) => m.mentorId)).toEqual(['good', 'weak']);
    expect(top[0].reasons.en).toMatch(/teaches SQL and Power BI, your top gaps/);
    expect(top[0].reasons.bn).toMatch(/সুপারিশ/);
    expect(baseline[0].mentorId).toBe('good');
  });
  test('no mentor takes more than 25% of recommendations in a simulated run', () => {
    const pool = Array.from({ length: 8 }, (_, i) => mk(`m${i}`, { yearsExperience: 10 - i }));
    const history = { total: 0, byMentor: {} };
    const counts = {};
    for (let s = 0; s < 60; s++) {
      const { top } = rankMentors(student, pool, history);
      for (const m of top) { counts[m.mentorId] = (counts[m.mentorId] || 0) + 1; history.byMentor[m.mentorId] = counts[m.mentorId]; history.total++; }
    }
    const max = Math.max(...Object.values(counts)) / history.total;
    expect(max).toBeLessThanOrEqual(0.25 + 0.05); // small tolerance for the first, un-capped sample window
  });
  test('keyword baseline ranks by shared words only', () => {
    const b = keywordBaseline('sql powerbi', [mk('a', { doc: 'sql powerbi' }), mk('b', { doc: 'banking' })]);
    expect(b.map((x) => x.mentorId)).toEqual(['a', 'b']);
  });
});
