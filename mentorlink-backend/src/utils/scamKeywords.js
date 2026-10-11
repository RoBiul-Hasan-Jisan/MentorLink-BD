// Simple suspicious-keyword check (shared by chat now, opportunity posts in Phase 4a).
const TERMS = ['registration fee', 'pay to apply', 'send money', 'security deposit', 'processing fee',
  'advance payment', 'share otp', 'send otp', 'bkash me', 'nagad me', 'earn daily', 'earn per day', 'whatsapp only', 'no interview needed'];
const findSuspicious = (text = '') => { const t = text.toLowerCase(); return TERMS.filter((x) => t.includes(x)); };

// Flags for a new opportunity post: keyword hits + "no company name" (as in the admin queue design).
function flagOpportunity({ title = '', organization = '', description = '' }) {
  const flags = findSuspicious(`${title} ${organization} ${description}`);
  if (organization.trim().length < 2) flags.push('no company name');
  return [...new Set(flags)];
}
module.exports = { findSuspicious, flagOpportunity, TERMS };
