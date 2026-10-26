// "Pick a target" paths. A target is a goal such as Machine Learning, made of topics.
// Each topic has: weight w (3 core, 2 important, 1 helpful), planning hours, and `needs` (topics to know first).
// This is a prerequisite graph, so the app can say "you can start this now" or "learn X first".
// `ev` links a topic to a skill: a quiz/project/endorsement at that level counts the topic as VERIFIED.
// Hours and weights are rough planning estimates written by us, not measured data.
const G = { math: ['Maths', 'গণিত'], code: ['Programming', 'প্রোগ্রামিং'], data: ['Working with data', 'ডেটা নিয়ে কাজ'], core: ['ML core', 'এমএল মূল'], deep: ['Deep learning', 'ডিপ লার্নিং'], work: ['Real work', 'বাস্তব কাজ'], tools: ['Tools', 'টুলস'], web: ['Web & API', 'ওয়েব ও API'], qa: ['Testing', 'টেস্টিং'], prep: ['Preparation', 'প্রস্তুতি'], build: ['Building', 'তৈরি'], launch: ['Launch', 'চালু'] };
// [key, titleEn, titleBn, group, w, hours, needs[], ev?]
const T = (rows) => rows.map(([key, titleEn, titleBn, group, w, hours, needs, ev]) => ({ key, titleEn, titleBn, group, w, hours, needs: needs || [], ev: ev || null }));

