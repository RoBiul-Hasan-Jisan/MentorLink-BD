// Pure helpers for notifications (no database, no framework), so they can be unit-tested directly.

// Where a notification should send the person when they tap it. Only these types are accepted, and an id,
// when present, must look like a MongoDB ObjectId. The app maps each type to a screen and the screen's own API call
// still checks access, so a destination is only a hint, never a permission.
const TARGET_TYPES = ['request', 'chat', 'session', 'plan', 'application', 'opportunity', 'invite', 'review', 'sprint', 'organization', 'verification', 'post', 'qa'];
const OBJECT_ID = /^[a-f\d]{24}$/i;

function buildTarget(input) {
  if (!input || typeof input !== 'object') return undefined;
  const type = String(input.type || '');
  if (!TARGET_TYPES.includes(type)) return undefined;
  if (input.id === undefined || input.id === null || input.id === '') return { type };
  const id = String(input.id);
  if (!OBJECT_ID.test(id)) return undefined;
  return { type, id };
}

// Quiet hours are whole hours in Bangladesh time (UTC+6), the same calendar the rest of the backend uses.
// The window may wrap midnight (22 -> 7). from === to means "no quiet hours".
function inQuietHours(quiet, now = new Date()) {
  if (!quiet || !Number.isInteger(quiet.from) || !Number.isInteger(quiet.to) || quiet.from === quiet.to) return false;
  const hour = (now.getUTCHours() + 6) % 24;
  return quiet.from < quiet.to ? hour >= quiet.from && hour < quiet.to : hour >= quiet.from || hour < quiet.to;
}

module.exports = { TARGET_TYPES, buildTarget, inQuietHours };
