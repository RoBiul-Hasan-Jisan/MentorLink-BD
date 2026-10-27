// GitHub: prove ownership with a code in the profile bio, then read PUBLIC repositories. No token, nothing private.
// All network calls go through `client.get`, so tests replace it and never touch the internet.
const crypto = require('crypto');
const { bad, HttpError } = require('../utils/httpError');
const httpError = (status, code, msg) => new HttpError(status, code, msg);

const USERNAME = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/;
// GitHub language / topic -> our skill keys. A repo shows USE of a skill, not proficiency, so it only suggests skills.
const LANG = {
  Python: ['python'], 'Jupyter Notebook': ['python', 'statistics'], JavaScript: ['backend'], TypeScript: ['backend'], Go: ['backend'], PHP: ['backend'], Ruby: ['backend'],
  Java: ['dsa'], C: ['dsa'], 'C++': ['dsa'], 'C#': ['dsa'], PLpgSQL: ['sql'], TSQL: ['sql'],
};
const TOPIC = {
  'machine-learning': 'python', 'data-science': 'python', pandas: 'python', numpy: 'python', sql: 'sql', mysql: 'sql', postgresql: 'sql', testing: 'testing', pytest: 'testing', jest: 'testing',
  dashboard: 'dashboard', 'power-bi': 'dashboard', tableau: 'dashboard', algorithms: 'dsa', 'data-structures': 'dsa', api: 'backend', 'rest-api': 'backend', nodejs: 'backend', express: 'backend', statistics: 'statistics', excel: 'excel',
};

const client = {
  async get(path) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(`https://api.github.com${path}`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'MentorLinkBD' }, signal: ctrl.signal });
      if (r.status === 404) throw httpError(404, 'GITHUB_NOT_FOUND', 'GitHub user not found.');
      if (r.status === 403 || r.status === 429) throw httpError(429, 'GITHUB_LIMIT', 'GitHub is limiting requests right now. Try again in a few minutes.');
      if (!r.ok) throw httpError(502, 'GITHUB_ERROR', 'Could not read GitHub.');
      return await r.json();
    } catch (e) {
      if (e.status) throw e;
      throw httpError(502, 'GITHUB_UNREACHABLE', 'Could not reach GitHub. Check your connection and try again.');
    } finally { clearTimeout(t); }
  },
};

const newCode = () => `mentorlink-${crypto.randomBytes(3).toString('hex')}`;
function checkUsername(u) { if (!USERNAME.test(String(u || ''))) throw bad('BAD_GITHUB_USERNAME', 'That is not a valid GitHub username.'); return String(u); }
const skillsForRepo = (r) => [...new Set([...(LANG[r.language] || []), ...(r.topics || []).map((t) => TOPIC[t]).filter(Boolean)])];

// Returns the verified repo list (own, non-fork, newest push first) or throws a message that tells the student what to do.
async function verifyOwnership(username, code) {
  const u = await client.get(`/users/${username}`);
  if (!String(u.bio || '').includes(code)) throw bad('CODE_NOT_FOUND', `Put ${code} in your GitHub profile bio, save it, then verify again. You can remove it afterwards.`);
  const repos = await client.get(`/users/${username}/repos?per_page=100&sort=pushed`);
  return (Array.isArray(repos) ? repos : []).filter((r) => !r.fork).slice(0, 30).map((r) => ({
    name: r.name, url: r.html_url, language: r.language || '', topics: r.topics || [], description: String(r.description || '').slice(0, 200), stars: r.stargazers_count || 0, pushedAt: r.pushed_at ? new Date(r.pushed_at) : undefined,
  }));
}

module.exports = { client, newCode, checkUsername, skillsForRepo, verifyOwnership, LANG, TOPIC };
