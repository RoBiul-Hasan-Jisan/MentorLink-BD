// Blocking closes the chat for both people (pure rule, no database).
const { isBlockedBetween, hasBlocked, otherId } = require('../src/services/blocks');

const a = { _id: 'a', blockedBy: ['x'] };
const b = { _id: 'b', blockedBy: [] };
const c = { _id: 'c' }; // older documents may have no blockedBy at all

describe('isBlockedBetween', () => {
  test('false when nobody blocked anybody', () => {
    expect(isBlockedBetween(b, c)).toBe(false);
    expect(isBlockedBetween(c, b)).toBe(false);
  });
  test('true in both directions when either side blocked the other', () => {
    const blocker = { _id: 'm', blockedBy: ['s'] };
    const blocked = { _id: 's', blockedBy: [] };
    expect(isBlockedBetween(blocker, blocked)).toBe(true);
    expect(isBlockedBetween(blocked, blocker)).toBe(true);
  });
  test('works with ObjectId-like values (compared as strings)', () => {
    const oid = (s) => ({ toString: () => s });
    expect(isBlockedBetween({ _id: oid('1'), blockedBy: [oid('2')] }, { _id: oid('2') })).toBe(true);
  });
  test('an unrelated block does not count', () => {
    expect(isBlockedBetween(a, b)).toBe(false);
  });
  test('missing users are never "blocked" (the route handles not-found separately)', () => {
    expect(isBlockedBetween(a, null)).toBe(false);
    expect(hasBlocked(undefined, a)).toBe(false);
  });
});

describe('otherId', () => {
  const rq = { studentId: 's1', mentorId: 'm1' };
  test('returns the other person on the request', () => {
    expect(otherId(rq, 's1')).toBe('m1');
    expect(otherId(rq, 'm1')).toBe('s1');
  });
});
