import { Router } from 'express';
import { STAFF_ROLES } from '@cinemax/shared';
import type { AuthService } from '../services/auth-service.js';
import type { DashboardService } from '../services/dashboard-service.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { sendSuccess } from '../lib/response.js';

export function createDashboardRouter(
  authService: AuthService,
  dashboardService: DashboardService,
  secureCookie: boolean,
): Router {
  const router = Router();
  const { requireRole } = createAuthMiddleware(authService, secureCookie);

  // Accessible by all staff
  router.get(
    '/dashboard/summary',
    requireRole(...STAFF_ROLES),
    async (_req, res) => {
      const summary = await dashboardService.getSummary();
      sendSuccess(res, summary, 200);
    },
  );

  return router;
}
