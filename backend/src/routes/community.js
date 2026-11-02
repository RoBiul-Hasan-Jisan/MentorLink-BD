// Community feed: posts, comments and replies, reactions, follow people, skill groups, search, report and moderation.
const express = require('express');
const { z } = require('zod');
const M = require('../models');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/guards');
const { bad, notFound, forbidden, conflict } = require('../utils/httpError');
const { notify, toObjectId, audit, firstNameInitial } = require('../utils/helpers');
const { scamFlags } = require('../services/scam');
const { TARGETS } = require('../data/targets');
const env = require('../config/env');

const GROUP_KEYS = new Set(['general', ...TARGETS.map((t) => t.key)]);
const esc = (q) => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = function communityRoutes(auth) {
  const r = express.Router();
  const A = auth.authenticate;
  const member = [A, requireRole('student', 'mentor', 'department', 'admin')]; // employers are not part of the learning community
  const poster = [A, requireRole('student', 'mentor')];
  const admin = [A, requireRole('admin')];
  const oid = (x) => toObjectId(String(x));
  const blockedBetween = (me, other) => (me.blockedBy || []).map(String).includes(String(other._id)) || (other.blockedBy || []).map(String).includes(String(me._id));

  async function shape(posts, me) {
    const users = new Map((await M.User.find({ _id: { $in: posts.map((p) => p.authorId) } }).select('displayName role verificationStatus blockedBy').lean()).map((u) => [String(u._id), u]));
    const follows = new Set((await M.Follow.find({ followerId: me._id, kind: 'user' }).lean()).map((f) => f.target));
    return posts.filter((p) => { const u = users.get(String(p.authorId)); return u && !blockedBetween(me, u); }).map((p) => {
      const u = users.get(String(p.authorId));
      const counts = {}; for (const x of p.reactions || []) counts[x.type] = (counts[x.type] || 0) + 1;
      const mine = (p.reactions || []).find((x) => String(x.userId) === String(me._id));
      return {
        id: p._id, topic: p.topic, text: p.text, link: p.link || null, createdAt: p.createdAt,
        author: { id: u._id, name: firstNameInitial(u.displayName), role: u.role, verifiedMentor: u.role === 'mentor' && u.verificationStatus === 'verified', following: follows.has(String(u._id)), isMe: String(u._id) === String(me._id) },
        reactions: counts, myReaction: mine ? mine.type : null, myReactions: (p.reactions || []).filter((x) => String(x.userId) === String(me._id)).map((x) => x.type), commentCount: p.commentCount || 0,
      };
    });
  }

  // Feed. Filters: topic (group), q (search text), following=1 (people and groups you follow).
  r.get('/feed', ...member, async (req, res) => {
    const f = { status: 'visible' };
    const topic = String(req.query.topic || '');
    if (topic) { if (!GROUP_KEYS.has(topic)) throw bad('UNKNOWN_GROUP', 'Unknown group.'); f.topic = topic; }
    const q = String(req.query.q || '').trim().slice(0, 60);
    if (q) f.text = new RegExp(esc(q), 'i');
    if (req.query.following === '1') {
      const fs = await M.Follow.find({ followerId: req.user._id }).lean();
      const people = fs.filter((x) => x.kind === 'user').map((x) => x.target);
      const groups = fs.filter((x) => x.kind === 'group').map((x) => x.target);
      f.$or = [{ authorId: { $in: people } }, { topic: { $in: groups } }];
    }
    if (req.query.before) f.createdAt = { $lt: new Date(String(req.query.before)) };
    const posts = await M.Post.find(f).sort({ createdAt: -1 }).limit(30).lean();
    res.json({ posts: await shape(posts, req.user), next: posts.length === 30 ? posts[posts.length - 1].createdAt : null });
  });

  const postSchema = z.object({ text: z.string().trim().min(3).max(1000), topic: z.string().max(40).default('general'), link: z.string().url().max(300).refine((u) => u.startsWith('https://'), 'Links must start with https://').optional() }).strict();
  r.post('/posts', ...poster, validate(postSchema), async (req, res) => {
    if (!GROUP_KEYS.has(req.body.topic)) throw bad('UNKNOWN_GROUP', 'Unknown group.');
    if (scamFlags(`${req.body.text} ${req.body.link || ''}`).length) throw bad('NOT_ALLOWED', 'Posts asking for money or off-app contact are not allowed.');
    const recent = await M.Post.countDocuments({ authorId: req.user._id, createdAt: { $gt: new Date(Date.now() - 60 * 60 * 1000) } });
    if (recent >= 10) throw conflict('TOO_MANY_POSTS', 'You have posted a lot in the last hour. Please wait a little.');
    const p = await M.Post.create({ ...req.body, authorId: req.user._id, authorRole: req.user.role });
    res.status(201).json({ id: p._id });
  });

  r.get('/posts/:id', ...member, async (req, res) => {
    oid(req.params.id);
    const p = await M.Post.findOne({ _id: req.params.id, status: 'visible' }).lean();
    if (!p) throw notFound();
    const [one] = await shape([p], req.user);
    if (!one) throw notFound();
    const cs = await M.Comment.find({ postId: p._id, status: 'visible' }).sort({ createdAt: 1 }).lean();
    const users = new Map((await M.User.find({ _id: { $in: cs.map((c) => c.authorId) } }).select('displayName role verificationStatus blockedBy').lean()).map((u) => [String(u._id), u]));
    const view = (c) => { const u = users.get(String(c.authorId)) || {}; return { id: c._id, text: c.text, createdAt: c.createdAt, by: firstNameInitial(u.displayName), role: c.authorRole, verifiedMentor: c.authorRole === 'mentor' && u.verificationStatus === 'verified', replies: [] }; };
    const tops = []; const byId = new Map();
    for (const c of cs) {
      const u = users.get(String(c.authorId));
      if (!u || blockedBetween(req.user, { _id: u._id, blockedBy: u.blockedBy })) continue;
      const v = view(c);
      if (!c.parentId) { tops.push(v); byId.set(String(c._id), v); } else if (byId.has(String(c.parentId))) byId.get(String(c.parentId)).replies.push(v);
    }
    res.json({ post: one, comments: tops });
  });

  r.delete('/posts/:id', ...member, async (req, res) => {
    oid(req.params.id);
    const p = await M.Post.findById(req.params.id);
    if (!p) throw notFound();
    if (String(p.authorId) !== String(req.user._id) && req.user.role !== 'admin') throw forbidden();
    p.status = 'removed'; await p.save();
    if (req.user.role === 'admin') await audit(req.user._id, 'remove_post', 'post', p._id);
    res.json({ ok: true });
  });

  // Comment or reply. A reply must point at a top-level comment of the same post (one level only).
  r.post('/posts/:id/comments', ...poster, validate(z.object({ text: z.string().trim().min(1).max(600), parentId: z.string().optional() }).strict()), async (req, res) => {
    oid(req.params.id);
    const p = await M.Post.findOne({ _id: req.params.id, status: 'visible' });
    if (!p) throw notFound();
    if (scamFlags(req.body.text).length) throw bad('NOT_ALLOWED', 'Comments asking for money or off-app contact are not allowed.');
    let parent = null;
    if (req.body.parentId) {
      oid(req.body.parentId);
      parent = await M.Comment.findOne({ _id: req.body.parentId, postId: p._id, parentId: null, status: 'visible' });
      if (!parent) throw bad('BAD_PARENT', 'You can only reply to a comment on this post.');
    }
    await M.Comment.create({ postId: p._id, parentId: parent ? parent._id : null, authorId: req.user._id, authorRole: req.user.role, text: req.body.text });
    await M.Post.updateOne({ _id: p._id }, { $inc: { commentCount: 1 } });
    if (String(p.authorId) !== String(req.user._id)) await notify(p.authorId, 'New comment on your post', req.body.text.slice(0, 80), 'community');
    if (parent && String(parent.authorId) !== String(req.user._id)) await notify(parent.authorId, 'New reply to your comment', req.body.text.slice(0, 80), 'community');
    res.status(201).json({ ok: true });
  });

  // A person can give each kind of reaction once (like, helpful and idea can all be on). Sending the same kind again removes it.
  r.put('/posts/:id/reaction', ...member, validate(z.object({ type: z.enum(M.REACTIONS) }).strict()), async (req, res) => {
    oid(req.params.id);
    const p = await M.Post.findOne({ _id: req.params.id, status: 'visible' });
    if (!p) throw notFound();
    const mine = (x) => String(x.userId) === String(req.user._id);
    const had = p.reactions.some((x) => mine(x) && x.type === req.body.type);
    p.reactions = p.reactions.filter((x) => !(mine(x) && x.type === req.body.type));
    if (!had) p.reactions.push({ userId: req.user._id, type: req.body.type });
    await p.save();
    const myReactions = p.reactions.filter(mine).map((x) => x.type);
    res.json({ myReactions, myReaction: myReactions[0] || null });
  });

  r.post('/posts/:id/report', ...member, async (req, res) => {
    oid(req.params.id);
    const p = await M.Post.findOneAndUpdate({ _id: req.params.id, status: 'visible' }, { $addToSet: { reporters: req.user._id } }, { returnDocument: 'after' }); // one person counts once
    if (!p) throw notFound();
    let hidden = false;
    if (p.reporters.length >= env.reportHideThreshold) { p.status = 'hidden'; await p.save(); hidden = true; await audit(req.user._id, 'auto_hide_post', 'post', p._id, { reports: p.reporters.length }); }
    res.status(201).json({ ok: true, hidden });
  });

  // Follow people and join groups.
  r.put('/follow/user/:id', ...member, async (req, res) => {
    oid(req.params.id);
    if (String(req.params.id) === String(req.user._id)) throw bad('SELF_FOLLOW', 'You cannot follow yourself.');
    const u = await M.User.findOne({ _id: req.params.id, role: { $in: ['student', 'mentor', 'department'] } }).select('blockedBy').lean();
    if (!u || blockedBetween(req.user, u)) throw notFound();
    await M.Follow.updateOne({ followerId: req.user._id, kind: 'user', target: String(req.params.id) }, { $setOnInsert: { followerId: req.user._id, kind: 'user', target: String(req.params.id) } }, { upsert: true });
    res.json({ following: true });
  });
  r.delete('/follow/user/:id', ...member, async (req, res) => { await M.Follow.deleteOne({ followerId: req.user._id, kind: 'user', target: String(req.params.id) }); res.json({ following: false }); });
  r.put('/follow/group/:key', ...member, async (req, res) => {
    if (!GROUP_KEYS.has(req.params.key)) throw notFound();
    await M.Follow.updateOne({ followerId: req.user._id, kind: 'group', target: req.params.key }, { $setOnInsert: { followerId: req.user._id, kind: 'group', target: req.params.key } }, { upsert: true });
    res.json({ joined: true });
  });
  r.delete('/follow/group/:key', ...member, async (req, res) => { await M.Follow.deleteOne({ followerId: req.user._id, kind: 'group', target: req.params.key }); res.json({ joined: false }); });

  // Skill groups: one per target plus "general", with post counts and whether I joined.
  r.get('/groups', ...member, async (req, res) => {
    const counts = new Map((await M.Post.aggregate([{ $match: { status: 'visible' } }, { $group: { _id: '$topic', n: { $sum: 1 } } }])).map((x) => [x._id, x.n]));
    const mine = new Set((await M.Follow.find({ followerId: req.user._id, kind: 'group' }).lean()).map((x) => x.target));
    res.json({ groups: [{ key: 'general', titleEn: 'General', titleBn: 'সাধারণ' }, ...TARGETS.map((t) => ({ key: t.key, titleEn: t.titleEn, titleBn: t.titleBn }))].map((g) => ({ ...g, posts: counts.get(g.key) || 0, joined: mine.has(g.key) })) });
  });

  // Admin moderation of posts.
  r.get('/admin/posts', ...admin, async (_q, res) => res.json({ posts: await M.Post.find({ status: { $ne: 'removed' }, $or: [{ status: 'hidden' }, { 'reporters.0': { $exists: true } }] }).select('text status reporters topic').limit(100).lean() }));
  r.post('/admin/posts/:id/moderate', ...admin, validate(z.object({ decision: z.enum(['hide', 'restore', 'remove']) }).strict()), async (req, res) => {
    oid(req.params.id);
    const status = { hide: 'hidden', restore: 'visible', remove: 'removed' }[req.body.decision];
    const p = await M.Post.findByIdAndUpdate(req.params.id, { status, ...(status === 'visible' ? { reporters: [] } : {}) }, { returnDocument: 'after' });
    if (!p) throw notFound();
    await audit(req.user._id, `post_${req.body.decision}`, 'post', p._id);
    res.json({ status: p.status });
  });

  return r;
};
