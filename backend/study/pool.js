// Pure helpers shared by export-sheet-ab.js (real data) and dry-run.js (invented data), so the dry run tests the SAME pooling code.
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const clean = (x) => String(x == null ? '' : x).replace(/[",\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
const csv = (cells) => cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');

// Baseline top N. Ties are broken by mentor id so the list is repeatable (many mentors can share a keyword score).
const baselineTop = (scored, n = 5) => [...scored].sort((a, b) => b.score - a.score || String(a.mentorId).localeCompare(String(b.mentorId))).slice(0, n);

function shuffle(arr, rnd) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// system / baseline: [{ mentorId, score }] in rank order. Returns the shuffled, de-duplicated pool with each mentor's rank under both methods.
function buildPool({ system, baseline, rnd }) {
  const pool = new Map();
  system.slice(0, 5).forEach((m, i) => pool.set(String(m.mentorId), { mentorId: String(m.mentorId), systemRank: i + 1, systemScore: m.score, baselineRank: null, baselineScore: null }));
  baseline.slice(0, 5).forEach((m, i) => {
    const k = String(m.mentorId);
    const e = pool.get(k) || { mentorId: k, systemRank: null, systemScore: null, baselineRank: null, baselineScore: null };
    e.baselineRank = i + 1; e.baselineScore = m.score; pool.set(k, e);
  });
  return shuffle([...pool.values()], rnd);
}

// Neutral profile card: same fields for every mentor, nothing that reveals which method picked them.
const mentorCard = (p) => `Role: ${clean(p.roleTitle)} / Industry: ${clean(p.industry)} / Experience: ${p.yearsExperience || 0} years / Languages: ${(p.languages || []).join(' ')} / Skills: ${(p.expertiseSkills || []).map((x) => `${clean(x.skillKey)} L${x.level}`).join(' ')}`;

module.exports = { mulberry32, clean, csv, baselineTop, shuffle, buildPool, mentorCard };
