// "Download my data" and "Delete my account" share one list (src/services/userdata.js). No database needed.
// The first block READS THE MODEL FILES and fails when somebody adds a model that points at a User
// without deciding what export and delete do with it. That is the whole point of this test.
const fs = require('fs');
const path = require('path');
const { OWN, PULL, CLEAR, RETAINED, NOT_PERSONAL, exportUser, eraseUser, anyOf } = require('../src/services/userdata');

const dir = path.join(__dirname, '../src/models');
// { ModelName: { fields: Set of top-level and nested keys that appear in its schema text, pointsAtUser: bool } }
function readModels() {
  const out = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js') && x !== 'index.js')) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const re = /mongoose\.model\(\s*'(\w+)'\s*,\s*(\w+)\s*\)/g;
    let m;
    while ((m = re.exec(src))) {
      const [, name, schemaVar] = m;
      const start = src.indexOf(`const ${schemaVar} = new Schema(`);
      if (start < 0) throw new Error(`cannot find schema ${schemaVar} for ${name} in ${f}`);
      // Walk to the matching close paren of "new Schema(" so only this schema's text is read.
      let depth = 0, i = src.indexOf('(', start);
      const open = i;
      for (; i < src.length; i++) { if (src[i] === '(') depth++; else if (src[i] === ')') { depth--; if (!depth) break; } }
      const text = src.slice(open, i);
      out[name] = { text, pointsAtUser: /ref\(\s*'User'|ref:\s*'User'/.test(text), hasField: (k) => new RegExp(`(^|[\\s{,])${k}\\s*:`).test(text) };
    }
  }
  return out;
}
const models = readModels();

describe('every model is classified', () => {
  test('the scan finds the models (sanity check on the scanner itself)', () => {
    expect(Object.keys(models).length).toBeGreaterThan(30);
    expect(models.SavedJob.pointsAtUser).toBe(true);
    expect(models.University.pointsAtUser).toBe(false);
  });
  test('each model that points at a User is exported and deleted, or kept on purpose with a reason', () => {
    const covered = new Set([...OWN.map((o) => o[1]), ...PULL.map((p) => p.model), ...Object.keys(RETAINED)]);
    const unclassified = Object.keys(models).filter((n) => models[n].pointsAtUser && !covered.has(n));
    expect(unclassified).toEqual([]); // add the model to OWN (or RETAINED with a reason) in services/userdata.js
  });
  test('models that point at no User are listed as not personal, so a new one is noticed', () => {
    const known = new Set([...OWN.map((o) => o[1]), ...PULL.map((p) => p.model), ...Object.keys(RETAINED), ...NOT_PERSONAL]);
    expect(Object.keys(models).filter((n) => !known.has(n))).toEqual([]);
  });
  test('nothing is listed that does not exist, and the fields named really exist in that schema', () => {
    for (const [key, model, fields] of OWN) {
      expect(models[model] ? key : `${key}: no such model ${model}`).toBe(key);
      for (const f of fields) expect(models[model].hasField(f) ? 'ok' : `${model} has no field ${f}`).toBe('ok');
    }
    for (const p of PULL) expect(models[p.model] ? 'ok' : `no model ${p.model}`).toBe('ok');
    for (const c of CLEAR) expect(models[c.model].hasField(c.field) ? 'ok' : `${c.model} has no ${c.field}`).toBe('ok');
  });
  test('export keys are unique and none uses a name the route already sets', () => {
    const keys = OWN.map((o) => o[0]);
    expect(new Set(keys).size).toBe(keys.length);
    for (const reserved of ['account', 'settings', 'exportedAt', 'keptAfterDeletion', 'workshopsJoined']) expect(keys).not.toContain(reserved);
  });
  test('retained items all give a reason', () => {
    for (const [n, why] of Object.entries(RETAINED)) expect(why.length > 20 ? 'ok' : `${n} needs a reason`).toBe('ok');
  });
});

// A fake model layer that records what was asked, so the behaviour can be checked without MongoDB.
function fakeModels(data = {}) {
  const calls = [];
  const chain = (v) => { const p = Promise.resolve(v); p.select = () => p; p.lean = () => p; return p; };
  const M = new Proxy({}, {
    get: (_t, model) => ({
      find: (q) => { calls.push(['find', model, q]); return chain(data[model] || []); },
      findOne: (q) => { calls.push(['findOne', model, q]); return chain((data[model] || [])[0] || null); },
      deleteMany: (q) => { calls.push(['deleteMany', model, q]); return Promise.resolve({}); },
      updateMany: (q, u) => { calls.push(['updateMany', model, q, u]); return Promise.resolve({}); },
      updateOne: (q, u) => { calls.push(['updateOne', model, q, u]); return Promise.resolve({}); },
    }),
  });
  return { M, calls };
}
const id = 'u1';

