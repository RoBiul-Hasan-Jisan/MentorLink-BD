// Mounted inside /api/admin AFTER authenticateFirebase + requireRole('admin') (see admin.js).
// Nothing is hidden from admins, but EVERY action here is written to auditLogs.
const router = require('express').Router();
const { z } = require('zod');
const User = require('../models/User');
const University = require('../models/University');
const MentorProfile = require('../models/MentorProfile');
const RoleRequest = require('../models/RoleRequest');
const Opportunity = require('../models/Opportunity');
const Report = require('../models/Report');
const Match = require('../models/Match');
const AuditLog = require('../models/AuditLog');
const { fairnessStats } = require('../services/fairness');
const { notify } = require('../services/notify');
const audit = require('../utils/audit');
const { objectId, pageQuery } = require('../utils/validators');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

const hoursSince = (d) => Math.round((Date.now() - new Date(d).getTime()) / 3600000);

// ---------- dashboard numbers ("5 to verify, 2 reports, 31 h avg turnaround") ----------
router.get('/summary', asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 30 * 86400000);
  const [roleReqs, pendingStudents, pendingPosts, reportGroups, turnaround] = await Promise.all([
    RoleRequest.countDocuments({ status: 'pending' }),
    User.countDocuments({ role: 'student', verificationStatus: 'pending' }),
    Opportunity.countDocuments({ status: 'pending' }),
    Report.aggregate([{ $match: { status: 'open' } }, { $group: { _id: { t: '$targetType', id: '$targetId' } } }, { $count: 'n' }]),
    RoleRequest.aggregate([{ $match: { status: { $in: ['approved', 'rejected'] }, reviewedAt: { $gte: since } } }, { $group: { _id: null, ms: { $avg: { $subtract: ['$reviewedAt', '$createdAt'] } } } }]),
  ]);
  res.json({ toVerify: roleReqs + pendingStudents, roleRequests: roleReqs, pendingStudents, pendingPosts, reports: reportGroups[0] ? reportGroups[0].n : 0,
    avgTurnaroundHours: turnaround[0] ? Math.round(turnaround[0].ms / 3600000) : null });
}));

// ---------- verification queue: alumni / department role requests ----------
router.get('/role-requests', asyncHandler(async (req, res) => {
  const { status, page, limit } = z.object({ status: z.enum(['pending', 'approved', 'rejected']).default('pending') }).merge(pageQuery).parse(req.query);
  const rows = await RoleRequest.find({ status }).sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit).populate('userId', 'displayName email department batchYear universityId');
  const unis = new Map((await University.find({ _id: { $in: rows.map((r) => r.userId.universityId) } })).map((u) => [String(u._id), u.name]));
  res.json({ items: rows.map((r) => ({ id: String(r._id), requestedRole: r.requestedRole, note: r.note || null, proofUrl: r.proofUrl || null, status: r.status, waitingHours: hoursSince(r.createdAt), createdAt: r.createdAt,
    user: { id: String(r.userId._id), displayName: r.userId.displayName, email: r.userId.email, department: r.userId.department || null, batchYear: r.userId.batchYear || null, universityName: unis.get(String(r.userId.universityId)) || null } })), page, limit });
}));

router.post('/role-requests/:id/approve', asyncHandler(async (req, res) => {
  const { department } = z.object({ department: z.string().trim().max(80).optional() }).strict().parse(req.body);
  const rr = await RoleRequest.findOneAndUpdate({ _id: objectId.parse(req.params.id), status: 'pending' }, { $set: { status: 'approved', reviewedBy: req.user._id, reviewedAt: new Date() } }, { new: true });
  if (!rr) throw new AppError(409, 'NOT_PENDING', 'Request not found or already reviewed');
  const user = await User.findById(rr.userId);
  // The SERVER sets the role, and only here, after an admin approved.
  user.role = rr.requestedRole; user.verificationStatus = 'verified'; if (department) user.department = department;
  await user.save();
  if (rr.requestedRole === 'mentor') await MentorProfile.updateOne({ userId: user._id }, { $setOnInsert: { weeklyCapacity: 3, isRising: true } }, { upsert: true });
  await audit(req.user._id, 'role.approve', 'User', user._id, { role: rr.requestedRole, requestId: String(rr._id) });
  await notify(user._id, { type: 'role_approved', title: { en: 'You are verified', bn: 'আপনি যাচাইকৃত' }, body: { en: `Your ${rr.requestedRole} account is approved. Sign in again.`, bn: 'আপনার অ্যাকাউন্ট অনুমোদিত হয়েছে।' }, data: { role: rr.requestedRole } });
  res.json({ id: String(rr._id), status: 'approved', userId: String(user._id), role: user.role });
}));

