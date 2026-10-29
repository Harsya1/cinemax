import { Router } from 'express';
import { customerProfileUpdateSchema } from '@cinemax/shared';
import type { AuthService } from '../services/auth-service.js';
import type { PaymentService } from '../services/payment-service.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { sendSuccess } from '../lib/response.js';

export function createProfileRouter(
  authService: AuthService,
  paymentService: PaymentService,
  secureCookie: boolean,
): Router {
  const router = Router();
  const { requireAuth } = createAuthMiddleware(authService, secureCookie);

  router.get('/profile/tickets', requireAuth, async (req, res) => {
    const data = await paymentService.getCustomerTickets(req.authUser!.id);
    sendSuccess(res, data, 200);
  });

  router.patch('/profile', requireAuth, async (req, res) => {
    const input = customerProfileUpdateSchema.parse(req.body);
    const updated = await paymentService.updateProfile(req.authUser!.id, input);
    sendSuccess(res, updated, 200);
  });

  return router;
}
