// The whole hiring process through the real API: an EMPLOYER posts a job (only employers can), students apply, interviews, papers, offer, messages,
// and the admin sees all of it. Also: a company with two recruiters sharing one job.
const request = require('supertest');
const { setup, teardown, bearer, mkUni, mkUser, models } = require('./helpers');

let app, edu, adm, poster, a1, a2, outsider, mentor, ownerEmp, recruiter, otherEmp, org;
const api = (m, url, who, body) => { const q = request(app)[m](`/api${url}`).set(bearer(who)); return body === undefined ? q : q.send(body); };
const hrs = (h) => new Date(Date.now() + h * 36e5).toISOString();
const jobBody = (extra = {}) => ({ title: 'Math tutor for HSC student', description: 'Teach HSC higher math two evenings a week near campus. Pay is per month.', noFeeConfirmed: true, ...extra });
async function applyTo(jobId, who, fields = ['name', 'cv']) {
  const cv = (await api('post', '/me/cv', who, { data: { summary: `CV of ${who}` } })).body.cv;
  return api('post', `/opportunities/${jobId}/apply`, who, { cvVersionId: cv._id, consent: true, sharedFields: fields });
}
async function approvedJobBy(who, extra) {
  const j = (await api('post', '/employer/jobs', who, jobBody(extra))).body.job;
  if (j.status !== 'approved') await api('post', `/admin/opportunities/${j._id}/review`, 'adm', { decision: 'approve' }); // a company's first post waits for the admin
  return j;
}

beforeAll(async () => {
  app = await setup();
  edu = await mkUni('EDU', 'EDU', 'Chattogram', 91.83, 22.35);
  adm = await mkUser('adm', 'admin', null);
  for (const s of ['a1', 'a2', 'outsider']) await mkUser(s, 'student', edu);
  await mkUser('unverified', 'student', edu, { verificationStatus: 'pending' });
  mentor = await mkUser('mnt', 'mentor', edu);
  ownerEmp = await mkUser('emp1', 'employer', edu);
  recruiter = await mkUser('emp2', 'employer', edu);
  otherEmp = await mkUser('emp3', 'employer', edu);
  org = await models.Organization.create({ name: 'Acme Ltd', verificationStatus: 'verified', verificationEvidence: 'x' });
  await models.OrganizationMember.create({ organizationId: org._id, userId: ownerEmp._id, membershipRole: 'owner', status: 'active' });
  await models.OrganizationMember.create({ organizationId: org._id, userId: recruiter._id, membershipRole: 'recruiter', status: 'active' });
  const org2 = await models.Organization.create({ name: 'Other Ltd', verificationStatus: 'verified', verificationEvidence: 'x' });
  await models.OrganizationMember.create({ organizationId: org2._id, userId: otherEmp._id, status: 'active' });
});
afterAll(teardown);

describe('ONLY an employer posts a job (and the first post of a company is reviewed first)', () => {
  test('students, mentors and admins cannot post; the old open route is gone', async () => {
    for (const who of ['a1', 'mnt', 'adm', 'emp1']) expect((await api('post', '/opportunities', who, jobBody())).status).toBe(404);
    for (const who of ['a1', 'mnt', 'adm']) expect((await api('post', '/employer/jobs', who, jobBody())).status).toBe(403);
  });
  test('employer rules: no-fee promise, scam words held, first post pending', async () => {
    expect((await api('post', '/employer/jobs', 'emp1', jobBody({ noFeeConfirmed: false }))).status).toBe(400);
    const clean = await api('post', '/employer/jobs', 'emp1', jobBody());
    expect(clean.status).toBe(201);
    expect(clean.body.job.status).toBe('pending'); // first post of the company
    expect(clean.body.job.sourceLabel).toBe('employer');
    const scam = await api('post', '/employer/jobs', 'emp1', jobBody({ title: 'Data entry', description: 'Pay a registration fee via bKash to confirm your seat today.' }));
    expect(scam.body.job.suspiciousFlags.length).toBeGreaterThan(0);
    expect((await api('get', '/opportunities', 'a1')).body.opportunities).toHaveLength(0); // nothing visible yet
  });
  test('the admin decision reaches the poster; the board then shows the job with the employer label', async () => {
    const mine = (await api('get', '/me/jobs', 'emp1')).body.jobs;
    const first = mine.find((j) => j.title === 'Math tutor for HSC student');
    expect((await api('post', `/admin/opportunities/${first.id}/review`, 'emp1', { decision: 'approve' })).status).toBe(403);
    await api('post', `/admin/opportunities/${first.id}/review`, 'adm', { decision: 'approve' });
    const note = await models.Notification.findOne({ userId: ownerEmp._id, title: /approved/ });
    expect(note).toBeTruthy();
    const board = (await api('get', '/opportunities', 'a1')).body.opportunities;
    expect(board).toHaveLength(1);
    expect(board[0].labels.source).toBe('employer');
    for (const j of mine.filter((j) => j.id !== first.id)) await api('post', `/admin/opportunities/${j.id}/review`, 'adm', { decision: 'remove' });
  });
});

