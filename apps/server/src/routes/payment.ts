import { Router } from 'express';
import { paymentProcessSchema } from '@cinemax/shared';
import type { AuthService } from '../services/auth-service.js';
import type { PaymentService } from '../services/payment-service.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { sendSuccess } from '../lib/response.js';

export function createPaymentRouter(
  authService: AuthService,
  paymentService: PaymentService,
  secureCookie: boolean,
): Router {
  const router = Router();
  const { requireAuth } = createAuthMiddleware(authService, secureCookie);

  router.post('/payment/process', requireAuth, async (req, res) => {
    const input = paymentProcessSchema.parse(req.body);
    const result = await paymentService.processPayment(req.authUser!.id, input);
    sendSuccess(res, result, 200);
  });

  return router;
}
