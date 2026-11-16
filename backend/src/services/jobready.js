// Job-readiness path: the one clear route from "I picked a target" to "I applied with proof".
// Pure functions only (no database), so every rule has a plain unit test (tests/jobready.test.js).
//
// The loop: target -> top gaps -> weekly plan -> proof (quiz / project / endorsement) -> checklist
//           -> interview practice -> ranked jobs -> close the gap after an application.

const CHECK_CV_SCORE = 80;       // CV tips score needed for "CV complete"
const CHECK_PROVEN_SHARE = 60;   // % of the target's skills that need non-self proof
const CHECK_PRACTICE_DONE = 5;   // self-rated practice answers that count as "mock interview done" (a mentor mock counts on its own)
const CHECK_APPLICATIONS = 3;    // "first applications sent"
const ALMOST_MAX_MISSING = 2;    // "almost there" = missing 1 or 2 skills

// ---------------------------------------------------------------- interview question bank
const q = (id, en, bn, kind = 'role') => ({ id, en, bn, kind });

const COMMON = [
  q('c1', 'Tell me about yourself in one minute.', 'এক মিনিটে নিজের সম্পর্কে বলুন।', 'general'),
  q('c2', 'Why do you want this role, and why now?', 'আপনি কেন এই পদে কাজ করতে চান, এবং কেন এখনই?', 'general'),
  q('c3', 'Describe a project you finished. What was your part and what was the result?', 'আপনার শেষ করা একটি প্রজেক্টের কথা বলুন। আপনার ভূমিকা ও ফলাফল কী ছিল?', 'general'),
  q('c4', 'Tell me about a time you failed or got stuck. What did you do next?', 'কখন ব্যর্থ হয়েছেন বা আটকে গিয়েছিলেন? তারপর কী করলেন?', 'general'),
  q('c5', 'How do you work in a team when you disagree with someone?', 'কারও সাথে মতভেদ হলে টিমে কীভাবে কাজ করেন?', 'general'),
];

