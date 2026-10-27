// Data checks for the links ported from the web version (no database needed).
const { MORE_RESOURCES } = require('../src/seed/resources_more');
const { MORE_SKILLS } = require('../src/seed/quizzes_more');

test('ported resources are valid: https, unique, known kind, title and url length, skill exists', () => {
  const skills = new Set([...MORE_SKILLS.map((s) => s[0]), 'python', 'sql', 'statistics', 'git']);
  const urls = new Set();
  for (const [skillKey, title, url, kind, lang] of MORE_RESOURCES) {
    expect(skills.has(skillKey)).toBe(true);
    expect(url).toMatch(/^https:\/\//);
    expect(url).not.toMatch(/youtube\.com\/results/);
    expect(urls.has(url)).toBe(false); urls.add(url);
    expect(['course', 'video', 'article', 'practice']).toContain(kind);
    expect(['en', 'bn']).toContain(lang);
    expect(title.length).toBeLessThanOrEqual(140);
    expect(url.length).toBeLessThanOrEqual(300);
  }
});
