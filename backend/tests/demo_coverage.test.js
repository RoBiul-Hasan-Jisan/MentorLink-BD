// Pure check (no database): every skill that any career goal asks for has at least 2 demo mentors at level 2+.
const fs = require('fs');
const path = require('path');
const { COVERAGE_MENTORS } = require('../src/seed/demo_coverage');
const { STUDY_MENTORS } = require('../src/seed/demo_study');
const { MENTORS } = require('../src/seed/demo_more');

test('every skill in every career goal has at least 2 demo mentors at level 2 or 3', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/seed/learning.js'), 'utf8');
  const wanted = new Set();
  for (const r of src.matchAll(/R\('[a-z-]+',[^\[]*\[(.*)\]\),?\s*$/gm)) for (const m of r[1].matchAll(/\['([a-z]+)'/g)) wanted.add(m[1]);
  expect(wanted.has('machinelearning')).toBe(true);
  const expertise = [...COVERAGE_MENTORS.map((m) => m[10]), ...STUDY_MENTORS.map((m) => m[10]), ...MENTORS.map((m) => m[10])];
  const missing = [...wanted].filter((k) => expertise.filter((e) => (e[k] || 0) >= 2).length < 2);
  expect(missing).toEqual([]);
});