describe('employer-run hiring from application to hire', () => {
  let job, app1, app2;
  beforeAll(async () => {
    job = (await models.Opportunity.findOne({ title: 'Math tutor for HSC student', status: 'approved' }));
  });

  test('applicants apply; the poster cannot apply to their own job; outsiders cannot see the pipeline', async () => {
    const own = await applyTo(job._id, 'emp1');
    expect(own.status).toBe(403);
    const r1 = await applyTo(job._id, 'a1'); const r2 = await applyTo(job._id, 'a2', ['cv']);
    expect(r1.status).toBe(201); app1 = r1.body.application.id; app2 = r2.body.application.id;
    expect((await api('get', `/jobs/${job._id}/pipeline`, 'outsider')).status).toBe(403); // a student has no employer tools
    expect((await api('get', `/jobs/${job._id}/pipeline`, 'a1')).status).toBe(403); // applicants never see other applicants
    const p = (await api('get', `/jobs/${job._id}/pipeline`, 'emp1')).body;
    expect(p.applicants).toHaveLength(2);
    const second = p.applicants.find((x) => x.id === app2);
    expect(second.name).toBeUndefined(); // a2 shared only the CV
    expect(second.cv).toBeDefined();
    expect(JSON.stringify(p)).not.toMatch(/firebaseUid|a2@t\.test/);
  });

  test('interviews: only after shortlisting; checks; double-booking; confirm / move / complete; private feedback', async () => {
    const body = { title: 'Trial class', kind: 'video', startsAt: hrs(48), meetingLink: 'https://meet.example/trial', durationMin: 30 };
    expect((await api('post', `/applications/${app1}/interviews`, 'emp1', body)).status).toBe(409); // still "Applied"
    expect((await api('patch', `/applications/${app1}/stage`, 'emp1', { stage: 'Shortlisted' })).status).toBe(200);
    expect((await api('post', `/applications/${app1}/interviews`, 'a1', body)).status).toBe(403); // the applicant cannot schedule their own interview
    expect((await api('post', `/applications/${app1}/interviews`, 'outsider', body)).status).toBe(404);
    expect((await api('post', `/applications/${app1}/interviews`, 'emp1', { ...body, meetingLink: 'http://plain.example' })).status).toBe(400);
    expect((await api('post', `/applications/${app1}/interviews`, 'emp1', { ...body, meetingLink: undefined })).status).toBe(400);
    expect((await api('post', `/applications/${app1}/interviews`, 'emp1', { ...body, startsAt: hrs(-3) })).status).toBe(400);
    const ok = await api('post', `/applications/${app1}/interviews`, 'emp1', body);
    expect(ok.status).toBe(201);
    expect(ok.body.stage).toBe('Interview'); // first interview moves the applicant forward by itself
    expect(ok.body.interview.round).toBe(1);
    const iv = ok.body.interview.id;
    // the same student cannot be booked twice at the same time (here: a mentor posts another job, shortlists a1, and tries the same slot)
    const other = await approvedJobBy('emp3', { title: 'Weekend reviewer' });
    await applyTo(other._id, 'a1');
    const otherApp = (await models.Application.findOne({ opportunityId: other._id }))._id;
    await api('patch', `/applications/${otherApp}/stage`, 'emp3', { stage: 'Shortlisted' });
    const clash = await api('post', `/applications/${otherApp}/interviews`, 'emp3', { ...body, title: 'Clash', startsAt: hrs(48.2) });
    expect(clash.status).toBe(409); expect(clash.body.error.code).toBe('APPLICANT_BUSY');
    // the student answers
    expect((await api('post', `/interviews/${iv}/respond`, 'emp1', { response: 'accept' })).status).toBe(403);
    const mv = await api('post', `/interviews/${iv}/respond`, 'a1', { response: 'reschedule', note: 'Exam that day', proposedStartsAt: hrs(72) });
    expect(mv.body.interview.status).toBe('reschedule_requested');
    expect((await api('post', `/interviews/${iv}/respond`, 'a1', { response: 'accept' })).status).toBe(409); // nothing to confirm while a move is pending
    const re = await api('patch', `/interviews/${iv}`, 'emp1', { action: 'reschedule', startsAt: hrs(72) });
    expect(re.body.interview.status).toBe('scheduled');
    expect((await api('post', `/interviews/${iv}/respond`, 'a1', { response: 'accept' })).body.interview.status).toBe('confirmed');
    // completing needs the start time to have passed (unless DEMO_MODE)
    expect((await api('patch', `/interviews/${iv}`, 'emp1', { action: 'complete', result: 'passed' })).status).toBe(409);
    await models.Interview.updateOne({ _id: iv }, { startsAt: new Date(Date.now() - 36e5) });
    expect((await api('patch', `/interviews/${iv}`, 'emp1', { action: 'complete' })).status).toBe(400); // result required
    const done = await api('patch', `/interviews/${iv}`, 'emp1', { action: 'complete', result: 'passed', feedback: 'Explains clearly' });
    expect(done.body.interview.status).toBe('completed');
    const seen = (await api('get', `/applications/${app1}/workspace`, 'a1')).body;
    expect(seen.interviews[0].feedback).toBeUndefined(); // private
    expect(seen.interviews[0].result).toBe('passed');
    expect((await api('get', `/applications/${app1}/workspace`, 'emp1')).body.interviews[0].feedback).toBe('Explains clearly');
  });

  test('papers: request, send, ask for a fix, send again, accept; money requests are refused', async () => {
    expect((await api('post', `/applications/${app1}/documents`, 'emp1', { docType: 'other', label: 'Send 500 taka registration fee via bKash' })).status).toBe(400);
    const rq = await api('post', `/applications/${app1}/documents`, 'emp1', { docType: 'transcript', dueAt: hrs(72) });
    expect(rq.status).toBe(201); expect(rq.body.document.label).toBe('Academic transcript');
    const id = rq.body.document.id;
    expect((await api('post', `/documents/${id}/review`, 'emp1', { decision: 'accepted' })).status).toBe(409); // nothing sent yet
    expect((await api('post', `/documents/${id}/submit`, 'emp1', { text: 'x' })).status).toBe(403);
    expect((await api('post', `/documents/${id}/submit`, 'a1', {})).status).toBe(400);
    expect((await api('post', `/documents/${id}/submit`, 'a1', { link: 'http://drive.example/x' })).status).toBe(400);
    expect((await api('post', `/documents/${id}/submit`, 'a1', { link: 'https://drive.example/transcript' })).body.document.status).toBe('submitted');
    expect((await api('post', `/documents/${id}/review`, 'emp1', { decision: 'needs_fix' })).status).toBe(400); // must say what to fix
    expect((await api('post', `/documents/${id}/review`, 'emp1', { decision: 'needs_fix', note: 'Page 2 is missing' })).body.document.status).toBe('needs_fix');
    expect((await api('post', `/documents/${id}/submit`, 'a1', { link: 'https://drive.example/transcript-full' })).body.document.status).toBe('submitted');
    expect((await api('post', `/documents/${id}/review`, 'emp1', { decision: 'accepted' })).body.document.status).toBe('accepted');
    expect((await api('post', `/documents/${id}/submit`, 'a1', { text: 'again' })).status).toBe(409);
  });

  test('messages: both sides, unread count, scam words are flagged, outsiders see nothing, admin reads but cannot write', async () => {
    expect((await api('post', `/applications/${app1}/messages`, 'outsider', { body: 'hi' })).status).toBe(404);
    await api('post', `/applications/${app1}/messages`, 'emp1', { body: 'Welcome. Can you start next week?' });
    const inbox = (await api('get', '/me/hiring/inbox', 'a1')).body;
    expect(inbox.applicant.unreadMessages).toBe(1);
    const read = (await api('get', `/applications/${app1}/messages`, 'a1')).body;
    expect(read.messages[0].mine).toBe(false);
    expect((await api('get', '/me/hiring/inbox', 'a1')).body.applicant.unreadMessages).toBe(0); // reading clears it
    const reply = await api('post', `/applications/${app1}/messages`, 'a1', { body: 'Yes, I can.' });
    expect(reply.status).toBe(201);
    const bad = await api('post', `/applications/${app1}/messages`, 'emp1', { body: 'Please send the joining fee by bKash first' });
    expect(bad.body.message.flags.length).toBeGreaterThan(0);
    expect((await api('get', `/applications/${app1}/messages`, 'a1')).body.messages.at(-1).flags.length).toBeGreaterThan(0); // the applicant sees the warning flag
    const adminView = await api('get', `/applications/${app1}/messages`, 'adm');
    expect(adminView.body.messages).toHaveLength(3);
    expect((await api('post', `/applications/${app1}/messages`, 'adm', { body: 'hello' })).status).toBe(403);
    expect(await models.AuditLog.countDocuments({ action: 'admin_view_messages' })).toBe(1);
  });

  test('offer: sent after the interview, answered by the student, hired; expiry and withdrawal work', async () => {
    expect((await api('post', `/applications/${app2}/offer`, 'emp1', {})).status).toBe(409); // a2 is still "Applied"
    const of = await api('post', `/applications/${app1}/offer`, 'emp1', { salaryText: 'BDT 6,000 per month', startDate: hrs(24 * 14), expiresAt: hrs(24 * 5), terms: 'Two evenings a week.' });
    expect(of.status).toBe(201); expect(of.body.stage).toBe('Offer'); expect(of.body.offer.positionTitle).toBe('Math tutor for HSC student');
    expect((await api('post', `/applications/${app1}/offer`, 'emp1', {})).status).toBe(409); // one offer per application
    const seen = (await api('get', `/applications/${app1}/workspace`, 'a1')).body;
    expect(seen.application.studentSees).toBe('Selected'); expect(seen.offer.status).toBe('sent');
    expect((await api('post', `/offers/${of.body.offer.id}/respond`, 'emp1', { decision: 'accept' })).status).toBe(403);
    const ok = await api('post', `/offers/${of.body.offer.id}/respond`, 'a1', { decision: 'accept' });
    expect(ok.body.stage).toBe('Hired'); expect(ok.body.offer.status).toBe('accepted');
    expect((await api('post', `/offers/${of.body.offer.id}/respond`, 'a1', { decision: 'decline' })).status).toBe(409);
    const hist = (await models.Application.findById(app1)).stageHistory.map((h) => h.stage);
    expect(hist).toEqual(['Applied', 'Shortlisted', 'Interview', 'Offer', 'Hired']);
  });

  test('offer that runs out of time cannot be accepted; a withdrawn offer closes the application', async () => {
    const pass = await models.Application.findById(app2);
    pass.stage = 'Interview'; pass.stageHistory.push({ stage: 'Interview' }); await pass.save();
    const of = await api('post', `/applications/${app2}/offer`, 'emp1', { expiresAt: hrs(24) });
    await models.Offer.updateOne({ _id: of.body.offer.id }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await api('post', `/offers/${of.body.offer.id}/respond`, 'a2', { decision: 'accept' })).status).toBe(409);
    expect((await api('get', `/applications/${app2}/workspace`, 'a2')).body.offer.status).toBe('expired');
    await models.Offer.updateOne({ _id: of.body.offer.id }, { expiresAt: new Date(Date.now() + 864e5) });
    const w = await api('post', `/offers/${of.body.offer.id}/withdraw`, 'emp1');
    expect(w.body.stage).toBe('Rejected');
    expect((await api('post', `/applications/${app2}/messages`, 'a2', { body: 'why?' })).status).toBe(409); // closed
  });
});