const FAMILIES = {
  dev: [
    q('d1', 'Explain the difference between an array and a linked list. When would you pick each?', 'অ্যারে ও লিংকড লিস্টের পার্থক্য বুঝিয়ে বলুন। কখন কোনটি বেছে নেবেন?'),
    q('d2', 'You get a bug report: "the page is slow". How do you find the cause?', '"পেজ ধীর" এই বাগ রিপোর্ট পেলে কারণ কীভাবে খুঁজবেন?'),
    q('d3', 'What is a REST API? Walk me through what happens when a client calls one.', 'REST API কী? ক্লায়েন্ট কল করলে কী ঘটে ধাপে ধাপে বলুন।'),
    q('d4', 'How do you use Git in a team? What do you do when you get a merge conflict?', 'টিমে Git কীভাবে ব্যবহার করেন? মার্জ কনফ্লিক্ট হলে কী করেন?'),
    q('d5', 'What is the difference between SQL joins (inner vs left)? Give an example.', 'SQL ইনার ও লেফট জয়েনের পার্থক্য উদাহরণসহ বলুন।'),
    q('d6', 'How would you test a function that validates an email address?', 'ইমেইল যাচাইয়ের একটি ফাংশন কীভাবে টেস্ট করবেন?'),
  ],
  data: [
    q('a1', 'You have a table of sales. How would you find the top 5 products by revenue (SQL or Excel)?', 'বিক্রির টেবিল থেকে আয়ের দিক দিয়ে শীর্ষ ৫টি পণ্য কীভাবে বের করবেন (SQL বা Excel)?'),
    q('a2', 'How do you deal with missing or messy data before analysis?', 'বিশ্লেষণের আগে অনুপস্থিত বা অগোছালো ডেটা কীভাবে সামলান?'),
    q('a3', 'Explain mean, median and mode. When is the median better?', 'গড়, মধ্যমা ও প্রচুরক বুঝিয়ে বলুন। কখন মধ্যমা ভালো?'),
    q('a4', 'A manager asks "why did sales drop last month?". How do you answer with data?', 'ম্যানেজার জিজ্ঞেস করলেন "গত মাসে বিক্রি কমল কেন?"। ডেটা দিয়ে কীভাবে উত্তর দেবেন?'),
    q('a5', 'How would you explain a chart to someone who does not like numbers?', 'সংখ্যা পছন্দ করেন না এমন কাউকে একটি চার্ট কীভাবে বোঝাবেন?'),
  ],
  qa: [
    q('t1', 'What is the difference between a bug, a defect and a failure?', 'বাগ, ডিফেক্ট ও ফেইলিউরের পার্থক্য কী?'),
    q('t2', 'Write test cases for a login page. What do you try first?', 'লগইন পেজের টেস্ট কেস লিখুন। প্রথমে কী চেষ্টা করবেন?'),
    q('t3', 'A developer says "it works on my machine". What do you do?', 'ডেভেলপার বলছে "আমার মেশিনে চলছে"। আপনি কী করবেন?'),
    q('t4', 'What should a good bug report contain?', 'একটি ভালো বাগ রিপোর্টে কী কী থাকা উচিত?'),
  ],
  finance: [
    q('f1', 'Explain debit and credit with a simple everyday example.', 'ডেবিট ও ক্রেডিট একটি সহজ দৈনন্দিন উদাহরণসহ বুঝিয়ে বলুন।'),
    q('f2', 'What is the difference between a balance sheet and an income statement?', 'ব্যালেন্স শিট ও আয় বিবরণীর পার্থক্য কী?'),
    q('f3', 'How would you check a long Excel sheet for errors before sending it?', 'পাঠানোর আগে বড় Excel শিটের ভুল কীভাবে যাচাই করবেন?'),
    q('f4', 'A customer is upset about a wrong charge. How do you handle it?', 'ভুল চার্জ নিয়ে গ্রাহক বিরক্ত। আপনি কীভাবে সামলাবেন?'),
    q('f5', 'What does "confidentiality" mean when you handle customer or company data?', 'গ্রাহক বা কোম্পানির তথ্য সামলানোর সময় "গোপনীয়তা" বলতে কী বোঝেন?'),
  ],
  people: [
    q('m1', 'Describe a time you led a group. What did you do to keep everyone on track?', 'যখন একটি দলকে নেতৃত্ব দিয়েছিলেন তার কথা বলুন। সবাইকে ট্র্যাকে রাখতে কী করেছিলেন?'),
    q('m2', 'You have three urgent tasks and time for one. How do you choose?', 'তিনটি জরুরি কাজ কিন্তু সময় একটির। কীভাবে বেছে নেবেন?'),
    q('m3', 'How would you give feedback to a teammate who keeps missing deadlines?', 'যে সহকর্মী বারবার ডেডলাইন মিস করে তাকে কীভাবে ফিডব্যাক দেবেন?'),
    q('m4', 'What do you know about our company and how could you help?', 'আমাদের কোম্পানি সম্পর্কে কী জানেন এবং কীভাবে সাহায্য করতে পারবেন?'),
  ],
  design: [
    q('x1', 'Walk me through one design from your portfolio: the problem, your steps, the result.', 'পোর্টফোলিওর একটি ডিজাইন ধাপে ধাপে বলুন: সমস্যা, আপনার পদক্ষেপ, ফলাফল।'),
    q('x2', 'How do you decide what to cut when a client asks for too much?', 'ক্লায়েন্ট অনেক বেশি চাইলে কী বাদ দেবেন কীভাবে ঠিক করেন?'),
    q('x3', 'How do you check that your design works for real users?', 'আপনার ডিজাইন আসল ব্যবহারকারীর জন্য কাজ করছে কীভাবে যাচাই করেন?'),
  ],
  marketing: [
    q('k1', 'How would you promote a new online course with a small budget?', 'অল্প বাজেটে একটি নতুন অনলাইন কোর্স কীভাবে প্রচার করবেন?'),
    q('k2', 'Which numbers tell you a campaign worked? Why those?', 'কোন সংখ্যা দেখে বুঝবেন ক্যাম্পেইন সফল? কেন?'),
    q('k3', 'Write one headline for a student discount offer and explain your choice.', 'ছাত্র ছাড়ের অফারের জন্য একটি শিরোনাম লিখুন এবং কেন বেছেছেন বলুন।'),
  ],
  study: [
    q('s1', 'What do you want to research, and why this field and this university?', 'আপনি কী নিয়ে গবেষণা করতে চান, এবং কেন এই বিষয় ও এই বিশ্ববিদ্যালয়?'),
    q('s2', 'Describe your thesis or a research-style project. What was the question and the method?', 'আপনার থিসিস বা গবেষণাধর্মী প্রজেক্ট বর্ণনা করুন। প্রশ্ন ও পদ্ধতি কী ছিল?'),
    q('s3', 'What are your plans after the degree?', 'ডিগ্রির পর আপনার পরিকল্পনা কী?'),
  ],
};

