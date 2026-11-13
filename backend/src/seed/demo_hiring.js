// DEMO: the whole hiring world, so every screen has something real to show.
//   * Several employer accounts, each at their own verified company (one company has TWO recruiters).
//   * Jobs posted ONLY by employers (each at their own verified company). Students, mentors and admins cannot post jobs.
//   * Applicants at every stage with interviews, papers (documents), offers and chat messages, plus a pending-review example.
// Every person and company is invented, every job title ends with "(Demo)", no listing asks for a fee.
// Idempotent: a job, application or account is only created when it does not exist yet. Needs the base demo seed first.
const { User, Organization, OrganizationMember, Opportunity, Application, CvVersion, Interview, AppMessage, DocumentRequest, Offer, Report, Notification } = require('../models');
const { normalizeCv } = require('../services/cv');
const { scamFlags } = require('../services/scam');
const { UNI } = require('./demo_more');

const PW = 'Demo@12345';
const NOFEE = ' No fee is ever asked from applicants.';
const H = 36e5, D = 864e5;
const ago = (days) => new Date(Date.now() - days * D);   // days in the past
const ahead = (hours) => new Date(Date.now() + hours * H); // hours in the future
const sk = (...a) => a.map(([skillKey, requiredLevel, weight]) => ({ skillKey, requiredLevel, weight }));

// ---- people ---------------------------------------------------------------------------------------------------------
// email, name, company, owner? (false = recruiter in an existing company)
const EMPLOYERS = [
  ['employer.hr@demo.mentorlink.bd', 'Rafiq Ahmed (Recruiter)', 'Demo Tech Ltd', false],
  ['employer2@demo.mentorlink.bd', 'Nusrat Karim (HR)', 'Demo Bay Analytics Ltd', true],
  ['employer3@demo.mentorlink.bd', 'Imran Chowdhury (HR)', 'Demo Karnaphuli Textiles Ltd', true],
  ['employer4@demo.mentorlink.bd', 'Tahmina Haque (HR)', 'Demo Shikhon Learning Hub', true],
];
const COMPANIES = {
  'Demo Bay Analytics Ltd': { website: 'https://bay-analytics.example', industry: 'Data & Analytics', city: 'Chattogram', publicDescription: 'Demo company: dashboards and reports for local retailers.', workEmail: 'hr@bay-analytics.example' },
  'Demo Karnaphuli Textiles Ltd': { website: 'https://karnaphuli-textiles.example', industry: 'Textiles', city: 'Chattogram', publicDescription: 'Demo company: knit garments for export.', workEmail: 'hr@karnaphuli-textiles.example' },
  'Demo Shikhon Learning Hub': { website: 'https://shikhon-hub.example', industry: 'Education', city: 'Dhaka', publicDescription: 'Demo company: English and skills courses for students.', workEmail: 'hr@shikhon-hub.example' },
};
const E = (n) => `employer${n === 1 ? '' : n}@demo.mentorlink.bd`;
const S = { robiul: 'student.edu', su: 'student.su', nusrat: 'student.du', tanvir: 'student.buet', farhana: 'student.nsu', rakib: 'student.bracu', sadia: 'student.cuet', mahmud: 'student2.edu', anika: 'student2.su', imran: 'student2.du', jannat: 'student2.nsu', shakib: 'student2.bracu' };
const mail = (k) => `${S[k]}@demo.mentorlink.bd`;

