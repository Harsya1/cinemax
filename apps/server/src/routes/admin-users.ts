import { Router } from 'express';
import { z } from 'zod';
import {
  adminCreateUserSchema,
  adminUpdateUserSchema,
  adminUserListQuerySchema,
  auditLogQuerySchema,
} from '@cinemax/shared';
import type { AuthService } from '../services/auth-service.js';
import type { AdminUserService } from '../services/admin-user-service.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { sendSuccess } from '../lib/response.js';

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export function createAdminUsersRouter(
  authService: AuthService,
  adminUserService: AdminUserService,
  secureCookie: boolean,
): Router {
  const router = Router();
  const { requireRole } = createAuthMiddleware(authService, secureCookie);

  router.get('/admin/users', requireRole('admin', 'manager'), async (req, res) => {
    const query = adminUserListQuerySchema.parse(req.query);
    const { data, meta } = await adminUserService.listUsers(query);
    sendSuccess(res, data, 200, meta);
  });

  router.post('/admin/users', requireRole('admin'), async (req, res) => {
    const input = adminCreateUserSchema.parse(req.body);
    const created = await adminUserService.createUser(req.authUser!.id, input);
    sendSuccess(res, created, 201);
  });

  router.patch('/admin/users/:id', requireRole('admin'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const input = adminUpdateUserSchema.parse(req.body);
    const updated = await adminUserService.updateUser(req.authUser!.id, id, input);
    sendSuccess(res, updated, 200);
  });

  router.delete('/admin/users/:id', requireRole('admin'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const result = await adminUserService.deleteUser(req.authUser!.id, id);
    sendSuccess(res, result, 200);
  });

  router.get('/admin/audit-logs', requireRole('admin', 'manager'), async (req, res) => {
    const query = auditLogQuerySchema.parse(req.query);
    const { data, meta } = await adminUserService.listAuditLogs(query);
    sendSuccess(res, data, 200, meta);
  });

  return router;
}
