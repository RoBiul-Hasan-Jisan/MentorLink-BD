// Logic tests for the launch features (no database needed).
const S = require('../src/services/startup');

const skills = [{ key: 'sql', nameEn: 'SQL', nameBn: 'এসকিউএল' }, { key: 'python', nameEn: 'Python', nameBn: 'পাইথন' }, { key: 'excel', nameEn: 'Excel', nameBn: 'এক্সেল' }];

describe('Career Passport', () => {
  test('self-rated skills are never shown as proof; the best proven level wins; endorsement is flagged', () => {
    const ev = [
      { skillKey: 'sql', type: 'self', level: 3 },
      { skillKey: 'python', type: 'quiz', level: 1 }, { skillKey: 'python', type: 'endorsement', level: 2 },
      { skillKey: 'excel', type: 'self', level: 2 },
    ];
    const p = S.provenSkills(ev, skills);
    expect(p.map((x) => x.skillKey)).toEqual(['python']);
    expect(p[0].level).toBe(2); expect(p[0].endorsed).toBe(true); expect(p[0].levelEn).toBe('Intermediate');
  });
  test('proof strength is a transparent capped count', () => {
    const proven = [1, 2, 3, 4, 5, 6].map((i) => ({ skillKey: `s${i}`, level: 2, endorsed: i <= 4 }));
    const r = S.proofStrength({ proven, projects: 5, sprints: 5, github: true });
    expect(r.parts).toEqual({ skills: 40, endorsed: 25, projects: 15, sprints: 15, github: 5 });
    expect(r.score).toBe(100);
    expect(S.proofStrength({ proven: [], projects: 0, sprints: 0, github: false }).score).toBe(0);
  });
  test('the public view carries no contact data and respects the owner\'s switches', () => {
    const user = { displayName: 'Robiul Hasan Jisan', department: 'CSE', email: 'secret@x.com', phone: '017' };
    const evidence = [{ skillKey: 'sql', type: 'endorsement', level: 3 }];
    const base = { user, university: { name: 'East Delta University', shortName: 'EDU', city: 'Chattogram' }, evidence, skills, projects: [{ title: 'P', url: 'https://x.y', skillKeys: ['sql'], review: 'endorsed' }], github: { verified: true, username: 'rob' }, badges: [{ id: 'quiz', titleEn: 'Quiz', titleBn: 'কুইজ', earned: true }], sprints: [] };
    const all = S.passportView({ ...base, show: {} });
    expect(all.name).toBe('Robiul H.');
    expect(JSON.stringify(all)).not.toMatch(/secret@x\.com|017/);
    expect(all.skills[0].endorsed).toBe(true); expect(all.github.username).toBe('rob');
    const hidden = S.passportView({ ...base, show: { endorsements: false, github: false, projects: false, badges: false } });
    expect(hidden.skills[0].endorsed).toBe(false); expect(hidden.github).toBeNull(); expect(hidden.projects).toEqual([]); expect(hidden.badges).toEqual([]);
    expect(S.passportView({ ...base, show: { skills: false } }).skills).toEqual([]);
  });
});

