// Scores a filled-in rating sheet. Pure functions (tested) + a small CLI:  node study/analyze.js study/ratings.csv
// Sheet columns: rater_code, student_code, mentor_code, rank_shown, system_score, rating (1-5), would_request (yes/no)
const fs = require('fs');

function parseCsv(text) {
  const [head, ...rows] = text.trim().split(/\r?\n/).map((l) => l.split(',').map((c) => c.trim()));
  return rows.filter((r) => r.length === head.length && r.some((c) => c !== '')).map((r) => Object.fromEntries(r.map((c, i) => [head[i], c])));
}
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) : 0; };
function ranks(a) { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = Array(a.length); let i = 0; while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; }
function spearman(x, y) { if (x.length < 3) return NaN; const a = ranks(x), b = ranks(y), ma = mean(a), mb = mean(b); let n = 0, da = 0, db = 0; for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return da && db ? n / Math.sqrt(da * db) : NaN; }

// Returns the study metrics. A "good match" is a rating of 4 or 5.
function analyze(rows) {
  const rated = rows.map((r) => ({ ...r, rating: Number(r.rating), rank: Number(r.rank_shown), score: Number(r.system_score) })).filter((r) => r.rating >= 1 && r.rating <= 5);
  const byStudent = new Map();
  for (const r of rated) { const k = `${r.rater_code}|${r.student_code}`; (byStudent.get(k) || byStudent.set(k, []).get(k)).push(r); }
  const lists = [...byStudent.values()];
  const good = (r) => r.rating >= 4;
  const top1 = lists.map((l) => l.find((r) => r.rank === 1)).filter(Boolean);
  const top3 = lists.map((l) => { const t = l.filter((r) => r.rank <= 3); return t.length ? t.filter(good).length / t.length : null; }).filter((x) => x !== null);
  const rho = lists.map((l) => spearman(l.map((r) => r.score), l.map((r) => r.rating))).filter((x) => !Number.isNaN(x));
  const ratings = rated.map((r) => r.rating);
  const yes = rated.filter((r) => String(r.would_request).toLowerCase() === 'yes').length;
  const se = ratings.length > 1 ? sd(ratings) / Math.sqrt(ratings.length) : NaN;
  return {
    studentsRated: lists.length, ratings: rated.length,
    meanRating: mean(ratings), meanRatingCI95: [mean(ratings) - 1.96 * se, mean(ratings) + 1.96 * se],
    top1GoodRate: top1.length ? top1.filter(good).length / top1.length : NaN,
    precisionAt3: mean(top3),
    meanSpearman: mean(rho),
    wouldRequestRate: rated.length ? yes / rated.length : NaN,
    note: lists.length < 20 ? 'Fewer than 20 students rated: report these as a small pilot, not as general accuracy.' : 'Report the sample size and how raters were chosen alongside these numbers.',
  };
}
module.exports = { parseCsv, analyze, spearman };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('Usage: node study/analyze.js study/ratings.csv'); process.exit(1); }
  const r = analyze(parseCsv(fs.readFileSync(file, 'utf8')));
  const pct = (x) => (Number.isNaN(x) ? 'n/a' : `${(100 * x).toFixed(0)}%`);
  console.log(`Students rated: ${r.studentsRated}   Ratings: ${r.ratings}`);
  console.log(`Mean rating (1-5): ${r.meanRating.toFixed(2)}  95% CI ${r.meanRatingCI95.map((x) => x.toFixed(2)).join(' to ')}`);
  console.log(`Rank-1 mentor rated good (4-5): ${pct(r.top1GoodRate)}`);
  console.log(`Precision@3 (good among top 3): ${pct(r.precisionAt3)}`);
  console.log(`Mean Spearman (score vs rating): ${r.meanSpearman.toFixed(2)}`);
  console.log(`Would send a request: ${pct(r.wouldRequestRate)}`);
  console.log(r.note);
}