// ---- jobs -----------------------------------------------------------------------------------------------------------
// poster email, company (or null), title, organization label, type, employment type, mode, place, description, skills, deadline in days, status, source
const JOBS = [
  // Demo Tech Ltd: owner + recruiter
  [E(1), 'Demo Tech Ltd', 'Technical Support Engineer (Demo)', null, 'job', 'full_time', 'onsite', 'Chattogram', 'Help customers of our web product, reproduce issues and write clear bug reports for the developers.', sk(['communication', 2, 3], ['testing', 1, 2], ['networking', 1, 1]), 20, 'approved', 'employer', 'employer.hr'],
  // Bay Analytics
  [E(2), 'Demo Bay Analytics Ltd', 'Business Intelligence Analyst (Demo)', null, 'job', 'full_time', 'hybrid', 'Chattogram', 'Turn sales data into weekly dashboards, answer questions from retail managers and keep the SQL queries tidy.', sk(['sql', 2, 3], ['excel', 2, 2], ['dashboard', 2, 2], ['communication', 2, 1]), 24, 'approved', 'employer'],
  [E(2), 'Demo Bay Analytics Ltd', 'Analytics Intern (Demo)', null, 'internship', 'internship', 'hybrid', 'Chattogram', 'Three months: clean datasets, build one dashboard and present it to the team.', sk(['excel', 2, 3], ['sql', 1, 2], ['statistics', 1, 1]), 18, 'approved', 'employer'],
  [E(2), 'Demo Bay Analytics Ltd', 'Data Entry Operator (Demo)', null, 'job', 'part_time', 'onsite', 'Chattogram', 'Enter and check daily sales sheets; accuracy matters more than speed.', sk(['excel', 2, 3], ['communication', 1, 1]), 12, 'approved', 'employer'],
  // Karnaphuli Textiles
  [E(3), 'Demo Karnaphuli Textiles Ltd', 'Accounts Executive (Demo)', null, 'job', 'full_time', 'onsite', 'Chattogram', 'Daily vouchers, supplier payments and month-end reconciliations for a garment factory.', sk(['accounting', 2, 3], ['excel', 2, 2], ['communication', 1, 1]), 22, 'approved', 'employer'],
  [E(3), 'Demo Karnaphuli Textiles Ltd', 'Merchandiser Trainee (Demo)', null, 'job', 'full_time', 'onsite', 'Chattogram', 'Follow orders from sampling to shipment with a senior merchandiser.', sk(['communication', 2, 3], ['excel', 2, 2], ['leadership', 1, 1]), 26, 'approved', 'employer'],
  [E(3), 'Demo Karnaphuli Textiles Ltd', 'Textile Quality Inspector (Demo)', null, 'job', 'full_time', 'onsite', 'Chattogram', 'New listing waiting in the admin review queue: this company has no approved post yet.', sk(['communication', 1, 2]), 30, 'pending', 'employer'],
  // Shikhon Learning Hub
  [E(4), 'Demo Shikhon Learning Hub', 'Spoken English Instructor (Demo)', null, 'job', 'part_time', 'hybrid', 'Dhaka', 'Teach evening spoken-English batches of fifteen learners, online and in class.', sk(['ielts', 2, 3], ['communication', 3, 2]), 28, 'approved', 'employer'],
  [E(4), 'Demo Shikhon Learning Hub', 'Student Success Officer (Demo)', null, 'job', 'full_time', 'onsite', 'Dhaka', 'Call learners who fall behind, record their reasons and help them catch up.', sk(['communication', 2, 3], ['excel', 1, 1]), 21, 'approved', 'employer'],
];