const TARGETS = [
  // kind 'career' = a job role; kind 'pathway' = a route beyond one job (design screen: Pathways). Checklists are general guidance, not official requirements:
  // always check the official source (university, BPSC, marketplace) for current rules.
  { kind: 'career', key: 'ml', titleEn: 'Machine Learning', titleBn: 'মেশিন লার্নিং',
    summaryEn: 'Build models that learn from data. The path goes maths + Python first, then core ML, then a real project.',
    summaryBn: 'ডেটা থেকে শেখে এমন মডেল তৈরি। আগে গণিত ও পাইথন, তারপর মূল এমএল, শেষে বাস্তব প্রজেক্ট।',
    topics: T([
      ['linalg', 'Vectors, matrices and dot products', 'ভেক্টর, ম্যাট্রিক্স, ডট প্রোডাক্ট', 'math', 3, 12],
      ['calc', 'Derivatives and gradients', 'ডেরিভেটিভ ও গ্রেডিয়েন্ট', 'math', 2, 10],
      ['prob', 'Probability basics', 'সম্ভাবনার মূলকথা', 'math', 3, 10],
      ['stats', 'Statistics: mean, variance, distributions', 'পরিসংখ্যান: গড়, ভেদ, বণ্টন', 'math', 3, 8, [], ['statistics', 2]],
      ['py', 'Python basics', 'পাইথন মূলকথা', 'code', 3, 16, [], ['python', 1]],
      ['pydata', 'NumPy and pandas', 'NumPy ও pandas', 'code', 3, 14, ['py'], ['python', 2]],
      ['viz', 'Charts with matplotlib', 'matplotlib দিয়ে চার্ট', 'code', 1, 4, ['pydata']],
      ['git', 'Git for your projects', 'প্রজেক্টের জন্য Git', 'tools', 1, 4, [], ['git', 2]],
      ['clean', 'Cleaning data (missing values, duplicates)', 'ডেটা পরিষ্কার', 'data', 2, 8, ['pydata']],
      ['eda', 'Exploring data (EDA)', 'ডেটা অন্বেষণ (EDA)', 'data', 2, 8, ['clean', 'stats']],
      ['mlconcepts', 'ML ideas: supervised vs unsupervised, train/test split, overfitting', 'এমএল ধারণা: সুপারভাইজড/আনসুপারভাইজড, ট্রেন/টেস্ট, ওভারফিটিং', 'core', 3, 6, ['stats']],
      ['linreg', 'Linear regression', 'লিনিয়ার রিগ্রেশন', 'core', 3, 8, ['linalg', 'pydata', 'mlconcepts']],
      ['gd', 'Gradient descent', 'গ্রেডিয়েন্ট ডিসেন্ট', 'core', 2, 6, ['calc', 'linreg']],
      ['logreg', 'Logistic regression and classification', 'লজিস্টিক রিগ্রেশন ও ক্লাসিফিকেশন', 'core', 3, 8, ['linreg', 'prob']],
      ['metrics', 'Metrics: accuracy, precision, recall, cross-validation', 'মেট্রিক্স: accuracy, precision, recall, ক্রস-ভ্যালিডেশন', 'core', 3, 6, ['logreg']],
      ['trees', 'Decision trees and random forests', 'ডিসিশন ট্রি ও র‍্যান্ডম ফরেস্ট', 'core', 2, 8, ['metrics']],
      ['cluster', 'Clustering (k-means)', 'ক্লাস্টারিং (k-means)', 'core', 1, 5, ['mlconcepts', 'pydata']],
      ['sklearn', 'scikit-learn workflow and pipelines', 'scikit-learn ওয়ার্কফ্লো ও পাইপলাইন', 'core', 3, 10, ['metrics', 'pydata']],
      ['feat', 'Feature engineering', 'ফিচার ইঞ্জিনিয়ারিং', 'core', 2, 6, ['sklearn', 'eda']],
      ['nn', 'Neural network basics', 'নিউরাল নেটওয়ার্কের মূলকথা', 'deep', 2, 12, ['gd', 'linalg', 'sklearn']],
      ['dlfw', 'PyTorch or TensorFlow first model', 'PyTorch/TensorFlow-এ প্রথম মডেল', 'deep', 1, 12, ['nn']],
      ['proj', 'Project: a full tabular ML project', 'প্রজেক্ট: সম্পূর্ণ টেবুলার এমএল প্রজেক্ট', 'work', 3, 20, ['sklearn', 'eda']],
      ['write', 'Write-up and portfolio page', 'রাইট-আপ ও পোর্টফোলিও', 'work', 2, 5, ['proj']],
      ['deploy', 'Serve a model as a small API', 'মডেলকে ছোট API হিসেবে চালানো', 'work', 1, 8, ['proj']],
    ]) },
  { kind: 'career', key: 'data-analysis', titleEn: 'Data Analysis', titleBn: 'ডেটা অ্যানালাইসিস',
    summaryEn: 'Answer business questions with data: SQL, spreadsheets, statistics and a dashboard.',
    summaryBn: 'ডেটা দিয়ে ব্যবসায়িক প্রশ্নের উত্তর: SQL, স্প্রেডশিট, পরিসংখ্যান ও ড্যাশবোর্ড।',
    topics: T([
      ['excel', 'Spreadsheet formulas and pivot tables', 'স্প্রেডশিট ফর্মুলা ও পিভট', 'data', 2, 12, [], ['excel', 2]],
      ['stats', 'Statistics basics', 'পরিসংখ্যানের মূলকথা', 'data', 3, 12, [], ['statistics', 2]],
      ['sql1', 'SQL: SELECT, WHERE, GROUP BY', 'SQL: SELECT, WHERE, GROUP BY', 'data', 3, 12, [], ['sql', 1]],
      ['sql2', 'SQL: JOINs and subqueries', 'SQL: JOIN ও সাবকোয়েরি', 'data', 3, 14, ['sql1'], ['sql', 2]],
      ['sql3', 'SQL: window functions', 'SQL: উইন্ডো ফাংশন', 'data', 2, 10, ['sql2'], ['sql', 3]],
      ['clean', 'Cleaning messy data', 'এলোমেলো ডেটা পরিষ্কার', 'data', 2, 8, ['excel']],
      ['dash', 'Dashboard in Power BI or Looker Studio', 'ড্যাশবোর্ড', 'tools', 3, 14, ['sql1', 'excel'], ['dashboard', 2]],
      ['py', 'Python and pandas', 'পাইথন ও pandas', 'code', 2, 20, ['stats'], ['python', 2]],
      ['story', 'Telling the story: one-page report', 'গল্প বলা: এক পাতার রিপোর্ট', 'work', 2, 5, ['dash'], ['communication', 2]],
      ['proj', 'Project: analyse a public dataset', 'প্রজেক্ট: পাবলিক ডেটাসেট বিশ্লেষণ', 'work', 3, 16, ['sql2', 'dash']],
    ]) },
  { kind: 'career', key: 'backend-dev', titleEn: 'Backend Developer', titleBn: 'ব্যাকএন্ড ডেভেলপার',
    summaryEn: 'Build and secure a REST API with a database, tests and Git.',
    summaryBn: 'ডেটাবেস, টেস্ট ও Git সহ নিরাপদ REST API তৈরি।',
    topics: T([
      ['git', 'Git and GitHub', 'Git ও GitHub', 'tools', 2, 6, [], ['git', 2]],
      ['lang', 'JavaScript (or Python) fundamentals', 'JavaScript (বা Python) মূলকথা', 'code', 3, 24, []],
      ['http', 'HTTP, JSON and REST', 'HTTP, JSON ও REST', 'web', 3, 6, ['lang']],
      ['server', 'A first server with routes', 'রুটসহ প্রথম সার্ভার', 'web', 3, 10, ['http']],
      ['db', 'Database: SQL or MongoDB', 'ডেটাবেস: SQL বা MongoDB', 'web', 3, 14, ['server'], ['sql', 1]],
      ['valid', 'Validation and error handling', 'ভ্যালিডেশন ও এরর হ্যান্ডলিং', 'web', 2, 5, ['server']],
      ['auth', 'Authentication with a provider', 'প্রোভাইডার দিয়ে অথেন্টিকেশন', 'web', 2, 6, ['db']],
      ['test', 'Automated endpoint tests', 'এন্ডপয়েন্ট টেস্ট', 'qa', 2, 6, ['server'], ['testing', 2]],
      ['dsa', 'Data structures basics', 'ডেটা স্ট্রাকচার মূলকথা', 'code', 2, 20, ['lang'], ['dsa', 2]],
      ['proj', 'Project: small API with auth and tests', 'প্রজেক্ট: auth ও টেস্টসহ ছোট API', 'work', 3, 14, ['db', 'auth', 'test']],
    ]) },
  { kind: 'pathway', key: 'higher-study', titleEn: 'Higher study abroad', titleBn: 'বিদেশে উচ্চশিক্ষা',
    summaryEn: 'SOP tips and an application checklist. Always confirm requirements on each university and funder website.',
    summaryBn: 'SOP টিপস ও আবেদনের চেকলিস্ট। প্রতিটি বিশ্ববিদ্যালয় ও অর্থায়নকারীর ওয়েবসাইটে শর্ত যাচাই করুন।',
    topics: T([
      ['goal', 'Decide the field, degree level and countries', 'বিষয়, ডিগ্রি ও দেশ ঠিক করা', 'prep', 3, 6],
      ['lang', 'Language test plan (for example IELTS or TOEFL) and a study schedule', 'ভাষা পরীক্ষার পরিকল্পনা ও পড়ার রুটিন', 'prep', 3, 30, ['goal']],
      ['short', 'Shortlist programs and note deadlines and requirements', 'প্রোগ্রাম বাছাই, শেষ তারিখ ও শর্ত লেখা', 'prep', 3, 8, ['goal']],
      ['research', 'Thesis, project or research experience', 'থিসিস, প্রজেক্ট বা গবেষণার অভিজ্ঞতা', 'build', 2, 40, ['goal']],
      ['cv', 'Academic CV', 'একাডেমিক সিভি', 'build', 2, 5, ['goal']],
      ['sop', 'Statement of purpose: first draft, mentor review, final', 'SOP: প্রথম খসড়া, মেন্টর রিভিউ, চূড়ান্ত', 'build', 3, 15, ['short', 'cv']],
      ['ref', 'Ask referees for recommendation letters early', 'সুপারিশপত্রের জন্য আগেভাগে অনুরোধ', 'build', 2, 3, ['short']],
      ['fund', 'Scholarship and funding checklist from official pages', 'স্কলারশিপ ও অর্থায়নের চেকলিস্ট (অফিসিয়াল পেজ থেকে)', 'build', 2, 6, ['short']],
      ['apply', 'Submit applications before each deadline', 'শেষ তারিখের আগে আবেদন জমা', 'launch', 3, 8, ['lang', 'sop', 'ref']],
      ['interview', 'Interview practice with a mentor', 'মেন্টরের সাথে ইন্টারভিউ অনুশীলন', 'launch', 1, 3, ['apply']],
    ]) },
  { kind: 'pathway', key: 'bcs', titleEn: 'BCS preparation', titleBn: 'বিসিএস প্রস্তুতি',
    summaryEn: 'A syllabus plan with weekly goals. Check the latest official circular for the current syllabus.',
    summaryBn: 'সিলেবাস পরিকল্পনা ও সাপ্তাহিক লক্ষ্য। বর্তমান সিলেবাসের জন্য সর্বশেষ অফিসিয়াল বিজ্ঞপ্তি দেখুন।',
    topics: T([
      ['circ', 'Read the official circular and syllabus', 'অফিসিয়াল বিজ্ঞপ্তি ও সিলেবাস পড়া', 'prep', 3, 3],
      ['plan', 'Weekly study plan and mock-test calendar', 'সাপ্তাহিক পড়ার পরিকল্পনা ও মডেল টেস্ট ক্যালেন্ডার', 'prep', 2, 2, ['circ']],
      ['bangla', 'Bangla language and literature', 'বাংলা ভাষা ও সাহিত্য', 'build', 3, 40, ['circ']],
      ['english', 'English language and literature', 'ইংরেজি ভাষা ও সাহিত্য', 'build', 3, 40, ['circ']],
      ['bd', 'Bangladesh affairs', 'বাংলাদেশ বিষয়াবলি', 'build', 3, 50, ['circ']],
      ['intl', 'International affairs', 'আন্তর্জাতিক বিষয়াবলি', 'build', 2, 30, ['circ']],
      ['sci', 'General science and ICT', 'সাধারণ বিজ্ঞান ও আইসিটি', 'build', 2, 30, ['circ']],
      ['math', 'Mathematical reasoning and mental ability', 'গাণিতিক যুক্তি ও মানসিক দক্ষতা', 'build', 2, 30, ['circ']],
      ['past', 'Practise previous questions', 'আগের প্রশ্ন অনুশীলন', 'launch', 3, 30, ['bangla', 'english', 'bd']],
      ['mock', 'Full-length timed mock tests', 'পূর্ণ সময় ধরে মডেল টেস্ট', 'launch', 3, 20, ['past']],
      ['viva', 'Written and viva practice', 'লিখিত ও ভাইভা অনুশীলন', 'launch', 1, 10, ['mock']],
    ]) },
  { kind: 'pathway', key: 'entrepreneurship', titleEn: 'Entrepreneurship', titleBn: 'উদ্যোক্তা',
    summaryEn: 'An idea check and your first 10 customers.',
    summaryBn: 'আইডিয়া যাচাই ও প্রথম ১০ জন গ্রাহক।',
    topics: T([
      ['problem', 'Write down the problem and who has it', 'সমস্যা ও কার সমস্যা তা লেখা', 'prep', 3, 3],
      ['talk', 'Talk to 10 possible customers', '১০ জন সম্ভাব্য গ্রাহকের সাথে কথা বলা', 'prep', 3, 10, ['problem']],
      ['value', 'One-sentence value proposition', 'এক বাক্যে মূল্য প্রস্তাব', 'prep', 2, 2, ['talk']],
      ['mvp', 'Smallest version you can test', 'পরীক্ষার জন্য ক্ষুদ্রতম সংস্করণ', 'build', 3, 20, ['value']],
      ['cost', 'Costs, price and a simple profit check', 'খরচ, দাম ও সহজ লাভের হিসাব', 'build', 2, 5, ['value']],
      ['rules', 'Check registration and local rules with an official source', 'নিবন্ধন ও স্থানীয় নিয়ম অফিসিয়াল সূত্রে যাচাই', 'build', 2, 4, ['value']],
      ['sell', 'First 10 customers', 'প্রথম ১০ জন গ্রাহক', 'launch', 3, 20, ['mvp', 'cost']],
      ['track', 'Track sales and feedback weekly', 'সাপ্তাহিক বিক্রি ও ফিডব্যাক ট্র্যাক', 'launch', 2, 3, ['sell']],
    ]) },
  { kind: 'pathway', key: 'freelancing', titleEn: 'Freelancing', titleBn: 'ফ্রিল্যান্সিং',
    summaryEn: 'Profile, pricing and safe payment.',
    summaryBn: 'প্রোফাইল, দাম নির্ধারণ ও নিরাপদ পেমেন্ট।',
    topics: T([
      ['skill', 'Choose one service and a skill level you can deliver', 'একটি সার্ভিস ও দেওয়ার মতো দক্ষতা বাছাই', 'prep', 3, 4],
      ['samples', '3 portfolio samples', '৩টি পোর্টফোলিও নমুনা', 'build', 3, 25, ['skill']],
      ['profile', 'Marketplace profile with a clear headline', 'পরিষ্কার শিরোনামসহ মার্কেটপ্লেস প্রোফাইল', 'build', 2, 3, ['samples']],
      ['price', 'Pricing: hourly or fixed, with a minimum', 'দাম: ঘণ্টা বা ফিক্সড, সর্বনিম্নসহ', 'build', 2, 2, ['skill']],
      ['safe', 'Safe payment: use the platform, never pay to get work, avoid off-platform deals', 'নিরাপদ পেমেন্ট: প্ল্যাটফর্ম ব্যবহার, কাজ পেতে টাকা নয়, প্ল্যাটফর্মের বাইরে নয়', 'build', 3, 2],
      ['proposal', 'Write short, specific proposals', 'ছোট ও নির্দিষ্ট প্রস্তাব লেখা', 'launch', 2, 4, ['profile', 'price']],
      ['first', 'Deliver the first job and ask for a review', 'প্রথম কাজ ডেলিভারি ও রিভিউ চাওয়া', 'launch', 3, 15, ['proposal', 'safe']],
    ]) },
];


