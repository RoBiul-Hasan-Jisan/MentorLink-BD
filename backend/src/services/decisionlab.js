// Career Decision Lab: compare roles, rank skills by a transparent priority, and run what-if scenarios.
// Pure functions (no database) so every number can be unit-tested and explained on screen.
//
//   P(s) = D(s) x W(s) x G(s)
//   D = share of relevant approved postings that ask for the skill (1 when there are too few postings: see MIN_POSTINGS)
//   W = importance of the skill for the role (template weight / largest weight; DEMAND_ONLY_W for skills only postings ask for)
//   G = normalised gap = (required level - current level) / required level
//
// A what-if result is HYPOTHETICAL. It never creates evidence and never raises the "proven" score.
const { computeReadiness, levelsFromEvidence } = require('./readiness');
const { relevantPostings, demand } = require('./jobgap');

const MIN_POSTINGS = 3;      // below this, posting shares are too noisy: fall back to the role template (D = 1)
const DEMAND_ONLY_W = 0.3;   // importance given to a skill that postings ask for but the role template does not list
const r2 = (x) => Math.round(x * 100) / 100;

// Skill prerequisites derived from the existing topic graph (data/targets*.js):
// if topic A (linked to skill SA at level LA) needs topic B (linked to skill SB at level LB), then SA needs SB at level LB first.
// Same-skill steps (SQL 1 -> SQL 2) are ignored. If two skills need each other in different targets, both edges are dropped.
function skillPrereqs(targets) {
  const out = new Map();
  for (const t of targets) {
    const byKey = new Map(t.topics.map((x) => [x.key, x]));
    for (const topic of t.topics) {
      if (!topic.ev) continue;
      const [sa] = topic.ev;
      for (const nk of topic.needs) {
        const need = byKey.get(nk);
        if (!need || !need.ev) continue;
        const [sb, lb] = need.ev;
        if (sb === sa) continue;
        const m = out.get(sa) || new Map();
        m.set(sb, Math.max(m.get(sb) || 0, lb));
        out.set(sa, m);
      }
    }
  }
  for (const [a, m] of out) for (const b of [...m.keys()]) { const back = out.get(b); if (back && back.has(a)) { m.delete(b); back.delete(a); } }
  return out;
}

// Rank every skill that matters for the role (template skills + skills the postings ask for).
function rankSkills({ role, evidence, postings, prereqs }) {
  const have = levelsFromEvidence(evidence);
  const dem = demand(postings);
  const useDemand = postings.length >= MIN_POSTINGS;
  const demBy = new Map(dem.map((d) => [d.skillKey, d]));
  const tmpl = new Map(role.requiredSkills.map((s) => [s.skillKey, s]));
  const maxW = Math.max(1, ...role.requiredSkills.map((s) => s.weight));
  const keys = new Set([...tmpl.keys(), ...(useDemand ? dem.map((d) => d.skillKey) : [])]);
  const rows = [];
  for (const k of keys) {
    const t = tmpl.get(k), d = demBy.get(k);
    const required = t ? t.requiredLevel : d.level;
    const cur = (have[k] || { level: 0 }).level;
    if (cur >= required) continue; // no gap: not a candidate for "next"
    const D = useDemand ? (d ? d.share : 0) : 1;
    const W = t ? t.weight / maxW : DEMAND_ONLY_W;
    const G = (required - cur) / required;
    const unmet = [];
    const pre = (prereqs && prereqs.get(k)) || new Map();
    for (const [pk, pl] of pre) if (keys.has(pk) && ((have[pk] || { level: 0 }).level) < pl) unmet.push({ skillKey: pk, level: pl }); // only prerequisites that matter for THIS role
    rows.push({
      skillKey: k, current: cur, required, evidence: have[k] ? (have[k].nonSelf ? 'verified' : 'self') : 'none',
      D: r2(D), W: r2(W), G: r2(G), priority: r2(D * W * G),
      postings: d ? d.postings : 0, startable: unmet.length === 0, learnFirst: unmet,
    });
  }
  rows.sort((a, b) => b.priority - a.priority || a.skillKey.localeCompare(b.skillKey));
  return { rows, basis: useDemand ? 'postings' : 'role_template' };
}