// ---- applicants -----------------------------------------------------------------------------------------------------
// Each row is one application and its story. Times are "days ago" (d) or "hours ahead" (h).
//   job title, applicant key, shared fields, note, stage, then the list of things that happened.
// interviews: [title, kind, status, startsAt, extra]
// docs: [docType, label, status, extra]
// offer: [status, extra]
// chat: [[side, text, daysAgo]...]
const V = 'https://meet.example/demo-';
const APPS = [
  // ---- Frontend Developer (Demo) @ Demo Tech Ltd: one full success story, one rejection, one waiting
  { job: 'Frontend Developer (Demo)', who: 'tanvir', note: 'I built two responsive sites with plain CSS and a small React app.', stage: 'Hired', applied: 14,
    history: [['Under Review', 13], ['Shortlisted', 11]],
    interviews: [
      ['HR screening', 'phone', 'completed', ago(9), { result: 'passed', feedback: 'Friendly, clear goals.', durationMin: 20, notes: 'We will call the number on your CV.' }],
      ['Technical round', 'video', 'completed', ago(6), { result: 'passed', feedback: 'Strong CSS, needs more testing habits.', feedbackShared: true, meetingLink: `${V}tech-1`, durationMin: 60, notes: 'Share your screen and be ready to build a small page.' }],
    ],
    docs: [['transcript', 'Academic transcript', 'accepted', { submitted: 5, reviewed: 4, link: 'https://drive.example/tanvir-transcript' }], ['reference_letter', 'Reference letter from a teacher', 'accepted', { submitted: 3, reviewed: 3, text: 'Letter from Prof. Karim attached as a link in the next message.' }]],
    offer: ['accepted', { created: 3, responded: 2, salaryText: 'BDT 28,000 per month', terms: 'Three-month probation. Hybrid: three days in the office.' }],
    chat: [['poster', 'Welcome Tanvir! Your technical round went well. Can you send your transcript?', 6], ['student', 'Thank you. I sent the transcript just now.', 5], ['poster', 'Received. We are preparing an offer.', 4], ['student', 'Great, I am excited to join.', 2]] },
  { job: 'Frontend Developer (Demo)', who: 'sadia', note: 'Final-year CSE; comfortable with JavaScript and Git.', stage: 'Interview', applied: 8,
    history: [['Shortlisted', 6]],
    interviews: [['Phone screening', 'phone', 'completed', ago(4), { result: 'passed', feedback: 'Good communication.', durationMin: 20 }], ['Technical round', 'video', 'confirmed', ahead(30), { meetingLink: `${V}tech-2`, durationMin: 60, notes: 'Bring one project to walk us through.' }]],
    docs: [['portfolio', 'Portfolio or project link', 'submitted', { submitted: 1, link: 'https://github.example/sadia/portfolio' }]],
    chat: [['poster', 'Thanks for the phone screen. Please send your portfolio before the technical round.', 3], ['student', 'Sent the link just now!', 1]] },
  { job: 'Frontend Developer (Demo)', who: 'rakib', note: 'Learning React; happy to start as a junior.', stage: 'Shortlisted', applied: 5,
    history: [['Shortlisted', 2]],
    interviews: [['First interview', 'video', 'scheduled', ahead(52), { meetingLink: `${V}first-3`, durationMin: 30, notes: 'Please confirm the slot in the app.' }]] },
  { job: 'Frontend Developer (Demo)', who: 'mahmud', note: 'BBA student moving into web work.', stage: 'Rejected', applied: 12,
    history: [['Shortlisted', 10], ['Interview', 8], ['Rejected', 5, 'Thank you for your time. We moved forward with candidates with more coding practice.']],
    interviews: [['Technical round', 'video', 'completed', ago(7), { result: 'not_passed', feedback: 'Needs more HTML/CSS practice before a developer role.', meetingLink: `${V}tech-4`, durationMin: 45 }]],
    chat: [['poster', 'Thank you for interviewing. We will keep your CV for a future junior opening.', 5]] },
  { job: 'Frontend Developer (Demo)', who: 'jannat', note: 'I can start in two weeks.', stage: 'Applied', applied: 1 },

  // ---- QA Engineer (Demo) @ Demo Tech Ltd
  { job: 'QA Engineer (Demo)', who: 'rakib', note: 'I wrote test cases for my class project.', stage: 'Offer', applied: 9,
    history: [['Shortlisted', 7], ['Interview', 6], ['Offer', 1]],
    interviews: [['QA interview', 'onsite', 'completed', ago(3), { result: 'passed', feedback: 'Careful and curious.', placeText: 'Demo Tech Ltd, 2nd floor, Room 4', durationMin: 45, notes: 'Bring your laptop and a printed CV.' }]],
    docs: [['national_id', 'National ID (copy or number)', 'accepted', { submitted: 2, reviewed: 2, text: 'ID number sent in the message instead.' }]],
    offer: ['sent', { created: 1, expiresAt: ahead(96), salaryText: 'BDT 24,000 per month', employmentType: 'full_time', terms: 'Start on the first of next month. Three-month probation.' }],
    chat: [['poster', 'Congratulations Rakib! The offer is in the app. Please answer within four days.', 1]] },
  { job: 'QA Engineer (Demo)', who: 'jannat', note: 'Available for evening shifts.', stage: 'Interview', applied: 6,
    history: [['Shortlisted', 4], ['Interview', 3]],
    interviews: [['QA interview', 'video', 'reschedule_requested', ahead(26), { meetingLink: `${V}qa-5`, durationMin: 30, studentNote: 'I have a university exam that afternoon. Could we do the evening?', proposedStartsAt: ahead(50) }]],
    chat: [['student', 'Sir, may I move the interview to the evening?', 0.3]] },
  { job: 'QA Engineer (Demo)', who: 'shakib', note: 'Interested, but I took another job.', stage: 'Withdrawn', applied: 8, history: [['Withdrawn', 6, 'I accepted another offer.']] },

  // ---- Business Intelligence Analyst (Demo) @ Bay Analytics (Robiul has a live application here)
  { job: 'Business Intelligence Analyst (Demo)', who: 'robiul', note: 'I built a sales dashboard for my university project and I am practising SQL daily.', stage: 'Interview', applied: 6,
    history: [['Shortlisted', 4], ['Interview', 1]],
    interviews: [['Analyst interview', 'video', 'scheduled', ahead(40), { meetingLink: `${V}bi-6`, durationMin: 45, notes: 'Be ready to explain one SQL query you wrote. Please confirm this time in the app.' }]],
    docs: [['portfolio', 'Portfolio or project link', 'requested', { due: ahead(72), note: 'A link to your dashboard project is enough.' }]],
    chat: [['poster', 'Hello Robiul, we liked your dashboard project. I scheduled an interview and added a document request. Let me know if the time works.', 1]] },
  { job: 'Business Intelligence Analyst (Demo)', who: 'imran', note: 'Statistics student with Python and SQL.', stage: 'Withdrawn', applied: 16,
    history: [['Shortlisted', 14], ['Interview', 12], ['Offer', 8], ['Withdrawn', 6, 'The applicant declined the offer.']],
    interviews: [['Analyst interview', 'video', 'completed', ago(10), { result: 'passed', feedback: 'Excellent statistics.', meetingLink: `${V}bi-7`, durationMin: 45 }]],
    offer: ['declined', { created: 8, responded: 6, salaryText: 'BDT 30,000 per month', declineReason: 'I received an offer for a research position abroad.' }],
    chat: [['poster', 'We would love to have you. The offer is in the app.', 8], ['student', 'Thank you very much, I have to decline: I got a research position.', 6], ['poster', 'Understood, and congratulations!', 6]] },
  { job: 'Business Intelligence Analyst (Demo)', who: 'jannat', note: 'Excel and dashboards are my favourites.', stage: 'Shortlisted', applied: 4, history: [['Under Review', 3], ['Shortlisted', 2]] },
  { job: 'Analytics Intern (Demo)', who: 'nusrat', note: 'I can work three days a week.', stage: 'Hired', applied: 20,
    history: [['Shortlisted', 18], ['Interview', 16], ['Offer', 12], ['Hired', 10]],
    interviews: [['Intern interview', 'phone', 'completed', ago(15), { result: 'passed', feedback: 'Strong with Excel.', durationMin: 20 }]],
    docs: [['transcript', 'Academic transcript', 'accepted', { submitted: 14, reviewed: 13, link: 'https://drive.example/nusrat-transcript' }]],
    offer: ['accepted', { created: 12, responded: 10, salaryText: 'BDT 8,000 stipend per month', employmentType: 'internship', terms: 'Three months, three days a week.' }],
    chat: [['poster', 'Welcome to the team Nusrat!', 10]] },
  { job: 'Analytics Intern (Demo)', who: 'imran', note: 'Happy to learn dashboards.', stage: 'Applied', applied: 3 },
  { job: 'Analytics Intern (Demo)', who: 'jannat', note: 'Beginner in SQL, strong in Excel.', stage: 'Rejected', applied: 9, history: [['Under Review', 8], ['Rejected', 6, 'The internship was filled. Please apply again next term.']] },
  { job: 'Data Entry Operator (Demo)', who: 'shakib', note: 'Careful and fast with spreadsheets.', stage: 'Under Review', applied: 2, history: [['Under Review', 1]] },

  // ---- Karnaphuli Textiles
  { job: 'Accounts Executive (Demo)', who: 'farhana', note: 'BBA with accounting coursework and a banking internship.', stage: 'Interview', applied: 7,
    history: [['Shortlisted', 5], ['Interview', 3]],
    interviews: [['Accounts interview', 'onsite', 'confirmed', ahead(20), { placeText: 'Karnaphuli Textiles head office, Reception', durationMin: 40, notes: 'Bring your original certificates; we only look at them, we do not keep them.' }]],
    docs: [['certificate', 'Certificate (accounting course)', 'needs_fix', { submitted: 2, reviewed: 1, link: 'https://drive.example/farhana-cert-blurry', reviewNote: 'The scan is too blurry to read. Please send a clearer copy.' }]],
    chat: [['poster', 'Please send a clearer scan of your certificate.', 1], ['student', 'Of course, I will re-scan it tonight.', 0.5]] },
  { job: 'Accounts Executive (Demo)', who: 'shakib', note: 'Banking trainee goal, strong in Excel.', stage: 'Applied', applied: 2,
    chat: [['poster', 'Send the registration fee by bKash first to get your login.', 4], ['student', 'I will not pay to get a job. I am reporting this.', 4]] }, // moderation example: a message that asks for money is flagged automatically
  { job: 'Accounts Executive (Demo)', who: 'mahmud', note: 'Learning accounting basics.', stage: 'Under Review', applied: 4, history: [['Under Review', 3]] },
  { job: 'Merchandiser Trainee (Demo)', who: 'mahmud', note: 'Leadership role in the business club.', stage: 'Shortlisted', applied: 6, history: [['Shortlisted', 3]],
    docs: [['national_id', 'National ID (copy or number)', 'accepted', { submitted: 2, reviewed: 2, text: 'ID shared in the verification call.' }], ['cover_letter', 'Short cover letter', 'requested', { due: ahead(48) }]] },

  // ---- Shikhon Learning Hub
  { job: 'Spoken English Instructor (Demo)', who: 'anika', note: 'English honours student with IELTS 7.5.', stage: 'Hired', applied: 15,
    history: [['Shortlisted', 13], ['Interview', 11], ['Offer', 7], ['Hired', 5]],
    interviews: [['Demo class', 'video', 'completed', ago(10), { result: 'passed', feedback: 'Learners will enjoy her class.', feedbackShared: true, meetingLink: `${V}eng-8`, durationMin: 40 }]],
    docs: [['reference_letter', 'Joining paper: reference letter', 'requested', { due: ahead(120), note: 'Needed before your first class.' }]],
    offer: ['accepted', { created: 7, responded: 5, salaryText: 'BDT 450 per class hour', employmentType: 'part_time', terms: 'Evening batches, Sunday to Thursday.' }],
    chat: [['poster', 'Welcome aboard Anika. Please send the reference letter before your first class.', 5]] },
  { job: 'Student Success Officer (Demo)', who: 'su', note: 'Good with people and records.', stage: 'Applied', applied: 2 },

];

