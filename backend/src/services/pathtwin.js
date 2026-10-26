// Path Twin: find mentors whose skills AT GRADUATION looked like the student's skills NOW,
// then show what those mentors learned next, in order, and how long their first job took.
// Similarity is a weighted Jaccard: sum(min(you, them)) / sum(max(you, them)) over the union of skills (0..1).

function stateAtGraduation(milestones) {
  const out = {};
  for (const m of milestones) if (m.month <= 0) out[m.skillKey] = Math.max(out[m.skillKey] || 0, m.level);
  return out;
}

function similarity(you, them) {
  const keys = new Set([...Object.keys(you), ...Object.keys(them)]);
  let mn = 0, mx = 0;
  for (const k of keys) { const a = you[k] || 0, b = them[k] || 0; mn += Math.min(a, b); mx += Math.max(a, b); }
  return mx === 0 ? 0 : mn / mx;
}

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b), h = Math.floor(s.length / 2);
  return s.length % 2 ? s[h] : Math.round((s[h - 1] + s[h]) / 2);
}

// you: {skillKey: level}; journeys: [{mentorId, milestones, firstJobMonths, note}]
function findTwins(you, journeys, limit = 5) {
  const scored = [];
  for (const j of journeys) {
    const next = (j.milestones || []).filter((m) => m.month > 0).sort((a, b) => a.month - b.month);
    if (!next.length) continue; // a twin must show something that happened after graduation
    const sim = similarity(you, stateAtGraduation(j.milestones || []));
    if (sim <= 0) continue;
    scored.push({ journey: j, sim, next });
  }
  scored.sort((a, b) => b.sim - a.sim);
  const twins = scored.slice(0, limit);
  // "What most twins learned next": skills the student does not already have at that level.
  const tally = new Map();
  for (const t of twins) {
    const seen = new Set();
    for (const m of t.next) {
      if ((you[m.skillKey] || 0) >= m.level || seen.has(m.skillKey)) continue;
      seen.add(m.skillKey);
      const e = tally.get(m.skillKey) || { skillKey: m.skillKey, count: 0, months: [] };
      e.count += 1; e.months.push(m.month); tally.set(m.skillKey, e);
    }
  }
  const consensus = [...tally.values()]
    .map((e) => ({ skillKey: e.skillKey, count: e.count, ofTwins: twins.length, medianMonth: median(e.months) }))
    .sort((a, b) => b.count - a.count || a.medianMonth - b.medianMonth);
  return { twins, consensus };
}

module.exports = { findTwins, similarity, stateAtGraduation, median };
