const R = require('../src/services/readiness');

// Data Analyst template (weight, required level)
const DA = [
  { skillKey: 'sql', weight: 5, requiredLevel: 3 }, { skillKey: 'powerbi', weight: 4, requiredLevel: 2 },
  { skillKey: 'python', weight: 3, requiredLevel: 2 }, { skillKey: 'excel', weight: 3, requiredLevel: 2 },
  { skillKey: 'statistics', weight: 3, requiredLevel: 2 }, { skillKey: 'communication', weight: 2, requiredLevel: 2 },
];
const L = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { level: v, verified: true }]));

describe('effectiveLevels', () => {
  test('self-rating alone is capped at level 1', () => {
    expect(R.effectiveLevels([{ skillKey: 'sql', level: 3, verified: false }]).sql).toEqual({ level: 1, verified: false });
  });
  test('verified evidence counts in full and beats self', () => {
    const r = R.effectiveLevels([{ skillKey: 'sql', level: 3, verified: false }, { skillKey: 'sql', level: 2, verified: true }]);
    expect(r.sql).toEqual({ level: 2, verified: true });
  });
});

describe('readinessPercent', () => {
  test('formula 100*sum(w*min(s/r,1))/sum(w)', () => {
    const p = R.readinessPercent(DA, L({ sql: 1, powerbi: 0, python: 1, excel: 2, statistics: 2, communication: 2 }));
    expect(p).toBeCloseTo(55.83, 1); // (1.667+0+1.5+3+3+2)/20
  });
  test('levels above required do not over-credit', () => {
    expect(R.readinessPercent(DA, L({ sql: 3, powerbi: 3, python: 3, excel: 3, statistics: 3, communication: 3 }))).toBe(100);
  });
  test('no evidence -> 0, empty template -> 0', () => {
    expect(R.readinessPercent(DA, {})).toBe(0);
    expect(R.readinessPercent([], {})).toBe(0);
  });
});

describe('computeGaps', () => {
  test('ordered by w*(r-s): SQL, Power BI, Python', () => {
    const gaps = R.computeGaps(DA, L({ sql: 1, powerbi: 0, python: 1, excel: 2, statistics: 2, communication: 2 }));
    expect(gaps.map((g) => g.skillKey)).toEqual(['sql', 'powerbi', 'python']);
    expect(gaps.map((g) => g.priority)).toEqual([10, 8, 3]);
  });
  test('met skills are not gaps', () => {
    expect(R.computeGaps(DA, L({ sql: 3, powerbi: 2, python: 2, excel: 2, statistics: 2, communication: 2 }))).toEqual([]);
  });
});

describe('confidence', () => {
  test('share of skills with evidence beyond self-rating', () => {
    expect(R.confidence({ a: { level: 1, verified: false }, b: { level: 2, verified: true } })).toBe(0.5);
    expect(R.confidence({})).toBe(0);
  });
});

describe('timeToReady', () => {
  const gaps = R.computeGaps(DA, L({ sql: 1, powerbi: 0, python: 1, excel: 2, statistics: 2, communication: 2 }));
  const hpl = { sql: 6, powerbi: 5, python: 6 };
  test('hours / weekly hours, rounded up (28h / 6h = 5 weeks)', () => {
    expect(R.timeToReady(gaps, hpl, 6)).toMatchObject({ weeks: 5, estimatedHours: 28 });
  });
  test('zero or missing weekly hours -> null with explanation, never divide by zero', () => {
    const r = R.timeToReady(gaps, hpl, 0);
    expect(r.weeks).toBeNull();
    expect(r.note).toMatch(/weekly study hours/i);
    expect(R.timeToReady(gaps, hpl, undefined).weeks).toBeNull();
  });
  test('no gaps -> 0 weeks', () => expect(R.timeToReady([], hpl, 6).weeks).toBe(0));
});

describe('projectedPercent', () => {
  test('closing top two gaps raises readiness', () => {
    const lv = L({ sql: 1, powerbi: 0, python: 1, excel: 2, statistics: 2, communication: 2 });
    const gaps = R.computeGaps(DA, lv);
    expect(R.projectedPercent(DA, lv, gaps, 2)).toBeCloseTo(92.5, 1);
  });
});
