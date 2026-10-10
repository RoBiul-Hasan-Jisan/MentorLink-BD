const rateLimit = require('express-rate-limit');
const skip = () => process.env.NODE_ENV === 'test';
const make = (windowMs, limit) => rateLimit({
  windowMs, limit, skip, standardHeaders: true, legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, try later' } },
});
module.exports = {
  general: make(15 * 60 * 1000, 300),
  registration: make(60 * 60 * 1000, 20),
};
