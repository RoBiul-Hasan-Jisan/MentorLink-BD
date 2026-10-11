const router = require('express').Router();
const { z } = require('zod');
const { authenticateFirebase, requireRole } = require('../middleware/auth');
const privacyGuard = require('../middleware/privacyGuard');
const Plan = require('../models/Plan');
const Task = require('../models/Task');
const MentorRequest = require('../models/MentorRequest');
const { ensurePlan } = require('../services/planService');
const { summarize } = require('../services/planStats');
const { notify } = require('../services/notify');
const { objectId } = require('../utils/validators');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

router.use(authenticateFirebase, privacyGuard);

const serTask = (t) => ({ id: String(t._id), title: t.title, weekNumber: t.weekNumber, dueDate: t.dueDate || null, status: t.status, doneAt: t.doneAt || null,
  source: t.source, reminderAt: t.reminderAt || null, resourceIds: t.resourceIds.map(String),
  mentorComments: t.mentorComments.map((c) => ({ text: c.text, authorId: String(c.authorId), createdAt: c.createdAt })) });

async function planView(studentId) {
  const plan = await Plan.findOne({ studentId, status: 'active' });
  if (!plan) return { plan: null };
  const tasks = await Task.find({ planId: plan._id }).sort({ weekNumber: 1, dueDate: 1, createdAt: 1 });
  return { plan: { id: String(plan._id), roleKey: plan.roleKey, startDate: plan.startDate }, ...summarize(tasks, plan.startDate), tasks: tasks.map(serTask) };
}

// ---------- student: own plan ----------
router.get('/', requireRole('student'), asyncHandler(async (req, res) => res.json(await planView(req.user._id))));
router.post('/start', requireRole('student'), asyncHandler(async (req, res) => { await ensurePlan(req.user._id); res.status(201).json(await planView(req.user._id)); }));

const taskBody = z.object({
  title: z.string().trim().min(3).max(160), weekNumber: z.number().int().min(1).max(4),
  dueDate: z.coerce.date().optional(), reminderAt: z.coerce.date().optional(),
  resourceIds: z.array(objectId).max(5).optional(),
}).strict();

router.post('/tasks', requireRole('student'), asyncHandler(async (req, res) => {
  const b = taskBody.parse(req.body);
  const plan = await ensurePlan(req.user._id);
  res.status(201).json({ task: serTask(await Task.create({ ...b, planId: plan._id, studentId: req.user._id })) });
}));

// A student can only touch their OWN tasks: the studentId is part of every query.
router.patch('/tasks/:id', requireRole('student'), asyncHandler(async (req, res) => {
  const patch = taskBody.partial().extend({ status: z.enum(['todo', 'done']).optional() }).strict().parse(req.body);
  const t = await Task.findOne({ _id: objectId.parse(req.params.id), studentId: req.user._id });
  if (!t) throw new AppError(404, 'NOT_FOUND', 'Task not found');
  Object.assign(t, patch);
  if (patch.status) t.doneAt = patch.status === 'done' ? new Date() : undefined;
  if (patch.reminderAt) t.reminderSent = false;
  await t.save(); // NOTE: completing a task never changes a skill level; only reviewed evidence does.
  res.json({ task: serTask(t) });
}));

router.delete('/tasks/:id', requireRole('student'), asyncHandler(async (req, res) => {
  const r = await Task.deleteOne({ _id: objectId.parse(req.params.id), studentId: req.user._id });
  if (!r.deletedCount) throw new AppError(404, 'NOT_FOUND', 'Task not found');
  res.status(204).end();
}));

// ---------- mentor: only for students who have an ACCEPTED request with this mentor ----------
async function assertMentee(mentorId, studentId) {
  if (!(await MentorRequest.exists({ mentorId, studentId, status: 'accepted' }))) throw new AppError(404, 'NOT_FOUND', 'Not found');
}
router.get('/mentees/:studentId', requireRole('mentor'), asyncHandler(async (req, res) => {
  const studentId = objectId.parse(req.params.studentId);
  await assertMentee(req.user._id, studentId);
  res.json(await planView(studentId));
}));

router.post('/tasks/:id/comments', requireRole('mentor'), asyncHandler(async (req, res) => {
  const { text } = z.object({ text: z.string().trim().min(2).max(500) }).strict().parse(req.body);
  const t = await Task.findById(objectId.parse(req.params.id));
  if (!t) throw new AppError(404, 'NOT_FOUND', 'Task not found');
  await assertMentee(req.user._id, t.studentId);
  t.mentorComments.push({ authorId: req.user._id, text });
  await t.save();
  await notify(t.studentId, { type: 'task_comment', title: { en: `${req.user.displayName} commented on your task`, bn: `${req.user.displayName} আপনার কাজে মন্তব্য করেছেন` },
    body: { en: text.slice(0, 80), bn: text.slice(0, 80) }, data: { taskId: String(t._id) } });
  res.status(201).json({ task: serTask(t) });
}));

module.exports = router;
