// Career pathway graph for ONE target (a job path or a pathway like higher study). Pure function: no database.
// Left to right: assessments (evidence) -> topics in prerequisite order -> the target.
// Every topic node carries the student's status from data/targets.analyse, so the graph shows what to do first.
// Statuses: verified (quiz/project/mentor evidence) | known (self-ticked) | ready (can start now) | locked (learn a prerequisite first).
function buildGraph(target, analysed, { quizSkills = new Set() } = {}) {
  const topics = analysed.topics;
  const byKey = new Map(topics.map((t) => [t.key, t]));
  const depth = new Map();
  const d = (k, seen = new Set()) => {
    if (depth.has(k)) return depth.get(k);
    if (seen.has(k)) return 0; // a cycle would be a data bug; never loop forever
    seen.add(k);
    const t = byKey.get(k);
    const v = t.needs.filter((n) => byKey.has(n)).length ? 1 + Math.max(...t.needs.filter((n) => byKey.has(n)).map((n) => d(n, seen))) : 0;
    depth.set(k, v);
    return v;
  };
  for (const t of topics) d(t.key);
  const maxDepth = Math.max(0, ...depth.values());

  const nodes = [];
  const edges = [];
  const hasDependents = new Set();
  for (const t of topics) for (const n of t.needs) if (byKey.has(n)) hasDependents.add(n);

  for (const t of topics) {
    const skillKey = t.ev ? t.ev[0] : null;
    nodes.push({ id: `t:${t.key}`, type: 'topic', key: t.key, titleEn: t.titleEn, titleBn: t.titleBn, group: t.group, status: t.status, weight: t.w, hours: t.hours, skillKey, col: 1 + (depth.get(t.key) || 0), missing: t.missing });
    for (const n of t.needs) if (byKey.has(n)) edges.push({ from: `t:${n}`, to: `t:${t.key}`, kind: 'prerequisite_of' });
    if (!hasDependents.has(t.key)) edges.push({ from: `t:${t.key}`, to: 'target', kind: 'required_for' });
    if (skillKey && quizSkills.has(skillKey)) {
      const id = `a:${t.key}`;
      nodes.push({ id, type: 'assessment', key: t.key, titleEn: `${skillKey} quiz`, titleBn: `${skillKey} কুইজ`, skillKey, status: t.status === 'verified' ? 'verified' : 'ready', col: 0 });
      edges.push({ from: id, to: `t:${t.key}`, kind: 'assessed_by' });
    }
  }
  nodes.push({ id: 'target', type: 'target', key: target.key, titleEn: target.titleEn, titleBn: target.titleBn, status: analysed.percent >= 80 ? 'verified' : 'ready', percent: analysed.percent, verifiedPercent: analysed.verifiedPercent, col: maxDepth + 2 });
  const counts = { verified: 0, known: 0, ready: 0, locked: 0 };
  for (const t of topics) counts[t.status] += 1;
  const next = analysed.path.find((t) => t.status === 'ready');
  return {
    target: { key: target.key, kind: target.kind, titleEn: target.titleEn, titleBn: target.titleBn, percent: analysed.percent, verifiedPercent: analysed.verifiedPercent },
    nodes, edges, columns: maxDepth + 3, counts,
    nextKey: next ? next.key : null,
    legend: ['assessment', 'topic', 'target'],
  };
}
module.exports = { buildGraph };