// Readiness counting ONLY proof (quiz, project, endorsement). Self ratings count as 0.
function provenReadiness(role, evidence, skills) {
  return computeReadiness({ role, evidence: evidence.filter((e) => e.type !== 'self'), skills, weeklyHours: 0 }).readiness;
}

function analyzeRole({ role, evidence, skills, weeklyHours, allPostings, prereqs }) {
  const posts = relevantPostings(allPostings, role);
  const base = computeReadiness({ role, evidence, skills, weeklyHours });
  const { rows, basis } = rankSkills({ role, evidence, postings: posts, prereqs });
  const next = rows.find((x) => x.startable) || null;
  return {
    role: { key: role.key, titleEn: role.titleEn, titleBn: role.titleBn },
    readiness: base.readiness, provenReadiness: provenReadiness(role, evidence, skills), confidence: base.confidence,
    totalHours: base.totalHours, timeToReadyWeeks: base.timeToReadyWeeks,
    postings: { used: posts.length, small: posts.length < MIN_POSTINGS, basis },
    skills: rows, next, blocked: rows.filter((x) => !x.startable),
  };
}

// Compare roles: higher readiness first, then fewer hours left.
function compareRoles(items) {
  return [...items].sort((a, b) => b.readiness - a.readiness || a.totalHours - b.totalHours)
    .map((x, i) => ({ ...x, fitRank: i + 1 }));
}

// What if the student reached these levels? learn = [{ skillKey, level }]. Hypothetical evidence is typed 'self'
// so it can never count as proof, and the hours it would cost are reported with it.
// weeklyHours is the study pace ASSUMED for this scenario (the route passes the request's scenario value, else the saved
// profile value). It only changes the week estimates; it is never stored. delta is in percentage points.
function simulate({ role, evidence, skills, weeklyHours, learn, hoursSource }) {
  const have = levelsFromEvidence(evidence);
  const skillMap = new Map(skills.map((s) => [s.key, s]));
  const extra = [], steps = [];
  let addedHours = 0;
  for (const l of learn) {
    const cur = (have[l.skillKey] || { level: 0 }).level;
    if (l.level <= cur) { steps.push({ skillKey: l.skillKey, from: cur, to: cur, hours: 0, note: 'already_there' }); continue; }
    const hrs = (l.level - cur) * ((skillMap.get(l.skillKey) || {}).learningHours || 20);
    addedHours += hrs;
    steps.push({ skillKey: l.skillKey, from: cur, to: l.level, hours: hrs });
    extra.push({ skillKey: l.skillKey, type: 'self', level: l.level });
  }
  const before = computeReadiness({ role, evidence, skills, weeklyHours });
  const after = computeReadiness({ role, evidence: [...evidence, ...extra], skills, weeklyHours });
  const proven = provenReadiness(role, evidence, skills);
  return {
    hypothetical: true,
    label: 'Simulation only. Nothing here is recorded as your progress until a quiz, project or mentor review proves it.',
    before: { readiness: before.readiness, hoursLeft: before.totalHours, weeksLeft: before.timeToReadyWeeks },
    after: { readiness: after.readiness, hoursLeft: after.totalHours, weeksLeft: after.timeToReadyWeeks },
    delta: after.readiness - before.readiness,
    provenReadiness: { before: proven, after: proven }, // unchanged on purpose
    studyHoursNeeded: addedHours,
    studyWeeksNeeded: weeklyHours > 0 ? Math.ceil(addedHours / weeklyHours) : null,
    assumption: { weeklyHours: weeklyHours > 0 ? weeklyHours : null, source: weeklyHours > 0 ? (hoursSource || 'profile') : 'none' },
    steps,
  };
}

module.exports = { skillPrereqs, rankSkills, analyzeRole, compareRoles, simulate, provenReadiness, MIN_POSTINGS, DEMAND_ONLY_W };