// ---- helpers --------------------------------------------------------------------------------------------------------
async function ensureFirebase(auth, email, name) {
  try { const u = await auth.getUserByEmail(email); await auth.updateUser(u.uid, { password: PW, displayName: name, emailVerified: true }); return u.uid; }
  catch (e) { if (e.code !== 'auth/user-not-found') throw e; return (await auth.createUser({ email, password: PW, displayName: name, emailVerified: true })).uid; }
}

function cvFor(user, profileHint) {
  return normalizeCv({
    v: 2, template: 'classic', fullName: user.displayName, headline: `${user.department || 'Student'} student`, contact: { city: 'Bangladesh' },
    summary: `${user.department || 'University'} student looking for ${profileHint || 'a first role'}. Reliable, quick to learn and used to team projects.`,
    skills: [{ label: 'Skills', items: ['Excel', 'Communication', 'Teamwork'] }],
    education: [{ degree: `BSc/BBA in ${user.department || 'my field'}`, institution: 'Bangladeshi university', period: 'Ongoing', note: '' }],
  }, user);
}

async function seedHiringDemo({ auth }) {
  const adm = await User.findOne({ email: 'admin@demo.mentorlink.bd' });
  const base = await User.findOne({ email: 'employer@demo.mentorlink.bd' });
  if (!adm || !base) return { skipped: 'base demo accounts missing' };
  const out = { employers: 0, jobs: 0, applications: 0, interviews: 0, documents: 0, offers: 0, messages: 0 };

  // employers and their companies
  const people = new Map([[base.email, base]]);
  for (const [email, name, company, owner] of EMPLOYERS) {
    const uid = await ensureFirebase(auth, email, name);
    const u = await User.findOneAndUpdate({ firebaseUid: uid }, { $set: { firebaseUid: uid, email, displayName: name, role: 'employer', verificationStatus: 'verified', showInDirectory: false, isDemo: true, language: 'en' } }, { upsert: true, returnDocument: 'after' });
    people.set(email, u); out.employers++;
    let org = await Organization.findOne({ name: company });
    if (!org) org = await Organization.create({ name: company, ...COMPANIES[company], verificationStatus: 'verified', verificationEvidence: 'Demo seed', reviewedBy: adm._id, reviewedAt: new Date() });
    await OrganizationMember.updateOne({ organizationId: org._id, userId: u._id }, { $set: { membershipRole: owner ? 'owner' : 'recruiter', status: 'active', invitedBy: base._id } }, { upsert: true });
  }
  // a company that is still waiting for the admin (the person stays a student until it is verified)
  const waiter = await User.findOne({ email: mail('su') });
  if (waiter && !(await OrganizationMember.findOne({ userId: waiter._id }))) {
    const org = await Organization.create({ name: 'Demo Greenway Logistics', website: 'https://greenway-logistics.example', industry: 'Logistics', city: 'Chattogram', publicDescription: 'Demo company waiting for admin review.', workEmail: 'hr@greenway-logistics.example', verificationStatus: 'pending', verificationEvidence: 'Trade licence no. DEMO-4471 (invented)' });
    await OrganizationMember.create({ organizationId: org._id, userId: waiter._id, membershipRole: 'owner', status: 'pending' });
  }
  for (const k of Object.keys(S)) people.set(mail(k), await User.findOne({ email: mail(k) }));
  people.set('mentor1@demo.mentorlink.bd', await User.findOne({ email: 'mentor1@demo.mentorlink.bd' }));
  people.set('employer.hr', people.get('employer.hr@demo.mentorlink.bd'));
  for (const [k, v] of people) if (!v) throw new Error(`Demo person missing: ${k}. Run the base demo seed first.`);

  // every applicant needs a CV
  for (const k of Object.keys(S)) {
    const u = people.get(mail(k));
    if (!(await CvVersion.exists({ studentId: u._id }))) await CvVersion.create({ studentId: u._id, version: 1, data: cvFor(u, k === 'robiul' ? 'a data analyst role' : undefined) });
  }

  // jobs
  const jobIds = new Map();
  for (const [posterEmail, company, title, orgLabel, type, employmentType, workplaceMode, locationText, desc, requiredSkills, deadline, status, source, recruiterKey] of JOBS) {
    let job = await Opportunity.findOne({ title });
    if (!job) {
      const org = company ? await Organization.findOne({ name: company }) : null;
      const poster = people.get(recruiterKey || posterEmail);
      const flags = scamFlags(`${title} ${desc}`);
      job = await Opportunity.create({
        postedBy: poster._id, organizationId: org ? org._id : undefined, organization: org ? org.name : orgLabel, title, type, employmentType, workplaceMode, locationText,
        description: status === 'hidden' ? desc : desc + NOFEE, requiredSkills, applicationDeadline: ahead(deadline * 24), noFeeConfirmed: status !== 'hidden', sourceLabel: source,
        suspiciousFlags: flags, status, listingReviewed: status === 'approved', reportCount: status === 'hidden' ? 3 : 0, reviewedBy: status === 'pending' ? undefined : adm._id, reviewedAt: status === 'pending' ? undefined : ago(deadline > 10 ? 25 : 8),
      });
      out.jobs++;
    }
    jobIds.set(title, job);
  }
  // existing jobs from the base seed that also get applicants
  for (const t of ['Frontend Developer (Demo)', 'QA Engineer (Demo)']) jobIds.set(t, await Opportunity.findOne({ title: t }));

  // applications and everything that happened to them
  for (const a of APPS) {
    const job = jobIds.get(a.job), student = people.get(mail(a.who));
    if (!job || !student) continue;
    if (await Application.exists({ studentId: student._id, opportunityId: job._id })) continue;
    const posters = job.organizationId ? await OrganizationMember.find({ organizationId: job.organizationId, status: 'active' }).sort({ createdAt: 1 }) : [];
    const posterId = (i) => (posters.length ? posters[i % posters.length].userId : job.postedBy); // recruiters take turns
    const cv = await CvVersion.findOne({ studentId: student._id }).sort({ version: -1 });
    const history = [{ stage: 'Applied', by: student._id, at: ago(a.applied) }];
    let msg = 'Your application was received.';
    for (const [stage, d, m] of a.history || []) { history.push({ stage, by: stage === 'Withdrawn' ? student._id : posterId(history.length), at: ago(d), message: m }); if (m) msg = m; }
    const shared = a.who === 'jannat' ? ['name', 'department', 'cv'] : ['name', 'cv'];
    const app = await Application.create({ studentId: student._id, opportunityId: job._id, cvVersionId: cv._id, applicantNote: a.note, consentSnapshot: { sharedFields: shared, consentedAt: ago(a.applied) }, stage: a.stage, statusMessage: msg, stageHistory: history, createdAt: ago(a.applied) });
    out.applications++;

    let round = 0;
    for (const [title, kind, status, startsAt, x] of a.interviews || []) {
      round++;
      await Interview.create({ applicationId: app._id, opportunityId: job._id, studentId: student._id, scheduledBy: posterId(round), round, title, kind, status, startsAt, durationMin: x.durationMin || 30, meetingLink: x.meetingLink, placeText: x.placeText, notes: x.notes, studentNote: x.studentNote, proposedStartsAt: x.proposedStartsAt, result: x.result || 'pending', feedback: x.feedback, feedbackShared: !!x.feedbackShared, createdAt: new Date(+startsAt - 4 * D), updatedAt: status === 'scheduled' ? new Date(Date.now() - H) : new Date(Math.min(+startsAt + H, Date.now())) });
      out.interviews++;
    }
    for (const [docType, label, status, x] of a.docs || []) {
      await DocumentRequest.create({ applicationId: app._id, opportunityId: job._id, studentId: student._id, requestedBy: posterId(0), docType, label, note: x.note, dueAt: x.due, status, submission: x.submitted ? { text: x.text, link: x.link, submittedAt: ago(x.submitted) } : undefined, reviewNote: x.reviewNote, reviewedAt: x.reviewed !== undefined ? ago(x.reviewed) : undefined, createdAt: ago(Math.max(a.applied - 1, (x.submitted || 1) + 1)) });
      out.documents++;
    }
    if (a.offer) {
      const [status, x] = a.offer;
      await Offer.create({ applicationId: app._id, opportunityId: job._id, studentId: student._id, createdBy: posterId(0), positionTitle: job.title.replace(' (Demo)', ''), salaryText: x.salaryText, employmentType: x.employmentType || job.employmentType, startDate: ahead(24 * 14), workPlaceText: job.locationText, terms: x.terms, expiresAt: x.expiresAt || ago(x.created - 5), status, respondedAt: x.responded !== undefined ? ago(x.responded) : undefined, declineReason: x.declineReason, createdAt: ago(x.created) });
      out.offers++;
    }
    // messages: sides alternate in time; the person who wrote last has "read" everything up to then, the other side has an unread tail
    const readAtStudent = new Date(), readAtPoster = new Date();
    let lastSide = null;
    for (const [side, text, d] of a.chat || []) {
      await AppMessage.create({ applicationId: app._id, senderId: side === 'student' ? student._id : posterId(1), side, body: text, flags: scamFlags(text), createdAt: ago(d), updatedAt: ago(d) });
      out.messages++; lastSide = side;
    }
    // Make the last message unread for the reader: that is what a real inbox looks like.
    if (lastSide && (a.chat || []).length) {
      const last = ago(a.chat[a.chat.length - 1][2]);
      const before = new Date(+last - 1000);
      await Application.updateOne({ _id: app._id }, { $set: lastSide === 'poster' ? { 'readAt.student': before, 'readAt.poster': readAtPoster } : { 'readAt.poster': before, 'readAt.student': readAtStudent } }, { timestamps: false });
    }
  }

  // a few notifications so the bell is not empty for the main demo student
  const rob = people.get(mail('robiul'));
  if (!(await Notification.exists({ userId: rob._id, title: 'Interview scheduled' }))) {
    const bi = jobIds.get('Business Intelligence Analyst (Demo)');
    const bapp = await Application.findOne({ studentId: rob._id, opportunityId: bi._id });
    const t = bapp && { targetType: 'application', targetId: String(bapp._id) };
    await Notification.insertMany([
      { userId: rob._id, title: 'Interview scheduled', body: 'Business Intelligence Analyst (Demo): Analyst interview', kind: 'application', ...t, createdAt: ago(1) },
      { userId: rob._id, title: 'Document requested', body: 'Business Intelligence Analyst (Demo): Portfolio or project link', kind: 'application', ...t, createdAt: ago(1) },
      { userId: rob._id, title: 'New message', body: 'Business Intelligence Analyst (Demo)', kind: 'application', ...t, createdAt: ago(1) },
    ]);
  }
  return out;
}

module.exports = { seedHiringDemo, EMPLOYERS, JOBS, APPS };
