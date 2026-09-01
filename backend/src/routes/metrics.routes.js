import { Router } from 'express';

import {
  events,
  reset,
  summary,
  timeseries,
  totals,
  utilization,
} from '../controllers/metrics.controller.js';
import { requireAdmin, requireApiKey } from '../middleware/auth.middleware.js';

const router = Router();

// Read-only dashboard API. Guarded by the dashboard key when REQUIRE_API_KEY=true.
router.use(requireApiKey);

router.get('/', summary);
router.get('/timeseries', timeseries);
router.get('/totals', totals);
router.get('/utilization', utilization);
router.get('/events', events);

// Destructive — admin token required regardless of REQUIRE_API_KEY.
router.post('/reset', requireAdmin, reset);

export default router;
