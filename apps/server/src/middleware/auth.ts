import type { RequestHandler } from 'express';
import type { AuthUser, UserRole } from '@cinemax/shared';
import type { AuthService } from '../services/auth-service.js';
import {
  clearSessionCookie,
  parseCookies,
  SESSION_COOKIE_NAME,
} from '../lib/cookies.js';
import { AppError } from '../lib/http-error.js';

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export function createAuthMiddleware(authService: AuthService, secureCookie: boolean) {
  const requireAuth: RequestHandler = async (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    const rawToken = cookies[SESSION_COOKIE_NAME];
    const user = await authService.getUserFromRawToken(rawToken);

    if (!user) {
      if (rawToken) {
        clearSessionCookie(res, secureCookie);
      }
      throw new AppError(401, 'UNAUTHORIZED', 'Sesi login diperlukan');
    }

    req.authUser = user;
    next();
  };

  function requireRole(...allowedRoles: UserRole[]): RequestHandler {
    return async (req, res, next) => {
      const cookies = parseCookies(req.headers.cookie);
      const rawToken = cookies[SESSION_COOKIE_NAME];
      const user = await authService.getUserFromRawToken(rawToken);

      if (!user) {
        if (rawToken) {
          clearSessionCookie(res, secureCookie);
        }
        throw new AppError(401, 'UNAUTHORIZED', 'Sesi login diperlukan');
      }

      if (!allowedRoles.includes(user.role)) {
        throw new AppError(403, 'FORBIDDEN', 'Role tidak memiliki izin akses');
      }

      req.authUser = user;
      next();
    };
  }

  return { requireAuth, requireRole };
}
