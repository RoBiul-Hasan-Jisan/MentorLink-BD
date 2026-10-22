// Explainable mentor matching.
// Weights: career 30, gap coverage 25, experience 15, language 10, schedule 10, reliability 10.
const W = { career: 0.30, gap: 0.25, experience: 0.15, language: 0.10, schedule: 0.10, reliability: 0.10 };

const tokens = (t) => String(t || '').toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 1);

function tfidfCosine(aText, docs, bText) {
  const A = tokens(aText), B = tokens(bText);
  const N = docs.length + 2;
  const df = {};
  for (const d of [aText, bText, ...docs]) for (const t of new Set(tokens(d))) df[t] = (df[t] || 0) + 1;
  const vec = (arr) => { const v = {}; for (const t of arr) v[t] = (v[t] || 0) + 1; for (const t in v) v[t] *= Math.log(1 + N / (df[t] || 1)); return v; };
  const va = vec(A), vb = vec(B);
  let dot = 0, na = 0, nb = 0;
  for (const t in va) { na += va[t] ** 2; if (vb[t]) dot += va[t] * vb[t]; }
  for (const t in vb) nb += vb[t] ** 2;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function relevance(mp, roleKey) {
  if (mp.roleKey && mp.roleKey === roleKey) return 1.0;
  if ((mp.relatedRoleKeys || []).includes(roleKey)) return 0.6;
  return 0.3;
}

function factors({ student, role, gaps, mentor, docs }) {
  const sp = student.profile, mp = mentor.profile;
  const rel = relevance(mp, sp.careerGoalRoleKey);
  const text = (m) => `${m.roleTitle} ${m.industry} ${(m.expertiseSkills || []).map((s) => s.skillKey).join(' ')}`;
  const goalText = `${role ? role.titleEn : ''} ${sp.goalText || ''}`;
  const bonus = rel === 1 ? 0.4 : rel === 0.6 ? 0.2 : 0;
  const career = Math.min(1, tfidfCosine(goalText, docs, text(mp)) + bonus);

  const gapTotal = gaps.reduce((t, g) => t + g.priority, 0);
  const have = new Map((mp.expertiseSkills || []).map((s) => [s.skillKey, s.level]));
  const covered = gaps.filter((g) => (have.get(g.skillKey) || 0) >= g.required);
  const gap = gapTotal ? covered.reduce((t, g) => t + g.priority, 0) / gapTotal : 0;

  const experience = Math.min((mp.yearsExperience || 0) / 10, 1) * rel;
  const sl = sp.languages || [];
  const language = sl.length ? sl.filter((l) => (mp.languages || []).includes(l)).length / sl.length : 0;
  const overlap = (sp.requestedSlots || []).filter((s) => (mp.availableSlots || []).includes(s));
  const schedule = Math.min(overlap.length / 2, 1);
  const reliability = mp.acceptedRequests > 0 ? (mp.sessionsCompleted + 2) / (mp.acceptedRequests + 4) : 0.5;
  return { career, gap, experience, language, schedule, reliability, _covered: covered, _overlap: overlap, _rel: rel };
}

function reasons(f, mentor, student) {
  const out = [];
  const t = mentor.profile.roleTitle || 'this field';
  if (f._rel === 1) out.push({ en: `Works as ${t}, the same as your goal.`, bn: `আপনার লক্ষ্যের মতোই ${t} পদে কাজ করেন।` });
  else if (f._rel === 0.6) out.push({ en: `Works in a field related to your goal (${t}).`, bn: `আপনার লক্ষ্যের সাথে সম্পর্কিত ক্ষেত্রে (${t}) কাজ করেন।` });
  if (f._covered.length) {
    const names = f._covered.map((g) => g.nameEn || g.skillKey).join(', ');
    const namesBn = f._covered.map((g) => g.nameBn || g.skillKey).join(', ');
    out.push({ en: `Can help close your gaps in ${names}.`, bn: `${namesBn}-এ আপনার ঘাটতি পূরণে সাহায্য করতে পারবেন।` });
  }
  if (mentor.profile.yearsExperience >= 3) out.push({ en: `${mentor.profile.yearsExperience} years of experience.`, bn: `${mentor.profile.yearsExperience} বছরের অভিজ্ঞতা।` });
  if (f.language > 0) out.push({ en: 'Speaks your preferred language.', bn: 'আপনার পছন্দের ভাষায় কথা বলেন।' });
  if (f._overlap.length) out.push({ en: `${f._overlap.length} time slot(s) match yours.`, bn: `${f._overlap.length}টি সময় আপনার সাথে মিলে যায়।` });
  if (mentor.profile.isRising) out.push({ en: 'Rising mentor: newer, with open capacity.', bn: 'উদীয়মান মেন্টর: নতুন এবং সময় আছে।' });
  return out;
}

// mentors: [{ user, profile }], recentCounts: { mentorId: number of recent recommendations }
function rankMentors({ student, role, gaps, mentors, recentCounts = {}, limit = 5 }) {
  const eligible = mentors.filter((m) => m.user.verificationStatus === 'verified' && !m.profile.paused
    && String(m.user._id) !== String(student.user._id)
    && !(student.user.blockedBy || []).some((b) => String(b) === String(m.user._id))
    && !(m.user.blockedBy || []).some((b) => String(b) === String(student.user._id)));
  const docs = eligible.map((m) => `${m.profile.roleTitle} ${m.profile.industry}`);
  const scored = eligible.map((m) => {
    const f = factors({ student, role, gaps, mentor: m, docs });
    const score = Object.keys(W).reduce((t, k) => t + W[k] * f[k], 0);
    return { mentor: m, f, score: Math.round(score * 100) };
  }).sort((a, b) => b.score - a.score);

  // Fair re-rank: a mentor already in >25% of recent recommendations is moved behind others,
  // and at least one rising mentor gets a slot.
  const total = Object.values(recentCounts).reduce((a, b) => a + b, 0);
  const over = (s) => total >= 4 && (recentCounts[String(s.mentor.user._id)] || 0) / total > 0.25;
  let ranked = [...scored.filter((s) => !over(s)), ...scored.filter(over)];
  let top = ranked.slice(0, limit);
  if (!top.some((s) => s.mentor.profile.isRising)) {
    const rising = ranked.slice(limit).find((s) => s.mentor.profile.isRising);
    if (rising) top[top.length - 1] = rising;
  }
  return top.map((s) => ({
    mentorId: s.mentor.user._id, score: s.score,
    factorScores: Object.fromEntries(Object.keys(W).map((k) => [k, Math.round(s.f[k] * 100)])),
    reasons: reasons(s.f, s.mentor, student),
  }));
}

// Plain keyword-overlap baseline, kept to show the weighted model is better than a simple search.
function keywordBaseline({ student, role, mentors }) {
  const goal = new Set(tokens(`${role ? role.titleEn : ''} ${student.profile.goalText}`));
  return mentors.map((m) => {
    const t = tokens(`${m.profile.roleTitle} ${m.profile.industry}`);
    return { mentorId: m.user._id, score: t.filter((x) => goal.has(x)).length };
  }).sort((a, b) => b.score - a.score);
}

module.exports = { rankMentors, keywordBaseline, factors, tfidfCosine, W };
