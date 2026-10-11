// Monthly fairness check: what share of recommendations did the most-recommended mentor take? Pure.
const LIMIT = 0.25;
function fairnessStats(rows, { limit = LIMIT, minSample = 20 } = {}) {
  const total = rows.reduce((a, r) => a + r.n, 0);
  const byMentor = rows.map((r) => ({ mentorId: String(r.mentorId), count: r.n, share: total ? r.n / total : 0 })).sort((a, b) => b.share - a.share);
  const top = byMentor[0];
  return {
    total, limit, highestShare: top ? Math.round(top.share * 1000) / 10 : 0, highestMentorId: top ? top.mentorId : null,
    compliant: !top || top.share <= limit,
    sampleTooSmall: total < minSample, // with few recommendations a high share is expected, so read it with care
    byMentor,
  };
}
module.exports = { fairnessStats, LIMIT };
