import { Router } from 'express';
import { ticketScanInputSchema } from '@cinemax/shared';
import type { AuthService } from '../services/auth-service.js';
import type { ValidatorService } from '../services/validator-service.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { sendSuccess } from '../lib/response.js';

export function createValidatorRouter(
  authService: AuthService,
  validatorService: ValidatorService,
  secureCookie: boolean,
): Router {
  const router = Router();
  const { requireRole } = createAuthMiddleware(authService, secureCookie);

  // Ushes/Staff allowed to scan: admin, manager, cashier, staff
  router.post(
    '/validator/scan',
    requireRole('admin', 'manager', 'cashier', 'staff'),
    async (req, res) => {
      const input = ticketScanInputSchema.parse(req.body);
      const result = await validatorService.scanTicket(req.authUser!.id, input.bookingCode);
      sendSuccess(res, result, 200);
    },
  );

  return router;
}
