// One list of every collection that holds a person's data. "Download my data" and "Delete my account" both read it,
// so a new feature cannot be added to one and forgotten in the other.
// tests/userdata.test.js reads the model files and FAILS when a model that points at a User is in none of the three lists below.
// Pure rules + two small async functions that take the models object (so tests can pass a fake).

// [exportKey, Model, fields that hold the person's id, options]
//   one: true  -> exported as a single object (findOne) instead of a list
// Where two fields are listed (student and mentor), the person is one side of the record and the whole record is deleted with the account.
const OWN = [
  ['profile', 'StudentProfile', ['userId'], { one: true }],
  ['mentorProfile', 'MentorProfile', ['userId'], { one: true }],
  ['evidence', 'SkillEvidence', ['studentId']],
  ['cvVersions', 'CvVersion', ['studentId']],
  ['plans', 'Plan', ['studentId']],
  ['tasks', 'Task', ['studentId']],
  ['applications', 'Application', ['studentId']],
  ['savedJobs', 'SavedJob', ['studentId']],
  ['interviews', 'Interview', ['studentId', 'scheduledBy']],
  ['applicationMessages', 'AppMessage', ['senderId']],
  ['documentRequests', 'DocumentRequest', ['studentId', 'requestedBy']],
  ['jobOffers', 'Offer', ['studentId', 'createdBy']],
  ['requests', 'MentorRequest', ['studentId', 'mentorId']],
  ['matches', 'Match', ['studentId', 'mentorId']],
  ['sessions', 'Session', ['studentId', 'mentorId']],
  ['mockInterviews', 'MockInterview', ['studentId', 'mentorId']],
  ['planReviews', 'PlanReview', ['studentId', 'mentorId']],
  ['mentorReviews', 'MentorReview', ['studentId', 'mentorId']],
  ['notifications', 'Notification', ['userId']],
  ['roadmapProgress', 'RoadmapProgress', ['studentId']],
  ['resourceProgress', 'ResourceProgress', ['studentId']], // the old export/delete used userId, which this model does not have, so it matched nothing
  ['progressHistory', 'ProgressSnapshot', ['studentId']],
  ['messagesSent', 'Message', ['senderId']],
  ['projects', 'PortfolioProject', ['studentId']],
  ['githubLink', 'GithubLink', ['userId'], { one: true }],
  ['passport', 'Passport', ['userId'], { one: true }],
  ['sprints', 'Sprint', ['studentId']],
  ['companyInvitations', 'TalentInvite', ['studentId']],
  ['journey', 'Journey', ['mentorId'], { one: true }],
  ['posts', 'Post', ['authorId']],
  ['comments', 'Comment', ['authorId']],
  ['follows', 'Follow', ['followerId']],
  ['questions', 'Question', ['authorId']],
  ['answers', 'Answer', ['authorId']],
  ['workshopsHosted', 'Workshop', ['hostId']],
  // Metadata only: the file bytes are stored with select:false and are never exported (they are the person's own ID papers).
  ['verificationDocuments', 'VerificationDoc', ['userId']],
  ['companyMemberships', 'OrganizationMember', ['userId']],
];

// The person is one entry inside an array on someone else's record: removed on delete, shown on export where useful.
const PULL = [
  { model: 'Workshop', update: (id) => ({ $pull: { attendees: id } }), filter: (id) => ({ attendees: id }) },
  { model: 'Post', update: (id) => ({ $pull: { reactions: { userId: id }, reporters: id } }), filter: (id) => ({ $or: [{ 'reactions.userId': id }, { reporters: id }] }) },
  { model: 'Question', update: (id) => ({ $pull: { reporters: id } }), filter: (id) => ({ reporters: id }) },
];

// A reference that is cleared, not deleted (the other person's record stays, without this person on it).
const CLEAR = [
  { model: 'Sprint', field: 'mentorId' },
  { model: 'SkillEvidence', field: 'endorsedBy' },
  { model: 'SkillEvidence', field: 'reviewMentorId' },
];

// Kept on purpose, with the reason. A new model that points at a User must be added to OWN or here.
const RETAINED = {
  User: 'The account row stays as a blank "Deleted user" so other people\'s records do not break; email, name and settings are wiped.',
  Report: 'Safety reports are kept so moderators can finish reviewing; the reporter is never shown to the person reported.',
  AuditLog: 'Admin audit trail is kept for accountability.',
  Opportunity: 'A job post other students applied to stays; it shows only the organisation name.',
  Resource: 'Learning links added by admins are shared content, not personal data.',
  Organization: 'A company record is the company\'s, not a person\'s; the person\'s membership in it is deleted.',
};
// Models that do not point at a User at all (so nothing personal): listed so the guard test is exhaustive.
const NOT_PERSONAL = ['University', 'Quiz', 'Roadmap', 'Skill', 'RoleTemplate'];

const anyOf = (fields, id) => (fields.length === 1 ? { [fields[0]]: id } : { $or: fields.map((f) => ({ [f]: id })) });

// The `data` part of the download. Account and settings are added by the route.
async function exportUser(M, id) {
  const out = {};
  await Promise.all(OWN.map(async ([key, model, fields, opts = {}]) => {
    const q = M[model][opts.one ? 'findOne' : 'find'](anyOf(fields, id));
    out[key] = await q.lean();
  }));
  const joined = await M.Workshop.find({ attendees: id }).select('title startsAt').lean();
  out.workshopsJoined = joined;
  return out;
}

// Deletes everything in the lists above. Order matters only for the community items (children first).
async function eraseUser(M, id) {
  // Community: a person's posts take their comments with them; comments they wrote elsewhere lower that post's counter.
  const posts = await M.Post.find({ authorId: id }).select('_id').lean();
  const mine = await M.Comment.find({ authorId: id }).select('_id postId').lean();
  const postIds = posts.map((p) => p._id);
  const myPostSet = new Set(postIds.map(String));
  const perPost = new Map();
  for (const c of mine) if (!myPostSet.has(String(c.postId))) perPost.set(String(c.postId), (perPost.get(String(c.postId)) || 0) + 1);
  const questions = await M.Question.find({ authorId: id }).select('_id').lean();
  const requests = await M.MentorRequest.find(anyOf(['studentId', 'mentorId'], id)).select('_id').lean();
  await Promise.all([
    requests.length ? M.Message.deleteMany({ requestId: { $in: requests.map((r) => r._id) } }) : null, // the other person's side of the chats goes with the chat
    postIds.length ? M.Comment.deleteMany({ postId: { $in: postIds } }) : null,
    mine.length ? M.Comment.deleteMany({ parentId: { $in: mine.map((c) => c._id) } }) : null, // replies to their comments
    questions.length ? M.Answer.deleteMany({ questionId: { $in: questions.map((q) => q._id) } }) : null,
    ...[...perPost].map(([postId, n]) => M.Post.updateOne({ _id: postId }, { $inc: { commentCount: -n } })),
  ]);
  await Promise.all([
    ...OWN.map(([, model, fields]) => M[model].deleteMany(anyOf(fields, id))),
    M.Follow.deleteMany({ kind: 'user', target: String(id) }), // people who followed this person
    ...PULL.map((p) => M[p.model].updateMany(p.filter(id), p.update(id))),
    ...CLEAR.map((c) => M[c.model].updateMany({ [c.field]: id }, { $unset: { [c.field]: 1 } })),
  ]);
}

module.exports = { OWN, PULL, CLEAR, RETAINED, NOT_PERSONAL, exportUser, eraseUser, anyOf };
