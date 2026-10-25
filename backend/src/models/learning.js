const { mongoose } = require('../config/db');
const { Schema } = mongoose;

const skillSchema = new Schema({
  key: { type: String, required: true, unique: true },
  nameEn: { type: String, required: true },
  nameBn: { type: String, required: true },
  learningHours: { type: Number, default: 20 }, // documented rubric: hours to move one level
});

const roleTemplateSchema = new Schema({
  key: { type: String, required: true, unique: true },
  titleEn: { type: String, required: true },
  titleBn: { type: String, required: true },
  requiredSkills: [
    {
      skillKey: { type: String, required: true },
      weight: { type: Number, required: true, min: 0 },
      requiredLevel: { type: Number, required: true, min: 1, max: 3 },
    },
  ],
});

// Evidence-based skills: self-rating counts least, mentor endorsement counts most.
const skillEvidenceSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    skillKey: { type: String, required: true },
    type: { type: String, enum: ['self', 'quiz', 'project', 'endorsement'], required: true },
    level: { type: Number, min: 1, max: 3, required: true },
    url: { type: String, maxlength: 300 },
    endorsedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const resourceSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 140 },
    url: { type: String, required: true, maxlength: 300 },
    skillKey: { type: String, required: true, index: true },
    language: { type: String, enum: ['bn', 'en'], default: 'en' },
    kind: { type: String, enum: ['course', 'video', 'article', 'practice'], default: 'course' },
    free: { type: Boolean, default: true },
    status: { type: String, enum: ['approved', 'hidden'], default: 'approved' },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reportCount: { type: Number, default: 0 },
    lastLinkCheckedAt: Date,
    linkStatus: { type: String, enum: ['ok', 'broken', 'blocked'] },
  },
  { timestamps: true }
);

// A student marks a resource as done. This is progress only: it does NOT raise a skill level
// (levels come from quiz, project or mentor endorsement evidence).
const resourceProgressSchema = new Schema(
  { studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, resourceId: { type: Schema.Types.ObjectId, ref: 'Resource', required: true }, status: { type: String, enum: ['saved', 'in_progress', 'completed'], default: 'completed' } },
  { timestamps: true }
);
resourceProgressSchema.index({ studentId: 1, resourceId: 1 }, { unique: true });

// A study roadmap for one skill. Topics are goals only; links come from the approved resources of the same skill.
const roadmapSchema = new Schema({
  skillKey: { type: String, required: true, unique: true },
  summaryEn: String, summaryBn: String,
  stages: [{ level: { type: String, enum: ['beginner', 'intermediate', 'advanced'] }, titleEn: String, titleBn: String,
    topics: [{ key: String, titleEn: String, titleBn: String, hours: Number }] }],
});
// A student ticks a topic as studied. Private to the student. It never changes a skill level by itself (levels come from evidence).
const roadmapProgressSchema = new Schema({ studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, skillKey: { type: String, required: true }, topicKey: { type: String, required: true } }, { timestamps: true });
roadmapProgressSchema.index({ studentId: 1, skillKey: 1, topicKey: 1 }, { unique: true });

const quizSchema = new Schema({
  skillKey: { type: String, required: true, unique: true },
  questions: [{ q: String, options: [String], answer: Number }], // `answer` is NEVER sent to the client
});
module.exports = {
  Quiz: mongoose.model('Quiz', quizSchema),
  Roadmap: mongoose.model('Roadmap', roadmapSchema),
  RoadmapProgress: mongoose.model('RoadmapProgress', roadmapProgressSchema),
  Resource: mongoose.model('Resource', resourceSchema),
  ResourceProgress: mongoose.model('ResourceProgress', resourceProgressSchema),
  Skill: mongoose.model('Skill', skillSchema),
  RoleTemplate: mongoose.model('RoleTemplate', roleTemplateSchema),
  SkillEvidence: mongoose.model('SkillEvidence', skillEvidenceSchema),
};
