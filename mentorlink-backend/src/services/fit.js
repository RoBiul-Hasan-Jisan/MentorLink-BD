// Explainable job fit for one student and one opportunity. Same formula as readiness. Pure.
// Gender, religion, region and family background are never inputs.
const R = require('./readiness');

function opportunityFit(required, levels, hoursPerLevel, weeklyHours, names = {}) {
  const gaps = R.computeGaps(required, levels);
  const ttr = R.timeToReady(gaps, hoursPerLevel, weeklyHours);
  return {
    fitPercent: Math.round(R.readinessPercent(required, levels)),
    skills: required.map((r) => {
      const have = levels[r.skillKey];
      const current = have ? have.level : 0;
      // "not_provided" = no evidence at all. We show it as missing information, not as a proven lack of skill.
      return { skillKey: r.skillKey, ...names[r.skillKey], requiredLevel: r.requiredLevel, currentLevel: current,
        state: current >= r.requiredLevel ? 'met' : have ? 'gap' : 'not_provided' };
    }),
    topGaps: gaps.slice(0, 2).map((g) => g.skillKey),
    projectedIfTopGapsClosed: Math.round(R.projectedPercent(required, levels, gaps, 2)),
    weeksToClose: ttr.weeks, weeksNote: ttr.note,
  };
}
module.exports = { opportunityFit };
