// Pure functions for the four "launch" features. No database here, so every rule can be unit-tested.
//   1. Career Passport  - a verified proof profile the student owns and can share.
//   2. Mentor Sprint    - a 7-day mission on one skill, closed by a mentor review.
//   3. Daily Brief      - one clear move for today, chosen by fixed rules.
//   4. Talent Pool      - companies search PROOF (quiz, reviewed project, endorsement), never CVs or contact details.
// Privacy and honesty rules used everywhere below:
//   - self-rated skills are never shown as proven
//   - no email, phone, address or location ever leaves through a passport
//   - the proof strength number is a transparent count, not a prediction

const { levelName } = require('../data/levels');

const nameOf = (displayName) => {
  const parts = String(displayName || '').trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || '';
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
};

const DEFAULT_SHOW = { skills: true, projects: true, endorsements: true, github: true, badges: true, sprints: true };

// ---------- 1. Career Passport ----------
// Best PROVEN level per skill. Self ratings are ignored here on purpose.
function provenSkills(evidence, skills) {
  const names = new Map((skills || []).map((s) => [s.key, s]));
  const best = new Map();
  for (const e of evidence || []) {
    if (e.type === 'self') continue;
    const cur = best.get(e.skillKey) || { level: 0, types: new Set(), endorsed: false };
    cur.level = Math.max(cur.level, e.level);
    cur.types.add(e.type);
    if (e.type === 'endorsement') cur.endorsed = true;
    best.set(e.skillKey, cur);
  }
  return [...best.entries()].map(([skillKey, v]) => {
    const s = names.get(skillKey) || {};
    const ln = levelName(v.level);
    return { skillKey, nameEn: s.nameEn || skillKey, nameBn: s.nameBn || skillKey, level: v.level, levelEn: ln.en, levelBn: ln.bn, proof: [...v.types].sort(), endorsed: v.endorsed };
  }).sort((a, b) => b.level - a.level || a.nameEn.localeCompare(b.nameEn));
}

