/*
 * MentorLink BD - route + security audit (black-box, no Firebase needed)
 *
 * HOW TO RUN (from the backend folder):
 *     1. Start MongoDB locally (default mongodb://127.0.0.1:27017)
 *     2. npm install
 *     3. node audit/audit.js
 *
 * Optional: TEST_MONGODB_URI=mongodb://127.0.0.1:27017/mentorlink_test   (database name MUST end with _test;
 *           this database is WIPED on every run. It never touches MONGODB_URI / your real data.)
 *
 * What it does:
 *   - reads every route in src/routes/*.js
 *   - seeds one user per role (student, mentor, department, admin, employer) with a fake Firebase login
 *   - calls every route as: no token, bad token, and each role; plus bad-ID and hostile-body variants
 *   - runs security probes (role escalation, privacy guard, NoSQL operators, body limits, CORS, headers)
 *   - prints a summary and writes audit/audit-report.json (full detail)
 *
 * Exit code: 0 = no failures, 1 = at least one failure (so it can run in CI).
 */
process.env.NODE_ENV = 'test'; // turns the rate limiter off so the sweep is not throttled
const path = require('path');
const fs = require('fs');
const B = path.resolve(__dirname, '..');
process.chdir(B);
const request = require(path.join(B, 'node_modules/supertest'));
const h = require(path.join(B, 'tests/helpers.js'));
const { seedLearning } = require(path.join(B, 'src/seed/learning'));

const OID = '64b000000000000000000001'; // valid ObjectId that does not exist
const PUBLIC = new Set(['GET /universities', 'GET /public/passport/:slug']); // routes allowed without a token
const bearer = (uid) => ({ Authorization: `Bearer ${uid}:${uid}@t.test` });
const ID_PARAM = /:(id|studentId|mentorId|userId|talentId|evId)\b/;

// ---------- 1. discover routes from the source files ----------
function discoverRoutes() {
  const dir = path.join(B, 'src/routes');
  const out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((l, i) => {
      const m = /\b(?:r|startup|router)\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/.exec(l);
      if (m) out.push({ file: f, line: i + 1, method: m[1].toUpperCase(), path: m[3] });
    });
  }
  return out;
}
const fill = (p, bad) => '/api' + p
  .replace(/:(id|studentId|mentorId|userId|talentId|evId)\b/g, bad ? 'not-an-id' : OID)
  .replace(/:n\b/g, '1')
  .replace(/:(skillKey|key|topicKey|slug)\b/g, 'x');

