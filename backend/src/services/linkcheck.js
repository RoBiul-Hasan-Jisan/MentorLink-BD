// Link checker for learning resources. Admin-triggered only.
// SAFETY: the server fetches URLs, so we (1) allow https only, (2) resolve the host first and refuse private / loopback /
// link-local addresses (SSRF guard), (3) use a short timeout and never follow redirects blindly.
const dns = require('dns').promises;
const net = require('net');

function isPrivateIp(ip) {
  if (net.isIPv6(ip)) { const x = ip.toLowerCase(); return x === '::1' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80') || x.startsWith('::ffff:127.') || x.startsWith('::ffff:10.') || x.startsWith('::ffff:192.168.'); }
  const p = ip.split('.').map(Number);
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127);
}

// Returns { status: 'ok' | 'broken' | 'blocked', detail }. `lookup` and `fetchImpl` can be replaced in tests.
async function checkUrl(url, { lookup = (h) => dns.lookup(h, { all: true }), fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  let u;
  try { u = new URL(url); } catch { return { status: 'broken', detail: 'invalid url' }; }
  if (u.protocol !== 'https:') return { status: 'blocked', detail: 'https only' };
  try {
    const addrs = net.isIP(u.hostname) ? [{ address: u.hostname }] : await lookup(u.hostname);
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) return { status: 'blocked', detail: 'private address' };
  } catch (e) { return { status: 'broken', detail: `dns: ${e.code || e.message}` }; }
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    // Redirects are not followed: a 3xx from a real site counts as alive, and we never chase a redirect to a private host.
    let res = await fetchImpl(url, { method: 'HEAD', redirect: 'manual', signal: ctl.signal });
    if (res.status === 405 || res.status === 403) res = await fetchImpl(url, { method: 'GET', redirect: 'manual', signal: ctl.signal });
    clearTimeout(t);
    return res.status < 400 ? { status: 'ok', detail: `HTTP ${res.status}` } : { status: 'broken', detail: `HTTP ${res.status}` };
  } catch (e) { return { status: 'broken', detail: e.name === 'AbortError' ? 'timeout' : e.message }; }
}
module.exports = { checkUrl, isPrivateIp };
