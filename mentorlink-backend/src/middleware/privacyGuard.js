const { AppError } = require('../utils/errors');

// PRIVACY: reject any location-like field in a user-profile request (body or query), at any depth.
const FORBIDDEN = new Set(['lat', 'lng', 'lon', 'latitude', 'longitude', 'location', 'gps', 'address', 'coordinates']);

function findForbidden(value) {
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (FORBIDDEN.has(key.toLowerCase())) return key;
      const nested = findForbidden(value[key]);
      if (nested) return nested;
    }
  }
  return null;
}

module.exports = (req, res, next) => {
  const bad = findForbidden(req.body) || findForbidden(req.query);
  if (bad) {
    return next(new AppError(400, 'LOCATION_NOT_ALLOWED', `Field "${bad}" is not accepted. MentorLink never collects user locations.`));
  }
  next();
};
module.exports.findForbidden = findForbidden;
