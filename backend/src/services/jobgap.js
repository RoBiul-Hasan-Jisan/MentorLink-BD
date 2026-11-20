// Career Gap Intelligence from REAL postings: what do the approved, open postings for a role ask for,
// and how does the student's EVIDENCE compare? Pure functions so they can be unit-tested.
const words = (t) => String(t || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

// A posting is relevant to a role when it shares a skill with the role template or a word with the role title.
function relevantPostings(postings, role) {
  const roleSkills = new Set((role.requiredSkills || []).map((s) => s.skillKey));
  const titleWords = new Set(words(role.titleEn).filter((w) => !['junior', 'senior', 'trainee', 'officer', 'engineer', 'developer'].includes(w)));
  return postings.filter((p) => {
    const skills = (p.requiredSkills || []).map((s) => s.skillKey);
    const overlap = skills.filter((k) => roleSkills.has(k)).length;
    const titleHit = words(p.title).some((w) => titleWords.has(w));
    return overlap >= 2 || (overlap >= 1 && titleHit) || titleHit;
  });
}

// demand[skill] = { share of postings that ask for it, typical (median) required level }
function demand(postings) {
  const by = new Map();
  for (const p of postings) for (const s of p.requiredSkills || []) {
    const e = by.get(s.skillKey) || { skillKey: s.skillKey, count: 0, levels: [] };
    e.count += 1; e.levels.push(s.requiredLevel || 2); by.set(s.skillKey, e);
  }
  const n = postings.length || 1;
  return [...by.values()].map((e) => {
    const l = [...e.levels].sort((a, b) => a - b);
    return { skillKey: e.skillKey, postings: e.count, share: e.count / n, level: l[Math.floor(l.length / 2)] };
  }).sort((a, b) => b.share - a.share || b.level - a.level);
}

// evidence: [{skillKey, type, level}]. proven = a quiz/project/endorsement at the level. selfOnly = only a self-rating reaches it.
function compare(dem, evidence) {
  const proven = {}, self = {};
  for (const e of evidence) { const t = e.type === 'self' ? self : proven; t[e.skillKey] = Math.max(t[e.skillKey] || 0, e.level); }
  const strengths = [], evidenceNeeded = [], missing = [];
  for (const d of dem) {
    const p = proven[d.skillKey] || 0, s = self[d.skillKey] || 0;
    if (p >= d.level) strengths.push({ ...d, have: p });
    else if (s >= d.level) evidenceNeeded.push({ ...d, have: s, proof: 'self_rated', suggest: 'Take the quiz or add a project link so this counts as proof.' });
    else missing.push({ ...d, have: Math.max(p, s), shortfall: d.level - Math.max(p, s), priority: Math.round(100 * d.share * (d.level - Math.max(p, s)) / d.level) });
  }
  missing.sort((a, b) => b.priority - a.priority);
  return { strengths, evidenceNeeded, missing };
}

module.exports = { relevantPostings, demand, compare };
