// Data and pipeline checks for the demo study mentors and the dry run. No database needed.
const { STUDY_MENTORS } = require('../src/seed/demo_study');
const { MENTORS } = require('../src/seed/demo_more');
const { ROLES, SKILLS } = require('../src/seed/learning');
const { mulberry32, baselineTop, buildPool, shuffle, mentorCard, csv } = require('../study/pool');
const { runDryRun } = require('../study/dry-run');

const skillKeys = new Set(SKILLS.map((s) => s[0]));
const roleKeys = new Set(ROLES.map((r) => r.key));

describe('demo study mentors (data)', () => {
  const all = [...MENTORS, ...STUDY_MENTORS];
  test('13 new mentors, unique emails, and at least 10 mentors in total', () => {
    expect(STUDY_MENTORS).toHaveLength(13);
    expect(new Set(all.map((m) => m[0])).size).toBe(all.length);
    expect(all.length).toBeGreaterThanOrEqual(10);
    expect(STUDY_MENTORS.every((m) => m[0].endsWith('@demo.mentorlink.bd'))).toBe(true);
  });
  test('valid roles, skills and levels', () => {
    for (const [, , , , , roleKey, related, , , years, expertise, languages, slots, accepted, completed] of STUDY_MENTORS) {
      expect(roleKeys.has(roleKey)).toBe(true);
      related.forEach((r) => expect(roleKeys.has(r)).toBe(true));
      for (const [k, l] of Object.entries(expertise)) { expect(skillKeys.has(k)).toBe(true); expect(l).toBeGreaterThanOrEqual(1); expect(l).toBeLessThanOrEqual(3); }
      expect(years).toBeGreaterThanOrEqual(0); expect(languages.length).toBeGreaterThan(0); expect(slots.length).toBeGreaterThan(0);
      expect(completed).toBeLessThanOrEqual(accepted);
    }
  });
  test('every goal has at least 2 mentors, and the four main goals have 5 or more', () => {
    const n = (key) => all.filter((m) => m[5] === key || m[6].includes(key)).length;
    for (const r of ROLES) expect(n(r.key)).toBeGreaterThanOrEqual(2);
    for (const k of ['junior-developer', 'data-analyst', 'banking-trainee', 'management-trainee']) expect(n(k)).toBeGreaterThanOrEqual(5);
  });
});

describe('pool building', () => {
  const sys = [1, 2, 3, 4, 5].map((i) => ({ mentorId: `m${i}`, score: 90 - i }));
  const base = [{ mentorId: 'm9', score: 2 }, { mentorId: 'm3', score: 2 }, { mentorId: 'm8', score: 1 }, { mentorId: 'm7', score: 1 }, { mentorId: 'm1', score: 0 }];
  test('de-duplicates and keeps both ranks', () => {
    const p = buildPool({ system: sys, baseline: base, rnd: mulberry32(1) });
    expect(p).toHaveLength(8);
    const m3 = p.find((x) => x.mentorId === 'm3');
    expect(m3).toMatchObject({ systemRank: 3, baselineRank: 2 });
    expect(p.find((x) => x.mentorId === 'm9')).toMatchObject({ systemRank: null, baselineRank: 1 });
  });
  test('same seed gives the same shuffle; a different seed can differ', () => {
    const a = buildPool({ system: sys, baseline: base, rnd: mulberry32(5) }).map((x) => x.mentorId);
    const b = buildPool({ system: sys, baseline: base, rnd: mulberry32(5) }).map((x) => x.mentorId);
    const c = buildPool({ system: sys, baseline: base, rnd: mulberry32(6) }).map((x) => x.mentorId);
    expect(a).toEqual(b);
    expect(c).not.toEqual(a);
  });
  test('shuffle keeps every item', () => { expect(shuffle([1, 2, 3, 4], mulberry32(3)).sort()).toEqual([1, 2, 3, 4]); });
  test('baseline ties are broken by id, so it is repeatable', () => {
    const t = baselineTop([{ mentorId: 'b', score: 1 }, { mentorId: 'a', score: 1 }, { mentorId: 'c', score: 2 }]);
    expect(t.map((x) => x.mentorId)).toEqual(['c', 'a', 'b']);
  });
  test('the neutral card shows profile facts only', () => {
    const c = mentorCard({ roleTitle: 'QA Lead, Senior', industry: 'Software', yearsExperience: 6, languages: ['bn', 'en'], expertiseSkills: [{ skillKey: 'testing', level: 3 }] });
    expect(c).toBe('Role: QA Lead Senior / Industry: Software / Experience: 6 years / Languages: bn en / Skills: testing L3');
    expect(c).not.toMatch(/score|rank|match/i);
  });
  test('csv quoting', () => { expect(csv(['a', 'b"c'])).toBe('"a","b""c"'); });
});

describe('dry run (invented data)', () => {
  const r = runDryRun({ students: 24, seed: 7 });
  test('runs end to end and analyses every student', () => {
    expect(r.analysis.students).toBe(24);
    expect(r.analysis.excluded).toEqual([]);
    expect(r.mentorCount).toBeGreaterThanOrEqual(20);
  });
  test('the two lists differ enough to compare (not almost identical)', () => {
    expect(r.analysis.meanOverlap).toBeLessThan(4);
  });
  test('it is repeatable', () => { expect(runDryRun({ students: 24, seed: 7 }).filledCsv).toBe(r.filledCsv); });
  test('the blank sheet is anonymous and has no ratings', () => {
    expect(r.blankCsv).not.toMatch(/@|demo\.mentorlink/);
    const rows = r.blankCsv.split('\n').slice(1);
    expect(rows.every((l) => l.endsWith('"",""'))).toBe(true);
  });
  test('the keyword decoy is picked by the baseline but never by the system', () => {
    const decoy = 'M12'; // "Data Entry Analyst": job title matches a goal, skills do not
    let base = 0, sys = 0;
    for (const i of Object.values(r.key.students)) { const row = i.rows[decoy]; if (row) { if (row.baselineRank) base++; if (row.systemRank) sys++; } }
    expect(base).toBeGreaterThan(0);
    expect(sys).toBe(0);
  });
  test('it is labelled synthetic', () => { expect(r.key.synthetic).toBe(true); });
});
