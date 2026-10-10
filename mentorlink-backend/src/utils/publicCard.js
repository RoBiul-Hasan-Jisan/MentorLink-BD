// PRIVACY: the ONLY user data other people may see. No email, phone or location, ever.
function shortName(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || '';
  return `${parts[0]} ${parts[parts.length - 1][0]}.`; // "Robiul Hasan" -> "Robiul H."
}

function toPublicCard(user, universityName, { isYou = false } = {}) {
  return {
    id: String(user._id),
    displayName: user.role === 'student' ? shortName(user.displayName) : user.displayName,
    role: user.role,
    department: user.department || null,
    batchYear: user.batchYear || null,
    verified: user.verificationStatus === 'verified',
    universityName,
    isYou,
  };
}
module.exports = { toPublicCard, shortName };
