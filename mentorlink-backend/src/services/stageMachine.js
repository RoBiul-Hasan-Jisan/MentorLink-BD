// Application stages and the only moves the server allows. Pure functions.
const NEXT = {
  Applied: ['Under Review', 'Shortlisted', 'Rejected'],
  'Under Review': ['Shortlisted', 'Rejected'],
  Shortlisted: ['Interview', 'Rejected'],
  Interview: ['Offer', 'Rejected'],
  Offer: ['Hired', 'Rejected'],
  Hired: [], Rejected: [], Withdrawn: [],
};
const canTransition = (from, to) => (NEXT[from] || []).includes(to);
const canWithdraw = (stage) => !['Hired', 'Rejected', 'Withdrawn'].includes(stage);

// The app shows 5 stages from the design. Backend stages map onto them.
const UI = { Applied: 'Applied', 'Under Review': 'Applied', Shortlisted: 'Shortlisted', Interview: 'Interview',
  Offer: 'Selected', Hired: 'Selected', Rejected: 'Not selected', Withdrawn: 'Withdrawn' };
const uiStage = (stage) => UI[stage];

const ORDER = ['Applied', 'Shortlisted', 'Interview', 'Selected'];
/** Timeline dots for the tracker: done / current / stopped (rejected or withdrawn) / todo. */
function timeline(stage, history = []) {
  const negative = ['Rejected', 'Withdrawn'].includes(stage);
  const reached = Math.max(0, ...[stage, ...history.map((h) => h.stage)].map((s) => ORDER.indexOf(UI[s])));
  const selected = UI[stage] === 'Selected';
  return ORDER.map((name, i) => ({
    name,
    state: i < reached ? 'done' : i === reached ? (negative ? 'stopped' : selected ? 'done' : 'current') : 'todo',
  }));
}
module.exports = { NEXT, canTransition, canWithdraw, uiStage, timeline };
