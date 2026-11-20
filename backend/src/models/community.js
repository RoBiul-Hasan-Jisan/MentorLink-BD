// Community feed: posts with reactions, comments with replies (one level), follows (people and skill groups).
const { mongoose } = require('../config/db');
const { Schema } = mongoose;
const ref = (name, extra = {}) => ({ type: Schema.Types.ObjectId, ref: name, ...extra });

const REACTIONS = ['like', 'helpful', 'idea'];

const postSchema = new Schema({
  authorId: ref('User', { required: true, index: true }),
  authorRole: { type: String, required: true },
  topic: { type: String, default: 'general', index: true }, // a target key such as "ml", or "general"
  text: { type: String, required: true, maxlength: 1000 },
  link: { type: String, maxlength: 300 }, // an https link to a resource or project
  reactions: [{ _id: false, userId: ref('User'), type: { type: String, enum: REACTIONS } }], // one reaction per person
  commentCount: { type: Number, default: 0 },
  status: { type: String, enum: ['visible', 'hidden', 'removed'], default: 'visible', index: true },
  reporters: [ref('User')], // unique reporters; hidden automatically at the threshold
}, { timestamps: true });

const commentSchema = new Schema({
  postId: ref('Post', { required: true, index: true }),
  parentId: ref('Comment', { default: null }), // replies attach to a top-level comment only
  authorId: ref('User', { required: true }),
  authorRole: { type: String, required: true },
  text: { type: String, required: true, maxlength: 600 },
  status: { type: String, enum: ['visible', 'removed'], default: 'visible' },
}, { timestamps: true });

// kind "user": follow a person. kind "group": join a topic group (target key).
const followSchema = new Schema({
  followerId: ref('User', { required: true, index: true }),
  kind: { type: String, enum: ['user', 'group'], required: true },
  target: { type: String, required: true }, // user id or group key
}, { timestamps: true });
followSchema.index({ followerId: 1, kind: 1, target: 1 }, { unique: true });

module.exports = {
  REACTIONS,
  Post: mongoose.model('Post', postSchema),
  Comment: mongoose.model('Comment', commentSchema),
  Follow: mongoose.model('Follow', followSchema),
};