// ---- plain functions (unit-tested) ----
// status per topic: 'verified' (evidence), 'known' (student ticked), 'ready' (prereqs known, can start), 'locked' (learn prerequisites first)
function analyse(target, known, evidence, weeklyHours) {
  const evOk = (t) => t.ev && (evidence[t.ev[0]] || 0) >= t.ev[1];
  const have = new Set();
  for (const t of target.topics) if (known.has(t.key) || evOk(t)) have.add(t.key);
  const topics = target.topics.map((t) => {
    const missing = t.needs.filter((n) => !have.has(n));
    const status = evOk(t) ? 'verified' : known.has(t.key) ? 'known' : missing.length ? 'locked' : 'ready';
    return { ...t, status, missing };
  });
  const sumW = target.topics.reduce((a, t) => a + t.w, 0);
  const haveW = target.topics.filter((t) => have.has(t.key)).reduce((a, t) => a + t.w, 0);
  const verW = topics.filter((t) => t.status === 'verified').reduce((a, t) => a + t.w, 0);
  // Order the remaining topics so prerequisites always come first (topological order).
  // Among topics that can be done now, the most important (higher w, then shorter) goes first.
  const remaining = topics.filter((t) => !have.has(t.key));
  const done = new Set(have); const path = [];
  const left = [...remaining];
  while (left.length) {
    const avail = left.filter((t) => t.needs.every((n) => done.has(n)));
    const pool = avail.length ? avail : left; // a cycle would be a data bug; never loop forever
    pool.sort((a, b) => b.w - a.w || a.hours - b.hours);
    const nx = pool[0]; left.splice(left.indexOf(nx), 1); done.add(nx.key); path.push(nx);
  }
  const hoursLeft = path.reduce((a, t) => a + t.hours, 0);
  const groups = {};
  for (const t of topics) { const g = (groups[t.group] ||= { w: 0, have: 0 }); g.w += t.w; if (have.has(t.key)) g.have += t.w; }
  return {
    percent: Math.round((100 * haveW) / sumW), verifiedPercent: Math.round((100 * verW) / sumW),
    topics, path, hoursLeft, weeksLeft: weeklyHours > 0 ? Math.ceil(hoursLeft / weeklyHours) : null,
    groups: Object.entries(groups).map(([k, g]) => ({ group: k, nameEn: G[k][0], nameBn: G[k][1], percent: Math.round((100 * g.have) / g.w) })),
  };
}
TARGETS.push(...require('./targets_more').MORE);

module.exports = { TARGETS, analyse, GROUPS: G };
