// No database needed: Career Action Center ranking rules.
const { buildActions, MAX_ACTIONS } = require('../src/services/actions');
const now = new Date('2026-10-30T06:00:00Z');
const h = (n) => new Date(now.getTime() + n * 36e5);
const keys = (r) => r.actions.map((a) => a.key);

test('a student with nothing set up is told to choose a goal first', () => {
  const r = buildActions({ now });
  expect(keys(r)).toEqual(['goal']);
  expect(r.actions[0].route).toBe('/goal');
});
test('an unanswered offer beats everything and is urgent', () => {
  const r = buildActions({ now, hasGoal: true, hasCv: true, hasMentor: true, offersWaiting: 1, dueTask: { title: 'x', overdue: true }, nextSession: { at: h(5) } });
  expect(r.actions[0].key).toBe('offer');
  expect(r.hasUrgent).toBe(true);
});
test('order: offer, interview, papers, session, task, feedback', () => {
  const r = buildActions({ now, hasGoal: true, hasCv: true, hasMentor: true, offersWaiting: 1, interviewSoon: { title: 'HR round', at: h(30) }, docsToSend: 2, nextSession: { at: h(5), mentor: 'Abrar' }, dueTask: { title: 'Do', overdue: false }, unseenReviews: 1, closingJob: { id: 'j', title: 'T', daysLeft: 2, fit: 80 } });
  expect(keys(r)).toEqual(['offer', 'interview', 'papers', 'session', 'task']);
  expect(r.total).toBe(7);
});
test('an interview more than 3 days away and a session more than 24 h away are not shown yet', () => {
  const r = buildActions({ now, hasGoal: true, hasCv: true, hasMentor: true, interviewSoon: { title: 'Late', at: h(100) }, nextSession: { at: h(48) } });
  expect(keys(r)).toEqual([]);
});
test('a gap with no proof asks for the quiz; a gap with proof asks to learn', () => {
  const gap = { skillKey: 'sql', nameEn: 'SQL', nameBn: 'এসকিউএল' };
  expect(buildActions({ now, hasGoal: true, hasCv: true, hasMentor: true, topGap: { ...gap, hasProof: false } }).actions[0]).toMatchObject({ key: 'gap_quiz', route: '/quiz/sql' });
  expect(buildActions({ now, hasGoal: true, hasCv: true, hasMentor: true, topGap: { ...gap, hasProof: true } }).actions[0]).toMatchObject({ key: 'gap_learn', route: '/roadmap/sql' });
});
test('never more than MAX_ACTIONS, every action has a reason in both languages and a route', () => {
  const r = buildActions({ now, hasGoal: true, offersWaiting: 1, interviewSoon: { title: 'a', at: h(10) }, docsToSend: 1, nextSession: { at: h(3) }, dueTask: { title: 't', overdue: true }, unseenReviews: 2, staleApps: 3 });
  expect(r.actions.length).toBe(MAX_ACTIONS);
  for (const a of r.actions) { expect(a.reasonEn).toBeTruthy(); expect(a.reasonBn).toBeTruthy(); expect(a.titleBn).toBeTruthy(); expect(a.route.startsWith('/')).toBe(true); }
});
