const router = require('express').Router();
const { listWithCounts } = require('../services/universityService');
const asyncHandler = require('../utils/asyncHandler');

// Public on purpose: the sign-up screen needs the list. It contains campus points and counts only.
router.get('/', asyncHandler(async (req, res) => {
  res.json({ universities: await listWithCounts() });
}));

module.exports = router;
