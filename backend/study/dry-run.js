// DRY RUN with INVENTED data. No database, no Firebase, no real people.
//   node study/dry-run.js [students=24] [seed=7]
// It exercises the real code path end to end: demo mentors -> real rankMentors + keyword baseline -> pooled, shuffled blind sheet
// -> (simulated) ratings -> the real analysis. Use it to check that the pipeline runs and the sheet looks right.
//
// !!! The ratings here come from a simple made-up rater model, NOT from people. The numbers are NOT a result.
// !!! Never quote them in your report. The real study needs real volunteer students.
//
// The rater model looks only at the mentor's profile versus the student's goal (role match, skill coverage, experience, language),
// plus noise. It never looks at either method's score or rank.
const fs = require('fs');
const path = require('path');
const { rankMentors, keywordBaseline } = require('../src/services/matching');
const { computeReadiness } = require('../src/services/readiness');
const { ROLES, SKILLS } = require('../src/seed/learning');
const { MENTORS } = require('../src/seed/demo_more');
const { STUDY_MENTORS } = require('../src/seed/demo_study');
const { mulberry32, csv, baselineTop, buildPool, mentorCard } = require('./pool');
const { parseCsv, analyzeAB, formatReport } = require('./analyze-ab');

const skills = SKILLS.map(([key, nameEn, nameBn, learningHours]) => ({ key, nameEn, nameBn, learningHours }));
const roles = ROLES.map((r) => ({ ...r }));
const SLOTS = ['sun-20', 'tue-21', 'mon-19', 'thu-20', 'wed-20', 'fri-20'];

function demoMentors() {
  return [...MENTORS, ...STUDY_MENTORS].map(([email, , , , , roleKey, related, title, industry, years, expertise, languages, slots, accepted, completed, rising]) => ({
    user: { _id: email, verificationStatus: 'verified', blockedBy: [] },
    profile: { roleKey, relatedRoleKeys: related, roleTitle: title, industry, yearsExperience: years, expertiseSkills: Object.entries(expertise).map(([skillKey, level]) => ({ skillKey, level })), languages, availableSlots: slots, acceptedRequests: accepted, sessionsCompleted: completed, isRising: rising, paused: false },
  }));
}

function demoStudents(n, rnd) {
  return Array.from({ length: n }, (_, i) => {
    const role = roles[i % roles.length];
    const evidence = [];
    for (const rs of role.requiredSkills) { const lvl = Math.floor(rnd() * (rs.requiredLevel + 1)); if (lvl > 0) evidence.push({ skillKey: rs.skillKey, level: lvl, type: ['self', 'quiz', 'project'][Math.floor(rnd() * 3)] }); }
    const picks = [...SLOTS].sort(() => rnd() - 0.5).slice(0, 2);
    return { user: { _id: `S${i + 1}`, blockedBy: [] }, role, evidence, profile: { careerGoalRoleKey: role.key, goalText: `I want to become a ${role.titleEn.toLowerCase()}`, weeklyHours: 6, languages: rnd() < 0.6 ? ['bn', 'en'] : ['bn'], requestedSlots: picks } };
  });
}

// Stand-in for a human rater. Looks at profile fit only (never at a method's score or rank).
function simulatedRating(student, mentor, rnd) {
  const p = mentor.profile, role = student.role;
  const rel = p.roleKey === role.key ? 1 : (p.relatedRoleKeys || []).includes(role.key) ? 0.6 : 0.15;
  const have = new Map((p.expertiseSkills || []).map((s) => [s.skillKey, s.level]));
  const wsum = role.requiredSkills.reduce((t, s) => t + s.weight, 0);
  const cover = role.requiredSkills.reduce((t, s) => t + s.weight * Math.min(1, (have.get(s.skillKey) || 0) / s.requiredLevel), 0) / wsum;
  const lang = student.profile.languages.some((l) => p.languages.includes(l)) ? 1 : 0;
  const fit = 0.45 * rel + 0.35 * cover + 0.10 * Math.min(1, p.yearsExperience / 10) + 0.10 * lang + (rnd() + rnd() + rnd() - 1.5) * 0.25; // noise
  return Math.max(1, Math.min(5, Math.round(1 + 4 * fit)));
}

function runDryRun({ students = 24, seed = 7 } = {}) {
  const rnd = mulberry32(seed);
  const mentors = demoMentors();
  const cohort = demoStudents(students, rnd);
  const key = { synthetic: true, seed, students: {} };
  const blank = [csv(['student_code', 'mentor_code', 'mentor_card', 'rating', 'would_request'])], filled = [blank[0]];
  const mcodes = new Map(mentors.map((m, i) => [String(m.user._id), `M${String(i + 1).padStart(2, '0')}`]));
  cohort.forEach((st, i) => {
    const s = `S${String(i + 1).padStart(2, '0')}`;
    const gaps = computeReadiness({ role: st.role, evidence: st.evidence, skills, weeklyHours: 6 }).gaps;
    const system = rankMentors({ student: { user: st.user, profile: st.profile }, role: st.role, gaps, mentors }).map((m) => ({ mentorId: m.mentorId, score: m.score }));
    const baseline = baselineTop(keywordBaseline({ student: { user: st.user, profile: st.profile }, role: st.role, mentors }));
    key.students[s] = { id: s, rows: {} };
    for (const e of buildPool({ system, baseline, rnd })) {
      const m = mentors.find((x) => String(x.user._id) === e.mentorId), c = mcodes.get(e.mentorId);
      key.students[s].rows[c] = { systemRank: e.systemRank, systemScore: e.systemScore, baselineRank: e.baselineRank, baselineScore: e.baselineScore };
      const r = simulatedRating(st, m, rnd);
      blank.push(csv([s, c, mentorCard(m.profile), '', '']));
      filled.push(csv([s, c, mentorCard(m.profile), r, r >= 4 ? 'yes' : 'no']));
    }
  });
  const filledCsv = filled.join('\n');
  return { blankCsv: blank.join('\n'), filledCsv, key, analysis: analyzeAB(parseCsv(filledCsv), key), mentorCount: mentors.length };
}
module.exports = { runDryRun, demoMentors, simulatedRating };

if (require.main === module) {
  const n = Number(process.argv[2]) || 24, seed = Number(process.argv[3]) || 7;
  const r = runDryRun({ students: n, seed });
  const dir = path.join(__dirname, 'demo-output');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SYNTHETIC_ratings_blank.csv'), r.blankCsv);
  fs.writeFileSync(path.join(dir, 'SYNTHETIC_ratings_filled.csv'), r.filledCsv);
  fs.writeFileSync(path.join(dir, 'SYNTHETIC_key.json'), JSON.stringify(r.key, null, 2));
  console.log(`DRY RUN: ${n} invented students, ${r.mentorCount} demo mentors, seed ${seed}. Files in study/demo-output/.`);
  console.log('SYNTHETIC RATINGS FROM A MADE-UP RATER MODEL. THESE NUMBERS ARE NOT A RESULT.\n');
  console.log(formatReport(r.analysis));
}
