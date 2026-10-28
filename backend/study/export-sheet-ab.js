// BLINDED A/B rating sheet: MentorLink's ranking versus the plain keyword baseline, for the SAME students.
//   node study/export-sheet-ab.js --students a@uni.edu,b@uni.edu [--seed 42] > study/ratings_blind.csv
//
// How it stays fair:
//  - Only the students you list (they gave consent) are exported. Nobody else is touched.
//  - For each student we POOL the system's top 5 (exactly what the app saved for them) and the baseline's top 5,
//    remove duplicates, and SHUFFLE. The student rates each mentor once, from a neutral profile card.
//    No "why this mentor" text and no scores are shown, so nobody can tell which method picked whom.
//  - The key (which method ranked whom) goes to study/ab-key.private.json. Do not share or commit it.
// Students and mentors are codes (S01, M03). No names, emails or ids are written to the sheet.
require('dotenv').config({ quiet: true });
const fs = require('fs');
const env = require('../src/config/env');
const { connect, mongoose } = require('../src/config/db');
const M = require('../src/models');
const { keywordBaseline } = require('../src/services/matching');

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : null; };
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const clean = (x) => String(x == null ? '' : x).replace(/[",\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
const csv = (cells) => cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');

(async () => {
  const emails = (arg('students') || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!emails.length) { console.error('Pass the consenting students: --students a@uni.edu,b@uni.edu'); process.exit(1); }
  const seed = Number(arg('seed')) || Math.floor(Math.random() * 1e9);
  const rnd = mulberry32(seed);
  await connect(env.mongoUri);

  const students = await M.User.find({ role: 'student', email: { $in: emails } }).lean();
  const mentorUsers = await M.User.find({ role: 'mentor', verificationStatus: 'verified' }).lean();
  const profs = new Map((await M.MentorProfile.find({ userId: { $in: mentorUsers.map((u) => u._id) } }).lean()).map((p) => [String(p.userId), p]));
  const mentors = mentorUsers.map((u) => ({ user: u, profile: profs.get(String(u._id)) })).filter((m) => m.profile);

  const sc = new Map(), mc = new Map();
  const key = { seed, createdAt: new Date().toISOString(), students: {}, mentors: {} };
  const code = (map, id, p, k) => { if (!map.has(String(id))) { const c = `${p}${String(map.size + 1).padStart(2, '0')}`; map.set(String(id), c); key[k][c] = String(id); } return map.get(String(id)); };
  const lines = [csv(['student_code', 'mentor_code', 'mentor_card', 'rating', 'would_request'])];
  const skipped = [];

  for (const st of students) {
    const sp = (await M.StudentProfile.findOne({ userId: st._id }).lean()) || {};
    const role = sp.careerGoalRoleKey ? await M.RoleTemplate.findOne({ key: sp.careerGoalRoleKey }).lean() : null;
    const saved = await M.Match.find({ studentId: st._id }).sort({ _id: 1 }).lean(); // saved in rank order by GET /matches
    if (!role || !saved.length) { skipped.push(st.email); continue; }
    const blocked = new Set([...(st.blockedBy || []), ...(sp.dismissedMentors || [])].map(String));
    const eligible = mentors.filter((m) => !m.profile.paused && String(m.user._id) !== String(st._id) && !blocked.has(String(m.user._id)) && !(m.user.blockedBy || []).map(String).includes(String(st._id)));
    const base = keywordBaseline({ student: { user: st, profile: sp }, role, mentors: eligible })
      .sort((a, b) => b.score - a.score || String(a.mentorId).localeCompare(String(b.mentorId))).slice(0, 5); // ties broken by id, so it is repeatable
    const s = code(sc, st._id, 'S', 'students');
    const pool = new Map();
    saved.slice(0, 5).forEach((m, i) => pool.set(String(m.mentorId), { sys: i + 1, sysScore: m.score, base: null }));
    base.forEach((m, i) => { const e = pool.get(String(m.mentorId)) || { sys: null, sysScore: null, base: null }; e.base = i + 1; e.baseScore = m.score; pool.set(String(m.mentorId), e); });
    key.students[s] = { id: String(st._id), rows: {} };
    const rows = [...pool.entries()].map(([mid, e]) => ({ mid, e, r: rnd() })).sort((a, b) => a.r - b.r);
    for (const { mid, e } of rows) {
      const m = mentors.find((x) => String(x.user._id) === mid); const p = m.profile;
      const mcode = code(mc, mid, 'M', 'mentors');
      const card = `Role: ${clean(p.roleTitle)} / Industry: ${clean(p.industry)} / Experience: ${p.yearsExperience || 0} years / Languages: ${(p.languages || []).join(' ')} / Skills: ${(p.expertiseSkills || []).map((x) => `${clean(x.skillKey)} L${x.level}`).join(' ')}`;
      key.students[s].rows[mcode] = { systemRank: e.sys, systemScore: e.sysScore, baselineRank: e.base, baselineScore: e.baseScore == null ? null : e.baseScore };
      lines.push(csv([s, mcode, card, '', '']));
    }
  }
  fs.writeFileSync(`${__dirname}/ab-key.private.json`, JSON.stringify(key, null, 2));
  console.log(lines.join('\n'));
  if (skipped.length) console.error(`Skipped (no career goal or no saved matches yet): ${skipped.join(', ')}. Ask them to open the Mentors tab first.`);
  console.error(`Seed ${seed}. Key written to study/ab-key.private.json (keep private).`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
