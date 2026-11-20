const { NOTES, topicLinks, topicNote } = require('../src/data/topic_notes');
const { DATA } = require('../src/seed/roadmaps');
const { normSlot } = require('../src/services/matching');
const { ROLES, SKILLS } = require('../src/seed/learning');

test('every roadmap topic has reading notes and a checklist', () => {
  for (const [skillKey, , , stages] of DATA) {
    expect(NOTES[skillKey]).toBeDefined();
    expect(NOTES[skillKey]).toHaveLength(stages.length);
    stages.forEach((st, i) => {
      expect(NOTES[skillKey][i]).toHaveLength(st[2].length);
      st[2].forEach((_, j) => {
        const n = topicNote(skillKey, i, j);
        expect(n.summary.length).toBeGreaterThan(30);
        expect(n.checklist.length).toBeGreaterThanOrEqual(2);
      });
    });
  }
});

test('topic links are https and include search fallbacks', () => {
  const l = topicLinks('sql', 'INNER and LEFT JOIN', 1, 0);
  for (const x of l) expect(x.url.startsWith('https://')).toBe(true);
  expect(l.some((x) => x.kind === 'search' && x.language === 'bn')).toBe(true);
});

test('slots: day-period form, old hour form and capitals all match', () => {
  expect(normSlot('Fri-evening')).toBe('fri-evening');
  expect(normSlot('sun-20')).toBe('sun-evening');
  expect(normSlot('sun-16')).toBe('sun-afternoon');
  expect(normSlot('mon-9')).toBe('mon-morning');
  expect(normSlot('garbage')).toBe('');
});

test('career goals offer many roles and all use known skills', () => {
  expect(ROLES.length).toBeGreaterThanOrEqual(12);
  const keys = new Set(SKILLS.map((s) => s[0]));
  for (const r of ROLES) for (const q of r.requiredSkills) expect(keys.has(q.skillKey)).toBe(true);
});
