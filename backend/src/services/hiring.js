// Rules for the hiring process after an application (interviews, papers, offers, messages).
// Pure functions: no database, no framework, so every rule has a plain unit test (tests/hiring_rules.test.js).
const { bad } = require('../utils/httpError');
const { uiStage } = require('./scam');

const CLOSED_STAGES = ['Rejected', 'Withdrawn'];
const DAY = 864e5;

// Who may do what at which stage.
const canSchedule = (stage) => ['Shortlisted', 'Interview'].includes(stage);
const canRequestDocs = (stage) => !CLOSED_STAGES.includes(stage);
const canMessage = (stage) => !CLOSED_STAGES.includes(stage);
const canOffer = (stage) => stage === 'Interview';

const DOC_LABELS = {
  cv_update: 'Updated CV', transcript: 'Academic transcript', certificate: 'Certificate', national_id: 'National ID (copy or number)',
  reference_letter: 'Reference letter', portfolio: 'Portfolio or project link', cover_letter: 'Cover letter', work_sample: 'Work sample', other: 'Other document',
};
const defaultDocLabel = (docType) => DOC_LABELS[docType] || 'Document';

// Only https links are accepted anywhere in the hiring flow (no javascript:, no plain http).
function httpsLink(value, field = 'link') {
  if (value === undefined || value === null || value === '') return undefined;
  let u;
  try { u = new URL(String(value)); } catch { throw bad('BAD_LINK', `The ${field} is not a valid link.`); }
  if (u.protocol !== 'https:') throw bad('BAD_LINK', `The ${field} must start with https://`);
  return u.toString();
}

// An offer or invitation that has run out of time. Computed on read so no background job is needed.
function offerStatus(offer, now = new Date()) {
  if (!offer) return null;
  if (offer.status === 'sent' && offer.expiresAt && new Date(offer.expiresAt) < now) return 'expired';
  return offer.status;
}

const overlaps = (aStart, aMin, bStart, bMin) => {
  const a0 = +new Date(aStart), a1 = a0 + aMin * 60000, b0 = +new Date(bStart), b1 = b0 + bMin * 60000;
  return a0 < b1 && b0 < a1;
};

// Checks the fields of a new or moved interview. Returns the cleaned values.
function checkInterview(input, now = new Date()) {
  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(+startsAt)) throw bad('BAD_TIME', 'Choose a date and time for the interview.');
  if (+startsAt < +now - 5 * 60000) throw bad('PAST_TIME', 'The interview time is in the past.');
  if (+startsAt > +now + 180 * DAY) throw bad('TOO_FAR', 'Choose a date within the next 180 days.');
  const meetingLink = httpsLink(input.meetingLink, 'meeting link');
  const placeText = input.placeText ? String(input.placeText).trim() : undefined;
  if (input.kind === 'video' && !meetingLink) throw bad('LINK_REQUIRED', 'A video interview needs a meeting link.');
  if (input.kind === 'onsite' && !placeText) throw bad('PLACE_REQUIRED', 'An on-site interview needs the office or room name.');
  return { startsAt, meetingLink, placeText };
}

// What an interview looks like to the student: poster-only feedback is removed unless it was shared.
function interviewView(i, side) {
  const o = {
    id: i._id, applicationId: i.applicationId, round: i.round, title: i.title, kind: i.kind, startsAt: i.startsAt, durationMin: i.durationMin,
    meetingLink: i.meetingLink, placeText: i.placeText, notes: i.notes, status: i.status, studentNote: i.studentNote, proposedStartsAt: i.proposedStartsAt, result: i.result,
  };
  if (side !== 'student' || i.feedbackShared) { o.feedback = i.feedback; o.feedbackShared = !!i.feedbackShared; }
  return o;
}

const docView = (d) => ({
  id: d._id, applicationId: d.applicationId, docType: d.docType, label: d.label, note: d.note, dueAt: d.dueAt, status: d.status,
  submission: d.submission && (d.submission.text || d.submission.link) ? { text: d.submission.text, link: d.submission.link, submittedAt: d.submission.submittedAt } : undefined,
  reviewNote: d.reviewNote, reviewedAt: d.reviewedAt, createdAt: d.createdAt,
});

const offerView = (o, now = new Date()) => o && ({
  id: o._id, applicationId: o.applicationId, positionTitle: o.positionTitle, salaryText: o.salaryText, employmentType: o.employmentType, startDate: o.startDate,
  workPlaceText: o.workPlaceText, terms: o.terms, expiresAt: o.expiresAt, status: offerStatus(o, now), respondedAt: o.respondedAt, declineReason: o.declineReason, createdAt: o.createdAt,
});

