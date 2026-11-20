// Career Action Center: ONE ranked list of "do this next, because ..." built from facts the app already holds.
// Pure function (no database) so every rule has a plain unit test (tests/actions.test.js).
// Rules are fixed and explainable. Lower priority number = shown first. Nothing here is AI or paid.
const MAX_ACTIONS = 5;

// ctx: { hasGoal, hasCv, hasMentor, nextSession:{at,mentor}, dueTask:{title,overdue}, docsToSend, offersWaiting,
//        interviewSoon:{title,at}, unseenReviews, topGap:{skillKey,nameEn,nameBn,hasProof}, closingJob:{id,title,daysLeft,fit}, staleApps, now }
function buildActions(ctx = {}) {
  const now = ctx.now ? new Date(ctx.now) : new Date();
  const out = [];
  const add = (priority, key, titleEn, titleBn, reasonEn, reasonBn, route, urgent = false) => out.push({ key, priority, urgent, titleEn, titleBn, reasonEn, reasonBn, route });
  const hoursTo = (d) => (new Date(d).getTime() - now.getTime()) / 36e5;

  if (ctx.offersWaiting > 0) add(1, 'offer', 'Answer your job offer', 'আপনার চাকরির অফারের উত্তর দিন', 'An employer sent an offer and is waiting for your answer. Offers can expire.', 'একজন নিয়োগকর্তা অফার পাঠিয়েছেন এবং উত্তরের অপেক্ষায় আছেন। অফারের মেয়াদ শেষ হতে পারে।', '/applications', true);
  if (ctx.interviewSoon && hoursTo(ctx.interviewSoon.at) <= 72 && hoursTo(ctx.interviewSoon.at) > -1) add(2, 'interview', `Prepare for "${ctx.interviewSoon.title}"`, `"${ctx.interviewSoon.title}" এর প্রস্তুতি নিন`, 'Your interview is within 3 days. Practise the common questions for your role now.', 'আপনার ইন্টারভিউ ৩ দিনের মধ্যে। এখনই আপনার পদের সাধারণ প্রশ্নগুলো অনুশীলন করুন।', '/interview-practice', true);
  if (ctx.docsToSend > 0) add(3, 'papers', `Send ${ctx.docsToSend} paper${ctx.docsToSend > 1 ? 's' : ''} an employer asked for`, `নিয়োগকর্তার চাওয়া ${ctx.docsToSend}টি কাগজ পাঠান`, 'An employer cannot move your application forward until you send these.', 'এগুলো না পাঠালে নিয়োগকর্তা আপনার আবেদন এগিয়ে নিতে পারবেন না।', '/applications', true);
  if (ctx.nextSession && hoursTo(ctx.nextSession.at) > 0 && hoursTo(ctx.nextSession.at) <= 24) add(4, 'session', `Get ready for your session${ctx.nextSession.mentor ? ` with ${ctx.nextSession.mentor}` : ''}`, 'আপনার সেশনের জন্য প্রস্তুত হোন', 'Your mentor session starts within 24 hours. Write down the one question you most want answered.', 'আপনার মেন্টর সেশন ২৪ ঘণ্টার মধ্যে শুরু। যে প্রশ্নের উত্তর সবচেয়ে বেশি চান সেটি লিখে রাখুন।', '/sessions', true);
  if (ctx.dueTask) add(5, 'task', `${ctx.dueTask.overdue ? 'Overdue' : 'Due soon'}: ${ctx.dueTask.title}`, `${ctx.dueTask.overdue ? 'দেরি হয়েছে' : 'শীঘ্রই শেষ'}: ${ctx.dueTask.title}`, ctx.dueTask.overdue ? 'This task is past its date. Finish it or tell your mentor.' : 'This task is due within 2 days.', ctx.dueTask.overdue ? 'কাজটির তারিখ পেরিয়ে গেছে। শেষ করুন অথবা মেন্টরকে জানান।' : 'কাজটি ২ দিনের মধ্যে শেষ করতে হবে।', '/plan', !!ctx.dueTask.overdue);
  if (ctx.unseenReviews > 0) add(6, 'review', 'Read your mentor\'s feedback', 'মেন্টরের মতামত পড়ুন', 'Your mentor reviewed your work. Feedback is how a level goes up.', 'মেন্টর আপনার কাজ দেখেছেন। মতামত থেকেই স্তর বাড়ে।', '/my-reviews');
  if (!ctx.hasGoal) add(7, 'goal', 'Choose your career goal', 'ক্যারিয়ার লক্ষ্য বেছে নিন', 'Every other step (gaps, plan, jobs) needs a target role to point at.', 'বাকি সব ধাপ (ঘাটতি, পরিকল্পনা, চাকরি) একটি লক্ষ্য পদ চায়।', '/goal');
  if (ctx.closingJob) add(8, 'closing_job', `Apply: ${ctx.closingJob.title}`, `আবেদন করুন: ${ctx.closingJob.title}`, `It closes in ${ctx.closingJob.daysLeft} day${ctx.closingJob.daysLeft > 1 ? 's' : ''} and matches ${ctx.closingJob.fit}% of your skills.`, `${ctx.closingJob.daysLeft} দিনে শেষ হবে এবং আপনার দক্ষতার ${ctx.closingJob.fit}% মেলে।`, `/opportunity/${ctx.closingJob.id}`, ctx.closingJob.daysLeft <= 1);
  if (ctx.hasGoal && ctx.topGap && !ctx.topGap.hasProof) add(9, 'gap_quiz', `Prove ${ctx.topGap.nameEn}: take the quiz`, `${ctx.topGap.nameBn || ctx.topGap.nameEn} প্রমাণ করুন: কুইজ দিন`, 'It is your biggest gap and only has a self-rating. A quiz is proof employers can trust.', 'এটি আপনার সবচেয়ে বড় ঘাটতি এবং শুধু নিজের দেওয়া রেটিং আছে। কুইজ নিয়োগকর্তার বিশ্বাসযোগ্য প্রমাণ।', `/quiz/${ctx.topGap.skillKey}`);
  else if (ctx.hasGoal && ctx.topGap) add(10, 'gap_learn', `Close your gap in ${ctx.topGap.nameEn}`, `${ctx.topGap.nameBn || ctx.topGap.nameEn} এর ঘাটতি পূরণ করুন`, 'It is the skill furthest from what your target role asks for.', 'আপনার লক্ষ্য পদ যা চায় তার থেকে এই দক্ষতাটি সবচেয়ে পিছিয়ে।', `/roadmap/${ctx.topGap.skillKey}`);
  if (ctx.staleApps > 0) add(11, 'stale', `${ctx.staleApps} application${ctx.staleApps > 1 ? 's' : ''} waiting 7+ days`, `${ctx.staleApps}টি আবেদন ৭+ দিন ধরে অপেক্ষায়`, 'No reply yet. Message the employer politely or apply to a similar job.', 'এখনও উত্তর নেই। নিয়োগকর্তাকে ভদ্রভাবে বার্তা দিন বা অনুরূপ চাকরিতে আবেদন করুন।', '/applications');
  if (ctx.hasGoal && !ctx.hasCv) add(12, 'cv', 'Build your CV', 'আপনার সিভি তৈরি করুন', 'You cannot apply to a job without a CV.', 'সিভি ছাড়া চাকরিতে আবেদন করা যায় না।', '/cv');
  if (ctx.hasGoal && !ctx.hasMentor) add(13, 'mentor', 'Ask a mentor to guide you', 'একজন মেন্টরের সাহায্য চান', 'A mentor can endorse your projects. Endorsements count as proof.', 'মেন্টর আপনার প্রজেক্ট অনুমোদন করতে পারেন, যা প্রমাণ হিসেবে গণ্য।', '/mentors');

  out.sort((a, b) => a.priority - b.priority);
  const actions = out.slice(0, MAX_ACTIONS);
  return { actions, total: out.length, hasUrgent: actions.some((a) => a.urgent) };
}
module.exports = { buildActions, MAX_ACTIONS };
