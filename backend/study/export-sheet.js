// Writes an anonymous rating sheet from the matches the app has already saved (one row per student x mentor shown).
// No names, emails or ids are written: students and mentors get codes like S01 / M03. Keep the code->person key
// (study/codes.private.json) away from the sheet, and do not commit it.
//   node study/export-sheet.js > study/ratings.csv      (then give each student their rows to fill in)
require('dotenv').config({ quiet: true });
const fs = require('fs');
const env = require('../src/config/env');
const { connect, mongoose } = require('../src/config/db');
const { Match } = require('../src/models');

(async () => {
  await connect(env.mongoUri);
  const ms = await Match.find().sort({ studentId: 1, score: -1 }).lean();
  const sc = new Map(), mc = new Map(), key = { students: {}, mentors: {} };
  const code = (map, id, p, k) => { if (!map.has(String(id))) { const c = `${p}${String(map.size + 1).padStart(2, '0')}`; map.set(String(id), c); key[k][c] = String(id); } return map.get(String(id)); };
  const rank = new Map();
  const lines = ['rater_code,student_code,mentor_code,rank_shown,system_score,rating,would_request'];
  for (const m of ms) {
    const s = code(sc, m.studentId, 'S', 'students'); const n = (rank.get(s) || 0) + 1; rank.set(s, n);
    lines.push([s, s, code(mc, m.mentorId, 'M', 'mentors'), n, m.score, '', ''].join(','));
  }
  fs.writeFileSync(`${__dirname}/codes.private.json`, JSON.stringify(key, null, 2));
  console.log(lines.join('\n'));
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
