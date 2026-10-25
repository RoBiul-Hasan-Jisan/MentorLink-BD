// Learning roadmaps: skill -> 3 stages (beginner, intermediate, advanced) -> topics with estimated hours.
// Topics are plain study goals. Links are NOT stored here: the API attaches the approved learning resources of the same skill,
// so there are no invented URLs. Hours are rough planning estimates, not measured data.
const { Roadmap } = require('../models');

// [skillKey, summaryEn, summaryBn, [ [stageEn, stageBn, [ [topicEn, topicBn, hours], ... ]], ... ] ]
const DATA = [
  ['sql', 'Learn to ask questions of data with SQL, from reading one table to joining many.', 'এসকিউএল দিয়ে ডেটা থেকে প্রশ্নের উত্তর বের করা শিখুন।', [
    ['Beginner: read data', 'শুরু: ডেটা পড়া', [['What a database, table, row and column are', 'ডেটাবেস, টেবিল, সারি ও কলাম', 2], ['SELECT, WHERE, ORDER BY, LIMIT', 'SELECT, WHERE, ORDER BY, LIMIT', 4], ['COUNT, SUM, AVG, GROUP BY', 'COUNT, SUM, AVG, GROUP BY', 4]]],
    ['Intermediate: combine data', 'মাঝারি: ডেটা জোড়া', [['INNER and LEFT JOIN', 'INNER ও LEFT JOIN', 5], ['HAVING, subqueries, CASE', 'HAVING, সাবকোয়েরি, CASE', 5], ['Create tables, INSERT, UPDATE, keys', 'টেবিল তৈরি, INSERT, UPDATE, কী', 4]]],
    ['Advanced: analysis queries', 'উন্নত: বিশ্লেষণ', [['Window functions (RANK, running total)', 'উইন্ডো ফাংশন', 6], ['Indexes and reading a query plan', 'ইনডেক্স ও কোয়েরি প্ল্যান', 4], ['Mini project: answer 10 business questions', 'মিনি প্রজেক্ট: ১০টি ব্যবসায়িক প্রশ্ন', 8]]],
  ]],
  ['excel', 'From tidy tables to pivot tables and a one-page report.', 'গোছানো টেবিল থেকে পিভট টেবিল ও রিপোর্ট পর্যন্ত।', [
    ['Beginner: clean sheets', 'শুরু: গোছানো শিট', [['Cells, formats, sorting and filtering', 'সেল, ফরম্যাট, সর্ট ও ফিল্টার', 3], ['Basic formulas: SUM, AVERAGE, IF', 'মৌলিক ফর্মুলা: SUM, AVERAGE, IF', 3], ['Charts: pick the right one', 'চার্ট: সঠিকটি বাছাই', 2]]],
    ['Intermediate: lookups and pivots', 'মাঝারি: লুকআপ ও পিভট', [['VLOOKUP / XLOOKUP, SUMIF, COUNTIF', 'VLOOKUP / XLOOKUP, SUMIF, COUNTIF', 4], ['PivotTables and slicers', 'পিভট টেবিল ও স্লাইসার', 4], ['Data cleaning: TRIM, text functions, duplicates', 'ডেটা পরিষ্কার', 3]]],
    ['Advanced: reporting', 'উন্নত: রিপোর্টিং', [['Conditional formatting and data validation', 'কন্ডিশনাল ফরম্যাটিং ও ভ্যালিডেশন', 3], ['Dashboards in Excel', 'এক্সেলে ড্যাশবোর্ড', 4], ['Mini project: monthly sales report', 'মিনি প্রজেক্ট: মাসিক বিক্রয় রিপোর্ট', 6]]],
  ]],
  ['python', 'Write small programs, then work with data using Python.', 'ছোট প্রোগ্রাম লিখে পাইথনে ডেটা নিয়ে কাজ শিখুন।', [
    ['Beginner: the language', 'শুরু: ভাষা', [['Install Python, variables, types, input/output', 'ইনস্টল, ভ্যারিয়েবল, টাইপ', 4], ['if/else, loops, functions', 'if/else, লুপ, ফাংশন', 6], ['Lists, dictionaries, tuples, files', 'লিস্ট, ডিকশনারি, ফাইল', 6]]],
    ['Intermediate: tools', 'মাঝারি: টুলস', [['Modules, virtual environments, errors', 'মডিউল, ভার্চুয়াল এনভায়রনমেন্ট, এরর', 4], ['pandas: load, clean, group data', 'pandas: লোড, ক্লিন, গ্রুপ', 8], ['Charts with matplotlib', 'matplotlib দিয়ে চার্ট', 4]]],
    ['Advanced: real work', 'উন্নত: বাস্তব কাজ', [['Read from an API or database', 'API বা ডেটাবেস থেকে পড়া', 5], ['Testing with pytest', 'pytest দিয়ে টেস্ট', 4], ['Mini project: analyse a public dataset', 'মিনি প্রজেক্ট: পাবলিক ডেটাসেট বিশ্লেষণ', 10]]],
  ]],
  ['statistics', 'Understand data well enough to avoid wrong conclusions.', 'ভুল সিদ্ধান্ত এড়াতে ডেটা বোঝা শিখুন।', [
    ['Beginner: describe data', 'শুরু: ডেটা বর্ণনা', [['Mean, median, mode, range', 'গড়, মধ্যমা, প্রচুরক, পরিসর', 3], ['Variance and standard deviation', 'ভেদ ও পরিমিত বিচ্যুতি', 3], ['Charts: histogram, box plot', 'হিস্টোগ্রাম, বক্স প্লট', 2]]],
    ['Intermediate: probability and samples', 'মাঝারি: সম্ভাবনা ও নমুনা', [['Probability basics, normal distribution', 'সম্ভাবনা, স্বাভাবিক বণ্টন', 5], ['Sampling and confidence intervals', 'নমুনায়ন ও আস্থা ব্যবধান', 5], ['Correlation is not causation', 'সম্পর্ক মানেই কারণ নয়', 2]]],
    ['Advanced: testing ideas', 'উন্নত: ধারণা যাচাই', [['Hypothesis tests and p-values', 'হাইপোথিসিস টেস্ট ও p-মান', 6], ['Simple linear regression', 'সরল রৈখিক রিগ্রেশন', 6], ['Mini project: A/B test write-up', 'মিনি প্রজেক্ট: A/B টেস্ট', 6]]],
  ]],
  ['dashboard', 'Turn numbers into a clear, honest dashboard people can act on.', 'সংখ্যাকে পরিষ্কার ড্যাশবোর্ডে রূপ দিন।', [
    ['Beginner: choose the right chart', 'শুরু: সঠিক চার্ট', [['Ask the question first, then pick the chart', 'আগে প্রশ্ন, তারপর চার্ট', 2], ['Bar, line, table: when to use each', 'বার, লাইন, টেবিল', 2], ['KPI cards and colour with meaning', 'KPI কার্ড ও অর্থবোধক রং', 2]]],
    ['Intermediate: build in a tool', 'মাঝারি: টুলে তৈরি', [['Power BI or Looker Studio: connect data', 'ডেটা সংযোগ', 4], ['Data model, relationships, filters and slicers', 'ডেটা মডেল, ফিল্টার', 5], ['Measures and DAX basics', 'মেজার ও DAX', 6]]],
    ['Advanced: publish and explain', 'উন্নত: প্রকাশ ও ব্যাখ্যা', [['Layout, accessibility, avoiding misleading axes', 'লেআউট ও বিভ্রান্তিকর অক্ষ এড়ানো', 3], ['Refresh and share', 'রিফ্রেশ ও শেয়ার', 2], ['Mini project: sales dashboard with a one-page story', 'মিনি প্রজেক্ট: বিক্রয় ড্যাশবোর্ড', 8]]],
  ]],
  ['communication', 'Speak, write and listen clearly at work and in interviews.', 'কাজে ও ইন্টারভিউতে পরিষ্কারভাবে বলা, লেখা ও শোনা।', [
    ['Beginner: basics', 'শুরু: মূলকথা', [['Clear short emails and messages', 'পরিষ্কার সংক্ষিপ্ত ইমেইল', 2], ['Active listening', 'মনোযোগ দিয়ে শোনা', 2], ['Introduce yourself in 60 seconds', '৬০ সেকেন্ডে পরিচয়', 2]]],
    ['Intermediate: interviews', 'মাঝারি: ইন্টারভিউ', [['STAR method for answers', 'STAR পদ্ধতি', 3], ['Common questions and honest answers', 'সাধারণ প্রশ্ন ও সৎ উত্তর', 3], ['A one-page CV', 'এক পাতার সিভি', 3]]],
    ['Advanced: teams', 'উন্নত: দল', [['Giving and receiving feedback', 'ফিডব্যাক দেওয়া ও নেওয়া', 3], ['Presenting to a group', 'দলের সামনে উপস্থাপনা', 4], ['Mock interview with a mentor', 'মেন্টরের সাথে মক ইন্টারভিউ', 2]]],
  ]],
  ['git', 'Save your work safely and collaborate without overwriting each other.', 'কাজ নিরাপদে সংরক্ষণ ও একসাথে কাজ করা।', [
    ['Beginner: local history', 'শুরু: লোকাল হিস্ট্রি', [['init, add, commit, status, log', 'init, add, commit, status, log', 2], ['.gitignore and good commit messages', '.gitignore ও কমিট মেসেজ', 1]]],
    ['Intermediate: branches and remotes', 'মাঝারি: ব্রাঞ্চ ও রিমোট', [['Branches and merging', 'ব্রাঞ্চ ও মার্জ', 3], ['GitHub: clone, push, pull', 'GitHub: ক্লোন, পুশ, পুল', 2], ['Resolving merge conflicts', 'মার্জ কনফ্লিক্ট', 2]]],
    ['Advanced: teamwork', 'উন্নত: দলগত কাজ', [['Pull requests and code review', 'পুল রিকোয়েস্ট ও রিভিউ', 3], ['Rebase, stash, undoing mistakes safely', 'rebase, stash, ভুল ফেরানো', 3]]],
  ]],
  ['dsa', 'Learn to store and search data efficiently, the base for coding interviews.', 'দক্ষভাবে ডেটা রাখা ও খোঁজা, কোডিং ইন্টারভিউয়ের ভিত্তি।', [
    ['Beginner: building blocks', 'শুরু: মূল উপাদান', [['Big-O: how to compare solutions', 'Big-O', 4], ['Arrays, strings, hash maps', 'অ্যারে, স্ট্রিং, হ্যাশ ম্যাপ', 8], ['Stacks and queues', 'স্ট্যাক ও কিউ', 5]]],
    ['Intermediate: structures', 'মাঝারি: কাঠামো', [['Linked lists, recursion', 'লিঙ্কড লিস্ট, রিকার্সন', 8], ['Trees and binary search', 'ট্রি ও বাইনারি সার্চ', 8], ['Sorting algorithms', 'সর্টিং', 6]]],
    ['Advanced: problem solving', 'উন্নত: সমস্যা সমাধান', [['Graphs: BFS and DFS', 'গ্রাফ: BFS ও DFS', 8], ['Dynamic programming basics', 'ডাইনামিক প্রোগ্রামিং', 10], ['Practice: 30 mixed problems', 'অনুশীলন: ৩০টি সমস্যা', 20]]],
  ]],
  ['backend', 'Build and secure a REST API backed by a database.', 'ডেটাবেসসহ নিরাপদ REST API তৈরি।', [
    ['Beginner: web basics', 'শুরু: ওয়েব মূলকথা', [['HTTP, JSON, REST ideas', 'HTTP, JSON, REST', 4], ['JavaScript or Python for servers', 'সার্ভারের জন্য JavaScript বা Python', 8], ['A first server with two routes', 'দুই রুটের প্রথম সার্ভার', 4]]],
    ['Intermediate: data and structure', 'মাঝারি: ডেটা ও কাঠামো', [['Express (or Flask) routing and middleware', 'রাউটিং ও মিডলওয়্যার', 5], ['MongoDB or SQL database access', 'ডেটাবেস অ্যাক্সেস', 6], ['Validation and error handling', 'ভ্যালিডেশন ও এরর হ্যান্ডলিং', 4]]],
    ['Advanced: production habits', 'উন্নত: প্রোডাকশন', [['Authentication with a provider (no hand-made tokens)', 'অথেন্টিকেশন (প্রোভাইডার দিয়ে)', 5], ['Automated tests for endpoints', 'এন্ডপয়েন্ট টেস্ট', 5], ['Mini project: a small API with auth and tests', 'মিনি প্রজেক্ট', 12]]],
  ]],
  ['testing', 'Find problems before users do, with clear test cases and bug reports.', 'ব্যবহারকারীর আগে সমস্যা খুঁজে বের করা।', [
    ['Beginner: testing ideas', 'শুরু: টেস্টিং ধারণা', [['What testing is and the test levels', 'টেস্টিং কী ও স্তর', 3], ['Writing a test case', 'টেস্ট কেস লেখা', 3], ['Writing a clear bug report', 'পরিষ্কার বাগ রিপোর্ট', 2]]],
    ['Intermediate: techniques', 'মাঝারি: কৌশল', [['Boundary values and equivalence classes', 'বাউন্ডারি ভ্যালু ও ইকুইভ্যালেন্স ক্লাস', 4], ['Regression and exploratory testing', 'রিগ্রেশন ও এক্সপ্লোরেটরি', 4], ['Test plans and a bug tracker', 'টেস্ট প্ল্যান ও বাগ ট্র্যাকার', 3]]],
    ['Advanced: automation', 'উন্নত: অটোমেশন', [['API testing with a tool such as Postman', 'API টেস্টিং', 5], ['A first automated UI or unit test', 'প্রথম অটোমেটেড টেস্ট', 6], ['Mini project: test a small app and report bugs', 'মিনি প্রজেক্ট', 8]]],
  ]],
  ['accounting', 'Read and record the money story of a business.', 'ব্যবসার আর্থিক লেনদেন পড়া ও লেখা।', [
    ['Beginner: the language', 'শুরু: ভাষা', [['Assets, liabilities, equity, income, expenses', 'সম্পদ, দায়, মালিকানা, আয়, ব্যয়', 4], ['Double entry and the accounting equation', 'ডাবল এন্ট্রি', 4], ['Journal and ledger', 'জার্নাল ও লেজার', 4]]],
    ['Intermediate: statements', 'মাঝারি: বিবরণী', [['Trial balance', 'ট্রায়াল ব্যালেন্স', 3], ['Income statement and balance sheet', 'আয় বিবরণী ও স্থিতিপত্র', 6], ['Cash flow basics', 'নগদ প্রবাহ', 4]]],
    ['Advanced: use it', 'উন্নত: ব্যবহার', [['Ratios: profitability and liquidity', 'অনুপাত বিশ্লেষণ', 5], ['Accounting in Excel', 'এক্সেলে হিসাব', 5], ['Mini project: statements for a small shop', 'মিনি প্রজেক্ট: ছোট দোকানের বিবরণী', 8]]],
  ]],
  ['banking', 'Understand how banks work, for banking trainee roles and interviews.', 'ব্যাংক কীভাবে কাজ করে, ট্রেইনি পদ ও ইন্টারভিউয়ের জন্য।', [
    ['Beginner: how banks work', 'শুরু: ব্যাংক কীভাবে চলে', [['What banks do: deposits, loans, payments', 'আমানত, ঋণ, পেমেন্ট', 3], ['Types of accounts and banks in Bangladesh', 'হিসাবের ধরন ও বাংলাদেশের ব্যাংক', 3], ['The role of Bangladesh Bank', 'বাংলাদেশ ব্যাংকের ভূমিকা', 3]]],
    ['Intermediate: products and risk', 'মাঝারি: পণ্য ও ঝুঁকি', [['Loans, interest and credit basics', 'ঋণ, সুদ ও ক্রেডিট', 5], ['Mobile banking and digital payments', 'মোবাইল ব্যাংকিং', 3], ['KYC and anti-money-laundering basics', 'KYC ও মানি লন্ডারিং প্রতিরোধ', 4]]],
    ['Advanced: interview ready', 'উন্নত: ইন্টারভিউ প্রস্তুতি', [['Current banking news and ratios', 'ব্যাংকিং সংবাদ ও অনুপাত', 4], ['Customer service scenarios', 'গ্রাহকসেবা পরিস্থিতি', 3], ['Mock interview with a mentor', 'মেন্টরের সাথে মক ইন্টারভিউ', 2]]],
  ]],
  ['leadership', 'Lead small teams by planning, deciding and building trust.', 'পরিকল্পনা, সিদ্ধান্ত ও আস্থা দিয়ে ছোট দল নেতৃত্ব।', [
    ['Beginner: self', 'শুরু: নিজেকে জানা', [['Time management and priorities', 'সময় ব্যবস্থাপনা', 3], ['Taking responsibility', 'দায়িত্ব নেওয়া', 2], ['Setting a clear goal', 'স্পষ্ট লক্ষ্য', 2]]],
    ['Intermediate: working with others', 'মাঝারি: অন্যদের সাথে', [['Delegation and follow-up', 'দায়িত্ব বণ্টন', 3], ['Running a short meeting', 'ছোট মিটিং পরিচালনা', 2], ['Resolving conflict', 'দ্বন্দ্ব সমাধান', 3]]],
    ['Advanced: lead a project', 'উন্নত: প্রজেক্ট নেতৃত্ব', [['Plan and track a team project', 'দলীয় প্রজেক্ট পরিকল্পনা', 5], ['Motivating and giving feedback', 'অনুপ্রেরণা ও ফিডব্যাক', 3], ['Lead a real student club or class project', 'ক্লাব বা ক্লাস প্রজেক্ট নেতৃত্ব', 10]]],
  ]],
  ['ielts', 'Build English for study abroad: the four skills plus test habits.', 'বিদেশে পড়ার জন্য ইংরেজি: চার দক্ষতা ও টেস্ট কৌশল।', [
    ['Beginner: foundations', 'শুরু: ভিত্তি', [['Know the test format and your target band', 'টেস্ট ফরম্যাট ও লক্ষ্য ব্যান্ড', 2], ['Core grammar and vocabulary', 'ব্যাকরণ ও শব্দভান্ডার', 15], ['Daily listening and reading habit', 'প্রতিদিনের শোনা ও পড়া', 10]]],
    ['Intermediate: skills', 'মাঝারি: দক্ষতা', [['Reading: skimming and scanning', 'রিডিং', 8], ['Listening: note-taking and distractors', 'লিসনিং', 8], ['Writing Task 1 and Task 2 structure', 'রাইটিং', 10], ['Speaking: parts 1 to 3', 'স্পিকিং', 8]]],
    ['Advanced: test practice', 'উন্নত: টেস্ট অনুশীলন', [['Full timed practice tests', 'সময় ধরে পূর্ণ পরীক্ষা', 12], ['Get feedback on writing and speaking', 'রাইটিং ও স্পিকিংয়ে ফিডব্যাক', 6]]],
  ]],
  ['research', 'Read papers, plan a small study and write it up, for higher study applications.', 'উচ্চশিক্ষার জন্য গবেষণাপত্র পড়া, পরিকল্পনা ও লেখা।', [
    ['Beginner: reading research', 'শুরু: গবেষণা পড়া', [['Find papers (Google Scholar) and read an abstract', 'পেপার খোঁজা ও অ্যাবস্ট্র্যাক্ট পড়া', 3], ['Structure of a paper', 'পেপারের কাঠামো', 2], ['Keeping notes and references', 'নোট ও রেফারেন্স', 2]]],
    ['Intermediate: plan a study', 'মাঝারি: গবেষণা পরিকল্পনা', [['Research question and literature review', 'গবেষণা প্রশ্ন ও সাহিত্য পর্যালোচনা', 6], ['Methods and simple data collection', 'পদ্ধতি ও ডেটা সংগ্রহ', 5], ['Basic statistics for your data', 'ডেটার জন্য মৌলিক পরিসংখ্যান', 5]]],
    ['Advanced: write and apply', 'উন্নত: লেখা ও আবেদন', [['Write a short report or thesis section', 'ছোট রিপোর্ট লেখা', 10], ['Statement of purpose and email to a professor', 'SOP ও প্রফেসরকে ইমেইল', 6], ['Get feedback from a mentor or teacher', 'মেন্টর বা শিক্ষকের ফিডব্যাক', 3]]],
  ]],
];
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const LEVELS = ['beginner', 'intermediate', 'advanced'];

async function seedRoadmaps() {
  for (const [skillKey, summaryEn, summaryBn, stages] of DATA) {
    const doc = {
      skillKey, summaryEn, summaryBn,
      stages: stages.map(([titleEn, titleBn, topics], i) => ({
        level: LEVELS[i], titleEn, titleBn,
        topics: topics.map(([tEn, tBn, hours]) => ({ key: `${LEVELS[i][0]}-${slug(tEn)}`, titleEn: tEn, titleBn: tBn, hours })),
      })),
    };
    await Roadmap.updateOne({ skillKey }, { $set: doc }, { upsert: true });
  }
  return DATA.length;
}
module.exports = { seedRoadmaps, DATA };
