// Demo data for the Community feed, so every screen can be tested right after `npm run seed:demo`.
// Idempotent: a post is created only if a post with the same text does not exist yet. Everything here is INVENTED and belongs to demo accounts.
const M = require('../models');

const D = '@demo.mentorlink.bd';
const H = 3600 * 1000;

// [author email, topic, text, link|null, hours ago, [[email, reaction]...], [[commenter email, text, [[replier email, text]...]]...]]
const POSTS = [
  ['mentor1', 'general', 'Welcome to the MentorLink BD community! Ask questions, share a resource, or show a small project. Be kind, and never share phone numbers or pay anyone for a job.', null, 70,
    [['student.edu', 'like'], ['student.su', 'like'], ['student.du', 'helpful'], ['mentor.nsu', 'like']],
    [['student.edu', 'Thank you! Where do I start if I only know a little Python?', [['mentor1', 'Start with the Python roadmap in Plan, then take the Python quiz to see your level.']]]]],
  ['student.edu', 'data-analysis', 'Question: for a first Data Analyst job, should I learn Power BI or Tableau first?', null, 52,
    [['mentor.nsu', 'helpful'], ['student2.du', 'like'], ['student.du', 'like']],
    [['mentor.nsu', 'Check ten job posts you like. Most in Bangladesh ask for Excel + SQL first, then Power BI. Learn one tool well; the ideas carry over.', [['student.edu', 'That helps a lot. I will count the posts this weekend.']]],
     ['student2.nsu', 'Power BI is free to start, so I began there.', []]]],
  ['student.du', 'data-analysis', 'I finished the SQL quiz and my level went up to Intermediate. The topic breakdown showed that I am weak in subqueries. Sharing the practice site I used.', 'https://sqlbolt.com', 40,
    [['student.edu', 'helpful'], ['mentor1', 'like'], ['student.nsu', 'helpful']],
    [['mentor1', 'Nice progress. Add a small project with 3 joined tables to your CV.', []]]],
  ['mentor.buet', 'backend-dev', 'Tip for junior backend developers: build one small REST API with login, one database and a few tests, and put it on GitHub. A working project says more than a long skills list.', null, 36,
    [['student.buet', 'like'], ['student.cuet', 'idea'], ['student.bracu', 'like'], ['student.edu', 'helpful']],
    [['student.buet', 'Should the tests be unit tests or API tests?', [['mentor.buet', 'Start with a few API tests. Add unit tests for the tricky logic later.']]]]],
  ['student.cuet', 'backend-dev', 'Looking for a study partner to practise Node.js + MongoDB this month. Evenings, Bangla or English.', null, 30,
    [['student.buet', 'like']],
    [['student.bracu', 'I am in. Message me in the app.', []]]],
  ['mentor.du', 'higher-study', 'For scholarship applications: start your statement of purpose early, and ask your teachers for recommendation letters at least one month before the deadline.', null, 28,
    [['student2.su', 'helpful'], ['student.du', 'helpful'], ['student.su', 'like']],
    [['student2.su', 'How long should the statement of purpose be?', [['mentor.du', 'Follow the university page: usually 500 to 1000 words. One clear story is better than a list.']]]]],
  ['mentor.su', 'ml', 'Before deep learning, make sure you can explain train/test split, overfitting and one simple metric to a friend. Most beginner mistakes start there.', null, 24,
    [['student.edu', 'idea'], ['student.buet', 'helpful'], ['student2.du', 'like']],
    [['student2.du', 'Is Kaggle Learn enough to start?', [['mentor.su', 'Yes, start with Intro to Machine Learning, then try one small dataset by yourself.']]]]],
  ['student.nsu', 'bcs', 'Anyone preparing for the BCS preliminary? Sharing my weekly plan: Bangla and English grammar on weekdays, general knowledge and mental ability on weekends.', null, 20,
    [['student.bracu', 'like'], ['student2.bracu', 'helpful']],
    [['student2.bracu', 'Please share the mental ability practice book you use.', []]]],
  ['student.bracu', 'general', 'My CV was reviewed by a mentor today. Biggest fix: one clear project line with what I built and what result it gave. Do not write only "good at teamwork".', null, 16,
    [['mentor.bracu', 'like'], ['student.edu', 'helpful'], ['student.su', 'idea'], ['student.cuet', 'like']],
    [['mentor.bracu', 'Well done. Keep each project to two lines: what, and what changed because of it.', []]]],
  ['mentor.edu', 'freelancing', 'Freelancing note: start with one small, clear service and three honest samples. Be careful with anyone who asks you to pay first to get work.', null, 12,
    [['student2.edu', 'helpful'], ['student.edu', 'like']],
    []],
  ['student2.edu', 'entrepreneurship', 'Our team is validating a small campus idea. Before building anything, we are interviewing 10 students about the problem. Any tips for good questions?', null, 8,
    [['mentor.edu', 'idea']],
    [['mentor.edu', 'Ask about the last time the problem happened, not whether they would use your idea. People tell stories well and predictions badly.', []]]],
  ['student.su', 'general', 'Is there a Bangla version of the roadmaps? It would help my friends from the district colleges.', null, 5,
    [['mentor2', 'like'], ['student2.su', 'like']],
    [['mentor2', 'Roadmap topics already have Bangla titles. More Bangla links are being added. You can also suggest one in this thread.', []]]],
];

