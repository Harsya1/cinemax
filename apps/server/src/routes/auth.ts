import { Router } from 'express';
import { loginInputSchema, registerInputSchema } from '@cinemax/shared';
import type { AuthService } from '../services/auth-service.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import {
  clearSessionCookie,
  parseCookies,
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from '../lib/cookies.js';
import { sendSuccess } from '../lib/response.js';

export function createAuthRouter(authService: AuthService, secureCookie: boolean): Router {
  const router = Router();
  const { requireAuth, requireRole } = createAuthMiddleware(authService, secureCookie);

  router.post('/auth/register', async (req, res) => {
    const input = registerInputSchema.parse(req.body);
    const { user, rawToken } = await authService.registerCustomer(input);
    setSessionCookie(res, rawToken, secureCookie);
    sendSuccess(res, user, 201);
  });

  router.post('/auth/login', async (req, res) => {
    const input = loginInputSchema.parse(req.body);
    const { user, rawToken } = await authService.loginCustomer(input);
    setSessionCookie(res, rawToken, secureCookie);
    sendSuccess(res, user, 200);
  });

  router.post('/auth/staff/login', async (req, res) => {
    const input = loginInputSchema.parse(req.body);
    const { user, rawToken } = await authService.loginStaff(input);
    setSessionCookie(res, rawToken, secureCookie);
    sendSuccess(res, user, 200);
  });

  router.get('/auth/me', requireAuth, (req, res) => {
    sendSuccess(res, req.authUser!, 200);
  });

  router.post('/auth/logout', async (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    await authService.logoutByRawToken(cookies[SESSION_COOKIE_NAME]);
    clearSessionCookie(res, secureCookie);
    sendSuccess(res, { loggedOut: true }, 200);
  });

  router.get('/staff/ping', requireRole('admin', 'manager'), (req, res) => {
    sendSuccess(res, { ok: true, role: req.authUser!.role }, 200);
  });

  return router;
}
