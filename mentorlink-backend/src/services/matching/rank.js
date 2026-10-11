const { buildTfidf, cosine, tokenize } = require('./textSim');
const F = require('./factors');

const FAIR = { cap: 0.25, minSample: 20, n: 5 }; // cap only applies once there are enough recommendations to judge

/** Step 1: eligibility filter. */
const isEligible = (m) => m.verified && !m.paused && !m.blocked && m.activeMentees < m.weeklyCapacity;

/** Step 4: fair re-ranking. history = { total, byMentor: {id: count} } over the recent period. */
function fairRerank(scored, history, opts = {}) {
  const { cap, minSample, n } = { ...FAIR, ...opts };
  // projected share if this mentor were recommended once more
  const overCap = (id) => history.total >= minSample && ((history.byMentor[id] || 0) + 1) / (history.total + 1) > cap;

  const allowed = scored.filter((m) => !overCap(m.mentorId));
  const cappedOut = scored.filter((m) => overCap(m.mentorId));
  let list = allowed.slice(0, n);
  if (list.length < n) list = list.concat(cappedOut.slice(0, n - list.length)); // never return fewer than we have

  // keep at least one "rising mentor" slot
  let risingSlotAdded = false;
  if (!list.some((m) => m.isRising)) {
    const rising = [...allowed.slice(n), ...cappedOut].find((m) => m.isRising && !list.includes(m));
    if (rising) {
      if (list.length >= n) list[list.length - 1] = rising; else list.push(rising);
      risingSlotAdded = true;
    }
  }
  list.sort((a, b) => b.score - a.score);
  return { list, cappedOut: cappedOut.map((m) => m.mentorId), risingSlotAdded };
}

/** Baseline for comparison: just count shared keywords. */
function keywordBaseline(studentDoc, mentors, n = 5) {
  const s = new Set(tokenize(studentDoc));
  return mentors
    .map((m) => ({ mentorId: m.mentorId, displayName: m.displayName, hits: [...new Set(tokenize(m.doc))].filter((t) => s.has(t)).length }))
    .sort((a, b) => b.hits - a.hits || a.displayName.localeCompare(b.displayName))
    .slice(0, n);
}

const join = (arr, and) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} ${and} ${arr[arr.length - 1]}`);
const LANG = { en: { bn: 'Bangla', en: 'English' }, bn: { bn: 'বাংলা', en: 'ইংরেজি' } };

/** Plain-words reasons in English and Bangla. */
function buildReasons(student, mentor, factors, covered) {
  const en = [], bn = [];
  if (covered.length) {
    en.push(`teaches ${join(covered.map((c) => c.nameEn), 'and')}, your top gaps`);
    bn.push(`${join(covered.map((c) => c.nameBn), 'ও')} শেখান, যা আপনার শীর্ষ ঘাটতি`);
  } else if (factors.career >= 0.5) {
    en.push(`works as ${mentor.roleTitle}${mentor.industry ? ` in ${mentor.industry}` : ''}, close to your goal`);
    bn.push(`${mentor.roleTitle} হিসেবে কাজ করেন, যা আপনার লক্ষ্যের কাছাকাছি`);
  }
  const shared = student.languages.filter((l) => mentor.languages.includes(l));
  if (shared.length) {
    en.push(`speaks ${join(shared.map((l) => LANG.en[l]), 'and')}`);
    bn.push(`${join(shared.map((l) => LANG.bn[l]), 'ও')} বলেন`);
  }
  if (factors.schedule > 0.5) { en.push('has open slots that match your times'); bn.push('আপনার সময়ের সাথে মেলে এমন স্লট খালি আছে'); }
  if (mentor.isRising) { en.push('is a rising mentor'); bn.push('উঠতি মেন্টর'); }
  return {
    en: en.length ? `Recommended because this mentor ${join(en, 'and')}.` : 'Recommended based on overall score.',
    bn: bn.length ? `সুপারিশ করা হয়েছে কারণ এই মেন্টর ${join(bn, 'এবং')}।` : 'সামগ্রিক স্কোরের ভিত্তিতে সুপারিশ।',
  };
}

/**
 * student: {goalRoleKey, relatedRoleKeys, doc, languages, preferredSlots, gapKeys[] (ordered), skillNames{key:{nameEn,nameBn}}}
 * mentors: [{mentorId, displayName, roleTitle, industry, roleKeys, yearsExperience, skills{key:level}, languages,
 *            availableSlots, sessionsCompleted, acceptedRequests, isRising, ratingAvg, weeklyCapacity,
 *            activeMentees, paused, verified, blocked, doc}]
 */
function rankMentors(student, mentors, history, opts = {}) {
  const eligible = mentors.filter(isEligible);
  const topGapKeys = student.gapKeys.slice(0, F.TOP_GAPS);

  const vecs = buildTfidf([student.doc, ...eligible.map((m) => m.doc)]);
  const [studentVec, ...mentorVecs] = vecs;

  const scored = eligible.map((m, i) => {
    const factors = {
      career: F.careerAlignment(cosine(studentVec, mentorVecs[i]), m.roleKeys.includes(student.goalRoleKey)),
      gaps: F.skillGapCoverage(topGapKeys, m.skills),
      experience: F.experienceFit(m.yearsExperience, F.roleRelevance(student.goalRoleKey, student.relatedRoleKeys, m.roleKeys)),
      language: F.languageFit(student.languages, m.languages),
      schedule: F.scheduleFit(student.preferredSlots, m.availableSlots),
      reliability: F.reliability(m.sessionsCompleted, m.acceptedRequests),
    };
    const { score, percent, points } = F.weightedScore(factors);
    const covered = topGapKeys.filter((k) => (m.skills[k] || 0) >= 3).map((k) => student.skillNames[k]).filter(Boolean);
    return { ...m, score, percent, factors, points, reasons: buildReasons(student, m, factors, covered) };
  }).sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));

  const { list, cappedOut, risingSlotAdded } = fairRerank(scored, history, opts);
  return { top: list, baseline: keywordBaseline(student.doc, eligible, opts.n || FAIR.n), fairness: { cappedOut, risingSlotAdded } };
}

module.exports = { isEligible, fairRerank, keywordBaseline, buildReasons, rankMentors, FAIR };