(async () => {
  const routes = discoverRoutes();
  const app = await h.setup(); // connects to the _test database and wipes it
  await seedLearning();
  const uni = await h.mkUni('EDU', 'EDU', 'Chattogram', 91.83, 22.35);

  const ids = {};
  for (const [uid, role] of [['student1', 'student'], ['mentor1', 'mentor'], ['dept1', 'department'], ['admin1', 'admin'], ['emp1', 'employer']]) {
    ids[uid] = (await h.mkUser(uid, role, uni, { department: 'CSE' }))._id.toString();
  }
  try { // verified company so employer routes can pass the organization gate
    const { Organization, OrganizationMember } = h.models;
    const org = await Organization.create({ name: 'Acme BD', verificationStatus: 'verified' });
    await OrganizationMember.create({ organizationId: org._id, userId: ids.emp1, status: 'active', membershipRole: 'owner' });
  } catch (e) { console.log('note: could not seed employer org:', e.message.slice(0, 100)); }

  const identities = [['none', {}], ['badtoken', { Authorization: 'Bearer garbage' }], ['student', bearer('student1')], ['mentor', bearer('mentor1')], ['department', bearer('dept1')], ['admin', bearer('admin1')], ['employer', bearer('emp1')]];
  const call = async (method, url, hdr, body) => {
    const t = Date.now();
    let q = request(app)[method.toLowerCase()](url).set(hdr);
    if (['POST', 'PUT', 'PATCH'].includes(method)) q = q.send(body === undefined ? {} : body);
    try { const r = await q; return { status: r.status, ms: Date.now() - t, code: r.body && r.body.error && r.body.error.code }; }
    catch (e) { return { status: 0, ms: Date.now() - t, err: e.message }; }
  };

  // ---------- 2. route sweep ----------
  const results = [];
  for (const rt of routes) {
    const key = `${rt.method} ${rt.path}`;
    const base = { route: key, file: rt.file, line: rt.line };
    for (const [who, hdr] of identities) results.push({ test: 'sweep', who, ...base, ...(await call(rt.method, fill(rt.path, false), hdr)) });
    if (ID_PARAM.test(rt.path)) for (const [who, hdr] of identities.slice(2)) results.push({ test: 'badid', who, ...base, ...(await call(rt.method, fill(rt.path, true), hdr)) });
    if (['POST', 'PUT', 'PATCH'].includes(rt.method)) {
      for (const [who, hdr] of [identities[2], identities[3], identities[5]]) {
        const evil = { role: 'admin', $where: '1', $ne: 1, name: { $gt: '' }, x: 'a'.repeat(5000) };
        results.push({ test: 'hostile', who, ...base, ...(await call(rt.method, fill(rt.path, false), hdr, evil)) });
      }
    }
  }

  // ---------- 3. security probes ----------
  const probes = [];
  const add = (name, ok, got) => probes.push({ name, ok: !!ok, got: String(got) });
  const safe = async (name, fn) => { try { await fn(); } catch (e) { add(name + ' (probe crashed: ' + e.message + ')', false, 'error'); } };

  await safe('health', async () => { add('GET /health -> 200', (await request(app).get('/health')).status === 200, 200); add('GET /ready (db up) -> 200', (await request(app).get('/ready')).status === 200, 200); });
  await safe('headers', async () => { const r = await request(app).get('/health'); add('helmet: nosniff header', r.headers['x-content-type-options'] === 'nosniff', r.headers['x-content-type-options']); add('x-powered-by hidden', !r.headers['x-powered-by'], r.headers['x-powered-by'] || 'absent'); });
  await safe('json', async () => { const r = await request(app).post('/api/me/goal').set(bearer('student1')).set('Content-Type', 'application/json').send('{bad'); add('malformed JSON -> 400', r.status === 400, r.status); });
  await safe('big', async () => { const r = await request(app).post('/api/posts').set(bearer('student1')).send({ body: 'a'.repeat(200000) }); add('200 KB body -> 413', r.status === 413, r.status); });
  await safe('404', async () => { const r = await request(app).get('/api/nope/nothing'); add('unknown endpoint -> 404 JSON', r.status === 404 && /json/.test(r.headers['content-type'] || ''), r.status); });
  await safe('privacy', async () => {
    const r = await request(app).put('/api/me/privacy').set(bearer('student1')).send({ latitude: 22.3 }); add('privacy guard blocks latitude in body', r.status === 400, r.status);
    const q = await request(app).get('/api/opportunities?lat=22&lng=91').set(bearer('student1')); add('privacy guard blocks lat/lng in query', q.status === 400, q.status);
  });
  await safe('register', async () => {
    const a = await request(app).post('/api/auth/register-profile').set(bearer('newbie')).send({ displayName: 'Evil', universityId: String(uni._id), role: 'admin' }); add('register with role:admin rejected', a.status === 400, a.status);
    const b = await request(app).post('/api/auth/register-profile').set(bearer('newbie')).send({ displayName: 'Normal User', universityId: String(uni._id) }); add('register creates a student (201)', b.status === 201 && b.body.user.role === 'student', b.status);
    const c = await request(app).post('/api/auth/register-profile').set(bearer('newbie')).send({ displayName: 'Normal User', universityId: String(uni._id) }); add('duplicate register -> 409', c.status === 409, c.status);
  });
  await safe('roles', async () => {
    const a = await request(app).patch(`/api/admin/users/${ids.student1}/role`).set(bearer('student1')).send({ role: 'admin' }); add('student cannot change roles -> 403', a.status === 403, a.status);
    const b = await request(app).patch(`/api/admin/users/${ids.student1}/role`).set(bearer('mentor1')).send({ role: 'admin' }); add('mentor cannot change roles -> 403', b.status === 403, b.status);
  });
  await safe('nosql', async () => { for (const u of ['/api/opportunities?q[$ne]=1', '/api/opportunities?type[$gt]=', '/api/feed?cursor[$ne]=1', '/api/targets?x[$where]=1']) add('NoSQL operator not 500: ' + u, (await request(app).get(u).set(bearer('student1'))).status < 500, 'checked'); });
  await safe('auth', async () => { add('token but no profile -> 403', (await request(app).get('/api/me').set(bearer('ghost'))).status === 403, 403); add('GET /api/me as student -> 200', (await request(app).get('/api/me').set(bearer('student1'))).status === 200, 200); });
  await safe('export', async () => { const r = await request(app).get('/api/me/export').set(bearer('student1')); add('own data export -> 200', r.status === 200, r.status); add('export has no secrets', !/password|private_key|serviceAccount/i.test(JSON.stringify(r.body)), 'checked'); });
  await safe('cors', async () => { const r = await request(app).get('/health').set('Origin', 'https://evil.example'); add('CORS does not allow arbitrary origins (set CORS_ORIGINS)', !r.headers['access-control-allow-origin'], r.headers['access-control-allow-origin'] || 'none'); });

  // ---------- 4. analysis ----------
  const problems = [];
  for (const r of results) {
    if (r.status >= 500 || r.status === 0) problems.push(`SERVER ERROR  ${r.who} ${r.route} -> ${r.status} ${r.err || ''} (${r.file}:${r.line}) [${r.test}]`);
    if (r.test === 'sweep' && (r.who === 'none' || r.who === 'badtoken') && r.status !== 401 && !PUBLIC.has(r.route)) problems.push(`NO AUTH       ${r.who} ${r.route} -> ${r.status} (${r.file}:${r.line})`);
  }
  for (const p of probes) if (!p.ok) problems.push(`PROBE FAILED  ${p.name} (got ${p.got})`);

  const byRoute = {};
  for (const r of results.filter((x) => x.test === 'sweep')) (byRoute[r.route] = byRoute[r.route] || {})[r.who] = r.status;
  const reached = Object.entries(byRoute).filter(([, v]) => Object.entries(v).some(([w, s]) => w !== 'none' && w !== 'badtoken' && (s === 200 || s === 201))).length;
  const never = Object.entries(byRoute).filter(([, v]) => Object.values(v).every((s) => s === 401 || s === 403)).map(([k]) => k);
  const slow = results.filter((r) => r.ms > 800).map((r) => `${r.route} (${r.who}) ${r.ms}ms`);

  const tally = {}; results.forEach((r) => { tally[r.status] = (tally[r.status] || 0) + 1; });
  console.log('\n================ MentorLink BD audit ================');
  console.log(`Routes found: ${routes.length}   Requests sent: ${results.length}`);
  console.log('Status counts:', JSON.stringify(tally));
  console.log(`Routes that returned 2xx for at least one role: ${reached}/${routes.length}`);
  console.log(`Routes where EVERY identity got 401/403 (handler never reached): ${never.length}`);
  never.forEach((k) => console.log('   -', k));
  if (slow.length) { console.log('Slow (>800ms):'); slow.forEach((s) => console.log('   -', s)); }
  console.log(`Probes: ${probes.filter((p) => p.ok).length}/${probes.length} passed`);
  probes.forEach((p) => console.log(`   ${p.ok ? 'PASS' : 'FAIL'}  ${p.name}  [${p.got}]`));
  console.log(problems.length ? `\nPROBLEMS (${problems.length}):\n  ` + problems.join('\n  ') : '\nNo problems found.');

  fs.writeFileSync(path.join(__dirname, 'audit-report.json'), JSON.stringify({ routes: routes.length, requests: results.length, tally, reached, never, slow, probes, problems, results }, null, 1));
  console.log('\nFull detail written to audit/audit-report.json');
  await h.teardown();
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error('AUDIT CRASHED:', e.message); process.exit(2); });
