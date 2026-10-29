import { and, count, desc, eq, ilike, ne, or, type SQL } from 'drizzle-orm';
import type {
  AdminUserListQuery,
  AdminUserRow,
  AuditLogQuery,
  AuditLogRow,
  PaginationMeta,
  ParsedAdminCreateUserInput,
  ParsedAdminUpdateUserInput,
  UserRole,
} from '@cinemax/shared';
import { getDb } from '../db/index.js';
import { auditLogs, sessions, users } from '../db/schema.js';
import { AppError } from '../lib/http-error.js';
import { hashPassword } from '../lib/crypto.js';

export interface AdminUserStore {
  listUsers(query: AdminUserListQuery): Promise<{ rows: AdminUserRow[]; total: number }>;
  findUserById(id: number): Promise<AdminUserRow | null>;
  findUserByEmail(email: string): Promise<AdminUserRow | null>;
  insertUser(input: {
    name: string;
    email: string;
    phoneNumber: string | null;
    role: UserRole;
    points: number;
    isActive: boolean;
    passwordHash: string;
  }): Promise<AdminUserRow>;
  updateUser(
    id: number,
    patch: {
      name?: string;
      email?: string;
      phoneNumber?: string | null;
      role?: UserRole;
      points?: number;
      isActive?: boolean;
      passwordHash?: string;
    },
  ): Promise<AdminUserRow>;
  deleteUserSessions(userId: number): Promise<void>;
  deleteUser(id: number): Promise<void>;
  recordAudit(entry: {
    actorId: number | null;
    action: string;
    targetType: string;
    targetId: string | null;
    description: string;
  }): Promise<void>;
  listAuditLogs(query: AuditLogQuery): Promise<{ rows: AuditLogRow[]; total: number }>;
}

function mapUserRow(row: typeof users.$inferSelect): AdminUserRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phoneNumber: row.phoneNumber,
    role: row.role,
    points: row.points,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

function buildMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export function createDrizzleAdminUserStore(): AdminUserStore {
  return {
    async listUsers(query) {
      const db = getDb();
      const filters: SQL[] = [];

      if (query.role) {
        filters.push(eq(users.role, query.role));
      }
      if (query.staffOnly) {
        filters.push(ne(users.role, 'user'));
      }
      if (query.search) {
        const pattern = `%${query.search}%`;
        filters.push(or(ilike(users.name, pattern), ilike(users.email, pattern))!);
      }

      const whereClause = filters.length > 0 ? and(...filters) : undefined;
      const offset = (query.page - 1) * query.limit;

      const [rows, totalResult] = await Promise.all([
        db
          .select()
          .from(users)
          .where(whereClause)
          .orderBy(desc(users.createdAt), desc(users.id))
          .limit(query.limit)
          .offset(offset),
        db.select({ value: count() }).from(users).where(whereClause),
      ]);

      return {
        rows: rows.map(mapUserRow),
        total: Number(totalResult[0]?.value ?? 0),
      };
    },

    async findUserById(id) {
      const rows = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
      return rows[0] ? mapUserRow(rows[0]) : null;
    },

    async findUserByEmail(email) {
      const rows = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
      return rows[0] ? mapUserRow(rows[0]) : null;
    },

    async insertUser(input) {
      const rows = await getDb()
        .insert(users)
        .values({
          name: input.name,
          email: input.email,
          phoneNumber: input.phoneNumber,
          role: input.role,
          points: input.points,
          isActive: input.isActive,
          passwordHash: input.passwordHash,
        })
        .returning();
      return mapUserRow(rows[0]!);
    },

    async updateUser(id, patch) {
      const rows = await getDb()
        .update(users)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();
      return mapUserRow(rows[0]!);
    },

    async deleteUserSessions(userId) {
      await getDb().delete(sessions).where(eq(sessions.userId, userId));
    },

    async deleteUser(id) {
      await getDb().delete(users).where(eq(users.id, id));
    },

    async recordAudit(entry) {
      await getDb().insert(auditLogs).values(entry);
    },

    async listAuditLogs(query) {
      const db = getDb();
      const filters: SQL[] = [];

      if (query.action) {
        filters.push(eq(auditLogs.action, query.action));
      }
      if (query.search) {
        const pattern = `%${query.search}%`;
        filters.push(
          or(ilike(auditLogs.description, pattern), ilike(auditLogs.action, pattern))!,
        );
      }

      const whereClause = filters.length > 0 ? and(...filters) : undefined;
      const offset = (query.page - 1) * query.limit;

      const [rows, totalResult] = await Promise.all([
        db
          .select({
            id: auditLogs.id,
            action: auditLogs.action,
            targetType: auditLogs.targetType,
            targetId: auditLogs.targetId,
            description: auditLogs.description,
            createdAt: auditLogs.createdAt,
            actorId: users.id,
            actorName: users.name,
            actorEmail: users.email,
            actorRole: users.role,
          })
          .from(auditLogs)
          .leftJoin(users, eq(auditLogs.actorId, users.id))
          .where(whereClause)
          .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
          .limit(query.limit)
          .offset(offset),
        db.select({ value: count() }).from(auditLogs).where(whereClause),
      ]);

      return {
        rows: rows.map((r) => ({
          id: r.id,
          action: r.action,
          targetType: r.targetType,
          targetId: r.targetId,
          description: r.description,
          createdAt: r.createdAt.toISOString(),
          actor:
            r.actorId && r.actorName && r.actorEmail && r.actorRole
              ? {
                  id: r.actorId,
                  name: r.actorName,
                  email: r.actorEmail,
                  role: r.actorRole,
                }
              : null,
        })),
        total: Number(totalResult[0]?.value ?? 0),
      };
    },
  };
}

