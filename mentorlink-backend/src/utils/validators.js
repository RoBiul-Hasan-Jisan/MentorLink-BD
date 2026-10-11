const { z } = require('zod');
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'invalid id');
const pageQuery = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) });
module.exports = { objectId, pageQuery };
