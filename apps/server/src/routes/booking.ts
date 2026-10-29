import { Router } from 'express';
import { z } from 'zod';
import { holdSeatsInputSchema } from '@cinemax/shared';
import type { AuthService } from '../services/auth-service.js';
import type { BookingService } from '../services/booking-service.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { parseCookies, SESSION_COOKIE_NAME } from '../lib/cookies.js';
import { sendSuccess } from '../lib/response.js';

const showtimeIdParamSchema = z.object({
  showtimeId: z.coerce.number().int().positive(),
});

const bookingCodeParamSchema = z.object({
  bookingCode: z.string().trim().min(3),
});

export function createBookingRouter(
  authService: AuthService,
  bookingService: BookingService,
  secureCookie: boolean,
): Router {
  const router = Router();
  const { requireAuth } = createAuthMiddleware(authService, secureCookie);

  router.get('/booking/showtimes/:showtimeId/seats', async (req, res) => {
    const { showtimeId } = showtimeIdParamSchema.parse(req.params);

    // Optional user session from cookie
    const cookies = parseCookies(req.headers.cookie);
    const rawToken = cookies[SESSION_COOKIE_NAME];
    const user = await authService.getUserFromRawToken(rawToken);

    const data = await bookingService.getSeatMap(showtimeId, user?.id);
    sendSuccess(res, data, 200);
  });

  router.post('/booking/hold', requireAuth, async (req, res) => {
    const input = holdSeatsInputSchema.parse(req.body);
    const data = await bookingService.holdSeats(req.authUser!.id, input);
    sendSuccess(res, data, 201);
  });

  router.post('/booking/:bookingCode/cancel', requireAuth, async (req, res) => {
    const { bookingCode } = bookingCodeParamSchema.parse(req.params);
    const result = await bookingService.cancelBooking(bookingCode, req.authUser!.id);
    sendSuccess(res, result, 200);
  });

  router.get('/booking/:bookingCode', requireAuth, async (req, res) => {
    const { bookingCode } = bookingCodeParamSchema.parse(req.params);
    const data = await bookingService.getBookingDetail(bookingCode, req.authUser!.id);
    sendSuccess(res, data, 200);
  });

  return router;
}
