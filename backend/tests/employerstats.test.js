// No database needed: employer funnel and timing numbers.
const { funnelFor, median } = require('../src/services/employerstats');
const t0 = new Date('2026-10-01T00:00:00Z');
const at = (d) => new Date(t0.getTime() + d * 864e5);
const app = (stage, history = [], created = 0) => ({ stage, createdAt: at(created), stageHistory: history.map(([s, d]) => ({ stage: s, at: at(d) })) });

test('funnel counts everyone who REACHED a stage, even after being rejected', () => {
  const f = funnelFor([
    app('Applied'), app('Under Review', [['Under Review', 1]]),
    app('Rejected', [['Under Review', 1], ['Shortlisted', 2], ['Rejected', 3]]),
    app('Hired', [['Shortlisted', 1], ['Interview', 2], ['Offer', 3], ['Hired', 4]]),
  ]);
  const n = Object.fromEntries(f.steps.map((s) => [s.key, s.count]));
  expect(n).toEqual({ applied: 4, reviewed: 3, shortlisted: 2, interview: 1, offer: 1, hired: 1 });
  expect(f.rejected).toBe(1);
  expect(f.biggestDropAt).toBe('reviewed');
});
test('a stage can be skipped (Shortlisted straight to Hired still counts for earlier steps)', () => {
  const f = funnelFor([app('Hired', [['Hired', 2]])]);
  expect(f.steps.map((s) => s.count)).toEqual([1, 1, 1, 1, 1, 1]);
});
test('time to first reply and time to hire use medians', () => {
  const f = funnelFor([
    app('Hired', [['Under Review', 1], ['Hired', 10]]), app('Hired', [['Under Review', 3], ['Hired', 20]]), app('Applied'),
  ]);
  expect(f.medianFirstReplyDays).toBe(2);
  expect(f.medianDaysToHire).toBe(15);
});
test('no applicants gives zeros and nulls, and small samples are marked', () => {
  const f = funnelFor([]);
  expect(f.total).toBe(0); expect(f.medianFirstReplyDays).toBeNull(); expect(f.smallSample).toBe(true);
  expect(f.steps.every((s) => s.percentOfApplied === 0)).toBe(true);
});
test('median helper', () => { expect(median([3, 1, 2])).toBe(2); expect(median([1, 2, 3, 4])).toBe(2.5); expect(median([])).toBeNull(); });