router.post('/role-requests/:id/reject', asyncHandler(async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(3).max(300) }).strict().parse(req.body);
  const rr = await RoleRequest.findOneAndUpdate({ _id: objectId.parse(req.params.id), status: 'pending' }, { $set: { status: 'rejected', reason, reviewedBy: req.user._id, reviewedAt: new Date() } }, { new: true });
  if (!rr) throw new AppError(409, 'NOT_PENDING', 'Request not found or already reviewed');
  await audit(req.user._id, 'role.reject', 'User', rr.userId, { requestId: String(rr._id), reason });
  await notify(rr.userId, { type: 'role_rejected', title: { en: 'Verification not approved', bn: 'যাচাই অনুমোদিত হয়নি' }, body: { en: reason, bn: reason }, data: {} });
  res.json({ id: String(rr._id), status: 'rejected' });
}));

router.get('/users', asyncHandler(async (req, res) => {
  const q = z.object({ verificationStatus: z.enum(['pending', 'verified', 'rejected']).optional(), role: z.enum(['student', 'mentor', 'department', 'employer', 'admin']).optional() }).merge(pageQuery).parse(req.query);
  const filter = { ...(q.verificationStatus && { verificationStatus: q.verificationStatus }), ...(q.role && { role: q.role }) };
  const [rows, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit), User.countDocuments(filter)]);
  res.json({ items: rows.map((u) => ({ id: String(u._id), displayName: u.displayName, email: u.email, role: u.role, verificationStatus: u.verificationStatus, department: u.department || null, createdAt: u.createdAt })), total, page: q.page });
}));

