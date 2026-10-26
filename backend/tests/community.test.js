const request = require('supertest');
const { setup, teardown, bearer, mkUni, mkUser, models } = require('./helpers');

let app, uni, S1, S2, MN, AD, EM;
const j = (m, u, uid, body) => request(app)[m](u).set(bearer(uid)).send(body);
let postId, commentId;

beforeAll(async () => {
  app = await setup();
  uni = await mkUni('EDU', 'EDU', 'Chattogram', 91.83, 22.35);
  S1 = await mkUser('s1', 'student', uni, { displayName: 'Nusrat Jahan' }); S2 = await mkUser('s2', 'student', uni, { displayName: 'Rakib Hasan' });
  MN = await mkUser('m1', 'mentor', uni, { displayName: 'Rahim Ahmed' }); AD = await mkUser('a1', 'admin', null); EM = await mkUser('e1', 'employer', null);
  for (const i of [3, 4, 5]) await mkUser('s' + i, 'student', uni);
});
afterAll(teardown);

test('create posts: group must exist, money asks and http links are refused, employers cannot post', async () => {
  expect((await j('post', '/api/posts', 's1', { text: 'My pandas groupby is slow, any tip?', topic: 'nope' })).status).toBe(400);
  expect((await j('post', '/api/posts', 's1', { text: 'Pay registration fee to join my course', topic: 'ml' })).status).toBe(400);
  expect((await j('post', '/api/posts', 's1', { text: 'Useful guide', topic: 'ml', link: 'http://example.com' })).status).toBe(400);
  expect((await j('post', '/api/posts', 'e1', { text: 'We are hiring now', topic: 'general' })).status).toBe(403);
  const ok = await j('post', '/api/posts', 's1', { text: 'My pandas groupby is slow, any tip?', topic: 'ml' });
  expect(ok.status).toBe(201); postId = ok.body.id;
});

test('feed shows short names, supports topic filter and search', async () => {
  const f = await j('get', '/api/feed?topic=ml', 's2');
  expect(f.body.posts).toHaveLength(1);
  expect(f.body.posts[0].author.name).toBe('Nusrat J.');
  expect((await j('get', '/api/feed?topic=web-dev', 's2')).body.posts).toHaveLength(0);
  expect((await j('get', '/api/feed?q=groupby', 's2')).body.posts).toHaveLength(1);
  expect((await j('get', '/api/feed?q=zzzz', 's2')).body.posts).toHaveLength(0);
  expect((await j('get', '/api/feed', 'e1')).status).toBe(403);
});

test('comments, one-level replies, notifications', async () => {
  const c = await j('post', `/api/posts/${postId}/comments`, 'm1', { text: 'Use vectorised ops and avoid apply.' });
  expect(c.status).toBe(201);
  const d = await j('get', `/api/posts/${postId}`, 's1');
  commentId = d.body.comments[0].id;
  expect(d.body.comments[0].verifiedMentor).toBe(true);
  expect((await j('post', `/api/posts/${postId}/comments`, 's1', { text: 'Thanks, trying it', parentId: commentId })).status).toBe(201);
  const reply = (await j('get', `/api/posts/${postId}`, 's1')).body.comments[0].replies[0];
  expect((await j('post', `/api/posts/${postId}/comments`, 's2', { text: 'nested', parentId: reply.id })).status).toBe(400); // replies are one level only
  expect((await j('get', `/api/posts/${postId}`, 's1')).body.post.commentCount).toBe(2);
  expect(await models.Notification.countDocuments({ userId: S1._id })).toBeGreaterThan(0);
});

test('one reaction per person; same reaction again removes it', async () => {
  expect((await j('put', `/api/posts/${postId}/reaction`, 's2', { type: 'helpful' })).body.myReaction).toBe('helpful');
  expect((await j('put', `/api/posts/${postId}/reaction`, 's2', { type: 'like' })).body.myReaction).toBe('like');
  let p = (await j('get', `/api/posts/${postId}`, 's1')).body.post;
  expect(p.reactions).toEqual({ like: 1 });
  expect((await j('put', `/api/posts/${postId}/reaction`, 's2', { type: 'like' })).body.myReaction).toBeNull();
  expect((await j('put', `/api/posts/${postId}/reaction`, 's2', { type: 'bad' })).status).toBe(400);
});

test('follow people and groups; the following feed uses them', async () => {
  expect((await j('put', `/api/follow/user/${S2._id}`, 's2', {})).status).toBe(400);
  expect((await j('put', `/api/follow/user/${S1._id}`, 's2', {})).body.following).toBe(true);
  expect((await j('get', '/api/feed?following=1', 's2')).body.posts).toHaveLength(1);
  await j('delete', `/api/follow/user/${S1._id}`, 's2');
  expect((await j('get', '/api/feed?following=1', 's2')).body.posts).toHaveLength(0);
  await j('put', '/api/follow/group/ml', 's2', {});
  expect((await j('get', '/api/feed?following=1', 's2')).body.posts).toHaveLength(1);
  const g = await j('get', '/api/groups', 's2');
  expect(g.body.groups.find((x) => x.key === 'ml')).toMatchObject({ joined: true, posts: 1 });
});

test('a blocked person is hidden from the feed', async () => {
  await models.User.updateOne({ _id: S2._id }, { $addToSet: { blockedBy: S1._id } });
  expect((await j('get', '/api/feed', 's2')).body.posts).toHaveLength(0);
  await models.User.updateOne({ _id: S2._id }, { $set: { blockedBy: [] } });
});

test('3 different reporters hide a post; the same person twice counts once; admin can restore', async () => {
  await j('post', `/api/posts/${postId}/report`, 's2', {}); await j('post', `/api/posts/${postId}/report`, 's2', {});
  expect((await j('get', `/api/posts/${postId}`, 's1')).status).toBe(200);
  const r3 = await j('post', `/api/posts/${postId}/report`, 's3', {});
  expect(r3.body.hidden).toBe(false);
  const r4 = await j('post', `/api/posts/${postId}/report`, 's4', {});
  expect(r4.body.hidden).toBe(true);
  expect((await j('get', `/api/posts/${postId}`, 's1')).status).toBe(404);
  expect((await j('get', '/api/admin/posts', 's1')).status).toBe(403);
  expect((await j('get', '/api/admin/posts', 'a1')).body.posts).toHaveLength(1);
  expect((await j('post', `/api/admin/posts/${postId}/moderate`, 'a1', { decision: 'restore' })).body.status).toBe('visible');
});

test('only the author or an admin can delete', async () => {
  expect((await j('delete', `/api/posts/${postId}`, 's2')).status).toBe(403);
  expect((await j('delete', `/api/posts/${postId}`, 's1')).status).toBe(200);
  expect((await j('get', `/api/posts/${postId}`, 's1')).status).toBe(404);
});
