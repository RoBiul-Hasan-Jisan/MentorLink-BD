// Readiness % = 100 * sum(w * min(s/r, 1)) / sum(w)
// Gaps are ordered by w * (r - s). Confidence = share of required skills with NON-self evidence.
function levelsFromEvidence(evidence) {
  const out = {};
  for (const e of evidence) {
    const o = out[e.skillKey] || { level: 0, nonSelf: false };
    o.level = Math.max(o.level, e.level);
    if (e.type !== 'self') o.nonSelf = true;
    out[e.skillKey] = o;
  }
  return out;
}

function computeReadiness({ role, evidence, skills, weeklyHours }) {
  const have = levelsFromEvidence(evidence);
  const skillMap = new Map(skills.map((s) => [s.key, s]));
  let num = 0, den = 0, proven = 0;
  const gaps = [];
  const skillsDetail = [];
  for (const rs of role.requiredSkills) {
    const s = (have[rs.skillKey] || { level: 0 }).level;
    num += rs.weight * Math.min(s / rs.requiredLevel, 1);
    den += rs.weight;
    if (have[rs.skillKey] && have[rs.skillKey].nonSelf) proven += 1;
    const sk0 = skillMap.get(rs.skillKey);
    skillsDetail.push({ skillKey: rs.skillKey, nameEn: sk0 && sk0.nameEn, nameBn: sk0 && sk0.nameBn, current: s, required: rs.requiredLevel, evidence: have[rs.skillKey] ? (have[rs.skillKey].nonSelf ? 'verified' : 'self') : 'none' });
    if (s < rs.requiredLevel) {
      const sk = skillMap.get(rs.skillKey);
      gaps.push({
        skillKey: rs.skillKey, nameEn: sk && sk.nameEn, nameBn: sk && sk.nameBn,
        current: s, required: rs.requiredLevel, priority: rs.weight * (rs.requiredLevel - s),
        hours: (rs.requiredLevel - s) * (sk ? sk.learningHours : 20),
      });
    }
  }
  gaps.sort((a, b) => b.priority - a.priority);
  const totalHours = gaps.reduce((t, g) => t + g.hours, 0);
  const n = role.requiredSkills.length || 1;
  const timeToReadyWeeks = weeklyHours > 0 ? Math.ceil(totalHours / weeklyHours) : null;
  return {
    roleKey: role.key,
    readiness: den ? Math.round((100 * num) / den) : 0,
    confidence: Math.round((100 * proven) / n),
    gaps, skills: skillsDetail, totalHours, timeToReadyWeeks,
    timeNote: weeklyHours > 0 ? null : 'Set weekly study hours above 0 to estimate time to ready.',
  };
}
module.exports = { computeReadiness, levelsFromEvidence };
