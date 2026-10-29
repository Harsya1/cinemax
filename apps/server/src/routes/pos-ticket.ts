import { Router } from 'express';
import { z } from 'zod';
import { posCheckoutInputSchema } from '@cinemax/shared';
import type { AuthService } from '../services/auth-service.js';
import type { TicketPosService } from '../services/ticket-pos-service.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { sendSuccess } from '../lib/response.js';

const bookingCodeParamSchema = z.object({
  bookingCode: z.string().trim().min(3),
});

export function createPosTicketRouter(
  authService: AuthService,
  ticketPosService: TicketPosService,
  secureCookie: boolean,
): Router {
  const router = Router();
  const { requireRole } = createAuthMiddleware(authService, secureCookie);

  // Ticket POS policy: admin, manager, cashier
  router.get(
    '/pos/ticket/today-showtimes',
    requireRole('admin', 'manager', 'cashier'),
    async (_req, res) => {
      const data = await ticketPosService.getTodayShowtimes();
      sendSuccess(res, data, 200);
    },
  );

  router.post(
    '/pos/ticket/checkout',
    requireRole('admin', 'manager', 'cashier'),
    async (req, res) => {
      const input = posCheckoutInputSchema.parse(req.body);
      const result = await ticketPosService.checkout(req.authUser!.id, input);
      sendSuccess(res, result, 201);
    },
  );

  router.get(
    '/pos/ticket/:bookingCode/stub',
    requireRole('admin', 'manager', 'cashier'),
    async (req, res) => {
      const { bookingCode } = bookingCodeParamSchema.parse(req.params);
      const stub = await ticketPosService.getTicketStub(bookingCode);
      sendSuccess(res, stub, 200);
    },
  );

  return router;
}