// One ordered list of everything that happened to an application. Used by the admin "process" view and by both people's history.
// Messages are only counted unless includeMessages is true (admin thread view, which is written to the audit log).
function buildTimeline({ application, interviews = [], documents = [], offer, messages = [], includeMessages = false, now = new Date() }) {
  const ev = [];
  const push = (at, type, actor, title, detail) => { if (at) ev.push({ at: new Date(at), type, actor, title, ...(detail ? { detail } : {}) }); };
  const hist = application.stageHistory || [];
  hist.forEach((h, idx) => {
    if (idx === 0 && h.stage === 'Applied') push(h.at, 'applied', 'student', 'Applied for the job');
    else if (h.stage === 'Withdrawn') push(h.at, 'stage', 'student', 'Application withdrawn', h.message);
    else push(h.at, 'stage', h.stage === 'Applied' ? 'student' : 'poster', `Moved to ${h.stage}`, h.message);
  });
  for (const i of interviews) {
    push(i.createdAt, 'interview', 'poster', `Interview scheduled: ${i.title} (round ${i.round}, ${i.kind.replace('_', ' ')})`, `for ${new Date(i.startsAt).toISOString()}`);
    if (i.status === 'confirmed') push(i.updatedAt, 'interview', 'student', `Student confirmed: ${i.title}`);
    if (i.status === 'reschedule_requested') push(i.updatedAt, 'interview', 'student', `Student asked to move: ${i.title}`, i.studentNote);
    if (i.status === 'declined') push(i.updatedAt, 'interview', 'student', `Student declined: ${i.title}`, i.studentNote);
    if (i.status === 'cancelled') push(i.updatedAt, 'interview', 'poster', `Interview cancelled: ${i.title}`);
    if (i.status === 'no_show') push(i.updatedAt, 'interview', 'poster', `Marked as no-show: ${i.title}`);
    if (i.status === 'completed') push(i.updatedAt, 'interview', 'poster', `Interview done: ${i.title} (${i.result === 'passed' ? 'passed' : i.result === 'not_passed' ? 'not passed' : 'result pending'})`);
  }
  for (const d of documents) {
    push(d.createdAt, 'document', 'poster', `Asked for: ${d.label}`, d.note);
    if (d.submission && d.submission.submittedAt) push(d.submission.submittedAt, 'document', 'student', `Sent: ${d.label}`);
    if (d.reviewedAt) push(d.reviewedAt, 'document', 'poster', d.status === 'accepted' ? `Accepted: ${d.label}` : `Needs a fix: ${d.label}`, d.reviewNote);
  }
  if (offer) {
    push(offer.createdAt, 'offer', 'poster', `Offer sent: ${offer.positionTitle}`, offer.salaryText);
    if (offer.status === 'accepted') push(offer.respondedAt, 'offer', 'student', 'Student accepted the offer');
    if (offer.status === 'declined') push(offer.respondedAt, 'offer', 'student', 'Student declined the offer', offer.declineReason);
    if (offer.status === 'withdrawn') push(offer.respondedAt || offer.updatedAt, 'offer', 'poster', 'Offer withdrawn');
    if (offerStatus(offer, now) === 'expired') push(offer.expiresAt, 'offer', 'system', 'Offer expired without an answer');
  }
  if (includeMessages) {
    for (const m of messages) push(m.createdAt, 'message', m.side, m.side === 'student' ? 'Student wrote' : 'Poster wrote', m.body);
  } else if (messages.length) {
    push(messages[messages.length - 1].createdAt, 'message', 'system', `${messages.length} message(s) exchanged`);
  }
  return ev.sort((a, b) => +a.at - +b.at);
}

// Share of applications that reached each step, for the admin funnel. Stages are ordered; "Rejected" and "Withdrawn" are leaves.
const FUNNEL = [['Applied', ['Applied', 'Under Review', 'Shortlisted', 'Interview', 'Offer', 'Hired', 'Rejected', 'Withdrawn']], ['Shortlisted', ['Shortlisted', 'Interview', 'Offer', 'Hired']], ['Interview', ['Interview', 'Offer', 'Hired']], ['Offer', ['Offer', 'Hired']], ['Hired', ['Hired']]];
function funnel(byStage) {
  const base = FUNNEL[0][1].reduce((s, k) => s + (byStage[k] || 0), 0);
  return FUNNEL.map(([step, stages]) => { const n = stages.reduce((s, k) => s + (byStage[k] || 0), 0); return { step, count: n, percent: base ? Math.round((100 * n) / base) : 0 }; });
}

module.exports = {
  CLOSED_STAGES, canSchedule, canRequestDocs, canMessage, canOffer, defaultDocLabel, httpsLink, offerStatus, overlaps, checkInterview,
  interviewView, docView, offerView, buildTimeline, funnel, uiStage,
};
