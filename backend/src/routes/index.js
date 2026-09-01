import { Router } from 'express';

import demoRoutes from './demo.routes.js';
import healthRoutes from './health.routes.js';
import metricsRoutes from './metrics.routes.js';
import policyRoutes from './policy.routes.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    name: 'RateFlow API',
    version: '0.1.0',
    endpoints: {
      health: '/api/health/{live,ready,redis}',
      metrics: '/api/metrics',
      policies: '/api/policies',
      demo: '/api/demo/{ping,search,report,login,partner/feed}',
    },
  });
});

router.use('/health', healthRoutes);
router.use('/metrics', metricsRoutes);
router.use('/policies', policyRoutes);
router.use('/demo', demoRoutes);

export default router;