export function createAdminUserService(store: AdminUserStore = createDrizzleAdminUserStore()) {
  return {
    async listUsers(query: AdminUserListQuery) {
      const { rows, total } = await store.listUsers(query);
      return { data: rows, meta: buildMeta(query.page, query.limit, total) };
    },

    async createUser(actorId: number, input: ParsedAdminCreateUserInput) {
      const existing = await store.findUserByEmail(input.email);
      if (existing) {
        throw new AppError(409, 'EMAIL_TAKEN', 'Email sudah digunakan oleh akun lain');
      }

      const passwordHash = await hashPassword(input.password);
      const created = await store.insertUser({
        name: input.name,
        email: input.email,
        phoneNumber: input.phoneNumber,
        role: input.role,
        points: input.points,
        isActive: input.isActive,
        passwordHash,
      });

      await store.recordAudit({
        actorId,
        action: 'USER_CREATED',
        targetType: 'user',
        targetId: String(created.id),
        description: `Membuat akun ${created.role} (${created.name})`,
      });

      return created;
    },

    async updateUser(actorId: number, targetId: number, input: ParsedAdminUpdateUserInput) {
      const existing = await store.findUserById(targetId);
      if (!existing) {
        throw new AppError(404, 'USER_NOT_FOUND', 'Akun tidak ditemukan');
      }

      if (
        actorId === targetId &&
        (input.isActive === false || (input.role !== undefined && input.role !== 'admin'))
      ) {
        throw new AppError(
          400,
          'SELF_LOCKOUT_FORBIDDEN',
          'Admin tidak dapat menonaktifkan atau menurunkan role akun sendiri',
        );
      }

      if (input.email && input.email !== existing.email) {
        const duplicate = await store.findUserByEmail(input.email);
        if (duplicate) {
          throw new AppError(409, 'EMAIL_TAKEN', 'Email sudah digunakan oleh akun lain');
        }
      }

      const passwordHash = input.password ? await hashPassword(input.password) : undefined;
      const updated = await store.updateUser(targetId, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phoneNumber !== undefined ? { phoneNumber: input.phoneNumber } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.points !== undefined ? { points: input.points } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(passwordHash !== undefined ? { passwordHash } : {}),
      });

      if (input.isActive === false) {
        await store.deleteUserSessions(targetId);
      }

      const auditAction =
        existing.isActive && input.isActive === false
          ? 'USER_DEACTIVATED'
          : !existing.isActive && input.isActive === true
            ? 'USER_ACTIVATED'
            : 'USER_UPDATED';

      await store.recordAudit({
        actorId,
        action: auditAction,
        targetType: 'user',
        targetId: String(updated.id),
        description: `Memperbarui akun ${updated.name} (role=${updated.role}, active=${updated.isActive})`,
      });

      return updated;
    },

    async deleteUser(actorId: number, targetId: number) {
      if (actorId === targetId) {
        throw new AppError(
          400,
          'SELF_DELETE_FORBIDDEN',
          'Tidak dapat menghapus akun yang sedang digunakan',
        );
      }

      const existing = await store.findUserById(targetId);
      if (!existing) {
        throw new AppError(404, 'USER_NOT_FOUND', 'Akun tidak ditemukan');
      }

      await store.deleteUser(targetId);
      await store.recordAudit({
        actorId,
        action: 'USER_DELETED',
        targetType: 'user',
        targetId: String(targetId),
        description: `Menghapus permanen akun ${existing.role} (${existing.name})`,
      });

      return { deletedId: targetId };
    },

    async listAuditLogs(query: AuditLogQuery) {
      const { rows, total } = await store.listAuditLogs(query);
      return { data: rows, meta: buildMeta(query.page, query.limit, total) };
    },

    recordAudit: store.recordAudit,
  };
}

export type AdminUserService = ReturnType<typeof createAdminUserService>;
