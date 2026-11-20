// No database needed: application tracker board rules.
const { buildBoard } = require('../src/services/tracker');
const now = new Date('2026-10-30T06:00:00Z');
const ago = (d) => new Date(now.getTime() - d * 864e5);
const job = (id, extra = {}) => ({ _id: id, title: `Job ${id}`, organization: 'Acme', ...extra });
const col = (b, k) => b.columns.find((c) => c.key === k);

test('stages land in the right columns', () => {
  const apps = [
    { _id: 'a1', stage: 'Applied', createdAt: ago(1), stageHistory: [], opportunity: job('j1') },
    { _id: 'a2', stage: 'Shortlisted', createdAt: ago(5), stageHistory: [{ stage: 'Shortlisted', at: ago(1) }], opportunity: job('j2') },
    { _id: 'a3', stage: 'Interview', createdAt: ago(9), stageHistory: [], opportunity: job('j3') },
    { _id: 'a4', stage: 'Offer', createdAt: ago(9), stageHistory: [], opportunity: job('j4') },
    { _id: 'a5', stage: 'Hired', createdAt: ago(9), stageHistory: [], opportunity: job('j5') },
    { _id: 'a6', stage: 'Rejected', createdAt: ago(9), stageHistory: [], opportunity: job('j6') },
  ];
  const b = buildBoard({ apps, now });
  expect(col(b, 'applied').count).toBe(2); expect(col(b, 'interview').count).toBe(1); expect(col(b, 'offer').count).toBe(1); expect(col(b, 'done').count).toBe(2);
  expect(col(b, 'done').cards.map((c) => c.outcome).sort()).toEqual(['hired', 'rejected']);
});
test('7 days without movement in Applied = stale; movement resets the clock; later stages are never stale', () => {
  const apps = [
    { _id: 'old', stage: 'Applied', createdAt: ago(8), stageHistory: [], opportunity: job('j1') },
    { _id: 'moved', stage: 'Under Review', createdAt: ago(20), stageHistory: [{ stage: 'Under Review', at: ago(2) }], opportunity: job('j2') },
    { _id: 'iv', stage: 'Interview', createdAt: ago(30), stageHistory: [], opportunity: job('j3') },
  ];
  const b = buildBoard({ apps, now });
  expect(b.staleCount).toBe(1);
  expect(col(b, 'applied').cards[0]).toMatchObject({ id: 'old', stale: true, daysWaiting: 8 });
  expect(col(b, 'interview').cards[0].stale).toBe(false);
});
test('saved jobs are sorted by deadline, closed ones are hidden, and closing soon is flagged', () => {
  const saved = [
    { opportunity: job('late', { applicationDeadline: new Date(now.getTime() + 20 * 864e5) }) },
    { opportunity: job('soon', { applicationDeadline: new Date(now.getTime() + 2 * 864e5) }) },
    { opportunity: job('gone', { applicationDeadline: ago(1) }) },
    { opportunity: job('none') },
  ];
  const c = col(buildBoard({ saved, now }), 'saved');
  expect(c.cards.map((x) => x.id)).toEqual(['soon', 'late', 'none']);
  expect(c.cards[0].closingSoon).toBe(true);
});
test('an application whose job was deleted still shows', () => {
  const b = buildBoard({ apps: [{ _id: 'x', stage: 'Applied', createdAt: ago(1), stageHistory: [], opportunity: null }], now });
  expect(col(b, 'applied').cards[0].title).toBe('Job removed');
});
