import { Router } from 'express';

import { login, ping, report, search } from '../controllers/demo.controller.js';
import { rateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

/**
 * Each demo route is protected by a different policy so the dashboard can show
 * several buckets draining and refilling side by side.
 */
router.get('/ping', rateLimiter({ policy: 'default' }), ping);

router.get('/search', rateLimiter({ policy: 'burst' }), search);

// An expensive endpoint spends more than one token per call.
router.get('/report', rateLimiter({ policy: 'strict', cost: 5 }), report);

router.post('/login', rateLimiter({ policy: 'auth' }), login);

// Partner traffic is bucketed per API key rather than per IP.
router.get(
  '/partner/feed',
  rateLimiter({
    policy: 'partner',
    keyGenerator: (req) => `key:${req.get('x-api-key') || 'anonymous'}`,
  }),
  ping,
);

export default router;
