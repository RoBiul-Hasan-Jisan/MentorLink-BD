// Portfolio projects, GitHub link (ownership proven by a code in the profile bio) and plan reviews.
const { mongoose } = require('../config/db');
const { Schema } = mongoose;
const ref = (name, extra = {}) => ({ type: Schema.Types.ObjectId, ref: name, ...extra });

// One project can back several skills. Each skill gets its own SkillEvidence row (type "project"),
// so the existing mentor review loop (request review, endorse, needs work) works on it unchanged.
const projectSchema = new Schema({
  studentId: ref('User', { required: true, index: true }),
  title: { type: String, required: true, trim: true, maxlength: 120 },
  url: { type: String, required: true, maxlength: 300 },
  description: { type: String, default: '', maxlength: 600 },
  skillKeys: { type: [String], default: [] },
  source: { type: String, enum: ['manual', 'github'], default: 'manual' },
  evidenceIds: [ref('SkillEvidence')],
}, { timestamps: true });

const githubLinkSchema = new Schema({
  userId: ref('User', { required: true, unique: true }),
  username: { type: String, required: true, maxlength: 39 },
  code: { type: String, maxlength: 40 },
  verified: { type: Boolean, default: false },
  checkedAt: Date,
  repos: [{ name: String, url: String, language: String, topics: [String], description: String, stars: Number, pushedAt: Date }],
}, { timestamps: true });

// A student asks one of their accepted mentors to look over the 4-week plan. The mentor approves it or asks for changes.
const planReviewSchema = new Schema({
  studentId: ref('User', { required: true, index: true }),
  mentorId: ref('User', { required: true, index: true }),
  status: { type: String, enum: ['requested', 'approved', 'changes'], default: 'requested' },
  studentNote: { type: String, maxlength: 300, default: '' },
  mentorNote: { type: String, maxlength: 400, default: '' },
  tasksTotal: { type: Number, default: 0 },
  tasksDone: { type: Number, default: 0 },
  decidedAt: Date,
}, { timestamps: true });

module.exports = {
  PortfolioProject: mongoose.model('PortfolioProject', projectSchema),
  GithubLink: mongoose.model('GithubLink', githubLinkSchema),
  PlanReview: mongoose.model('PlanReview', planReviewSchema),
};
