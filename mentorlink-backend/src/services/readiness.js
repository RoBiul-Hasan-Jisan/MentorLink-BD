// PURE FUNCTIONS: no database here, so they are easy to unit test and explain in a viva.
// Fairness: gender, religion, region and family background are never inputs.

const SELF_CAP = 1; // a self-rating alone can never count above level 1

/** rows: [{skillKey, level, verified}] -> { skillKey: {level, verified} } */
function effectiveLevels(rows) {
  const out = {};
  for (const r of rows) {
    const cur = out[r.skillKey] || { verifiedMax: 0, selfMax: 0, seen: true };
    if (r.verified) cur.verifiedMax = Math.max(cur.verifiedMax, r.level);
    else cur.selfMax = Math.max(cur.selfMax, r.level);
    out[r.skillKey] = cur;
  }
  const result = {};
  for (const [k, v] of Object.entries(out)) {
    result[k] = { level: Math.max(v.verifiedMax, Math.min(v.selfMax, SELF_CAP)), verified: v.verifiedMax > 0 };
  }
  return result;
}

const lvl = (levels, key) => (levels[key] ? levels[key].level : 0);

/** readiness% = 100 * sum(w * min(s/r, 1)) / sum(w) */
function readinessPercent(required, levels) {
  const totalW = required.reduce((a, r) => a + r.weight, 0);
  if (!totalW) return 0;
  const sum = required.reduce((a, r) => a + r.weight * Math.min(lvl(levels, r.skillKey) / r.requiredLevel, 1), 0);
  return (100 * sum) / totalW;
}

/** Gaps = skills where s < r, ordered by w * (r - s), biggest first. */
function computeGaps(required, levels) {
  return required
    .map((r) => ({ skillKey: r.skillKey, weight: r.weight, requiredLevel: r.requiredLevel, currentLevel: lvl(levels, r.skillKey) }))
    .filter((g) => g.currentLevel < g.requiredLevel)
    .map((g) => ({ ...g, priority: g.weight * (g.requiredLevel - g.currentLevel) }))
    .sort((a, b) => b.priority - a.priority || a.skillKey.localeCompare(b.skillKey));
}

/** Confidence = share of the student's skills that have evidence beyond self-rating. */
function confidence(levels) {
  const keys = Object.keys(levels);
  if (!keys.length) return 0;
  return keys.filter((k) => levels[k].verified).length / keys.length;
}

/**
 * Weeks = sum(estimated hours for all gap levels) / weekly study hours.
 * Returns weeks:null with an explanation instead of dividing by zero or inventing a forecast.
 */
function timeToReady(gaps, hoursPerLevel, weeklyHours) {
  if (!gaps.length) return { weeks: 0, note: 'No gaps: you meet every required level.' };
  if (!weeklyHours || weeklyHours <= 0) {
    return { weeks: null, note: 'Enter your weekly study hours to get a time estimate.' };
  }
  const hours = gaps.reduce((a, g) => a + (g.requiredLevel - g.currentLevel) * (hoursPerLevel[g.skillKey] ?? 5), 0);
  return { weeks: Math.ceil(hours / weeklyHours), estimatedHours: hours, note: 'Rough estimate from an uncalibrated rubric (v0).' };
}

/** What readiness would be if the top-N gaps were closed (used for "close SQL and Power BI to reach X%"). */
function projectedPercent(required, levels, gaps, topN = 2) {
  const next = { ...levels };
  for (const g of gaps.slice(0, topN)) next[g.skillKey] = { level: g.requiredLevel, verified: false };
  return readinessPercent(required, next);
}

module.exports = { effectiveLevels, readinessPercent, computeGaps, confidence, timeToReady, projectedPercent, SELF_CAP };
