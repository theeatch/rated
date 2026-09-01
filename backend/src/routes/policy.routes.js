import { Router } from 'express';

import { clearBucket, detail, list, reset, update } from '../controllers/policy.controller.js';
import { requireAdmin, requireApiKey } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', requireApiKey, list);
router.get('/:name', requireApiKey, detail);

// Mutating policy state is an admin action.
router.patch('/:name', requireAdmin, update);
router.post('/:name/reset', requireAdmin, reset);
router.post('/:name/buckets/clear', requireAdmin, clearBucket);

export default router;
