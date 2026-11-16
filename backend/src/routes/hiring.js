// The hiring process, step by step, the way it happens in real life:
//   post a job -> people apply -> shortlist -> interview(s) -> papers (documents) -> offer -> accepted / declined,
// with messages between the two sides all the way, and one admin view of the whole thing.
//
// Two sides: STUDENT (the applicant) and POSTER (whoever posted the job: an employer team, a mentor, an admin, or a student).
// A route never trusts the role alone: access is decided by who the application belongs to and who posted the job.
const express = require('express');
const { z } = require('zod');
const M = require('../models');
const { Opportunity, Application, Organization, OrganizationMember, Interview, AppMessage, DocumentRequest, Offer, User, Report, SavedJob, AuditLog, STAGES } = M;
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/guards');
const { bad, notFound, forbidden, conflict } = require('../utils/httpError');
const { audit, notify, toObjectId, firstNameInitial } = require('../utils/helpers');
const { normalizeCv, stripContact } = require('../services/cv');
const { scamFlags, uiStage, canMove } = require('../services/scam');
const H = require('../services/hiring');
const env = require('../config/env');

const idStr = (x) => String(x && x._id ? x._id : x);
const ago = (d) => new Date(Date.now() - d * 864e5);

module.exports = function hiringRoutes(auth) {
  const r = express.Router();
  const A = auth.authenticate;
  const admin = [A, requireRole('admin')];

  // ------------------------------------------------------------------ access ----
  const { posterIds, isPoster } = require('../services/posters');
  async function loadApp(req, id) {
    toObjectId(id);
    const app = await Application.findById(id);
    const opp = app && (await Opportunity.findById(app.opportunityId));
    if (!app || !opp) throw notFound();
    let side = null;
    if (idStr(app.studentId) === idStr(req.user._id)) side = 'student';
    else if (await isPoster(req.user, opp)) side = 'poster';
    else if (req.user.role === 'admin') side = 'admin'; // read-only
    if (!side) throw notFound(); // outsiders cannot tell the application exists
    return { app, opp, side };
  }
  const needSide = (side, want) => { if (side !== want) throw forbidden(want === 'poster' ? 'Only the person who posted this job can do that.' : 'Only the applicant can do that.'); };
  const target = (app) => ({ type: 'application', id: String(app._id) });
  async function tellPosters(opp, app, title, body, except) {
    for (const id of await posterIds(opp)) if (id !== idStr(except)) await notify(id, title, body, 'application', target(app));
  }
  const setStage = async (app, stage, byId, message) => {
    app.stage = stage; if (message) app.statusMessage = message;
    app.stageHistory.push({ stage, by: byId, message });
    await app.save();
  };

  // ------------------------------------------------------------- poster: jobs ----
  async function jobsOf(user) {
    const memberships = await OrganizationMember.find({ userId: user._id, status: 'active' }).select('organizationId').lean();
    const orgs = (await Organization.find({ _id: { $in: memberships.map((m) => m.organizationId) }, verificationStatus: 'verified' }).select('_id').lean()).map((o) => o._id);
    return Opportunity.find({ $or: [{ postedBy: user._id }, ...(orgs.length ? [{ organizationId: { $in: orgs } }] : [])] }).sort({ createdAt: -1 }).limit(200);
  }
  // Every job I run, with how many people are at each stage. Works for a student, mentor, employer or admin who posted jobs.
  r.get('/me/jobs', A, requireRole('employer'), async (req, res) => {
    const jobs = await jobsOf(req.user);
    const apps = await Application.find({ opportunityId: { $in: jobs.map((j) => j._id) } }).select('opportunityId stage').lean();
    const by = new Map();
    for (const a of apps) { const k = idStr(a.opportunityId); if (!by.has(k)) by.set(k, {}); by.get(k)[a.stage] = (by.get(k)[a.stage] || 0) + 1; }
    res.json({ jobs: jobs.map((j) => {
      const stages = by.get(idStr(j)) || {};
      return {
        id: j._id, title: j.title, organization: j.organization, type: j.type, status: j.status, closed: !!j.closed, sourceLabel: j.sourceLabel,
        applicationDeadline: j.applicationDeadline, suspiciousFlags: j.suspiciousFlags || [], createdAt: j.createdAt,
        applicants: Object.entries(stages).filter(([s]) => s !== 'Withdrawn').reduce((s, [, n]) => s + n, 0), byStage: stages,
      };
    }) });
  });
  r.post('/jobs/:id/close', A, requireRole('employer'), async (req, res) => {
    toObjectId(req.params.id);
    const j = await Opportunity.findById(req.params.id);
    if (!j || !(await isPoster(req.user, j))) throw notFound();
    j.closed = true; await j.save();
    res.json({ ok: true });
  });
  r.post('/jobs/:id/reopen', A, requireRole('employer'), async (req, res) => {
    toObjectId(req.params.id);
    const j = await Opportunity.findById(req.params.id);
    if (!j || !(await isPoster(req.user, j))) throw notFound();
    if (j.applicationDeadline && j.applicationDeadline < new Date()) throw conflict('DEADLINE_PASSED', 'The deadline has passed. Post a new job instead.');
    j.closed = false; await j.save();
    res.json({ ok: true });
  });

  // Applicants of one job, each with what is going on (interviews, papers, offer, unread messages).
  r.get('/jobs/:id/pipeline', A, requireRole('employer'), async (req, res) => {
    toObjectId(req.params.id);
    const job = await Opportunity.findById(req.params.id);
    if (!job || !(await isPoster(req.user, job))) throw notFound();
    const apps = await Application.find({ opportunityId: job._id }).populate('studentId', 'displayName department').populate('cvVersionId').sort({ createdAt: -1 });
    const ids = apps.map((a) => a._id);
    const [ints, docs, offers, msgs] = await Promise.all([
      Interview.find({ applicationId: { $in: ids } }).sort({ startsAt: 1 }).lean(),
      DocumentRequest.find({ applicationId: { $in: ids } }).select('applicationId status').lean(),
      Offer.find({ applicationId: { $in: ids } }).lean(),
      AppMessage.find({ applicationId: { $in: ids }, side: 'student' }).select('applicationId createdAt').lean(),
    ]);
    const group = (rows) => { const m = new Map(); for (const x of rows) { const k = idStr(x.applicationId); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
    const gi = group(ints), gd = group(docs), go = group(offers), gm = group(msgs);
    res.json({
      job: { id: job._id, title: job.title, organization: job.organization, status: job.status, closed: !!job.closed },
      applicants: apps.map((a) => {
        const f = a.consentSnapshot.sharedFields; // only what the student agreed to share
        const k = idStr(a);
        const my = gi.get(k) || [], dd = gd.get(k) || [], off = (go.get(k) || [])[0];
        const seen = a.readAt && a.readAt.poster ? +a.readAt.poster : 0;
        return {
          id: a._id, stage: a.stage, studentSees: uiStage(a.stage), appliedAt: a.createdAt, note: a.applicantNote, sharedFields: f,
          name: f.includes('name') ? a.studentId.displayName : undefined, department: f.includes('department') ? a.studentId.department : undefined,
          cv: f.includes('cv') && a.cvVersionId ? (f.includes('contact') ? normalizeCv(a.cvVersionId.data) : stripContact(normalizeCv(a.cvVersionId.data))) : undefined,
          interviews: my.length, nextInterview: (my.find((i) => ['scheduled', 'confirmed', 'reschedule_requested'].includes(i.status) && +new Date(i.startsAt) >= Date.now()) || {}).startsAt,
          documents: { total: dd.length, toReview: dd.filter((d) => d.status === 'submitted').length, waiting: dd.filter((d) => ['requested', 'needs_fix'].includes(d.status)).length },
          offer: off ? H.offerStatus(off) : null, unread: (gm.get(k) || []).filter((m) => +new Date(m.createdAt) > seen).length,
        };
      }),
    });
  });

  // ----------------------------------------------------- application workspace ----
  const hist = (a) => (a.stageHistory || []).map((h) => ({ stage: h.stage, ui: uiStage(h.stage), at: h.at, message: h.message }));
  async function markRead(app, side) {
    if (side === 'admin') return;
    await Application.updateOne({ _id: app._id }, { $set: { [`readAt.${side}`]: new Date() } }, { timestamps: false });
  }
  // Everything about ONE application, for either side. The poster sees only the fields the student agreed to share.
  r.get('/applications/:id/workspace', A, async (req, res) => {
    const { app, opp, side } = await loadApp(req, req.params.id);
    const [ints, docs, offer, msgs, student, cv] = await Promise.all([
      Interview.find({ applicationId: app._id }).sort({ round: 1, startsAt: 1 }),
      DocumentRequest.find({ applicationId: app._id }).sort({ createdAt: 1 }),
      Offer.findOne({ applicationId: app._id }),
      AppMessage.find({ applicationId: app._id }).sort({ createdAt: 1 }).limit(300).lean(),
      User.findById(app.studentId).select('displayName department').lean(),
      side === 'poster' ? M.CvVersion.findById(app.cvVersionId).lean() : null,
    ]);
    if (side === 'admin') await audit(req.user._id, 'admin_view_application', 'application', app._id);
    await markRead(app, side);
    const f = app.consentSnapshot.sharedFields;
    const body = {
      side, canWrite: side !== 'admin',
      job: { id: opp._id, title: opp.title, organization: opp.organization, closed: !!opp.closed },
      application: { id: app._id, stage: app.stage, studentSees: uiStage(app.stage), statusMessage: app.statusMessage, appliedAt: app.createdAt, history: hist(app), outcomeFeedback: app.outcomeFeedback },
      rules: { canSchedule: H.canSchedule(app.stage), canRequestDocs: H.canRequestDocs(app.stage), canMessage: H.canMessage(app.stage), canOffer: H.canOffer(app.stage) && !offer, nextStages: require('../services/scam').NEXT[app.stage] || [] },
      interviews: ints.map((i) => H.interviewView(i, side === 'student' ? 'student' : 'poster')),
      documents: docs.map(H.docView),
      offer: H.offerView(offer),
      messages: msgs.map((m) => ({ id: m._id, side: m.side, mine: m.side === side, body: m.body, flags: m.flags || [], at: m.createdAt })),
    };
    if (side !== 'student') {
      body.applicant = {
        name: f.includes('name') || side === 'admin' ? (student || {}).displayName : undefined, department: f.includes('department') || side === 'admin' ? (student || {}).department : undefined,
        note: side === 'poster' ? app.applicantNote : undefined, sharedFields: f,
        cv: side === 'poster' && f.includes('cv') && cv ? (f.includes('contact') ? normalizeCv(cv.data) : stripContact(normalizeCv(cv.data))) : undefined,
      };
    }
    res.json(body);
  });

  // ----------------------------------------------------------------- messages ----
  r.get('/applications/:id/messages', A, async (req, res) => {
    const { app, side } = await loadApp(req, req.params.id);
    const q = { applicationId: app._id };
    if (req.query.after) { const d = new Date(String(req.query.after)); if (!Number.isNaN(+d)) q.createdAt = { $gt: d }; }
    const list = await AppMessage.find(q).sort({ createdAt: 1 }).limit(300).lean();
    if (side === 'admin') await audit(req.user._id, 'admin_view_messages', 'application', app._id);
    await markRead(app, side);
    res.json({ open: H.canMessage(app.stage), messages: list.map((m) => ({ id: m._id, side: m.side, mine: m.side === side, body: m.body, flags: m.flags || [], at: m.createdAt })) });
  });
  r.post('/applications/:id/messages', A, validate(z.object({ body: z.string().trim().min(1).max(1000) }).strict()), async (req, res) => {
    const { app, opp, side } = await loadApp(req, req.params.id);
    if (side === 'admin') throw forbidden('Admins can read this conversation but not write in it.');
    if (!H.canMessage(app.stage)) throw conflict('CLOSED', 'This application is closed, so the conversation is closed too.');
    const flags = scamFlags(req.body.body);
    const m = await AppMessage.create({ applicationId: app._id, senderId: req.user._id, side, body: req.body.body, flags });
    await markRead(app, side);
    if (side === 'student') await tellPosters(opp, app, 'New message from an applicant', opp.title, req.user._id);
    else await notify(app.studentId, 'New message', `${opp.title}`, 'application', target(app));
    res.status(201).json({ message: { id: m._id, side, mine: true, body: m.body, flags, at: m.createdAt } });
  });

  // ---------------------------------------------------------------- interviews ----
  const interviewSchema = z.object({
    title: z.string().trim().min(2).max(80), kind: z.enum(M.INTERVIEW_KINDS), startsAt: z.coerce.date(), durationMin: z.number().int().min(10).max(480).default(30),
    meetingLink: z.string().max(300).optional(), placeText: z.string().trim().max(160).optional(), notes: z.string().trim().max(500).optional(),
  }).strict();
  r.post('/applications/:id/interviews', A, validate(interviewSchema), async (req, res) => {
    const { app, opp, side } = await loadApp(req, req.params.id);
    needSide(side, 'poster');
    if (!H.canSchedule(app.stage)) throw conflict('WRONG_STAGE', 'Shortlist the applicant before scheduling an interview.');
    const clean = H.checkInterview(req.body);
    // The applicant must not be double-booked (for example by another company).
    const around = await Interview.find({ studentId: app.studentId, status: { $in: ['scheduled', 'confirmed', 'reschedule_requested'] }, startsAt: { $gte: new Date(+clean.startsAt - 8 * 36e5), $lte: new Date(+clean.startsAt + 8 * 36e5) } }).lean();
    if (around.some((i) => H.overlaps(i.startsAt, i.durationMin, clean.startsAt, req.body.durationMin))) throw conflict('APPLICANT_BUSY', 'The applicant already has an interview at that time. Choose another time.');
    const round = (await Interview.countDocuments({ applicationId: app._id })) + 1;
    const iv = await Interview.create({ ...req.body, ...clean, applicationId: app._id, opportunityId: opp._id, studentId: app.studentId, scheduledBy: req.user._id, round });
    if (app.stage === 'Shortlisted') await setStage(app, 'Interview', req.user._id, `Interview scheduled: ${iv.title}`);
    await notify(app.studentId, 'Interview scheduled', `${opp.title}: ${iv.title}`, 'application', target(app));
    res.status(201).json({ interview: H.interviewView(iv, 'poster'), stage: app.stage });
  });

  const patchSchema = z.object({
    action: z.enum(['reschedule', 'cancel', 'complete', 'no_show']), startsAt: z.coerce.date().optional(), meetingLink: z.string().max(300).optional(), placeText: z.string().trim().max(160).optional(),
    notes: z.string().trim().max(500).optional(), result: z.enum(['passed', 'not_passed']).optional(), feedback: z.string().trim().max(500).optional(), feedbackShared: z.boolean().optional(),
  }).strict();
  async function loadInterview(req) {
    toObjectId(req.params.id);
    const iv = await Interview.findById(req.params.id);
    if (!iv) throw notFound();
    const ctx = await loadApp(req, iv.applicationId);
    return { iv, ...ctx };
  }
  const LIVE = ['scheduled', 'confirmed', 'reschedule_requested'];
  // Demo accounts may close an interview before its time (so a live demo is possible); real accounts only after it has started.
  const started = (iv) => env.demoMode || +new Date(iv.startsAt) <= Date.now();
  r.patch('/interviews/:id', A, validate(patchSchema), async (req, res) => {
    const { iv, app, opp, side } = await loadInterview(req);
    needSide(side, 'poster');
    const b = req.body;
    if (b.action === 'reschedule') {
      if (![...LIVE, 'declined'].includes(iv.status)) throw conflict('NOT_OPEN', 'This interview is already finished or cancelled.');
      if (!b.startsAt) throw bad('TIME_REQUIRED', 'Choose the new time.');
      const clean = H.checkInterview({ kind: iv.kind, startsAt: b.startsAt, meetingLink: b.meetingLink ?? iv.meetingLink, placeText: b.placeText ?? iv.placeText });
      const around = await Interview.find({ _id: { $ne: iv._id }, studentId: iv.studentId, status: { $in: LIVE }, startsAt: { $gte: new Date(+clean.startsAt - 8 * 36e5), $lte: new Date(+clean.startsAt + 8 * 36e5) } }).lean();
      if (around.some((i) => H.overlaps(i.startsAt, i.durationMin, clean.startsAt, iv.durationMin))) throw conflict('APPLICANT_BUSY', 'The applicant already has an interview at that time.');
      Object.assign(iv, { startsAt: clean.startsAt, meetingLink: clean.meetingLink, placeText: clean.placeText, notes: b.notes ?? iv.notes, status: 'scheduled', proposedStartsAt: undefined, studentNote: undefined });
      await iv.save();
      await notify(app.studentId, 'Interview time changed', `${opp.title}: ${iv.title}`, 'application', target(app));
    } else if (b.action === 'cancel') {
      if (!LIVE.includes(iv.status)) throw conflict('NOT_OPEN', 'This interview is already finished or cancelled.');
      iv.status = 'cancelled'; await iv.save();
      await notify(app.studentId, 'Interview cancelled', `${opp.title}: ${iv.title}`, 'application', target(app));
    } else if (b.action === 'complete') {
      if (!['scheduled', 'confirmed'].includes(iv.status)) throw conflict('NOT_OPEN', 'Only a scheduled or confirmed interview can be marked done.');
      if (!started(iv)) throw conflict('NOT_STARTED', 'The interview has not started yet.');
      if (!b.result) throw bad('RESULT_REQUIRED', 'Choose passed or not passed.');
      Object.assign(iv, { status: 'completed', result: b.result, feedback: b.feedback, feedbackShared: !!b.feedbackShared });
      await iv.save();
      await notify(app.studentId, 'Interview finished', `${opp.title}: ${iv.title}`, 'application', target(app));
    } else {
      if (!['scheduled', 'confirmed'].includes(iv.status)) throw conflict('NOT_OPEN', 'Only a scheduled or confirmed interview can be a no-show.');
      if (!started(iv)) throw conflict('NOT_STARTED', 'The interview has not started yet.');
      iv.status = 'no_show'; await iv.save();
    }
    res.json({ interview: H.interviewView(iv, 'poster') });
  });
  r.post('/interviews/:id/respond', A, validate(z.object({ response: z.enum(['accept', 'decline', 'reschedule']), note: z.string().trim().max(300).optional(), proposedStartsAt: z.coerce.date().optional() }).strict()), async (req, res) => {
    const { iv, app, opp, side } = await loadInterview(req);
    needSide(side, 'student');
    const b = req.body;
    if (b.response === 'accept') {
      if (iv.status !== 'scheduled') throw conflict('NOT_OPEN', 'This interview cannot be confirmed now.');
      iv.status = 'confirmed';
    } else if (b.response === 'decline') {
      if (!['scheduled', 'confirmed'].includes(iv.status)) throw conflict('NOT_OPEN', 'This interview cannot be declined now.');
      iv.status = 'declined'; iv.studentNote = b.note;
    } else {
      if (!['scheduled', 'confirmed'].includes(iv.status)) throw conflict('NOT_OPEN', 'This interview cannot be moved now.');
      if (!b.proposedStartsAt) throw bad('TIME_REQUIRED', 'Suggest a new time.');
      H.checkInterview({ kind: 'phone', startsAt: b.proposedStartsAt });
      iv.status = 'reschedule_requested'; iv.proposedStartsAt = b.proposedStartsAt; iv.studentNote = b.note;
    }
    await iv.save();
    await tellPosters(opp, app, `Interview ${iv.status.replace('_', ' ')}`, `${opp.title}: ${iv.title}`, req.user._id);
    res.json({ interview: H.interviewView(iv, 'student') });
  });

  // ------------------------------------------------------- papers (documents) ----
  r.post('/applications/:id/documents', A, validate(z.object({ docType: z.enum(M.DOC_TYPES), label: z.string().trim().min(2).max(120).optional(), note: z.string().trim().max(300).optional(), dueAt: z.coerce.date().optional() }).strict()), async (req, res) => {
    const { app, opp, side } = await loadApp(req, req.params.id);
    needSide(side, 'poster');
    if (!H.canRequestDocs(app.stage)) throw conflict('CLOSED', 'This application is closed.');
    if (req.body.dueAt && +req.body.dueAt < Date.now() - 864e5) throw bad('PAST_TIME', 'The due date is in the past.');
    const flags = scamFlags(`${req.body.label || ''} ${req.body.note || ''}`);
    if (flags.length) throw bad('SCAM_WORDS', 'Do not ask for money or contact outside MentorLink in a document request.');
    const d = await DocumentRequest.create({ ...req.body, label: req.body.label || H.defaultDocLabel(req.body.docType), applicationId: app._id, opportunityId: opp._id, studentId: app.studentId, requestedBy: req.user._id });
    await notify(app.studentId, 'Document requested', `${opp.title}: ${d.label}`, 'application', target(app));
    res.status(201).json({ document: H.docView(d) });
  });
  async function loadDoc(req) {
    toObjectId(req.params.id);
    const d = await DocumentRequest.findById(req.params.id);
    if (!d) throw notFound();
    return { d, ...(await loadApp(req, d.applicationId)) };
  }
  r.post('/documents/:id/submit', A, validate(z.object({ text: z.string().trim().max(1000).optional(), link: z.string().max(300).optional() }).strict()), async (req, res) => {
    const { d, app, opp, side } = await loadDoc(req);
    needSide(side, 'student');
    if (!['requested', 'needs_fix'].includes(d.status)) throw conflict('NOT_OPEN', 'This document was already sent.');
    if (!H.canRequestDocs(app.stage)) throw conflict('CLOSED', 'This application is closed.');
    const link = H.httpsLink(req.body.link, 'link');
    if (!link && !req.body.text) throw bad('EMPTY', 'Add a link or a short text.');
    d.submission = { text: req.body.text, link, submittedAt: new Date() }; d.status = 'submitted'; d.reviewNote = undefined; d.reviewedAt = undefined;
    await d.save();
    await tellPosters(opp, app, 'Document received', `${opp.title}: ${d.label}`, req.user._id);
    res.json({ document: H.docView(d) });
  });
  r.post('/documents/:id/review', A, validate(z.object({ decision: z.enum(['accepted', 'needs_fix']), note: z.string().trim().max(300).optional() }).strict()), async (req, res) => {
    const { d, app, opp, side } = await loadDoc(req);
    needSide(side, 'poster');
    if (d.status !== 'submitted') throw conflict('NOT_OPEN', 'Nothing to review: the applicant has not sent this document.');
    if (req.body.decision === 'needs_fix' && !req.body.note) throw bad('NOTE_REQUIRED', 'Tell the applicant what to fix.');
    d.status = req.body.decision; d.reviewNote = req.body.note; d.reviewedAt = new Date();
    await d.save();
    await notify(app.studentId, req.body.decision === 'accepted' ? 'Document accepted' : 'Document needs a fix', `${opp.title}: ${d.label}`, 'application', target(app));
    res.json({ document: H.docView(d) });
  });

  // --------------------------------------------------------------------- offers ----
  const offerSchema = z.object({
    positionTitle: z.string().trim().min(2).max(120).optional(), salaryText: z.string().trim().max(80).optional(), employmentType: z.enum(['full_time', 'part_time', 'internship', 'contract', 'freelance']).optional(),
    startDate: z.coerce.date().optional(), workPlaceText: z.string().trim().max(120).optional(), terms: z.string().trim().max(1000).optional(), expiresAt: z.coerce.date().optional(),
  }).strict();
  r.post('/applications/:id/offer', A, validate(offerSchema), async (req, res) => {
    const { app, opp, side } = await loadApp(req, req.params.id);
    needSide(side, 'poster');
    if (await Offer.exists({ applicationId: app._id })) throw conflict('OFFER_EXISTS', 'This applicant already has an offer.');
    if (!H.canOffer(app.stage)) throw conflict('WRONG_STAGE', 'An offer can be sent after the interview stage.');
    if (req.body.expiresAt && +req.body.expiresAt < Date.now()) throw bad('PAST_TIME', 'The answer deadline is in the past.');
    const flags = scamFlags(`${req.body.terms || ''} ${req.body.salaryText || ''}`);
    if (flags.length) throw bad('SCAM_WORDS', 'An offer must not ask the applicant for money.');
    const offer = await Offer.create({ ...req.body, positionTitle: req.body.positionTitle || opp.title, employmentType: req.body.employmentType || opp.employmentType, applicationId: app._id, opportunityId: opp._id, studentId: app.studentId, createdBy: req.user._id });
    await setStage(app, 'Offer', req.user._id, 'You have a job offer. Please answer it.');
    await notify(app.studentId, 'You received a job offer', `${opp.title}`, 'application', target(app));
    res.status(201).json({ offer: H.offerView(offer), stage: app.stage });
  });
  async function loadOffer(req) {
    toObjectId(req.params.id);
    const offer = await Offer.findById(req.params.id);
    if (!offer) throw notFound();
    return { offer, ...(await loadApp(req, offer.applicationId)) };
  }
  r.post('/offers/:id/respond', A, validate(z.object({ decision: z.enum(['accept', 'decline']), reason: z.string().trim().max(300).optional() }).strict()), async (req, res) => {
    const { offer, app, opp, side } = await loadOffer(req);
    needSide(side, 'student');
    if (H.offerStatus(offer) === 'expired') throw conflict('EXPIRED', 'This offer has expired. Message the poster if you are still interested.');
    if (offer.status !== 'sent') throw conflict('NOT_OPEN', 'This offer was already answered or withdrawn.');
    offer.respondedAt = new Date();
    if (req.body.decision === 'accept') {
      offer.status = 'accepted'; await offer.save();
      await setStage(app, 'Hired', req.user._id, 'The applicant accepted the offer.');
    } else {
      offer.status = 'declined'; offer.declineReason = req.body.reason; await offer.save();
      await setStage(app, 'Withdrawn', req.user._id, 'The applicant declined the offer.');
    }
    await tellPosters(opp, app, req.body.decision === 'accept' ? 'Offer accepted' : 'Offer declined', opp.title, req.user._id);
    res.json({ offer: H.offerView(offer), stage: app.stage, studentSees: uiStage(app.stage) });
  });
  r.post('/offers/:id/withdraw', A, async (req, res) => {
    const { offer, app, opp, side } = await loadOffer(req);
    needSide(side, 'poster');
    if (offer.status !== 'sent') throw conflict('NOT_OPEN', 'Only an offer that has not been answered can be withdrawn.');
    offer.status = 'withdrawn'; offer.respondedAt = new Date(); await offer.save();
    await setStage(app, 'Rejected', req.user._id, 'The offer was withdrawn.');
    await notify(app.studentId, 'Offer withdrawn', opp.title, 'application', target(app));
    res.json({ offer: H.offerView(offer), stage: app.stage });
  });

  // --------------------------------------------------------------------- inbox ----
  async function unreadByApp(appRows, side) {
    if (!appRows.length) return new Map();
    const other = side === 'student' ? 'poster' : 'student';
    const msgs = await AppMessage.find({ applicationId: { $in: appRows.map((a) => a._id) }, side: other }).select('applicationId createdAt').lean();
    const seen = new Map(appRows.map((a) => [idStr(a), a.readAt && a.readAt[side] ? +a.readAt[side] : 0]));
    const out = new Map();
    for (const m of msgs) if (+m.createdAt > seen.get(idStr(m.applicationId))) out.set(idStr(m.applicationId), (out.get(idStr(m.applicationId)) || 0) + 1);
    return out;
  }
  // "What needs my attention": one call for the badge and the home cards. Both sides at once, because one person can be both.
  r.get('/me/hiring/inbox', A, async (req, res) => {
    const now = new Date();
    const out = { applicant: null, poster: null };
    // as an applicant
    const mine = await Application.find({ studentId: req.user._id }).select('opportunityId stage readAt').lean();
    if (mine.length) {
      const ids = mine.map((a) => a._id);
      const titles = new Map((await Opportunity.find({ _id: { $in: mine.map((a) => a.opportunityId) } }).select('title organization').lean()).map((o) => [idStr(o), o]));
      const jobOf = (appId) => titles.get(idStr(mine.find((a) => idStr(a) === idStr(appId)).opportunityId)) || {};
      const [ints, docs, offers] = await Promise.all([
        Interview.find({ applicationId: { $in: ids }, status: { $in: LIVE }, startsAt: { $gte: ago(0.1) } }).sort({ startsAt: 1 }).lean(),
        DocumentRequest.find({ applicationId: { $in: ids }, status: { $in: ['requested', 'needs_fix'] } }).sort({ dueAt: 1 }).lean(),
        Offer.find({ applicationId: { $in: ids }, status: 'sent' }).lean(),
      ]);
      const unread = await unreadByApp(mine, 'student');
      out.applicant = {
        interviews: ints.map((i) => ({ ...H.interviewView(i, 'student'), jobTitle: jobOf(i.applicationId).title, organization: jobOf(i.applicationId).organization })),
        documents: docs.map((d) => ({ ...H.docView(d), jobTitle: jobOf(d.applicationId).title })),
        offers: offers.filter((o) => H.offerStatus(o, now) === 'sent').map((o) => ({ ...H.offerView(o, now), jobTitle: jobOf(o.applicationId).title, organization: jobOf(o.applicationId).organization })),
        unreadMessages: [...unread.values()].reduce((s, n) => s + n, 0), unreadApplications: [...unread.keys()],
      };
      out.applicant.total = out.applicant.interviews.length + out.applicant.documents.length + out.applicant.offers.length + out.applicant.unreadMessages;
    }
    // as a poster
    const jobs = await jobsOf(req.user);
    if (jobs.length) {
      const jobIds = jobs.map((j) => j._id);
      const apps = await Application.find({ opportunityId: { $in: jobIds }, stage: { $ne: 'Withdrawn' } }).select('opportunityId stage readAt').lean();
      const appIds = apps.map((a) => a._id);
      const title = new Map(jobs.map((j) => [idStr(j), j.title]));
      const jobOfApp = new Map(apps.map((a) => [idStr(a), title.get(idStr(a.opportunityId))]));
      const [ints, reqs, docs, offers] = await Promise.all([
        Interview.find({ applicationId: { $in: appIds }, status: { $in: LIVE }, startsAt: { $gte: ago(0.1) } }).sort({ startsAt: 1 }).limit(20).lean(),
        Interview.find({ applicationId: { $in: appIds }, status: 'reschedule_requested' }).lean(),
        DocumentRequest.find({ applicationId: { $in: appIds }, status: 'submitted' }).lean(),
        Offer.find({ applicationId: { $in: appIds }, status: 'sent' }).lean(),
      ]);
      const unread = await unreadByApp(apps, 'poster');
      out.poster = {
        newApplicants: apps.filter((a) => a.stage === 'Applied').length,
        upcomingInterviews: ints.map((i) => ({ ...H.interviewView(i, 'poster'), jobTitle: jobOfApp.get(idStr(i.applicationId)) })),
        rescheduleRequests: reqs.map((i) => ({ ...H.interviewView(i, 'poster'), jobTitle: jobOfApp.get(idStr(i.applicationId)) })),
        documentsToReview: docs.map((d) => ({ ...H.docView(d), jobTitle: jobOfApp.get(idStr(d.applicationId)) })),
        offersWaiting: offers.length, unreadMessages: [...unread.values()].reduce((s, n) => s + n, 0), unreadApplications: [...unread.keys()],
      };
      out.poster.total = out.poster.newApplicants + out.poster.rescheduleRequests.length + out.poster.documentsToReview.length + out.poster.unreadMessages;
    }
    res.json(out);
  });

  // ================================================================= ADMIN ====
  // The admin sees the whole process, read-only: who posted what, who applied, where everyone is, what was said.
  // Applicant CVs and contact details are never part of this view. Opening a conversation is written to the audit log.
  const count = (arr, key) => arr.reduce((m, x) => { const k = typeof key === 'function' ? key(x) : x[key]; m[k] = (m[k] || 0) + 1; return m; }, {});

  r.get('/admin/hiring/overview', ...admin, async (_q, res) => {
    const now = new Date();
    const [jobs, apps, ints, docs, offers, msgCount, flaggedMsgs, openReports] = await Promise.all([
      Opportunity.find({}).select('postedBy organizationId status closed sourceLabel title organization').lean(),
      Application.find({}).select('opportunityId stage createdAt').lean(),
      Interview.find({}).select('status startsAt').lean(),
      DocumentRequest.find({}).select('status').lean(),
      Offer.find({}).select('status expiresAt').lean(),
      AppMessage.countDocuments({}),
      AppMessage.countDocuments({ 'flags.0': { $exists: true } }),
      Report.countDocuments({ status: 'open' }),
    ]);
    const jobBy = new Map(jobs.map((j) => [idStr(j), j]));
    const byStage = count(apps, 'stage');
    // who posts: one row per poster (person), with the numbers that matter
    const posterIdsAll = [...new Set(jobs.map((j) => idStr(j.postedBy)))];
    const people = new Map((await User.find({ _id: { $in: posterIdsAll } }).select('displayName role').lean()).map((u) => [idStr(u), u]));
    const rows = new Map();
    for (const j of jobs) {
      const k = idStr(j.postedBy);
      if (!rows.has(k)) rows.set(k, { posterId: k, name: (people.get(k) || {}).displayName || 'Deleted user', role: (people.get(k) || {}).role || '', organization: j.organization, jobs: 0, open: 0, pending: 0, applicants: 0, hired: 0 });
      const row = rows.get(k); row.jobs++; if (j.status === 'approved' && !j.closed) row.open++; if (j.status === 'pending') row.pending++;
    }
    for (const a of apps) { const j = jobBy.get(idStr(a.opportunityId)); const row = j && rows.get(idStr(j.postedBy)); if (row) { if (a.stage !== 'Withdrawn') row.applicants++; if (a.stage === 'Hired') row.hired++; } }
    res.json({
      jobs: { total: jobs.length, byStatus: count(jobs, 'status'), bySource: count(jobs, 'sourceLabel'), open: jobs.filter((j) => j.status === 'approved' && !j.closed).length, posters: rows.size },
      applications: { total: apps.length, byStage, funnel: H.funnel(byStage) },
      interviews: { total: ints.length, byStatus: count(ints, 'status'), upcoming: ints.filter((i) => LIVE.includes(i.status) && new Date(i.startsAt) >= now).length },
      documents: { total: docs.length, byStatus: count(docs, 'status') },
      offers: { total: offers.length, byStatus: count(offers, (o) => H.offerStatus(o, now)) },
      messages: { total: msgCount, flagged: flaggedMsgs },
      attention: { jobsToReview: jobs.filter((j) => j.status === 'pending').length, hiddenJobs: jobs.filter((j) => j.status === 'hidden').length, openReports, flaggedMessages: flaggedMsgs },
      topPosters: [...rows.values()].sort((a, b) => b.applicants - a.applicants || b.jobs - a.jobs).slice(0, 10),
    });
  });

  // A live feed of what is happening across the platform: one line per event, newest first. No message text here.
  r.get('/admin/hiring/activity', ...admin, async (req, res) => {
    const limit = Math.min(100, Math.max(5, parseInt(String(req.query.limit || '40'), 10) || 40));
    const [jobs, apps, ints, docs, offers] = await Promise.all([
      Opportunity.find({}).sort({ createdAt: -1 }).limit(limit).select('title postedBy createdAt status sourceLabel organization').lean(),
      Application.find({}).sort({ updatedAt: -1 }).limit(limit).select('studentId opportunityId stageHistory').lean(),
      Interview.find({}).sort({ updatedAt: -1 }).limit(limit).select('studentId opportunityId title kind status createdAt updatedAt').lean(),
      DocumentRequest.find({}).sort({ updatedAt: -1 }).limit(limit).select('studentId opportunityId label status createdAt updatedAt').lean(),
      Offer.find({}).sort({ updatedAt: -1 }).limit(limit).select('studentId opportunityId positionTitle status createdAt updatedAt').lean(),
    ]);
    const userIds = new Set(), jobIds = new Set();
    [...jobs.map((j) => j.postedBy), ...apps.map((a) => a.studentId), ...ints.map((i) => i.studentId), ...docs.map((d) => d.studentId), ...offers.map((o) => o.studentId)].forEach((x) => userIds.add(idStr(x)));
    [...apps.map((a) => a.opportunityId), ...ints.map((i) => i.opportunityId), ...docs.map((d) => d.opportunityId), ...offers.map((o) => o.opportunityId)].forEach((x) => jobIds.add(idStr(x)));
    const names = new Map((await User.find({ _id: { $in: [...userIds] } }).select('displayName').lean()).map((u) => [idStr(u), u.displayName]));
    const titles = new Map((await Opportunity.find({ _id: { $in: [...jobIds] } }).select('title').lean()).map((o) => [idStr(o), o.title]));
    const ev = [];
    const add = (at, kind, who, text, jobId) => ev.push({ at, kind, who, text, jobId: jobId ? idStr(jobId) : undefined });
    for (const j of jobs) add(j.createdAt, 'job', names.get(idStr(j.postedBy)) || '', `posted "${j.title}" (${j.sourceLabel}${j.status === 'pending' ? ', waiting for review' : ''})`, j._id);
    for (const a of apps) for (const h of (a.stageHistory || []).slice(-3)) add(h.at, 'stage', names.get(idStr(a.studentId)) || '', h.stage === 'Applied' ? `applied to "${titles.get(idStr(a.opportunityId))}"` : `is now ${h.stage} for "${titles.get(idStr(a.opportunityId))}"`, a.opportunityId);
    for (const i of ints) add(i.updatedAt, 'interview', names.get(idStr(i.studentId)) || '', `interview "${i.title}" is ${i.status.replace('_', ' ')} (${titles.get(idStr(i.opportunityId))})`, i.opportunityId);
    for (const d of docs) add(d.updatedAt, 'document', names.get(idStr(d.studentId)) || '', `document "${d.label}" is ${d.status.replace('_', ' ')} (${titles.get(idStr(d.opportunityId))})`, d.opportunityId);
    for (const o of offers) add(o.updatedAt, 'offer', names.get(idStr(o.studentId)) || '', `offer "${o.positionTitle}" is ${o.status}`, o.opportunityId);
    ev.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    res.json({ events: ev.slice(0, limit) });
  });

  // One job, end to end: the post, its poster, and every applicant with where they stand.
  r.get('/admin/hiring/jobs/:id', ...admin, async (req, res) => {
    toObjectId(req.params.id);
    const job = await Opportunity.findById(req.params.id).lean();
    if (!job) throw notFound();
    const [poster, org, team, apps, saves, reports] = await Promise.all([
      User.findById(job.postedBy).select('displayName role department').lean(),
      job.organizationId ? Organization.findById(job.organizationId).select('name verificationStatus city').lean() : null,
      job.organizationId ? OrganizationMember.find({ organizationId: job.organizationId, status: 'active' }).populate('userId', 'displayName').lean() : [],
      Application.find({ opportunityId: job._id }).sort({ createdAt: 1 }).lean(),
      SavedJob.countDocuments({ opportunityId: job._id }),
      Report.countDocuments({ targetType: 'opportunity', targetId: job._id }),
    ]);
    const ids = apps.map((a) => a._id);
    const [ints, docs, offers, msgs, students] = await Promise.all([
      Interview.find({ applicationId: { $in: ids } }).lean(), DocumentRequest.find({ applicationId: { $in: ids } }).lean(), Offer.find({ applicationId: { $in: ids } }).lean(),
      AppMessage.find({ applicationId: { $in: ids } }).select('applicationId flags side').lean(),
      User.find({ _id: { $in: apps.map((a) => a.studentId) } }).select('displayName department').lean(),
    ]);
    const by = (rows) => { const m = new Map(); for (const x of rows) { const k = idStr(x.applicationId); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
    const bi = by(ints), bd = by(docs), bo = by(offers), bm = by(msgs);
    const sm = new Map(students.map((s) => [idStr(s), s]));
    res.json({
      job: { id: job._id, title: job.title, organization: job.organization, type: job.type, employmentType: job.employmentType, workplaceMode: job.workplaceMode, locationText: job.locationText, description: job.description, status: job.status, closed: !!job.closed, sourceLabel: job.sourceLabel, suspiciousFlags: job.suspiciousFlags || [], createdAt: job.createdAt, applicationDeadline: job.applicationDeadline, reportCount: reports, saved: saves },
      poster: { id: job.postedBy, name: (poster || {}).displayName || 'Deleted user', role: (poster || {}).role, company: org ? { name: org.name, verificationStatus: org.verificationStatus, city: org.city } : null, team: (team || []).map((m) => ({ name: m.userId && m.userId.displayName, membershipRole: m.membershipRole })) },
      funnel: H.funnel(count(apps, 'stage')), byStage: count(apps, 'stage'),
      applications: apps.map((a) => {
        const k = idStr(a), o = (bo.get(k) || [])[0], mm = bm.get(k) || [];
        return {
          id: a._id, name: (sm.get(idStr(a.studentId)) || {}).displayName || 'Deleted user', department: (sm.get(idStr(a.studentId)) || {}).department || '', stage: a.stage, appliedAt: a.createdAt, updatedAt: a.updatedAt,
          interviews: (bi.get(k) || []).map((i) => ({ title: i.title, round: i.round, kind: i.kind, status: i.status, startsAt: i.startsAt, result: i.result })),
          documents: (bd.get(k) || []).map((d) => ({ label: d.label, status: d.status })),
          offer: o ? { status: H.offerStatus(o), positionTitle: o.positionTitle } : null,
          messages: { total: mm.length, fromApplicant: mm.filter((m) => m.side === 'student').length, flagged: mm.filter((m) => (m.flags || []).length).length },
        };
      }),
    });
  });

  // One application, full timeline. Conversation text is included and every view is audited.
  r.get('/admin/hiring/applications/:id', ...admin, async (req, res) => {
    toObjectId(req.params.id);
    const app = await Application.findById(req.params.id).lean();
    if (!app) throw notFound();
    const [opp, student, ints, docs, offer, msgs] = await Promise.all([
      Opportunity.findById(app.opportunityId).lean(), User.findById(app.studentId).select('displayName department').lean(),
      Interview.find({ applicationId: app._id }).sort({ round: 1 }).lean(), DocumentRequest.find({ applicationId: app._id }).lean(), Offer.findOne({ applicationId: app._id }).lean(),
      AppMessage.find({ applicationId: app._id }).sort({ createdAt: 1 }).lean(),
    ]);
    await audit(req.user._id, 'admin_view_application_thread', 'application', app._id, { messages: msgs.length });
    res.json({
      application: { id: app._id, stage: app.stage, appliedAt: app.createdAt, sharedFields: (app.consentSnapshot || {}).sharedFields || [] },
      job: opp && { id: opp._id, title: opp.title, organization: opp.organization, sourceLabel: opp.sourceLabel },
      applicant: { name: (student || {}).displayName || 'Deleted user', department: (student || {}).department || '' },
      interviews: ints.map((i) => H.interviewView(i, 'poster')), documents: docs.map(H.docView), offer: H.offerView(offer),
      timeline: H.buildTimeline({ application: app, interviews: ints, documents: docs, offer, messages: msgs, includeMessages: true }),
      notice: 'Opening this conversation was recorded in the audit log.',
    });
  });

  return r;
};
