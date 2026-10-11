// Mentor weekly capacity. "Week" = Saturday 00:00 to Friday 23:59 in Bangladesh time (UTC+6, no DST).
const OFFSET_MS = 6 * 3600 * 1000;

function weekStart(date = new Date()) {
  const local = new Date(date.getTime() + OFFSET_MS);
  const sinceSaturday = (local.getUTCDay() + 1) % 7; // Sat=0, Sun=1 ... Fri=6
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - sinceSaturday) - OFFSET_MS);
}

// activeMentees counts accepted requests THIS week. If the stored week is old, it counts as 0.
function effectiveActiveMentees(profile, now = new Date()) {
  if (profile.capacityWeekStart && profile.capacityWeekStart < weekStart(now)) return 0;
  return profile.activeMentees || 0;
}
// "Paused automatically when full" = full this week, computed (no stale flag to forget to clear).
const isAtCapacity = (profile, now) => effectiveActiveMentees(profile, now) >= profile.weeklyCapacity;

module.exports = { weekStart, effectiveActiveMentees, isAtCapacity };
