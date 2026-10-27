const { parseCsv, scoreList, analyzeAB, ci } = require('../study/analyze-ab');

describe('csv parsing', () => {
  test('quoted cells with commas and quotes', () => {
    const r = parseCsv('a,b\n"x, y","say ""hi"""\n');
    expect(r).toEqual([{ a: 'x, y', b: 'say "hi"' }]);
  });
});

describe('scoring one list', () => {
  // pool of 6 mentors rated 5,4,3,2,1,2 ; the system ranks the first five, the baseline ranks M06,M05,M04,M03,M02
  const rating = { M01: 5, M02: 4, M03: 3, M04: 2, M05: 1, M06: 2 };
  const list = (order) => order.map((m, i) => ({ rank: i + 1, rating: rating[m], yes: rating[m] >= 4 }));
  const pool = Object.values(rating);
  test('system list', () => {
    const s = scoreList(list(['M01', 'M02', 'M03', 'M04', 'M05']), pool);
    expect(s.top1Good).toBe(1);
    expect(s.precisionAt3).toBeCloseTo(2 / 3);
    expect(s.meanRating).toBeCloseTo(3);
    expect(s.wouldRequest).toBeCloseTo(2 / 5);
    expect(s.ndcg5).toBeGreaterThan(0.95); // almost the ideal order
  });
  test('baseline list', () => {
    const b = scoreList(list(['M06', 'M05', 'M04', 'M03', 'M02']), pool);
    expect(b.top1Good).toBe(0);
    expect(b.precisionAt3).toBe(0);
    expect(b.meanRating).toBeCloseTo(2.4);
    expect(b.ndcg5).toBeLessThan(0.7);
  });
});

describe('analyzeAB', () => {
  const mk = (s, sysOrder, baseOrder) => { const rows = {}; sysOrder.forEach((m, i) => { rows[m] = { ...(rows[m] || {}), systemRank: i + 1, baselineRank: null }; }); baseOrder.forEach((m, i) => { rows[m] = { systemRank: null, ...(rows[m] || {}), baselineRank: i + 1 }; }); return [s, { id: s, rows }]; };
  const key = { students: Object.fromEntries([
    mk('S01', ['M01', 'M02', 'M03', 'M04', 'M05'], ['M06', 'M05', 'M04', 'M03', 'M02']),
    mk('S02', ['M01', 'M02', 'M03', 'M04', 'M05'], ['M01', 'M02', 'M03', 'M04', 'M05']),
  ]) };
  const sheet = (r1, r2) => [...Object.entries(r1).map(([m, r]) => ({ student_code: 'S01', mentor_code: m, rating: String(r), would_request: r >= 4 ? 'yes' : 'no' })), ...Object.entries(r2).map(([m, r]) => ({ student_code: 'S02', mentor_code: m, rating: String(r), would_request: r >= 4 ? 'yes' : 'no' }))];
  test('identical lists give zero difference; a better list gives a positive one', () => {
    const rows = sheet({ M01: 5, M02: 4, M03: 3, M04: 2, M05: 1, M06: 2 }, { M01: 3, M02: 3, M03: 3, M04: 3, M05: 3 });
    const r = analyzeAB(rows, key);
    expect(r.students).toBe(2);
    expect(r.metrics.meanRating.system).toBeCloseTo((3 + 3) / 2);
    expect(r.metrics.meanRating.baseline).toBeCloseTo((2.4 + 3) / 2);
    expect(r.metrics.meanRating.wins).toBe(1);
    expect(r.metrics.meanRating.ties).toBe(1);
    expect(r.metrics.precisionAt3.diff).toBeCloseTo((2 / 3 - 0 + 0) / 2);
    expect(r.note).toMatch(/small pilot/);
  });
  test('a student with a missing rating is excluded, not guessed', () => {
    const rows = sheet({ M01: 5, M02: 4, M03: 3, M04: 2, M05: 1 }, { M01: 3, M02: 3, M03: 3, M04: 3, M05: 3 });
    const r = analyzeAB(rows, key);
    expect(r.excluded).toEqual(['S01']); // M06 was never rated
    expect(r.students).toBe(1);
  });
  test('confidence interval needs at least two students', () => {
    expect(Number.isNaN(ci([1])[0])).toBe(true);
    const [lo, hi] = ci([1, 2, 3]);
    expect(lo).toBeLessThan(2); expect(hi).toBeGreaterThan(2);
  });
});
