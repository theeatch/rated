import { Router } from 'express';

import { live, ready, redisState } from '../controllers/health.controller.js';

const router = Router();

router.get('/live', live);
router.get('/ready', ready);
router.get('/redis', redisState);

export default router;