// ---------- opportunities: review, restore, remove ----------
const posterOf = (o) => (o.postedBy && o.postedBy.displayName ? { id: String(o.postedBy._id), displayName: o.postedBy.displayName } : null);
router.get('/opportunities', asyncHandler(async (req, res) => {
  const q = z.object({ status: z.enum(['pending', 'approved', 'hidden', 'removed', 'closed']).default('pending') }).merge(pageQuery).parse(req.query);
  const [rows, total] = await Promise.all([Opportunity.find({ status: q.status }).sort({ createdAt: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).populate('postedBy', 'displayName'), Opportunity.countDocuments({ status: q.status })]);
  res.json({ items: rows.map((o) => ({ id: String(o._id), title: o.title, organization: o.organization, status: o.status, flags: o.flags, reportCount: o.reportCount, employmentType: o.employmentType,
    description: o.description, noFeeConfirmed: o.noFeeConfirmed, poster: posterOf(o), waitingHours: hoursSince(o.createdAt), createdAt: o.createdAt })), total, page: q.page });
}));

async function review(req, res, { from, to, action, resolveReports, notifyPoster }) {
  const { note, warn } = z.object({ note: z.string().trim().max(300).optional(), warn: z.boolean().optional() }).strict().parse(req.body || {});
  const id = objectId.parse(req.params.id);
  const o = await Opportunity.findOneAndUpdate({ _id: id, status: { $in: from } }, { $set: { status: to, reviewedBy: req.user._id, reviewedAt: new Date(), reviewNote: note, ...(resolveReports === 'dismissed' && { reportCount: 0 }) } }, { new: true });
  if (!o) throw new AppError(409, 'INVALID_STATE', `Post is not in a state that allows "${action}"`);
  if (resolveReports) await Report.updateMany({ targetType: 'opportunity', targetId: id, status: 'open' }, { $set: { status: resolveReports } });
  await audit(req.user._id, `opportunity.${action}`, 'Opportunity', id, { note, warn: !!warn });
  const payload = notifyPoster && notifyPoster(o, { note, warn });
  if (payload) await notify(o.postedBy, payload); // "remove" only notifies the poster when the admin chose to warn them
  res.json({ id: String(o._id), status: o.status });
}
router.post('/opportunities/:id/approve', asyncHandler((req, res) => review(req, res, { from: ['pending'], to: 'approved', action: 'approve',
  notifyPoster: (o) => ({ type: 'post_approved', title: { en: 'Your post is live', bn: 'আপনার পোস্ট প্রকাশিত' }, body: { en: o.title, bn: o.title }, data: { opportunityId: String(o._id) } }) })));
router.post('/opportunities/:id/restore', asyncHandler((req, res) => review(req, res, { from: ['hidden'], to: 'approved', action: 'restore', resolveReports: 'dismissed',
  notifyPoster: (o) => ({ type: 'post_restored', title: { en: 'Your post was restored', bn: 'আপনার পোস্ট পুনরুদ্ধার হয়েছে' }, body: { en: o.title, bn: o.title }, data: { opportunityId: String(o._id) } }) })));
router.post('/opportunities/:id/hide', asyncHandler((req, res) => review(req, res, { from: ['approved'], to: 'hidden', action: 'hide' })));
// "Remove and warn poster"
router.post('/opportunities/:id/remove', asyncHandler((req, res) => review(req, res, { from: ['pending', 'approved', 'hidden'], to: 'removed', action: 'remove', resolveReports: 'actioned',
  notifyPoster: (o, { note, warn }) => warn ? { type: 'post_removed', title: { en: 'Your post was removed', bn: 'আপনার পোস্ট সরানো হয়েছে' },
    body: { en: note || 'It broke the no-fee / safety rules. Never ask applicants for money.', bn: note || 'এটি ফি/নিরাপত্তা নিয়ম ভেঙেছে।' }, data: { opportunityId: String(o._id) } } : null })));

// ---------- scam / user reports, grouped by target ----------
router.get('/reports', asyncHandler(async (req, res) => {
  const { targetType } = z.object({ targetType: z.enum(['opportunity', 'user']).optional() }).parse(req.query);
  const groups = await Report.aggregate([{ $match: { status: 'open', ...(targetType && { targetType }) } },
    { $group: { _id: { t: '$targetType', id: '$targetId' }, count: { $sum: 1 }, reasons: { $push: '$reason' }, first: { $min: '$createdAt' } } }, { $sort: { count: -1, first: 1 } }, { $limit: 50 }]);
  const [opps, users] = await Promise.all([
    Opportunity.find({ _id: { $in: groups.filter((g) => g._id.t === 'opportunity').map((g) => g._id.id) } }),
    User.find({ _id: { $in: groups.filter((g) => g._id.t === 'user').map((g) => g._id.id) } }),
  ]);
  const oBy = new Map(opps.map((o) => [String(o._id), o])), uBy = new Map(users.map((u) => [String(u._id), u]));
  res.json({ items: groups.map((g) => {
    const o = g._id.t === 'opportunity' ? oBy.get(String(g._id.id)) : null, u = g._id.t === 'user' ? uBy.get(String(g._id.id)) : null;
    return { targetType: g._id.t, targetId: String(g._id.id), reporters: g.count, reasons: g.reasons.reduce((a, r) => ({ ...a, [r]: (a[r] || 0) + 1 }), {}), firstReportedAt: g.first,
      ...(o && { title: o.title, status: o.status, flags: o.flags, autoHidden: o.status === 'hidden' }), ...(u && { displayName: u.displayName, role: u.role }) };
  }) });
}));

// For USER reports (opportunity reports are closed through the opportunity actions above).
router.post('/reports/user/:userId/resolve', asyncHandler(async (req, res) => {
  const { action, note } = z.object({ action: z.enum(['dismiss', 'action']), note: z.string().trim().max(300).optional() }).strict().parse(req.body);
  const r = await Report.updateMany({ targetType: 'user', targetId: objectId.parse(req.params.userId), status: 'open' }, { $set: { status: action === 'dismiss' ? 'dismissed' : 'actioned' } });
  await audit(req.user._id, `report.user.${action}`, 'User', req.params.userId, { note, closed: r.modifiedCount });
  res.json({ closed: r.modifiedCount });
}));

// ---------- audit log ----------
router.get('/audit', asyncHandler(async (req, res) => {
  const q = z.object({ action: z.string().max(60).optional() }).merge(pageQuery).parse(req.query);
  const filter = q.action ? { action: q.action } : {};
  const [rows, total] = await Promise.all([AuditLog.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).populate('actorId', 'displayName role'), AuditLog.countDocuments(filter)]);
  res.json({ items: rows.map((a) => ({ id: String(a._id), action: a.action, actor: a.actorId ? { id: String(a.actorId._id), displayName: a.actorId.displayName, role: a.actorId.role } : { system: true },
    targetType: a.targetType, targetId: a.targetId, meta: a.meta, at: a.createdAt })), total, page: q.page });
}));

// ---------- monthly fairness check ----------
router.get('/fairness', asyncHandler(async (req, res) => {
  const { days } = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }).parse(req.query);
  const rows = await Match.aggregate([{ $match: { createdAt: { $gte: new Date(Date.now() - days * 86400000) } } }, { $group: { _id: '$mentorId', n: { $sum: 1 } } }]);
  const stats = fairnessStats(rows.map((r) => ({ mentorId: r._id, n: r.n })));
  const names = new Map((await User.find({ _id: { $in: rows.map((r) => r._id) } }).select('displayName')).map((u) => [String(u._id), u.displayName]));
  res.json({ days, ...stats, highestMentorName: names.get(stats.highestMentorId) || null, byMentor: stats.byMentor.map((m) => ({ ...m, displayName: names.get(m.mentorId) || null, sharePercent: Math.round(m.share * 1000) / 10 })) });
}));

// ---------- "Admin preview (read-only)": opening another role's screens is recorded ----------
router.post('/preview', asyncHandler(async (req, res) => {
  const { role } = z.object({ role: z.enum(['student', 'mentor', 'department']) }).strict().parse(req.body);
  await audit(req.user._id, 'admin.preview', 'Role', role, {});
  res.json({ logged: true, readOnly: true });
}));

module.exports = router;
