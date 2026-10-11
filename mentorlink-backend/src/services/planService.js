const Plan = require('../models/Plan');
const StudentProfile = require('../models/StudentProfile');

// One active four-week plan per student. Created on first use.
async function ensurePlan(studentId) {
  const existing = await Plan.findOne({ studentId, status: 'active' });
  if (existing) return existing;
  const profile = await StudentProfile.findOne({ userId: studentId });
  try {
    return await Plan.create({ studentId, roleKey: profile?.careerGoalRoleKey });
  } catch (e) {
    if (e.code === 11000) return Plan.findOne({ studentId, status: 'active' }); // created by a parallel request
    throw e;
  }
}
module.exports = { ensurePlan };
