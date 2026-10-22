const { bad } = require('../utils/httpError');

// PRIVACY GUARD: we never collect or show a user's GPS or home location.
// Any of these keys, at any depth of a request body, is rejected with 400.
const FORBIDDEN_KEYS = new Set([
  'lat', 'lng', 'lon', 'long', 'latitude', 'longitude', 'location', 'gps', 'address', 'coords', 'coordinates', 'geo', 'geolocation', 'homeaddress',
]);

function findForbidden(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 6) return null;
  for (const [k, v] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(k.toLowerCase())) return k;
    const inner = findForbidden(v, depth + 1);
    if (inner) return inner;
  }
  return null;
}

// Admin university routes legitimately carry campus coordinates, so they are skipped.
function privacyGuard(req, _res, next) {
  if (req.path.startsWith('/api/admin/universities')) return next();
  const hit = findForbidden(req.body) || findForbidden(req.query);
  if (hit) {
    throw bad('PRIVACY_FIELD_REJECTED', `The field "${hit}" is not accepted. MentorLink never collects GPS or home location.`);
  }
  next();
}

// Validate with a zod schema. Unknown keys are rejected (use .strict() in the schema).
const validate = (schema, where = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[where]);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first.path.join('.') || where;
    throw bad('VALIDATION_ERROR', `${path}: ${first.message}`);
  }
  req[where] = result.data;
  next();
};

// Errors in one place, same shape every time.
function errorHandler(err, _req, res, _next) {
  if (err && err.status) {
    return res.status(err.status).json({ error: { code: err.code || 'ERROR', message: err.message } });
  }
  if (err && err.code === 11000) {
    return res.status(409).json({ error: { code: 'DUPLICATE', message: 'This already exists.' } });
  }
  if (err && err.name === 'ValidationError') {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'The request body is not valid JSON.' } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong on our side.' } });
}

module.exports = { privacyGuard, validate, errorHandler, findForbidden };
