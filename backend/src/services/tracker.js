// Application tracker board: saved -> applied -> interview -> offer -> done. Pure functions (tests/tracker.test.js).
const STALE_DAYS = 7; // no movement for this long in Applied / Under Review = "no reply yet"
const COLUMN_OF = { Applied: 'applied', 'Under Review': 'applied', Shortlisted: 'applied', Interview: 'interview', Offer: 'offer', Hired: 'done', Rejected: 'done', Withdrawn: 'done' };
const COLUMNS = ['saved', 'applied', 'interview', 'offer', 'done'];

const lastMove = (a) => { const h = (a.stageHistory || []).map((x) => +new Date(x.at)).filter(Number.isFinite); return h.length ? Math.max(...h) : +new Date(a.createdAt); };
const daysBetween = (from, to) => Math.max(0, Math.floor((to - from) / 864e5));

// apps: [{ _id, stage, createdAt, stageHistory, opportunity:{_id,title,organization,applicationDeadline} }]
// saved: [{ opportunityId, opportunity:{...} }] (jobs the student saved but has NOT applied to; the caller removes applied ones)
function buildBoard({ apps = [], saved = [], now = new Date() } = {}) {
  const t = +new Date(now);
  const cols = Object.fromEntries(COLUMNS.map((c) => [c, []]));
  for (const s of saved) {
    const o = s.opportunity; if (!o) continue;
    const left = o.applicationDeadline ? Math.ceil((+new Date(o.applicationDeadline) - t) / 864e5) : null;
    if (left !== null && left < 0) continue; // closed jobs do not belong on a to-do board
    cols.saved.push({ id: String(o._id), jobId: String(o._id), title: o.title, organization: o.organization, daysLeft: left, closingSoon: left !== null && left <= 3, route: `/opportunity/${o._id}` });
  }
  cols.saved.sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
  for (const a of apps) {
    const o = a.opportunity || {}; const col = COLUMN_OF[a.stage]; if (!col) continue;
    const waiting = daysBetween(lastMove(a), t);
    const stale = ['Applied', 'Under Review'].includes(a.stage) && waiting >= STALE_DAYS;
    cols[col].push({ id: String(a._id), jobId: o._id ? String(o._id) : null, title: o.title || 'Job removed', organization: o.organization || '', stage: a.stage, daysWaiting: waiting, stale, outcome: a.stage === 'Hired' ? 'hired' : a.stage === 'Rejected' ? 'rejected' : a.stage === 'Withdrawn' ? 'withdrawn' : undefined, route: `/application/${a._id}` });
  }
  for (const c of ['applied', 'interview', 'offer']) cols[c].sort((x, y) => Number(y.stale) - Number(x.stale) || y.daysWaiting - x.daysWaiting);
  cols.done.sort((x, y) => x.daysWaiting - y.daysWaiting);
  const staleCount = cols.applied.filter((c) => c.stale).length;
  return { columns: COLUMNS.map((key) => ({ key, count: cols[key].length, cards: cols[key] })), staleCount, total: COLUMNS.reduce((n, c) => n + cols[c].length, 0), staleDays: STALE_DAYS };
}
module.exports = { buildBoard, STALE_DAYS, COLUMNS, COLUMN_OF };
