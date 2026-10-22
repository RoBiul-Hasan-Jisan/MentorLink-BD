// One error shape for the whole API: { error: { code, message } }
class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const bad = (code, msg) => new HttpError(400, code, msg);
const unauthorized = (msg = 'Please sign in.') => new HttpError(401, 'UNAUTHENTICATED', msg);
const forbidden = (msg = 'You do not have access to this.') => new HttpError(403, 'FORBIDDEN', msg);
const notFound = (msg = 'Not found.') => new HttpError(404, 'NOT_FOUND', msg);
const conflict = (code, msg) => new HttpError(409, code, msg);

module.exports = { HttpError, bad, unauthorized, forbidden, notFound, conflict };
