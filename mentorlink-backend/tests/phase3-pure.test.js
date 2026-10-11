const { weekStart, effectiveActiveMentees, isAtCapacity } = require('../src/services/capacity');
const { currentWeek, summarize } = require('../src/services/planStats');
const { findSuspicious } = require('../src/utils/scamKeywords');

describe('weekStart (Saturday 00:00 Dhaka = Friday 18:00 UTC)', () => {
  test.each([
    ['2026-10-14T12:00:00Z', '2026-10-09T18:00:00.000Z'], // Wednesday
    ['2026-10-10T01:00:00Z', '2026-10-09T18:00:00.000Z'], // Saturday morning Dhaka
    ['2026-10-16T17:59:00Z', '2026-10-09T18:00:00.000Z'], // Friday 23:59 Dhaka: still the same week
    ['2026-10-16T18:00:00Z', '2026-10-16T18:00:00.000Z'], // Saturday 00:00 Dhaka: new week
  ])('%s', (input, expected) => expect(weekStart(new Date(input)).toISOString()).toBe(expected));
});

describe('capacity', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  test('counts this week, resets for an old week, full = auto-paused', () => {
    expect(effectiveActiveMentees({ activeMentees: 2, capacityWeekStart: weekStart(now) }, now)).toBe(2);
    expect(effectiveActiveMentees({ activeMentees: 3, capacityWeekStart: new Date('2026-10-01T00:00:00Z') }, now)).toBe(0);
    expect(effectiveActiveMentees({ activeMentees: 2 }, now)).toBe(2); // never stamped: trusted as current
    expect(isAtCapacity({ activeMentees: 3, weeklyCapacity: 3, capacityWeekStart: weekStart(now) }, now)).toBe(true);
    expect(isAtCapacity({ activeMentees: 2, weeklyCapacity: 3, capacityWeekStart: weekStart(now) }, now)).toBe(false);
    expect(isAtCapacity({ activeMentees: 3, weeklyCapacity: 3, capacityWeekStart: new Date('2026-10-01T00:00:00Z') }, now)).toBe(false);
  });
});

describe('plan stats', () => {
  const start = new Date('2026-10-01T00:00:00Z');
  test('current week is clamped to 1..4', () => {
    expect(currentWeek(start, new Date('2026-10-01T10:00:00Z'))).toBe(1);
    expect(currentWeek(start, new Date('2026-10-09T00:00:00Z'))).toBe(2);
    expect(currentWeek(start, new Date('2026-12-30T00:00:00Z'))).toBe(4);
    expect(currentWeek(start, new Date('2026-09-20T00:00:00Z'))).toBe(1);
  });
  test('progress, completion rate and week states', () => {
    const tasks = [{ weekNumber: 1, status: 'done' }, { weekNumber: 2, status: 'done' }, { weekNumber: 2, status: 'todo' }, { weekNumber: 3, status: 'todo' }];
    const s = summarize(tasks, start, new Date('2026-10-09T00:00:00Z')); // week 2
    expect(s.currentWeek).toBe(2);
    expect(s.overallProgress).toBe(50);            // 2 of 4
    expect(s.completionRate).toBe(67);              // tasks up to week 2: 2 of 3 done
    expect(s.weeks.map((w) => w.state)).toEqual(['past', 'now', 'next', 'next']);
    expect(s.weeks[1]).toMatchObject({ total: 2, done: 1 });
  });
  test('empty plan: 0 progress, null completion rate', () => {
    expect(summarize([], start, start)).toMatchObject({ overallProgress: 0, completionRate: null });
  });
});

describe('scam keyword flag', () => {
  test('flags fee requests, ignores normal talk', () => {
    expect(findSuspicious('Please pay a Registration Fee of 500 taka')).toEqual(['registration fee']);
    expect(findSuspicious('Let us start with SQL joins on Sunday')).toEqual([]);
  });
});
