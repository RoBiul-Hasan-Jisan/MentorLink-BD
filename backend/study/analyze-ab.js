// Scores the BLINDED A/B sheet: MentorLink ranking vs the keyword baseline, same students, same ratings.
//   node study/analyze-ab.js study/ratings_blind.csv study/ab-key.private.json
// A "good" match is a rating of 4 or 5. Differences are paired by student (system minus baseline).
const fs = require('fs');

function parseCsv(text) { // handles "quoted, cells"
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some((x) => x !== '')) rows.push(row);
  const [head, ...rest] = rows.map((r) => r.map((x) => x.trim()));
  return rest.filter((r) => r.length === head.length).map((r) => Object.fromEntries(r.map((c, i) => [head[i], c])));
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) : 0; };
const T975 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
const tCrit = (df) => (df < 1 ? NaN : df <= 30 ? T975[df - 1] : df <= 60 ? 2.0 : 1.96);
const ci = (a) => { if (a.length < 2) return [NaN, NaN]; const m = mean(a), h = tCrit(a.length - 1) * sd(a) / Math.sqrt(a.length); return [m - h, m + h]; };
const dcg = (gains) => gains.reduce((s, g, i) => s + (2 ** g - 1) / Math.log2(i + 2), 0);

// One student, one method. items: [{ rank, rating, yes }] for that method's top 5 (all must be rated).
function scoreList(items, poolRatings) {
  const l = [...items].sort((a, b) => a.rank - b.rank);
  const good = (r) => r.rating >= 4;
  const top3 = l.filter((x) => x.rank <= 3);
  const ideal = [...poolRatings].sort((a, b) => b - a).slice(0, 5);
  return {
    top1Good: l[0] && l[0].rank === 1 ? (good(l[0]) ? 1 : 0) : null,
    precisionAt3: top3.length ? top3.filter(good).length / top3.length : null,
    meanRating: mean(l.map((x) => x.rating)),
    wouldRequest: mean(l.map((x) => (x.yes ? 1 : 0))),
    ndcg5: dcg(ideal) ? dcg(l.map((x) => x.rating)) / dcg(ideal) : null,
  };
}

function analyzeAB(rows, key) {
  const per = [], excluded = [];
  for (const [s, info] of Object.entries(key.students)) {
    const mine = rows.filter((r) => r.student_code === s);
    const rated = new Map(mine.filter((r) => Number(r.rating) >= 1 && Number(r.rating) <= 5).map((r) => [r.mentor_code, { rating: Number(r.rating), yes: String(r.would_request).toLowerCase() === 'yes' }]));
    const codes = Object.keys(info.rows);
    if (!codes.length || codes.some((c) => !rated.has(c))) { excluded.push(s); continue; } // every mentor in the pool must be rated
    const pick = (field) => codes.filter((c) => info.rows[c][field] != null).map((c) => ({ rank: info.rows[c][field], ...rated.get(c) }));
    const pool = codes.map((c) => rated.get(c).rating);
    per.push({ student: s, system: scoreList(pick('systemRank'), pool), baseline: scoreList(pick('baselineRank'), pool), overlap: codes.filter((c) => info.rows[c].systemRank != null && info.rows[c].baselineRank != null).length });
  }
  const metrics = ['top1Good', 'precisionAt3', 'meanRating', 'wouldRequest', 'ndcg5'];
  const out = {};
  for (const m of metrics) {
    const a = per.map((p) => p.system[m]).filter((x) => x != null), b = per.map((p) => p.baseline[m]).filter((x) => x != null);
    const d = per.filter((p) => p.system[m] != null && p.baseline[m] != null).map((p) => p.system[m] - p.baseline[m]);
    out[m] = { system: mean(a), baseline: mean(b), diff: mean(d), diffCI95: ci(d), wins: d.filter((x) => x > 1e-9).length, ties: d.filter((x) => Math.abs(x) <= 1e-9).length, losses: d.filter((x) => x < -1e-9).length };
  }
  return {
    students: per.length, excluded, meanOverlap: mean(per.map((p) => p.overlap)), metrics: out,
    note: per.length < 20 ? 'Fewer than 20 students: report this as a small pilot, not as general accuracy.' : 'Report the sample size and how students were chosen next to these numbers.',
  };
}
module.exports = { parseCsv, scoreList, analyzeAB, ci, tCrit };

if (require.main === module) {
  const [sheet, keyFile] = process.argv.slice(2);
  if (!sheet || !keyFile) { console.error('Usage: node study/analyze-ab.js study/ratings_blind.csv study/ab-key.private.json'); process.exit(1); }
  const r = analyzeAB(parseCsv(fs.readFileSync(sheet, 'utf8')), JSON.parse(fs.readFileSync(keyFile, 'utf8')));
  const pct = (x) => (Number.isNaN(x) ? 'n/a' : `${(100 * x).toFixed(0)}%`);
  const f2 = (x) => (Number.isNaN(x) ? 'n/a' : x.toFixed(2));
  const row = (label, k, fmt) => { const m = r.metrics[k]; console.log(`${label.padEnd(30)} system ${fmt(m.system).padStart(5)}   baseline ${fmt(m.baseline).padStart(5)}   diff ${fmt(m.diff).padStart(6)}  95% CI ${fmt(m.diffCI95[0])} to ${fmt(m.diffCI95[1])}   (system better ${m.wins}, same ${m.ties}, worse ${m.losses})`); };
  console.log(`Students analysed: ${r.students}   Excluded (incomplete ratings): ${r.excluded.length ? r.excluded.join(', ') : 'none'}   Mean mentors in both lists: ${f2(r.meanOverlap)} of 5`);
  row('Rank-1 rated good (4-5)', 'top1Good', pct);
  row('Precision@3 (good in top 3)', 'precisionAt3', pct);
  row('Mean rating of top 5 (1-5)', 'meanRating', f2);
  row('Would send a request', 'wouldRequest', pct);
  row('nDCG@5 (ordering quality)', 'ndcg5', f2);
  console.log(r.note);
  console.log('A CI that includes 0 means this pilot cannot tell the two methods apart.');
}
