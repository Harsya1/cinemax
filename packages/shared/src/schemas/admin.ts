import { z } from 'zod';
import { USER_ROLES } from '../enums.js';

export const paginationMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().positive(),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export const adminUserListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  role: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .pipe(z.enum(USER_ROLES).optional()),
  staffOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type AdminUserListQuery = z.output<typeof adminUserListQuerySchema>;

export const adminUserRowSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  email: z.string().email(),
  phoneNumber: z.string().nullable(),
  role: z.enum(USER_ROLES),
  points: z.number().int().nonnegative(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export type AdminUserRow = z.infer<typeof adminUserRowSchema>;

export const adminCreateUserSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(120),
  email: z.string().trim().toLowerCase().email('Format email tidak valid').max(255),
  phoneNumber: z
    .string()
    .trim()
    .max(25)
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  role: z.enum(USER_ROLES),
  points: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  password: z.string().min(8, 'Password minimal 8 karakter').max(128),
});

export type AdminCreateUserInput = z.input<typeof adminCreateUserSchema>;
export type ParsedAdminCreateUserInput = z.output<typeof adminCreateUserSchema>;

export const adminUpdateUserSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(120).optional(),
  email: z.string().trim().toLowerCase().email('Format email tidak valid').max(255).optional(),
  phoneNumber: z
    .string()
    .trim()
    .max(25)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v && v.length > 0 ? v : null)),
  role: z.enum(USER_ROLES).optional(),
  points: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  password: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v : undefined))
    .refine((v) => v === undefined || (v.length >= 8 && v.length <= 128), {
      message: 'Password baru minimal 8 karakter',
    }),
});

export type AdminUpdateUserInput = z.input<typeof adminUpdateUserSchema>;
export type ParsedAdminUpdateUserInput = z.output<typeof adminUpdateUserSchema>;

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(15),
  search: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  action: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export type AuditLogQuery = z.output<typeof auditLogQuerySchema>;

export const auditLogRowSchema = z.object({
  id: z.number().int().positive(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  description: z.string(),
  createdAt: z.string(),
  actor: z
    .object({
      id: z.number().int().positive(),
      name: z.string(),
      email: z.string().email(),
      role: z.enum(USER_ROLES),
    })
    .nullable(),
});

export type AuditLogRow = z.infer<typeof auditLogRowSchema>;
