// Data checks for the extra assessments ported from the web version (no database needed).
const { MORE_QUIZZES, MORE_SKILLS } = require('../src/seed/quizzes_more');
const { QUIZZES } = require('../src/seed/quizzes');

test('every extra quiz has valid questions: answer index inside the options, a topic, no duplicates', () => {
  for (const [key, qs] of Object.entries(MORE_QUIZZES)) {
    expect(qs.length).toBeGreaterThanOrEqual(5);
    const seen = new Set();
    for (const x of qs) {
      expect(x.options.length).toBeGreaterThanOrEqual(2);
      expect(Number.isInteger(x.answer) && x.answer >= 0 && x.answer < x.options.length).toBe(true);
      expect(typeof x.topic).toBe('string');
      expect(x.topic.length).toBeGreaterThan(0);
      expect(new Set(x.options).size).toBe(x.options.length);
      expect(seen.has(x.q)).toBe(false); seen.add(x.q);
    }
  }
});

test('extra quizzes do not overwrite the original ones, and every quiz skill has a Skill row', () => {
  for (const key of Object.keys(MORE_QUIZZES)) expect(QUIZZES[key]).toBeUndefined();
  const skillKeys = MORE_SKILLS.map((s) => s[0]);
  expect(new Set(skillKeys).size).toBe(skillKeys.length);
  expect(skillKeys.sort()).toEqual(Object.keys(MORE_QUIZZES).sort());
  for (const [, en, bn, hours] of MORE_SKILLS) { expect(en && bn).toBeTruthy(); expect(hours).toBeGreaterThan(0); }
});