describe('Mentor Sprint', () => {
  test('has 7 ordered days, ends with a mentor review, and uses weak topics when given', () => {
    const d = S.sprintDays(skills[0], ['Joins', 'Aggregates']);
    expect(d).toHaveLength(7); expect(d.map((x) => x.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(d[6].kind).toBe('review'); expect(d[1].titleEn).toContain('Joins'); expect(d[2].titleEn).toContain('Aggregates');
    expect(d.every((x) => x.done === false && x.titleBn && x.taskBn)).toBe(true);
    expect(S.sprintDays(skills[0])[1].titleEn).toBe('Learn the basics');
  });
  test('cannot be submitted too early or without an https proof link', () => {
    const days = (n) => Array.from({ length: 7 }, (_, i) => ({ n: i + 1, done: i < n }));
    expect(S.canSubmitSprint({ status: 'active', days: days(4) }, 'https://a.b').ok).toBe(false);
    expect(S.canSubmitSprint({ status: 'active', days: days(5) }, 'http://a.b').ok).toBe(false);
    expect(S.canSubmitSprint({ status: 'active', days: days(5) }, 'https://a.b').ok).toBe(true);
    expect(S.canSubmitSprint({ status: 'completed', days: days(7) }, 'https://a.b').ok).toBe(false);
    expect(S.canSubmitSprint({ status: 'needs_work', days: days(7) }, 'https://a.b').ok).toBe(true);
  });
  test('a mentor can endorse only up to their own level', () => {
    expect(S.endorseLevel(3, 2).ok).toBe(false); expect(S.endorseLevel(2, 2)).toEqual({ ok: true, level: 2 });
    expect(S.endorseLevel(1, 0).ok).toBe(false); expect(S.endorseLevel(undefined, 1)).toEqual({ ok: true, level: 1 });
  });
  test('day index is clamped between 1 and 7', () => {
    const now = new Date('2026-10-20T10:00:00Z');
    expect(S.sprintDayIndex({ startedAt: '2026-10-20T08:00:00Z' }, now)).toBe(1);
    expect(S.sprintDayIndex({ startedAt: '2026-10-17T09:00:00Z' }, now)).toBe(4);
    expect(S.sprintDayIndex({ startedAt: '2026-09-01T09:00:00Z' }, now)).toBe(7);
  });
});

describe('Daily Brief', () => {
  const now = new Date('2026-10-20T10:00:00Z');
  test('no goal means "choose your goal" comes first', () => {
    expect(S.dailyBrief({ hasGoal: false }, now).move.kind).toBe('goal');
  });
  test('priority: session within 24h, then sprint, task, unproven top gap, closing job', () => {
    const sprint = { status: 'active', dayIndex: 2, days: S.sprintDays(skills[0]) };
    const ctx = { hasGoal: true, nextSession: { at: '2026-10-20T20:00:00Z', mentor: 'Rahim A.' }, sprint, dueTask: { title: 'Dashboard', overdue: false }, topGap: { skillKey: 'sql', nameEn: 'SQL', nameBn: 'এসকিউএল', hasProof: false }, closingJob: { id: 'j', title: 'Analyst', fit: 80, daysLeft: 2 } };
    const b = S.dailyBrief(ctx, now);
    expect(b.move.kind).toBe('session'); expect(b.also.map((x) => x.kind)).toEqual(['sprint', 'task']);
    expect(S.dailyBrief({ ...ctx, nextSession: { at: '2026-10-25T20:00:00Z', mentor: 'R' } }, now).move.kind).toBe('sprint');
    expect(S.dailyBrief({ ...ctx, nextSession: null, sprint: null }, now).move.kind).toBe('task');
    expect(S.dailyBrief({ ...ctx, nextSession: null, sprint: null, dueTask: null }, now).move.route).toBe('/quiz/sql');
    expect(S.dailyBrief({ ...ctx, nextSession: null, sprint: null, dueTask: null, topGap: { ...ctx.topGap, hasProof: true } }, now).move.kind).toBe('job');
  });
  test('always returns a move, with Bangla text', () => {
    const b = S.dailyBrief({ hasGoal: true }, now);
    expect(b.move.kind).toBe('explore'); expect(b.move.titleBn.length).toBeGreaterThan(3);
  });
  test('sprint move points at the first unfinished day', () => {
    const days = S.sprintDays(skills[0]); days[0].done = true; days[1].done = true;
    const b = S.dailyBrief({ hasGoal: true, sprint: { status: 'active', dayIndex: 1, days } }, now);
    expect(b.move.titleEn).toContain('day 3');
  });
  test('week card shows progress honestly', () => {
    const c = S.weekCard({ name: 'Robiul H.', tasksDone: 3, sprintDays: 2, quizzes: 1, proofStrength: 40, readinessNow: 58, readinessWeekAgo: 50 });
    expect(c.readinessDelta).toBe(8); expect(c.headlineEn).toContain('+8%');
    expect(S.weekCard({ name: 'R', tasksDone: 0, sprintDays: 0, quizzes: 0, proofStrength: 0, readinessNow: 40, readinessWeekAgo: 45 }).headlineEn).not.toContain('+');
  });
});

describe('Talent Pool', () => {
  test('parses "sql:2,python" safely (max 6, levels 1-3, no junk)', () => {
    expect(S.parseWanted('sql:2, python')).toEqual([{ skillKey: 'sql', minLevel: 2 }, { skillKey: 'python', minLevel: 1 }]);
    expect(S.parseWanted('sql:9,sql:1,$$$,')).toEqual([{ skillKey: 'sql', minLevel: 3 }]);
    expect(S.parseWanted('a,b,c,d,e,f,g')).toHaveLength(6); expect(S.parseWanted('')).toEqual([]);
  });
  test('only proven levels count and missing proof is "not proven"', () => {
    const proven = [{ skillKey: 'sql', level: 2, endorsed: true }, { skillKey: 'python', level: 1, endorsed: false }];
    const m = S.talentMatch(proven, S.parseWanted('sql:2,python:2,excel:1'));
    expect(m.pct).toBe(33); expect(m.matched).toEqual([{ skillKey: 'sql', level: 2, endorsed: true }]);
    expect(m.notProven).toEqual([{ skillKey: 'python', needLevel: 2, haveLevel: 1 }, { skillKey: 'excel', needLevel: 1, haveLevel: 0 }]);
  });
});
