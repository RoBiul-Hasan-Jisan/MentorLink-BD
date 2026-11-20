const { parseCsv, analyze, spearman } = require('../study/analyze');
test('spearman: perfect, reversed, and too-few points', () => {
  expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
  expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1);
  expect(Number.isNaN(spearman([1, 2], [1, 2]))).toBe(true);
});
test('analyze: worked example with one student rated 5,4,3,2,1 for ranks 1..5', () => {
  const csv = ['rater_code,student_code,mentor_code,rank_shown,system_score,rating,would_request',
    'R1,S01,M01,1,88,5,yes', 'R1,S01,M02,2,80,4,yes', 'R1,S01,M03,3,70,3,no', 'R1,S01,M04,4,60,2,no', 'R1,S01,M05,5,50,1,no',
    'R2,S02,M01,1,90,2,no', 'R2,S02,M02,2,80,,'].join('\n');
  const r = analyze(parseCsv(csv));
  expect(r.studentsRated).toBe(2);
  expect(r.ratings).toBe(6);                       // the blank rating is ignored
  expect(r.top1GoodRate).toBeCloseTo(0.5);         // S01 rank-1 rated 5 (good), S02 rank-1 rated 2 (not)
  expect(r.precisionAt3).toBeCloseTo((2 / 3 + 0) / 2);
  expect(r.wouldRequestRate).toBeCloseTo(2 / 6);
  expect(r.note).toMatch(/small pilot/);
});