// Proof strength: a plain count so the student can see exactly how to raise it. Max 100.
function proofStrength({ proven, projects, sprints, github }) {
  const parts = {
    skills: Math.min(40, 8 * proven.length),
    endorsed: Math.min(25, 8 * proven.filter((p) => p.endorsed).length),
    projects: Math.min(15, 5 * projects),
    sprints: Math.min(15, 5 * sprints),
    github: github ? 5 : 0,
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { score: Math.min(100, total), parts };
}

// What other people may see. `show` is the owner's choice, section by section.
function passportView({ user, university, evidence, skills, projects, github, badges, sprints, show, headline }) {
  const s = { ...DEFAULT_SHOW, ...(show || {}) };
  const proven = provenSkills(evidence, skills);
  const doneSprints = (sprints || []).filter((x) => x.status === 'completed' && x.badge);
  const strength = proofStrength({ proven, projects: (projects || []).length, sprints: doneSprints.length, github: !!(github && github.verified) });
  return {
    name: nameOf(user.displayName),
    university: university ? { name: university.name, shortName: university.shortName, city: university.city } : null,
    department: user.department || null,
    headline: headline || '',
    proofStrength: strength.score,
    proofParts: strength.parts,
    skills: s.skills ? proven.map((p) => (s.endorsements ? p : { ...p, endorsed: false, proof: p.proof.filter((x) => x !== 'endorsement') })) : [],
    projects: s.projects ? (projects || []).map((p) => ({ title: p.title, url: p.url, skillKeys: p.skillKeys || [], review: p.review || 'none' })) : [],
    github: s.github && github && github.verified ? { username: github.username, url: `https://github.com/${github.username}` } : null,
    badges: s.badges ? (badges || []).filter((b) => b.earned).map((b) => ({ id: b.id, titleEn: b.titleEn, titleBn: b.titleBn })) : [],
    sprints: s.sprints ? doneSprints.map((x) => ({ skillKey: x.skillKey, titleEn: x.titleEn, titleBn: x.titleBn, level: x.review && x.review.level })) : [],
    note: 'Skills listed here are backed by a quiz, a reviewed project or a mentor endorsement. Self-ratings are never shown as proof. No contact details are included.',
  };
}

// ---------- 2. Mentor Sprint ----------
// A fixed 7-day shape. Content comes from the skill name and (optionally) the student's weakest quiz topics.
function sprintDays(skill, weakTopics = []) {
  const en = skill.nameEn || skill.key, bn = skill.nameBn || skill.key;
  const w = weakTopics.filter(Boolean);
  const t1 = w[0], t2 = w[1];
  return [
    { n: 1, kind: 'quiz', titleEn: 'Baseline check', titleBn: 'শুরুর যাচাই', taskEn: `Take the ${en} quiz to see where you start.`, taskBn: `${bn} কুইজ দিয়ে দেখো তুমি কোথায় আছো।` },
    { n: 2, kind: 'learn', titleEn: t1 ? `Learn: ${t1}` : 'Learn the basics', titleBn: t1 ? `শেখো: ${t1}` : 'মূল বিষয় শেখো', taskEn: `Study one free resource on ${t1 || en} (about 45 minutes) and write 3 lines of notes.`, taskBn: `${t1 || bn} নিয়ে একটি বিনামূল্যের রিসোর্স (প্রায় ৪৫ মিনিট) পড়ো, ৩ লাইন নোট লেখো।` },
    { n: 3, kind: 'learn', titleEn: t2 ? `Learn: ${t2}` : 'Go one level deeper', titleBn: t2 ? `শেখো: ${t2}` : 'আরেকটু গভীরে যাও', taskEn: `Study a second resource on ${t2 || en} and solve 5 practice questions.`, taskBn: `${t2 || bn} নিয়ে আরেকটি রিসোর্স পড়ো, ৫টি অনুশীলন প্রশ্ন সমাধান করো।` },
    { n: 4, kind: 'build', titleEn: 'Start a mini-project', titleBn: 'ছোট প্রজেক্ট শুরু', taskEn: `Pick a small real problem and start solving it with ${en}.`, taskBn: `একটি ছোট বাস্তব সমস্যা বেছে ${bn} দিয়ে সমাধান শুরু করো।` },
    { n: 5, kind: 'build', titleEn: 'Finish the project', titleBn: 'প্রজেক্ট শেষ করো', taskEn: 'Finish it and write a short README: what it does and what you learned.', taskBn: 'শেষ করো এবং একটি ছোট README লেখো: কী করে আর কী শিখলে।' },
    { n: 6, kind: 'proof', titleEn: 'Publish your proof', titleBn: 'প্রমাণ প্রকাশ', taskEn: 'Put the project online (GitHub, Drive or a public page) and copy the https link.', taskBn: 'প্রজেক্টটি অনলাইনে রাখো (GitHub, Drive বা পাবলিক পেজ) এবং https লিংক কপি করো।' },
    { n: 7, kind: 'review', titleEn: 'Mentor review', titleBn: 'মেন্টর রিভিউ', taskEn: 'Retake the quiz, then send the project to your mentor for review.', taskBn: 'কুইজ আবার দাও, তারপর প্রজেক্ট রিভিউয়ের জন্য মেন্টরকে পাঠাও।' },
  ].map((d) => ({ ...d, done: false }));
}

// A sprint can be sent to the mentor after most of the work is done and a proof link exists.
function canSubmitSprint(sprint, proofUrl) {
  const done = (sprint.days || []).filter((d) => d.done).length;
  if (sprint.status !== 'active' && sprint.status !== 'needs_work') return { ok: false, reason: 'This sprint is not open for submission.' };
  if (done < 5) return { ok: false, reason: 'Finish at least 5 of the 7 days first.' };
  if (!/^https:\/\//i.test(String(proofUrl || ''))) return { ok: false, reason: 'Add your proof as a link that starts with https://' };
  return { ok: true };
}

// The mentor may endorse only up to their own level in this skill.
function endorseLevel(requested, mentorLevel) {
  const want = requested || 1;
  if (!mentorLevel || mentorLevel < want) return { ok: false, max: mentorLevel || 0 };
  return { ok: true, level: want };
}

function sprintDayIndex(sprint, now = new Date()) {
  const start = new Date(sprint.startedAt || sprint.createdAt || now);
  return Math.max(1, Math.min(7, Math.floor((now - start) / 864e5) + 1));
}

// ---------- 3. Daily Brief ----------
// Fixed priority. The first rule that applies is "the one move"; the next two are "also today".
function dailyBrief(ctx, now = new Date()) {
  const moves = [];
  const hoursTo = (d) => (new Date(d).getTime() - now.getTime()) / 36e5;
  if (ctx.nextSession && hoursTo(ctx.nextSession.at) > 0 && hoursTo(ctx.nextSession.at) <= 24) {
    moves.push({ kind: 'session', route: '/sessions', titleEn: `Prepare for your session with ${ctx.nextSession.mentor}`, titleBn: `${ctx.nextSession.mentor}-এর সাথে সেশনের প্রস্তুতি নাও`, whyEn: 'It is within 24 hours. Write your 2 best questions.', whyBn: 'সেশন ২৪ ঘণ্টার মধ্যে। তোমার ২টি সেরা প্রশ্ন লিখে রাখো।' });
  }
  if (ctx.sprint && ctx.sprint.status === 'active') {
    const day = ctx.sprint.dayIndex, d = (ctx.sprint.days || [])[day - 1];
    const open = (ctx.sprint.days || []).find((x) => !x.done);
    const pick = open || d;
    if (pick) moves.push({ kind: 'sprint', route: '/sprints', titleEn: `Sprint day ${pick.n}: ${pick.titleEn}`, titleBn: `স্প্রিন্ট দিন ${pick.n}: ${pick.titleBn}`, whyEn: pick.taskEn, whyBn: pick.taskBn });
  }
  if (ctx.sprint && ctx.sprint.status === 'needs_work') {
    moves.push({ kind: 'sprint', route: '/sprints', titleEn: 'Your mentor asked for a little more work', titleBn: 'মেন্টর আরেকটু কাজ চেয়েছেন', whyEn: 'Read the note, fix it and send it again.', whyBn: 'নোটটি পড়ো, ঠিক করে আবার পাঠাও।' });
  }
  if (ctx.dueTask) {
    moves.push({ kind: 'task', route: '/plan', titleEn: `Finish: ${ctx.dueTask.title}`, titleBn: `শেষ করো: ${ctx.dueTask.title}`, whyEn: ctx.dueTask.overdue ? 'It is overdue. A small step today keeps your plan alive.' : 'It is due soon.', whyBn: ctx.dueTask.overdue ? 'সময় পেরিয়ে গেছে। আজ ছোট একটি পদক্ষেপ নাও।' : 'শীঘ্রই শেষ করার সময়।' });
  }
  if (ctx.topGap && !ctx.topGap.hasProof) {
    moves.push({ kind: 'quiz', route: `/quiz/${ctx.topGap.skillKey}`, titleEn: `Prove your ${ctx.topGap.nameEn}`, titleBn: `${ctx.topGap.nameBn} প্রমাণ করো`, whyEn: 'It is your biggest gap and has no proof yet. A 10-minute quiz makes it count.', whyBn: 'এটি তোমার সবচেয়ে বড় ঘাটতি আর এখনও প্রমাণ নেই। ১০ মিনিটের কুইজ এটি গণনায় আনবে।' });
  }
  if (ctx.closingJob) {
    moves.push({ kind: 'job', route: `/opportunity/${ctx.closingJob.id}`, titleEn: `Closing soon: ${ctx.closingJob.title}`, titleBn: `শীঘ্রই শেষ: ${ctx.closingJob.title}`, whyEn: `Deadline in ${ctx.closingJob.daysLeft} day(s) and you meet ${ctx.closingJob.fit}% of it.`, whyBn: `আর ${ctx.closingJob.daysLeft} দিন বাকি এবং তুমি ${ctx.closingJob.fit}% মানো।` });
  }
  if (!ctx.hasGoal) {
    moves.unshift({ kind: 'goal', route: '/goal', titleEn: 'Choose your career goal', titleBn: 'ক্যারিয়ার লক্ষ্য বেছে নাও', whyEn: 'Everything else (gaps, mentors, jobs) starts from this.', whyBn: 'ঘাটতি, মেন্টর, চাকরি—সবকিছু এখান থেকেই শুরু।' });
  }
  if (!moves.length) {
    moves.push({ kind: 'explore', route: '/career-graph', titleEn: 'Explore your pathway map', titleBn: 'তোমার পথের মানচিত্র দেখো', whyEn: 'You are up to date. See what comes next on your path.', whyBn: 'সব হালনাগাদ। পরের ধাপ কী দেখো।' });
  }
  return { move: moves[0], also: moves.slice(1, 3), streakDays: ctx.streakDays || 0 };
}

// Weekly card the student may share. First name + initial only, no scores that could identify someone else.
function weekCard({ name, tasksDone, sprintDays: sd, quizzes, proofStrength: ps, readinessNow, readinessWeekAgo }) {
  const delta = readinessNow != null && readinessWeekAgo != null ? readinessNow - readinessWeekAgo : null;
  const line = (en, bn) => ({ en, bn });
  const items = [
    line(`${tasksDone} plan task(s) done`, `${tasksDone}টি পরিকল্পনার কাজ শেষ`),
    line(`${sd} sprint day(s)`, `${sd} দিনের স্প্রিন্ট কাজ`),
    line(`${quizzes} quiz(zes) taken`, `${quizzes}টি কুইজ`),
  ];
  return {
    name, items, proofStrength: ps,
    readinessDelta: delta,
    headlineEn: delta != null && delta > 0 ? `${name} moved +${delta}% closer to the goal this week` : `${name}'s week on MentorLink`,
    headlineBn: delta != null && delta > 0 ? `${name} এই সপ্তাহে লক্ষ্যের +${delta}% কাছে এসেছে` : `${name}-এর মেন্টরলিংক সপ্তাহ`,
  };
}

// ---------- 4. Talent Pool ----------
// "sql:2,python:1" -> [{skillKey:'sql', minLevel:2}, ...]
function parseWanted(text) {
  const out = [];
  for (const part of String(text || '').split(',')) {
    const [k, l] = part.trim().toLowerCase().split(':');
    if (!k || !/^[a-z0-9_-]{1,40}$/.test(k)) continue;
    const lv = Math.max(1, Math.min(3, parseInt(l || '1', 10) || 1));
    if (!out.some((o) => o.skillKey === k)) out.push({ skillKey: k, minLevel: lv });
    if (out.length >= 6) break;
  }
  return out;
}

// Only PROVEN levels count. Missing proof is shown as "not proven", never as "does not know it".
function talentMatch(proven, wanted) {
  const have = new Map(proven.map((p) => [p.skillKey, p]));
  const matched = [], notProven = [];
  for (const w of wanted) {
    const p = have.get(w.skillKey);
    if (p && p.level >= w.minLevel) matched.push({ skillKey: w.skillKey, level: p.level, endorsed: p.endorsed });
    else notProven.push({ skillKey: w.skillKey, needLevel: w.minLevel, haveLevel: p ? p.level : 0 });
  }
  const pct = wanted.length ? Math.round((100 * matched.length) / wanted.length) : 0;
  return { pct, matched, notProven };
}

module.exports = { nameOf, DEFAULT_SHOW, provenSkills, proofStrength, passportView, sprintDays, canSubmitSprint, endorseLevel, sprintDayIndex, dailyBrief, weekCard, parseWanted, talentMatch };
