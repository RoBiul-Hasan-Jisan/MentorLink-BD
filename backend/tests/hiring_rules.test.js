// Pure rules of the hiring process. No database.
const H = require('../src/services/hiring');

const future = (h) => new Date(Date.now() + h * 36e5);

test('who may do what at which stage', () => {
  expect(H.canSchedule('Shortlisted')).toBe(true);
  expect(H.canSchedule('Interview')).toBe(true);
  expect(H.canSchedule('Applied')).toBe(false);
  expect(H.canSchedule('Rejected')).toBe(false);
  expect(H.canOffer('Interview')).toBe(true);
  expect(H.canOffer('Shortlisted')).toBe(false);
  expect(H.canMessage('Offer')).toBe(true);
  expect(H.canMessage('Rejected')).toBe(false);
  expect(H.canMessage('Withdrawn')).toBe(false);
  expect(H.canRequestDocs('Hired')).toBe(true); // joining papers after the offer
  expect(H.canRequestDocs('Rejected')).toBe(false);
});

test('links must be https', () => {
  expect(H.httpsLink('https://meet.example/abc')).toBe('https://meet.example/abc');
  expect(H.httpsLink('')).toBeUndefined();
  expect(() => H.httpsLink('http://x.example')).toThrow(/https/);
  expect(() => H.httpsLink('javascript:alert(1)')).toThrow();
  expect(() => H.httpsLink('not a link')).toThrow(/valid link/);
});

test('interview input is checked: past, too far, video needs a link, on-site needs a place', () => {
  expect(() => H.checkInterview({ kind: 'phone', startsAt: future(-2) })).toThrow(/past/);
  expect(() => H.checkInterview({ kind: 'phone', startsAt: future(24 * 200) })).toThrow(/180 days/);
  expect(() => H.checkInterview({ kind: 'video', startsAt: future(5) })).toThrow(/meeting link/);
  expect(() => H.checkInterview({ kind: 'onsite', startsAt: future(5) })).toThrow(/office or room/);
  expect(() => H.checkInterview({ kind: 'phone', startsAt: 'nonsense' })).toThrow(/date and time/);
  const ok = H.checkInterview({ kind: 'video', startsAt: future(5), meetingLink: 'https://meet.example/x' });
  expect(ok.meetingLink).toBe('https://meet.example/x');
});

test('overlap detection', () => {
  const t = new Date('2030-01-01T10:00:00Z');
  expect(H.overlaps(t, 30, new Date('2030-01-01T10:20:00Z'), 30)).toBe(true);
  expect(H.overlaps(t, 30, new Date('2030-01-01T10:30:00Z'), 30)).toBe(false); // back to back is fine
  expect(H.overlaps(t, 60, new Date('2030-01-01T09:00:00Z'), 30)).toBe(false);
});

test('an unanswered offer expires by itself', () => {
  const now = new Date('2030-01-10');
  expect(H.offerStatus({ status: 'sent', expiresAt: new Date('2030-01-05') }, now)).toBe('expired');
  expect(H.offerStatus({ status: 'sent', expiresAt: new Date('2030-01-20') }, now)).toBe('sent');
  expect(H.offerStatus({ status: 'accepted', expiresAt: new Date('2030-01-05') }, now)).toBe('accepted');
  expect(H.offerStatus(null)).toBeNull();
});

test('the student never sees private interview feedback unless it was shared', () => {
  const iv = { _id: 'i', kind: 'video', title: 'HR', feedback: 'weak SQL', feedbackShared: false, status: 'completed', result: 'passed' };
  expect(H.interviewView(iv, 'student').feedback).toBeUndefined();
  expect(H.interviewView(iv, 'poster').feedback).toBe('weak SQL');
  expect(H.interviewView({ ...iv, feedbackShared: true }, 'student').feedback).toBe('weak SQL');
});

test('timeline is ordered and tells the whole story; messages are counted unless the admin opens them', () => {
  const t = (m) => new Date(Date.UTC(2030, 0, 1, 10, m));
  const application = { stageHistory: [{ stage: 'Applied', at: t(0) }, { stage: 'Shortlisted', at: t(5) }, { stage: 'Interview', at: t(10) }, { stage: 'Offer', at: t(40) }, { stage: 'Hired', at: t(50) }] };
  const interviews = [{ title: 'HR', round: 1, kind: 'phone', startsAt: t(20), createdAt: t(10), updatedAt: t(30), status: 'completed', result: 'passed' }];
  const documents = [{ label: 'Transcript', createdAt: t(32), submission: { submittedAt: t(35) }, reviewedAt: t(36), status: 'accepted' }];
  const offer = { positionTitle: 'Analyst', createdAt: t(40), status: 'accepted', respondedAt: t(50) };
  const messages = [{ side: 'poster', body: 'Hello', createdAt: t(6) }, { side: 'student', body: 'Hi', createdAt: t(7) }];
  const plain = H.buildTimeline({ application, interviews, documents, offer, messages });
  const times = plain.map((e) => +e.at);
  expect(times).toEqual([...times].sort((a, b) => a - b));
  expect(plain[0].type).toBe('applied');
  expect(plain.some((e) => e.title.includes('Offer sent'))).toBe(true);
  expect(plain.some((e) => e.title === 'Student accepted the offer')).toBe(true);
  expect(plain.some((e) => e.type === 'message' && e.title === '2 message(s) exchanged')).toBe(true);
  expect(JSON.stringify(plain)).not.toMatch(/Hello/); // text hidden by default
  const full = H.buildTimeline({ application, interviews, documents, offer, messages, includeMessages: true });
  expect(JSON.stringify(full)).toMatch(/Hello/);
});

test('funnel counts everyone who reached a step', () => {
  const f = H.funnel({ Applied: 4, Shortlisted: 2, Interview: 1, Hired: 1, Rejected: 2 });
  expect(f.map((x) => x.count)).toEqual([10, 4, 2, 1, 1]);
  expect(f[0].percent).toBe(100);
  expect(f[4].percent).toBe(10);
  expect(H.funnel({}).every((x) => x.count === 0 && x.percent === 0)).toBe(true);
});