const ROLE_FAMILY = {
  'junior-developer': 'dev', 'backend-developer': 'dev', 'frontend-developer': 'dev', 'mobile-app-developer': 'dev',
  'devops-engineer': 'dev', 'cybersecurity-analyst': 'dev',
  'data-analyst': 'data', 'business-analyst': 'data', 'data-scientist': 'data', 'research-assistant': 'data',
  'qa-engineer': 'qa',
  'banking-trainee': 'finance', 'accounts-finance-officer': 'finance',
  'management-trainee': 'people', 'hr-operations-executive': 'people',
  'ui-ux-designer': 'design', 'digital-marketing-executive': 'marketing', 'higher-study': 'study',
};

// Question bank for one role: 2 general questions first, then the role questions, then the rest of the general ones.
function questionsFor(roleKey) {
  const fam = FAMILIES[ROLE_FAMILY[roleKey]] || [];
  return [...COMMON.slice(0, 2), ...fam, ...COMMON.slice(2)].map((x) => ({ ...x, id: `${ROLE_FAMILY[roleKey] || 'any'}:${x.id}` }));
}
const isQuestionOf = (roleKey, questionId) => questionsFor(roleKey).some((x) => x.id === questionId);

// Summary of a student's self-practice: latest rating per question.
function practiceSummary(roleKey, answers) {
  const qs = questionsFor(roleKey);
  const latest = new Map();
  for (const a of [...answers].sort((x, y) => new Date(x.createdAt || 0) - new Date(y.createdAt || 0))) latest.set(a.questionId, a);
  const rated = qs.filter((x) => latest.has(x.id));
  const avg = rated.length ? Math.round((rated.reduce((t, x) => t + latest.get(x.id).rating, 0) / rated.length) * 10) / 10 : null;
  const weakest = rated.filter((x) => latest.get(x.id).rating <= 2).map((x) => x.id);
  return { total: qs.length, answered: rated.length, average: avg, weakest };
}

// ---------------------------------------------------------------- job-ready checklist
// ctx: { hasGoal, cvCount, cvScore, confidence, mocksDone, practiceAnswered, applications }
function buildChecklist(ctx) {
  const items = [
    { key: 'goal', done: !!ctx.hasGoal, en: 'Pick a target role', bn: 'লক্ষ্য পদ বেছে নিন', hintEn: 'Choose the job you want, so every step points at it.', hintBn: 'কোন চাকরি চান বেছে নিন, যাতে প্রতিটি ধাপ সেদিকে যায়।', route: '/goal' },
    { key: 'cv', done: ctx.cvCount > 0 && (ctx.cvScore || 0) >= CHECK_CV_SCORE, en: 'CV complete', bn: 'সিভি সম্পূর্ণ', progress: ctx.cvCount > 0 ? `${ctx.cvScore || 0}/${CHECK_CV_SCORE}` : '0/' + CHECK_CV_SCORE,
      hintEn: ctx.cvCount > 0 ? `Your CV score is ${ctx.cvScore || 0}. Reach ${CHECK_CV_SCORE} by fixing the tips.` : 'Build your CV. It shows a score and tips as you write.', hintBn: ctx.cvCount > 0 ? `আপনার সিভি স্কোর ${ctx.cvScore || 0}। টিপস মেনে ${CHECK_CV_SCORE} করুন।` : 'সিভি বানান। লেখার সময় স্কোর ও টিপস দেখাবে।', route: '/cv' },
    { key: 'proof', done: (ctx.confidence || 0) >= CHECK_PROVEN_SHARE, en: 'Skills proven', bn: 'দক্ষতার প্রমাণ আছে', progress: `${ctx.confidence || 0}/${CHECK_PROVEN_SHARE}`,
      hintEn: `Prove at least ${CHECK_PROVEN_SHARE}% of your target skills with a quiz, a project or a mentor endorsement. Self-rating does not count.`, hintBn: `লক্ষ্য পদের অন্তত ${CHECK_PROVEN_SHARE}% দক্ষতা কুইজ, প্রজেক্ট বা মেন্টরের এন্ডোর্সমেন্টে প্রমাণ করুন। নিজে রেটিং দিলে গণ্য হয় না।`, route: '/skill-gap' },
    { key: 'mock', done: (ctx.mocksDone || 0) > 0 || (ctx.practiceAnswered || 0) >= CHECK_PRACTICE_DONE, en: 'Mock interview done', bn: 'মক ইন্টারভিউ হয়েছে', progress: `${Math.min(ctx.practiceAnswered || 0, CHECK_PRACTICE_DONE)}/${CHECK_PRACTICE_DONE}`,
      hintEn: `Answer ${CHECK_PRACTICE_DONE} practice questions, or finish one mock interview with a mentor.`, hintBn: `${CHECK_PRACTICE_DONE}টি অনুশীলন প্রশ্নের উত্তর দিন, অথবা মেন্টরের সাথে একটি মক ইন্টারভিউ করুন।`, route: '/interview-practice' },
    { key: 'apply', done: (ctx.applications || 0) >= CHECK_APPLICATIONS, en: 'First applications sent', bn: 'প্রথম আবেদনগুলো পাঠানো হয়েছে', progress: `${Math.min(ctx.applications || 0, CHECK_APPLICATIONS)}/${CHECK_APPLICATIONS}`,
      hintEn: `Send ${CHECK_APPLICATIONS} applications. Start with the jobs you can apply to now.`, hintBn: `${CHECK_APPLICATIONS}টি আবেদন পাঠান। যেগুলোতে এখনই আবেদন করা যায় সেগুলো দিয়ে শুরু করুন।`, route: '/ready-jobs' },
  ];
  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length, percent: Math.round((100 * done) / items.length), complete: done === items.length };
}