describe('a company team: two recruiters share one job, another company sees nothing', () => {
  let jobId, appId;
  test('both recruiters run the same applicant; the other company gets 404', async () => {
    const j = await api('post', '/employer/jobs', 'emp1', { title: 'QA Engineer', description: 'Write test cases and report bugs with a friendly team.', noFeeConfirmed: true });
    jobId = j.body.job._id;
    await api('post', `/admin/opportunities/${jobId}/review`, 'adm', { decision: 'approve' });
    appId = (await applyTo(jobId, 'a1')).body.application.id;
    const forSecond = (await api('get', `/jobs/${jobId}/pipeline`, 'emp2')).body;
    expect(forSecond.applicants).toHaveLength(1); // the second recruiter sees the first recruiter's job
    expect((await api('get', `/jobs/${jobId}/pipeline`, 'emp3')).status).toBe(404);
    expect((await api('get', `/applications/${appId}/workspace`, 'emp3')).status).toBe(404);
    expect((await api('patch', `/applications/${appId}/stage`, 'emp2', { stage: 'Shortlisted' })).status).toBe(200);
    expect((await api('post', `/applications/${appId}/messages`, 'emp2', { body: 'Hello from HR' })).status).toBe(201);
    expect((await api('get', `/applications/${appId}/messages`, 'emp1')).body.messages).toHaveLength(1);
    const mine = (await api('get', '/me/jobs', 'emp2')).body.jobs;
    expect(mine.map((x) => x.title)).toContain('QA Engineer');
  });
  test('both recruiters are told when someone applies', async () => {
    const n = await models.Notification.find({ kind: 'application', title: 'New application', body: 'QA Engineer' }).lean();
    expect(n.map((x) => String(x.userId)).sort()).toEqual([String(ownerEmp._id), String(recruiter._id)].sort());
  });
});

