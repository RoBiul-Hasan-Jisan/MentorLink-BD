const express = require('express');
const { z } = require('zod');
const { User, University, StudentProfile } = require('../models');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/guards');
const { bad, notFound, conflict, forbidden } = require('../utils/httpError');
const { toObjectId, firstNameInitial } = require('../utils/helpers');

module.exports = function coreRoutes(auth) {
  const r = express.Router();

  const registerSchema = z.object({
    displayName: z.string().trim().min(2).max(80),
    universityId: z.string().min(1),
    department: z.string().trim().max(80).optional(),
    batchYear: z.number().int().min(1990).max(2100).optional(),
    language: z.enum(['bn', 'en']).optional(),
  }).strict(); // a client can never send "role"

  // Public list so the sign-up form can offer universities.
  r.get('/universities', async (_req, res) => {
    const list = await University.find({ active: true }).sort({ name: 1 });
    res.json({ universities: list.map(publicUniversity) });
  });

  // Sign-up step 2: Firebase account exists, now create our profile. Role is ALWAYS student.
  r.post('/auth/register-profile', auth.firebaseOnly, validate(registerSchema), async (req, res) => {
    toObjectId(req.body.universityId, 'university id');
    const uni = await University.findOne({ _id: req.body.universityId, active: true });
    if (!uni) throw bad('UNIVERSITY_REQUIRED', 'Please choose a valid university.');
    if (await User.findOne({ firebaseUid: req.firebase.uid })) throw conflict('PROFILE_EXISTS', 'Profile already exists.');
    const user = await User.create({
      firebaseUid: req.firebase.uid,
      email: req.firebase.email || `${req.firebase.uid}@unknown.local`,
      displayName: req.body.displayName,
      role: 'student',
      universityId: uni._id,
      department: req.body.department,
      batchYear: req.body.batchYear,
      language: req.body.language || 'bn',
      // The email domain matching the university is a hint for the department, not proof that the person owns the address.
      emailDomainMatch: (uni.emailDomains || []).length > 0 && (uni.emailDomains || []).some((d) => String(req.firebase.email || '').toLowerCase().endsWith('@' + String(d).toLowerCase())),
    });
    user.affiliationStatus = user.emailDomainMatch ? 'approved' : 'pending';
    await user.save();
    await StudentProfile.create({ userId: user._id });
    res.status(201).json({ user: await me(user) });
  });

  r.get('/me', auth.authenticate, async (req, res) => res.json({ user: await me(req.user) }));

  const privacySchema = z.object({
    showInDirectory: z.boolean().optional(),
    lowDataMode: z.boolean().optional(),
    language: z.enum(['bn', 'en']).optional(),
    remindersOn: z.boolean().optional(),
    quietHours: z.object({ from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(23) }).strict().optional(),
    shareProgressWithDept: z.boolean().optional(),
    shareProgressWithMentors: z.boolean().optional(),
  }).strict();
  r.patch('/me/privacy', auth.authenticate, validate(privacySchema), async (req, res) => {
    Object.assign(req.user, req.body);
    await req.user.save();
    res.json({ user: await me(req.user) });
  });

  // Student asks to become a mentor; only an admin can approve.
  const mentorAppSchema = z.object({
    roleTitle: z.string().trim().min(2).max(80),
    industry: z.string().trim().min(2).max(80),
    yearsExperience: z.number().min(0).max(50),
    proof: z.string().trim().max(500).optional(),
  }).strict();
  r.post('/me/mentor-application', auth.authenticate, requireRole('student'), validate(mentorAppSchema), async (req, res) => {
    req.user.mentorApplication = { ...req.body, status: 'pending', submittedAt: new Date() };
    await req.user.save();
    res.status(201).json({ status: 'pending' });
  });

  // ---- University map / directory ----
  const canSee = requireRole('student', 'mentor', 'department', 'admin'); // employers: 403

  r.get('/directory/universities', auth.authenticate, canSee, async (_req, res) => {
    const unis = await University.find({ active: true }).sort({ name: 1 });
    const counts = await User.aggregate([
      { $match: { verificationStatus: 'verified', showInDirectory: true } },
      { $group: { _id: { u: '$universityId', role: '$role' }, n: { $sum: 1 } } },
    ]);
    const out = unis.map((u) => {
      const c = counts.filter((x) => String(x._id.u) === String(u._id));
      const get = (role) => (c.find((x) => x._id.role === role) || { n: 0 }).n;
      return { ...publicUniversity(u), students: get('student'), mentors: get('mentor') };
    });
    res.json({ universities: out });
  });

  r.get('/directory/universities/:id/members', auth.authenticate, canSee, async (req, res) => {
    toObjectId(req.params.id, 'university id');
    const uni = await University.findById(req.params.id);
    if (!uni) throw notFound('University not found.');
    const filter = { universityId: uni._id, verificationStatus: 'verified', showInDirectory: true };
    if (req.query.role) {
      if (!['student', 'mentor'].includes(req.query.role)) throw bad('INVALID_ROLE', 'role must be student or mentor.');
      filter.role = req.query.role;
    } else filter.role = { $in: ['student', 'mentor'] };
    const members = await User.find(filter).sort({ displayName: 1 }).limit(200);
    res.json({
      university: publicUniversity(uni), // members are shown at this campus pin, never a personal position
      members: members.map((m) => ({
        id: m._id, name: firstNameInitial(m.displayName), role: m.role,
        department: m.department, batchYear: m.batchYear,
      })),
    });
  });

  return r;
};

function publicUniversity(u) {
  return {
    id: u._id, name: u.name, shortName: u.shortName, city: u.city,
    campus: { lat: u.campus.coordinates[1], lng: u.campus.coordinates[0] },
    campusAddressText: u.campusAddressText,
  };
}
async function me(user) {
  const uni = user.universityId ? await University.findById(user.universityId) : null;
  return {
    id: user._id, email: user.email, displayName: user.displayName, role: user.role,
    department: user.department, batchYear: user.batchYear, language: user.language,
    verificationStatus: user.verificationStatus, showInDirectory: user.showInDirectory,
    lowDataMode: user.lowDataMode, mentorApplication: user.mentorApplication, departmentApplication: user.departmentApplication,
    remindersOn: user.remindersOn, quietHours: user.quietHours, shareProgressWithDept: user.shareProgressWithDept, shareProgressWithMentors: user.shareProgressWithMentors,
    emailDomainMatch: user.emailDomainMatch, affiliationStatus: user.affiliationStatus,
    university: uni ? publicUniversity(uni) : null,
  };
}
module.exports.publicUniversity = publicUniversity;
module.exports.me = me;
