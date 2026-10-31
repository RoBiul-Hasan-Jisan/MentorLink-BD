// Meeting links: only https, no credentials in the URL, a real dotted host. Pure function (no framework), kept in step with
// mobile/lib/core/links.dart. Returns the cleaned URL string, or null when the text is not an acceptable link.
function normalizeMeetingLink(raw) {
  let t = String(raw == null ? '' : raw).trim();
  if (!t || t.length > 300 || /\s/.test(t)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) {
    if (!/^https:\/\//i.test(t)) return null; // http:, javascript:, file:, intent: ... are refused
  } else t = `https://${t}`;
  let u;
  try { u = new URL(t); } catch { return null; }
  if (u.protocol !== 'https:' || !u.hostname.includes('.') || u.username || u.password) return null;
  return u.toString();
}
module.exports = { normalizeMeetingLink };