describe('inbox for both sides', () => {
  test('poster inbox lists what needs attention; applicant inbox lists what is waiting', async () => {
    const qa = await models.Opportunity.findOne({ title: 'QA Engineer' });
    const qaApp = await models.Application.findOne({ opportunityId: qa._id });
    expect((await api('post', `/applications/${qaApp._id}/documents`, 'emp1', { docType: 'cv_update' })).status).toBe(201);
    const mineApplicant = (await api('get', '/me/hiring/inbox', 'a1')).body;
    expect(mineApplicant.applicant.documents.length).toBe(1);
    const poster = (await api('get', '/me/hiring/inbox', 'emp1')).body;
    expect(poster.poster).toBeTruthy();
    expect(poster.applicant).toBeNull(); // the poster applied nowhere
    expect((await api('get', '/me/hiring/inbox', 'outsider')).body).toEqual({ applicant: null, poster: null });
  });
});

describe('the admin sees the whole process', () => {
  test('only an admin; overview, activity feed, one job end to end, one application with its thread', async () => {
    expect((await api('get', '/admin/hiring/overview', 'emp1')).status).toBe(403);
    const o = (await api('get', '/admin/hiring/overview', 'adm')).body;
    expect(o.jobs.bySource.student).toBeGreaterThan(0);
    expect(o.jobs.bySource.employer).toBe(1);
    expect(o.applications.funnel[0].step).toBe('Applied');
    expect(o.offers.total).toBe(2);
    expect(o.messages.flagged).toBe(1);
    expect(o.topPosters.length).toBeGreaterThan(0);
    const feed = (await api('get', '/admin/hiring/activity', 'adm')).body.events;
    expect(feed.length).toBeGreaterThan(5);
    expect(JSON.stringify(feed)).not.toMatch(/Can you start next week/); // the feed never shows message text
    const job = (await models.Opportunity.findOne({ title: 'Math tutor for HSC student', status: 'approved' }));
    const p = (await api('get', `/admin/hiring/jobs/${job._id}`, 'adm')).body;
    expect(p.poster.role).toBe('student');
    expect(p.applications).toHaveLength(2);
    const hired = p.applications.find((a) => a.stage === 'Hired');
    expect(hired.interviews[0].status).toBe('completed'); expect(hired.documents[0].status).toBe('accepted'); expect(hired.offer.status).toBe('accepted');
    expect(hired.messages.flagged).toBe(1);
    expect(JSON.stringify(p)).not.toMatch(/CV of/); // no CV content for the admin
    const company = (await models.Opportunity.findOne({ title: 'QA Engineer' }));
    const cp = (await api('get', `/admin/hiring/jobs/${company._id}`, 'adm')).body;
    expect(cp.poster.company.name).toBe('Acme Ltd'); expect(cp.poster.team.map((t) => t.name).length).toBe(2);
    const t = (await api('get', `/admin/hiring/applications/${hired.id}`, 'adm')).body;
    expect(t.timeline[0].type).toBe('applied');
    expect(t.timeline.map((e) => e.type)).toEqual(expect.arrayContaining(['stage', 'interview', 'document', 'offer', 'message']));
    expect(JSON.stringify(t.timeline)).toMatch(/Welcome\. Can you start/);
    expect(await models.AuditLog.countDocuments({ action: 'admin_view_application_thread' })).toBe(1);
  });
});