describe('anyOf', () => {
  test('one field, or either side of a two-sided record', () => {
    expect(anyOf(['studentId'], id)).toEqual({ studentId: id });
    expect(anyOf(['studentId', 'mentorId'], id)).toEqual({ $or: [{ studentId: id }, { mentorId: id }] });
  });
});

describe('eraseUser', () => {
  test('deletes from every OWN model, matching only this person', async () => {
    const { M, calls } = fakeModels();
    await eraseUser(M, id);
    for (const [, model, fields] of OWN) {
      const c = calls.find((x) => x[0] === 'deleteMany' && x[1] === model && JSON.stringify(x[2]) === JSON.stringify(anyOf(fields, id)));
      expect(c ? 'deleted' : `${model} not deleted`).toBe('deleted');
    }
  });
  test('never runs a delete with an empty filter (that would wipe everybody)', async () => {
    const { M, calls } = fakeModels({ Post: [{ _id: 'p1' }], Comment: [{ _id: 'c1', postId: 'other' }], Question: [{ _id: 'q1' }], MentorRequest: [{ _id: 'r1' }] });
    await eraseUser(M, id);
    for (const c of calls.filter((x) => x[0] === 'deleteMany')) {
      expect(Object.keys(c[2]).length).toBeGreaterThan(0);
      expect(JSON.stringify(c[2])).not.toBe('{}');
    }
  });
  test('removes the person from other records instead of deleting them', async () => {
    const { M, calls } = fakeModels();
    await eraseUser(M, id);
    const up = calls.filter((x) => x[0] === 'updateMany');
    expect(up.some((c) => c[1] === 'Workshop' && JSON.stringify(c[3]) === JSON.stringify({ $pull: { attendees: id } }))).toBe(true);
    expect(up.some((c) => c[1] === 'Post' && JSON.stringify(c[3]).includes('reactions'))).toBe(true);
    expect(up.some((c) => c[1] === 'Sprint' && JSON.stringify(c[3]) === JSON.stringify({ $unset: { mentorId: 1 } }))).toBe(true);
  });
  test('followers of the deleted person are removed', async () => {
    const { M, calls } = fakeModels();
    await eraseUser(M, id);
    expect(calls.some((c) => c[0] === 'deleteMany' && c[1] === 'Follow' && c[2].kind === 'user' && c[2].target === id)).toBe(true);
  });
  test('their posts take the comments with them; comments elsewhere lower that post counter; chat messages go with the chat', async () => {
    const { M, calls } = fakeModels({
      Post: [{ _id: 'p1' }],
      Comment: [{ _id: 'c1', postId: 'p1' }, { _id: 'c2', postId: 'other' }, { _id: 'c3', postId: 'other' }],
      Question: [{ _id: 'q1' }], MentorRequest: [{ _id: 'r1' }],
    });
    await eraseUser(M, id);
    const del = (model) => calls.filter((c) => c[0] === 'deleteMany' && c[1] === model).map((c) => JSON.stringify(c[2]));
    expect(del('Comment')).toContain(JSON.stringify({ postId: { $in: ['p1'] } }));
    expect(del('Comment')).toContain(JSON.stringify({ parentId: { $in: ['c1', 'c2', 'c3'] } }));
    expect(del('Answer')).toContain(JSON.stringify({ questionId: { $in: ['q1'] } }));
    expect(del('Message')).toContain(JSON.stringify({ requestId: { $in: ['r1'] } }));
    const dec = calls.filter((c) => c[0] === 'updateOne' && c[1] === 'Post');
    expect(dec).toHaveLength(1); // only "other"; p1 is deleted anyway
    expect(dec[0][2]).toEqual({ _id: 'other' });
    expect(dec[0][3]).toEqual({ $inc: { commentCount: -2 } });
  });
});

describe('exportUser', () => {
  test('returns every key in the list, the same filter as delete, and joined workshops', async () => {
    const { M, calls } = fakeModels({ SavedJob: [{ _id: 's1' }], Workshop: [{ title: 'SQL night' }] });
    const out = await exportUser(M, id);
    for (const [key] of OWN) expect(Object.prototype.hasOwnProperty.call(out, key) ? 'ok' : `missing ${key}`).toBe('ok');
    expect(out.savedJobs).toEqual([{ _id: 's1' }]);
    expect(out.profile).toBeNull(); // single objects are null when absent
    expect(out.workshopsJoined).toEqual([{ title: 'SQL night' }]);
    const asked = calls.find((c) => c[1] === 'MentorRequest');
    expect(asked[2]).toEqual(anyOf(['studentId', 'mentorId'], id));
  });
});
