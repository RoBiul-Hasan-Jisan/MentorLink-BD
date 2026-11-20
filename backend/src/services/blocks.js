// Blocking is two-way in effect: if either person blocked the other, they cannot chat.
// `blockedBy` on a user lists the people THAT user blocked (see POST /users/:id/block).
const ids = (list) => (list || []).map(String);
const hasBlocked = (a, b) => !!a && !!b && ids(a.blockedBy).includes(String(b._id));
const isBlockedBetween = (a, b) => hasBlocked(a, b) || hasBlocked(b, a);
// The other person on a mentor request, given the signed-in user's id.
const otherId = (rq, myId) => (String(rq.studentId) === String(myId) ? rq.mentorId : rq.studentId);
module.exports = { isBlockedBetween, hasBlocked, otherId };
