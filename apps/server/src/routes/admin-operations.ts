import { Router } from 'express';
import { z } from 'zod';
import {
  batchCreateShowtimeSchema,
  createShowtimeSchema,
  createStudioSchema,
  showtimeListQuerySchema,
  syncMovieInputSchema,
  tmdbBrowseQuerySchema,
  updateShowtimeSchema,
  updateStudioSchema,
} from '@cinemax/shared';
import type { AuthService } from '../services/auth-service.js';
import type { OperationsService } from '../services/operations-service.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { sendSuccess } from '../lib/response.js';

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export function createAdminOperationsRouter(
  authService: AuthService,
  operationsService: OperationsService,
  secureCookie: boolean,
): Router {
  const router = Router();
  const { requireRole } = createAuthMiddleware(authService, secureCookie);

  // ==================== STUDIOS ====================
  // Studio Policy: Admin full, Manager/Cashier/Cleaner read-only
  router.get(
    '/admin/studios',
    requireRole('admin', 'manager', 'cashier', 'cleaner'),
    async (_req, res) => {
      const data = await operationsService.listStudios();
      sendSuccess(res, data, 200);
    },
  );

  router.post('/admin/studios', requireRole('admin'), async (req, res) => {
    const input = createStudioSchema.parse(req.body);
    const created = await operationsService.createStudio(req.authUser!.id, input);
    sendSuccess(res, created, 201);
  });

  router.patch('/admin/studios/:id', requireRole('admin'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const input = updateStudioSchema.parse(req.body);
    const updated = await operationsService.updateStudio(req.authUser!.id, id, input);
    sendSuccess(res, updated, 200);
  });

  router.delete('/admin/studios/:id', requireRole('admin'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const result = await operationsService.deleteStudio(req.authUser!.id, id);
    sendSuccess(res, result, 200);
  });

  // ==================== TMDB & MOVIES ====================
  // Showtime Policy: Admin full, Manager/Cashier read-only
  router.get(
    '/admin/tmdb/movies',
    requireRole('admin', 'manager', 'cashier'),
    async (req, res) => {
      const query = tmdbBrowseQuerySchema.parse(req.query);
      const data = await operationsService.browseTmdb(query);
      sendSuccess(res, data.results, 200, {
        page: query.page,
        totalPages: data.totalPages,
        total: data.totalResults,
      });
    },
  );

  router.get(
    '/admin/movies',
    requireRole('admin', 'manager', 'cashier'),
    async (_req, res) => {
      const data = await operationsService.listLocalMovies();
      sendSuccess(res, data, 200);
    },
  );

  router.post('/admin/movies/sync', requireRole('admin'), async (req, res) => {
    const { tmdbId } = syncMovieInputSchema.parse(req.body);
    const synced = await operationsService.syncMovieByTmdbId(req.authUser!.id, tmdbId);
    sendSuccess(res, synced, 200);
  });

  // ==================== SHOWTIMES ====================
  router.get(
    '/admin/showtimes',
    requireRole('admin', 'manager', 'cashier'),
    async (req, res) => {
      const query = showtimeListQuerySchema.parse(req.query);
      const { rows, total } = await operationsService.listShowtimes(query);
      sendSuccess(res, rows, 200, {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      });
    },
  );

  router.post('/admin/showtimes', requireRole('admin'), async (req, res) => {
    const input = createShowtimeSchema.parse(req.body);
    const created = await operationsService.createShowtime(req.authUser!.id, input);
    sendSuccess(res, created, 201);
  });

  router.post('/admin/showtimes/batch', requireRole('admin'), async (req, res) => {
    const input = batchCreateShowtimeSchema.parse(req.body);
    const result = await operationsService.createShowtimesBatch(req.authUser!.id, input);
    sendSuccess(res, result, 201);
  });

  router.patch('/admin/showtimes/:id', requireRole('admin'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const input = updateShowtimeSchema.parse(req.body);
    const updated = await operationsService.updateShowtime(req.authUser!.id, id, input);
    sendSuccess(res, updated, 200);
  });

  router.delete('/admin/showtimes/:id', requireRole('admin'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const result = await operationsService.deleteShowtime(req.authUser!.id, id);
    sendSuccess(res, result, 200);
  });

  return router;
}
