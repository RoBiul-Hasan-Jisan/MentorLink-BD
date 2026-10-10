const { ZodError } = require('zod');
const { AppError } = require('../utils/errors');

module.exports = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message } });
  }
  if (err instanceof AppError) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  if (err && err.code === 11000) return res.status(409).json({ error: { code: 'DUPLICATE', message: 'Already exists' } });
  if (err && err.name === 'CastError') return res.status(400).json({ error: { code: 'BAD_ID', message: 'Invalid id' } });
  if (process.env.NODE_ENV !== 'test') console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
};