// The one card on Home: the first thing not done yet.
function nextStep(checklist) {
  const n = checklist.items.find((i) => !i.done);
  if (!n) return { key: 'done', titleEn: 'You are job-ready. Keep applying and follow up.', titleBn: 'আপনি চাকরির জন্য প্রস্তুত। আবেদন চালিয়ে যান।', route: '/ready-jobs' };
  return { key: n.key, titleEn: n.hintEn, titleBn: n.hintBn, route: n.route };
}

// ---------------------------------------------------------------- weekly plan
// 2 or 3 small tasks from the biggest gaps. Each has a free resource when one exists, a time estimate and how to prove it.
// gaps: from computeReadiness; resources: [{ skillKey, title, url, kind, language, free }]; quizSkills: Set of skill keys that have a quiz.
function weeklyPlan({ gaps, resources, quizSkills, weeklyHours }) {
  const top = gaps.slice(0, 3);
  if (!top.length) return { tasks: [], minutes: 0 };
  const budget = Math.max(2, weeklyHours || 4) * 60;           // minutes the student says they have
  const each = Math.max(30, Math.min(180, Math.round(budget / top.length / 15) * 15));
  const tasks = top.map((g) => {
    const pool = resources.filter((r) => r.skillKey === g.skillKey && r.free !== false);
    const res = pool.find((r) => r.kind === 'course') || pool[0] || null;
    return {
      skillKey: g.skillKey, nameEn: g.nameEn || g.skillKey, nameBn: g.nameBn || g.skillKey,
      titleEn: `Study ${g.nameEn || g.skillKey}`, titleBn: `${g.nameBn || g.nameEn || g.skillKey} শিখুন`,
      minutes: each,
      resource: res ? { title: res.title, url: res.url, kind: res.kind, language: res.language, free: true } : null,
      proof: quizSkills.has(g.skillKey) ? 'quiz' : 'project',
      proofRoute: quizSkills.has(g.skillKey) ? `/quiz/${g.skillKey}` : '/portfolio',
      current: g.current, required: g.required,
    };
  });
  return { tasks, minutes: tasks.reduce((t, x) => t + x.minutes, 0) };
}

// ---------------------------------------------------------------- ranked jobs
// have: levelsFromEvidence() output. A skill is "missing" when the student's level is below the level the job asks for.
function missingSkills(job, have) {
  return (job.requiredSkills || []).filter((s) => (((have || {})[s.skillKey] || {}).level || 0) < (s.requiredLevel || 1))
    .map((s) => ({ skillKey: s.skillKey, need: s.requiredLevel || 1, have: (((have || {})[s.skillKey] || {}).level || 0) }));
}

// Two lists: jobs you can apply to now (nothing missing) and jobs you are 1-2 skills away from.
function rankJobs(jobs, have, fitOf) {
  const applyNow = [], almost = [];
  for (const j of jobs) {
    const missing = missingSkills(j, have);
    const row = { job: j, missing, fit: fitOf(j, have) };
    if (missing.length === 0) applyNow.push(row);
    else if (missing.length <= ALMOST_MAX_MISSING) almost.push(row);
  }
  const byFit = (a, b) => (b.fit === undefined ? 100 : b.fit) - (a.fit === undefined ? 100 : a.fit);
  applyNow.sort(byFit);
  almost.sort((a, b) => a.missing.length - b.missing.length || byFit(a, b));
  return { applyNow, almost };
}

