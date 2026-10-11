// Six factors, each 0..1. Weights sum to 1. Nothing here uses gender, religion, region or family background.
const WEIGHTS = { career: 0.30, gaps: 0.25, experience: 0.15, language: 0.10, schedule: 0.10, reliability: 0.10 };
const TOP_GAPS = 2;              // how many of the student's top gaps the mentor is asked to cover
const TAXONOMY_BONUS = 0.15;     // small bonus for an exact role-tag match

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** Career alignment = TF-IDF cosine + small exact-tag bonus, capped at 1. */
const careerAlignment = (cosineSim, exactTagMatch) => clamp01(cosineSim + (exactTagMatch ? TAXONOMY_BONUS : 0));

/** Gap coverage = top gaps where the mentor is strong (level 3) / number of top gaps. */
function skillGapCoverage(topGapKeys, mentorSkills) {
  if (!topGapKeys.length) return 0;
  return topGapKeys.filter((k) => (mentorSkills[k] || 0) >= 3).length / topGapKeys.length;
}

/** Role relevance: 1.0 same role, 0.6 related, 0.3 other. */
function roleRelevance(studentRoleKey, relatedKeys, mentorRoleKeys) {
  if (mentorRoleKeys.includes(studentRoleKey)) return 1.0;
  if (mentorRoleKeys.some((k) => relatedKeys.includes(k))) return 0.6;
  return 0.3;
}

/** Experience fit = min(years/10, 1) x relevance. */
const experienceFit = (years, relevance) => Math.min((years || 0) / 10, 1) * relevance;

/** Language: 1 if all preferred languages shared, 0.5 if some, 0 if none. No preference = 1. */
function languageFit(studentLangs, mentorLangs) {
  if (!studentLangs.length) return 1;
  const shared = studentLangs.filter((l) => mentorLangs.includes(l)).length;
  if (shared === studentLangs.length) return 1;
  return shared > 0 ? 0.5 : 0;
}

/** Schedule = overlapping slots / slots the student asked for, capped at 1. No request = neutral 0.5. */
function scheduleFit(studentSlots, mentorSlots) {
  if (!studentSlots.length) return 0.5;
  return clamp01(studentSlots.filter((s) => mentorSlots.includes(s)).length / studentSlots.length);
}

/** Reliability = (completed + 2) / (accepted + 4). A brand-new mentor starts at 0.5. */
const reliability = (completed, accepted) => clamp01(((completed || 0) + 2) / ((accepted || 0) + 4));

/** Weighted sum. Returns score 0..1 and the points each factor contributed (out of 100). */
function weightedScore(f) {
  const points = {};
  let score = 0;
  for (const k of Object.keys(WEIGHTS)) { score += WEIGHTS[k] * f[k]; points[k] = Math.round(WEIGHTS[k] * f[k] * 1000) / 10; }
  return { score, percent: Math.round(score * 100), points };
}

module.exports = {
  WEIGHTS, TOP_GAPS, careerAlignment, skillGapCoverage, roleRelevance, experienceFit,
  languageFit, scheduleFit, reliability, weightedScore,
};
