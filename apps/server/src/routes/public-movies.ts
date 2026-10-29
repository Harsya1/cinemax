import { Router } from 'express';
import { z } from 'zod';
import { watchlistToggleSchema } from '@cinemax/shared';
import type { AuthService } from '../services/auth-service.js';
import type { PublicMovieService } from '../services/public-movie-service.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { parseCookies, SESSION_COOKIE_NAME } from '../lib/cookies.js';
import { sendSuccess } from '../lib/response.js';

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export function createPublicMoviesRouter(
  authService: AuthService,
  publicMovieService: PublicMovieService,
  secureCookie: boolean,
): Router {
  const router = Router();
  const { requireAuth } = createAuthMiddleware(authService, secureCookie);

  router.get('/public/movies/now-playing', async (_req, res) => {
    const data = await publicMovieService.getNowPlaying();
    sendSuccess(res, data, 200);
  });

  router.get('/public/movies/coming-soon', async (_req, res) => {
    const data = await publicMovieService.getComingSoon();
    sendSuccess(res, data, 200);
  });

  router.get('/public/movies/:id', async (req, res) => {
    const { id } = idParamSchema.parse(req.params);

    // Optional user session from cookie
    const cookies = parseCookies(req.headers.cookie);
    const rawToken = cookies[SESSION_COOKIE_NAME];
    const user = await authService.getUserFromRawToken(rawToken);

    const data = await publicMovieService.getMovieDetail(id, user?.id);
    sendSuccess(res, data, 200);
  });

  router.post('/public/watchlist/toggle', requireAuth, async (req, res) => {
    const { tmdbId } = watchlistToggleSchema.parse(req.body);
    const result = await publicMovieService.toggleWatchlist(req.authUser!.id, tmdbId);
    sendSuccess(res, result, 200);
  });

  router.get('/public/watchlist', requireAuth, async (req, res) => {
    const data = await publicMovieService.listUserWatchlist(req.authUser!.id);
    sendSuccess(res, data, 200);
  });

  return router;
}
