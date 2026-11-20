// Employer analytics: hiring funnel, time to first reply, time to hire. Pure functions (tests/employerstats.test.js).
// Only counts: no student names. Small groups are marked so a company never reads too much into 2 applicants.
const RANK = { Applied: 0, 'Under Review': 1, Shortlisted: 2, Interview: 3, Offer: 4, Hired: 5 };
const FUNNEL = [['applied', 'Applied', 'আবেদন'], ['reviewed', 'Under review', 'পর্যালোচনা'], ['shortlisted', 'Shortlisted', 'শর্টলিস্ট'], ['interview', 'Interview', 'ইন্টারভিউ'], ['offer', 'Offer', 'অফার'], ['hired', 'Hired', 'নিয়োগ']];
const MIN_GROUP = 3;

const best = (a) => { let r = 0; for (const s of [a.stage, ...(a.stageHistory || []).map((h) => h.stage)]) if (s in RANK) r = Math.max(r, RANK[s]); return r; };
const median = (xs) => { const s = xs.filter(Number.isFinite).sort((p, q) => p - q); if (!s.length) return null; const h = Math.floor(s.length / 2); return s.length % 2 ? s[h] : Math.round(((s[h - 1] + s[h]) / 2) * 10) / 10; };
const days = (from, to) => Math.round(((+new Date(to) - +new Date(from)) / 864e5) * 10) / 10;

function firstReplyDays(a) {
  const h = (a.stageHistory || []).filter((x) => x.stage !== 'Applied').sort((p, q) => +new Date(p.at) - +new Date(q.at))[0];
  return h ? days(a.createdAt, h.at) : null;
}
function hireDays(a) {
  const h = (a.stageHistory || []).filter((x) => x.stage === 'Hired').pop();
  return h ? days(a.createdAt, h.at) : null;
}

// apps: [{ stage, createdAt, stageHistory:[{stage,at}] }]  (withdrawn applications still count as applied)
function funnelFor(apps = []) {
  const total = apps.length;
  const ranks = apps.map(best);
  let prev = total;
  const steps = FUNNEL.map(([key, en, bn], i) => {
    const count = i === 0 ? total : ranks.filter((r) => r >= i).length;
    const row = { key, en, bn, count, percentOfApplied: total ? Math.round((100 * count) / total) : 0, droppedFromPrevious: i === 0 ? 0 : Math.max(0, prev - count) };
    prev = count; return row;
  });
  const biggest = steps.slice(1).reduce((m, s) => (s.droppedFromPrevious > (m ? m.droppedFromPrevious : 0) ? s : m), null);
  return {
    total, steps,
    rejected: apps.filter((a) => a.stage === 'Rejected').length, withdrawn: apps.filter((a) => a.stage === 'Withdrawn').length,
    medianFirstReplyDays: median(apps.map(firstReplyDays)), medianDaysToHire: median(apps.map(hireDays)),
    biggestDropAt: biggest && biggest.droppedFromPrevious > 0 ? biggest.key : null,
    smallSample: total < MIN_GROUP,
  };
}
module.exports = { funnelFor, median, MIN_GROUP, FUNNEL };