// ---------------------------------------------------------------- tracker: what to do next at each stage
const NEXT = {
  'Applied': { en: 'Wait for a reply, usually a week. Meanwhile practise interview questions and apply to 2 more jobs.', bn: 'উত্তরের জন্য অপেক্ষা করুন, সাধারণত এক সপ্তাহ। এর মধ্যে ইন্টারভিউয়ের প্রশ্ন অনুশীলন করুন এবং আরও ২টি চাকরিতে আবেদন করুন।', route: '/interview-practice' },
  'Shortlisted': { en: 'You are shortlisted. Reread the job post, update your CV if asked and get ready for an interview call.', bn: 'আপনি শর্টলিস্টেড। চাকরির বিজ্ঞপ্তি আবার পড়ুন, চাইলে সিভি হালনাগাদ করুন এবং ইন্টারভিউ কলের জন্য তৈরি হন।', route: '/interview-practice' },
  'Interview': { en: 'Prepare for the interview: practise this role\'s questions and book a mock interview with a mentor.', bn: 'ইন্টারভিউয়ের প্রস্তুতি নিন: এই পদের প্রশ্ন অনুশীলন করুন এবং মেন্টরের সাথে মক ইন্টারভিউ বুক করুন।', route: '/interview-practice' },
  'Selected': { en: 'Congratulations. Read the offer carefully, check the company is verified and confirm there is no fee.', bn: 'অভিনন্দন। অফার মনোযোগ দিয়ে পড়ুন, কোম্পানি যাচাইকৃত কিনা দেখুন এবং নিশ্চিত হন কোনো ফি নেই।', route: '/applications' },
  'Not selected': { en: 'Not this time. Open the job gap, close the missing skill and apply to a similar job.', bn: 'এবার হয়নি। জব গ্যাপ খুলুন, ঘাটতির দক্ষতা পূরণ করুন এবং অনুরূপ চাকরিতে আবেদন করুন।', route: '/job-gaps' },
  'Withdrawn': { en: 'You withdrew. You can apply to other jobs you fit.', bn: 'আপনি আবেদন প্রত্যাহার করেছেন। যে চাকরিগুলোর সাথে মেলে সেগুলোতে আবেদন করতে পারেন।', route: '/ready-jobs' },
};
const nextForStage = (uiStageName) => NEXT[uiStageName] || NEXT['Applied'];

// ---------------------------------------------------------------- success stories (real, anonymous, opt-in)
const STORY_MIN_GROUP = 5; // no story is shown until at least this many consenting students have been hired
const monthsBetween = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / (30 * 864e5)));

// rows: [{ roleTitleEn, roleTitleBn, firstPercent, hirePercent, firstDay, hiredAt }]
function buildStories(rows) {
  if (rows.length < STORY_MIN_GROUP) return { stories: [], hidden: `Stories appear after ${STORY_MIN_GROUP} students who agreed to share have been hired. This protects their privacy.` };
  const stories = rows.filter((r) => r.firstPercent !== null && r.hirePercent !== null && r.hirePercent >= r.firstPercent)
    .map((r) => {
      const months = monthsBetween(r.firstDay, r.hiredAt);
      return { roleTitleEn: r.roleTitleEn, roleTitleBn: r.roleTitleBn, from: r.firstPercent, to: r.hirePercent, months,
        en: `From ${r.firstPercent}% to hired in ${months} month${months === 1 ? '' : 's'}: ${r.roleTitleEn}.`, bn: `${r.firstPercent}% থেকে ${months} মাসে চাকরি: ${r.roleTitleBn || r.roleTitleEn}।` };
    }).sort((a, b) => (b.to - b.from) - (a.to - a.from)).slice(0, 10);
  return { stories };
}

module.exports = {
  questionsFor, isQuestionOf, practiceSummary, buildChecklist, nextStep, weeklyPlan, missingSkills, rankJobs, nextForStage, buildStories,
  ROLE_FAMILY, CHECK_CV_SCORE, CHECK_PROVEN_SHARE, CHECK_PRACTICE_DONE, CHECK_APPLICATIONS, ALMOST_MAX_MISSING, STORY_MIN_GROUP,
};
