// Data checks for the community demo seed (no database needed).
const { POSTS, MODERATION, FOLLOWS } = require('../src/seed/demo_community');
const { TARGETS } = require('../src/data/targets');
const GROUPS = new Set(['general', ...TARGETS.map((t) => t.key)]);
const REACTIONS = ['like', 'helpful', 'idea'];

test('demo posts use real groups, fit the size limits, and use https links', () => {
  const texts = new Set();
  for (const [, topic, text, link, , reacts, thread] of POSTS) {
    expect(GROUPS.has(topic)).toBe(true);
    expect(text.length).toBeGreaterThanOrEqual(3); expect(text.length).toBeLessThanOrEqual(1000);
    expect(texts.has(text)).toBe(false); texts.add(text);
    if (link) expect(link).toMatch(/^https:\/\//);
    for (const [, r] of reacts) expect(REACTIONS).toContain(r);
    const per = new Set(reacts.map((r) => r[0])); expect(per.size).toBe(reacts.length); // one reaction per person
    for (const [, ct, replies] of thread) { expect(ct.length).toBeLessThanOrEqual(600); for (const [, rt] of replies) expect(rt.length).toBeLessThanOrEqual(600); }
  }
});

test('moderation examples: one reported once, one with 3 unique reporters and hidden', () => {
  expect(MODERATION.some((m) => m[4].length === 1 && m[5] === 'visible')).toBe(true);
  const hidden = MODERATION.find((m) => m[5] === 'hidden');
  expect(new Set(hidden[4]).size).toBeGreaterThanOrEqual(3);
  for (const m of MODERATION) expect(GROUPS.has(m[1])).toBe(true);
});

test('follow groups exist', () => { for (const [, , groups] of FOLLOWS) for (const g of groups) expect(GROUPS.has(g)).toBe(true); });
