const { mongoose } = require('../config/db');
const env = require('../config/env');
const { Schema } = mongoose;

const ROLES = ['student', 'mentor', 'employer', 'department', 'admin'];

// PRIVACY: users have NO latitude, longitude, address or GPS fields. Ever.
// A person is shown under their university's campus pin, never at a personal position.
const userSchema = new Schema(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true },
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    role: { type: String, enum: ROLES, default: 'student', required: true },
    universityId: { type: Schema.Types.ObjectId, ref: 'University' },
    department: { type: String, trim: true, maxlength: 80 },
    batchYear: { type: Number, min: 1990, max: 2100 },
    language: { type: String, enum: ['bn', 'en'], default: 'bn' },
    verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    verificationProof: { type: String, maxlength: 500 }, // private note/link, never in public cards
    showInDirectory: { type: Boolean, default: true },
    lowDataMode: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false },
    // A student asks to become a mentor. Only an admin can approve (the server then sets the role).
    mentorApplication: {
      status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
      roleTitle: String,
      industry: String,
      yearsExperience: Number,
      proof: { type: String, maxlength: 500 },
      submittedAt: Date,
    },
    // Settings and consent (design: Profile screen)
    remindersOn: { type: Boolean, default: true },
    quietHours: { from: { type: Number, min: 0, max: 23, default: 22 }, to: { type: Number, min: 0, max: 23, default: 7 } },
    shareProgressWithDept: { type: Boolean, default: false }, // counts only, never identity
    shareProgressWithMentors: { type: Boolean, default: false },
    shareOutcomesForResearch: { type: Boolean, default: false }, // anonymous, grouped results only (never individual rows)
    emailDomainMatch: { type: Boolean, default: false }, // the sign-up email domain matches the chosen university (not proof of ownership)
    affiliationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
    // A student asks to become department staff. Only an admin can approve (the server then sets the role).
    departmentApplication: { status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' }, note: { type: String, maxlength: 300 }, submittedAt: Date },
    deletedAt: Date,
    blockedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    deviceTokens: { type: [String], default: [] }, // FCM tokens. Never returned: every route maps explicit fields.
  },
  { timestamps: true }
);

const universitySchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    shortName: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, default: 'Bangladesh' },
    // Exact CAMPUS coordinates (not just the city). GeoJSON order is [lng, lat].
    campus: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    campusAddressText: { type: String, default: '' },
    emailDomains: [String],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
if (env.geoIndex) universitySchema.index({ campus: '2dsphere' });

const studentProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
    careerGoalRoleKey: String,
    goalText: { type: String, default: '' },
    weeklyHours: { type: Number, default: 6, min: 0, max: 80 },
    languages: { type: [String], default: ['bn'] },
    requestedSlots: { type: [String], default: [] }, // e.g. "sun-20", "tue-21"
    selectedTargets: { type: [String], default: [] }, // up to 5 chosen targets (several roadmaps at once)
    dismissedMentors: [{ type: Schema.Types.ObjectId, ref: 'User' }], // "Not interested"
  },
  { timestamps: true }
);

const mentorProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
    industry: { type: String, default: '' },
    roleTitle: { type: String, default: '' },
    roleKey: String, // taxonomy tag matching roleTemplates.key
    relatedRoleKeys: [String],
    yearsExperience: { type: Number, default: 0, min: 0 },
    expertiseSkills: [{ skillKey: String, level: { type: Number, min: 1, max: 3 } }],
    languages: { type: [String], default: ['bn', 'en'] },
    helpsWith: { type: [String], default: [] }, // kinds of help the mentor offers: technical_interview, portfolio_review, cv_review, roadmap_review, career_switch
    weeklyCapacity: { type: Number, default: 3, min: 0, max: 20 },
    availableSlots: { type: [String], default: [] },
    paused: { type: Boolean, default: false },
    acceptedRequests: { type: Number, default: 0 },
    sessionsCompleted: { type: Number, default: 0 },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    noShows: { type: Number, default: 0 }, // reported by students
    isRising: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = {
  ROLES,
  User: mongoose.model('User', userSchema),
  University: mongoose.model('University', universitySchema),
  StudentProfile: mongoose.model('StudentProfile', studentProfileSchema),
  MentorProfile: mongoose.model('MentorProfile', mentorProfileSchema),
};