// Posts used to test moderation. Texts are clearly fake demo content.
const MODERATION = [
  // one report: visible to everyone, shows in the admin "Reported" list
  ['student2.nsu', 'general', 'DEMO (reported once): selling my old notes, DM me. Admin can keep or remove this post.', 4, ['student.su'], 'visible'],
  // three unique reporters: auto-hidden, admin can Restore or Remove
  ['student2.bracu', 'freelancing', 'DEMO (hidden after 3 reports): Earn 5000 taka daily from home! Pay a small registration fee on bKash first.', 3, ['student.edu', 'student.su', 'student.du'], 'hidden'],
];

// [follower email, [people emails], [group keys]]
const FOLLOWS = [
  ['student.edu', ['mentor1', 'mentor.nsu', 'mentor.su'], ['general', 'data-analysis', 'ml']],
  ['student.su', ['mentor2', 'mentor.du'], ['general', 'higher-study']],
  ['student.du', ['mentor.nsu', 'mentor1'], ['data-analysis']],
  ['student.buet', ['mentor.buet'], ['backend-dev', 'cloud-devops']],
  ['student.cuet', ['mentor.buet'], ['backend-dev']],
  ['student.nsu', ['mentor.du'], ['bcs', 'general']],
  ['student.bracu', ['mentor.bracu'], ['general']],
  ['mentor1', ['student.edu'], ['general', 'data-analysis']],
];

async function seedCommunity() {
  const cache = new Map();
  const by = async (short) => {
    if (!cache.has(short)) cache.set(short, await M.User.findOne({ email: `${short}${D}` }));
    return cache.get(short);
  };
  if (!(await by('student.edu')) || !(await by('mentor1'))) return { posts: 0 }; // demo users not seeded

  let posts = 0, comments = 0;
  for (const [author, topic, text, link, ago, reacts, thread] of POSTS) {
    const a = await by(author); if (!a) continue;
    let p = await M.Post.findOne({ text });
    if (!p) {
      const reactions = [];
      for (const [u, type] of reacts) { const x = await by(u); if (x) reactions.push({ userId: x._id, type }); }
      const t = new Date(Date.now() - ago * H);
      p = await M.Post.create({ authorId: a._id, authorRole: a.role, topic, text, link: link || undefined, reactions, createdAt: t, updatedAt: t });
      posts += 1;
    }
    for (const [cu, ctext, replies] of thread) {
      const cUser = await by(cu); if (!cUser) continue;
      let c = await M.Comment.findOne({ postId: p._id, text: ctext });
      if (!c) { c = await M.Comment.create({ postId: p._id, parentId: null, authorId: cUser._id, authorRole: cUser.role, text: ctext }); comments += 1; }
      for (const [ru, rtext] of replies) {
        const rUser = await by(ru); if (!rUser) continue;
        if (!(await M.Comment.findOne({ postId: p._id, parentId: c._id, text: rtext }))) { await M.Comment.create({ postId: p._id, parentId: c._id, authorId: rUser._id, authorRole: rUser.role, text: rtext }); comments += 1; }
      }
    }
    await M.Post.updateOne({ _id: p._id }, { commentCount: await M.Comment.countDocuments({ postId: p._id, status: 'visible' }) });
  }

  for (const [author, topic, text, ago, reporters, status] of MODERATION) {
    const a = await by(author); if (!a || (await M.Post.findOne({ text }))) continue;
    const ids = []; for (const r of reporters) { const x = await by(r); if (x) ids.push(x._id); }
    const t = new Date(Date.now() - ago * H);
    await M.Post.create({ authorId: a._id, authorRole: a.role, topic, text, reporters: ids, status, createdAt: t, updatedAt: t });
    posts += 1;
  }

  for (const [who, people, groups] of FOLLOWS) {
    const f = await by(who); if (!f) continue;
    for (const pr of people) { const x = await by(pr); if (x) await M.Follow.updateOne({ followerId: f._id, kind: 'user', target: String(x._id) }, { $setOnInsert: { followerId: f._id, kind: 'user', target: String(x._id) } }, { upsert: true }); }
    for (const g of groups) await M.Follow.updateOne({ followerId: f._id, kind: 'group', target: g }, { $setOnInsert: { followerId: f._id, kind: 'group', target: g } }, { upsert: true });
  }
  return { posts, comments };
}

module.exports = { seedCommunity, POSTS, MODERATION, FOLLOWS };
