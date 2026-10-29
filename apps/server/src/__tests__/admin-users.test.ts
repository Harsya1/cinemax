import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import {
  adminUserRowSchema,
  auditLogRowSchema,
  isStaffRole,
  paginationMetaSchema,
  type AdminUserRow,
  type AuditLogRow,
  type UserRole,
} from '@cinemax/shared';
import { createApp } from '../app.js';
import { createAuthService, type AuthStore, type StoredUser } from '../services/auth-service.js';
import {
  createAdminUserService,
  type AdminUserStore,
} from '../services/admin-user-service.js';
import { hashPassword } from '../lib/crypto.js';

interface MemoryRecord extends StoredUser {
  createdAt: string;
}

function createCombinedMemoryStores(seed: MemoryRecord[]) {
  const users = [...seed];
  let nextUserId = users.length + 1;
  let nextAuditId = 1;
  const sessions = new Map<string, { userId: number; expiresAt: Date }>();
  const audits: AuditLogRow[] = [];

  const toAdminRow = (u: MemoryRecord): AdminUserRow => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phoneNumber: u.phoneNumber,
    role: u.role,
    points: u.points,
    isActive: u.isActive,
    createdAt: u.createdAt,
  });

  const authStore: AuthStore = {
    async findUserByEmail(email) {
      return users.find((u) => u.email === email) ?? null;
    },
    async createUser(input) {
      const rec: MemoryRecord = {
        id: nextUserId++,
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        phoneNumber: input.phoneNumber,
        role: input.role,
        points: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      users.push(rec);
      return rec;
    },
    async createSession(input) {
      sessions.set(input.tokenHash, { userId: input.userId, expiresAt: input.expiresAt });
    },
    async findSessionWithUser(tokenHash) {
      const s = sessions.get(tokenHash);
      if (!s) return null;
      const user = users.find((u) => u.id === s.userId);
      if (!user) return null;
      return { expiresAt: s.expiresAt, user };
    },
    async deleteSessionByTokenHash(tokenHash) {
      sessions.delete(tokenHash);
    },
  };

  const adminStore: AdminUserStore = {
    async listUsers(query) {
      const filtered = users.filter((u) => {
        if (query.role && u.role !== query.role) return false;
        if (query.staffOnly && !isStaffRole(u.role)) return false;
        if (query.search) {
          const q = query.search.toLowerCase();
          if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) {
            return false;
          }
        }
        return true;
      });
      const start = (query.page - 1) * query.limit;
      return {
        rows: filtered.slice(start, start + query.limit).map(toAdminRow),
        total: filtered.length,
      };
    },
    async findUserById(id) {
      const found = users.find((u) => u.id === id);
      return found ? toAdminRow(found) : null;
    },
    async findUserByEmail(email) {
      const found = users.find((u) => u.email === email);
      return found ? toAdminRow(found) : null;
    },
    async insertUser(input) {
      const rec: MemoryRecord = {
        id: nextUserId++,
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        phoneNumber: input.phoneNumber,
        role: input.role,
        points: input.points,
        isActive: input.isActive,
        createdAt: new Date().toISOString(),
      };
      users.push(rec);
      return toAdminRow(rec);
    },
    async updateUser(id, patch) {
      const idx = users.findIndex((u) => u.id === id);
      assert.notEqual(idx, -1);
      const current = users[idx]!;
      const updated: MemoryRecord = {
        ...current,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.phoneNumber !== undefined ? { phoneNumber: patch.phoneNumber } : {}),
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.points !== undefined ? { points: patch.points } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        ...(patch.passwordHash !== undefined ? { passwordHash: patch.passwordHash } : {}),
      };
      users[idx] = updated;
      return toAdminRow(updated);
    },
    async deleteUserSessions(userId) {
      for (const [hash, sess] of sessions.entries()) {
        if (sess.userId === userId) sessions.delete(hash);
      }
    },
    async deleteUser(id) {
      const idx = users.findIndex((u) => u.id === id);
      if (idx !== -1) users.splice(idx, 1);
    },
    async recordAudit(entry) {
      const actorRec = entry.actorId ? users.find((u) => u.id === entry.actorId) : null;
      audits.unshift({
        id: nextAuditId++,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        description: entry.description,
        createdAt: new Date().toISOString(),
        actor: actorRec
          ? {
              id: actorRec.id,
              name: actorRec.name,
              email: actorRec.email,
              role: actorRec.role,
            }
          : null,
      });
    },
    async listAuditLogs(query) {
      const filtered = audits.filter((a) => {
        if (query.action && a.action !== query.action) return false;
        if (query.search) {
          const q = query.search.toLowerCase();
          if (
            !a.description.toLowerCase().includes(q) &&
            !a.action.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        return true;
      });
      const start = (query.page - 1) * query.limit;
      return {
        rows: filtered.slice(start, start + query.limit),
        total: filtered.length,
      };
    },
  };

  return { authStore, adminStore };
}

async function loginStaffAndGetCookie(baseUrl: string, email: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/v1/auth/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Cinemax123!' }),
  });
  assert.equal(res.status, 200);
  const raw = res.headers.get('set-cookie');
  assert.ok(raw);
  return raw.split(';')[0]!;
}

test('Admin CRUD records audit logs, revokes deactivated staff sessions, blocks self-lockout, and enforces Manager read-only', async () => {
  const passwordHash = await hashPassword('Cinemax123!');
  const roles: Array<{ email: string; role: UserRole }> = [
    { email: 'admin@cinemax.local', role: 'admin' },
    { email: 'manager@cinemax.local', role: 'manager' },
    { email: 'cashier@cinemax.local', role: 'cashier' },
  ];

  const { authStore, adminStore } = createCombinedMemoryStores(
    roles.map((r, i) => ({
      id: i + 1,
      name: r.role.toUpperCase(),
      email: r.email,
      passwordHash,
      phoneNumber: null,
      role: r.role,
      points: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    })),
  );

  const authService = createAuthService(authStore);
  const adminUserService = createAdminUserService(adminStore);
  const app = createApp({ checkDb: async () => true, authService, adminUserService });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const adminCookie = await loginStaffAndGetCookie(baseUrl, 'admin@cinemax.local');
    const managerCookie = await loginStaffAndGetCookie(baseUrl, 'manager@cinemax.local');
    const cashierCookie = await loginStaffAndGetCookie(baseUrl, 'cashier@cinemax.local');

    // Cashier forbidden on /admin/users
    const cashierGet = await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: { Cookie: cashierCookie },
    });
    assert.equal(cashierGet.status, 403);

    // Manager can read /admin/users but cannot POST
    const managerGet = await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: { Cookie: managerCookie },
    });
    assert.equal(managerGet.status, 200);
    const listBody = (await managerGet.json()) as { data: unknown[]; meta: unknown };
    assert.equal(listBody.data.length, 3);
    paginationMetaSchema.parse(listBody.meta);

    const managerPost = await fetch(`${baseUrl}/api/v1/admin/users`, {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Blocked Create',
        email: 'blocked@cinemax.local',
        role: 'staff',
        password: 'Cinemax123!',
      }),
    });
    assert.equal(managerPost.status, 403);

    // Admin creates new staff user -> 201 + audit log
    const createRes = await fetch(`${baseUrl}/api/v1/admin/users`, {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cleaner Shift Pagi',
        email: 'cleaner2@cinemax.local',
        role: 'cleaner',
        password: 'Cinemax123!',
      }),
    });
    assert.equal(createRes.status, 201);
    const createdBody = (await createRes.json()) as { data: unknown };
    const createdUser = adminUserRowSchema.parse(createdBody.data);
    assert.equal(createdUser.role, 'cleaner');

    // Admin blocked from self-lockout and self-delete
    const selfDisable = await fetch(`${baseUrl}/api/v1/admin/users/1`, {
      method: 'PATCH',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(selfDisable.status, 400);

    const selfDelete = await fetch(`${baseUrl}/api/v1/admin/users/1`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    assert.equal(selfDelete.status, 400);

    // Admin deactivates cashier (id=3) -> cashier's active session immediately becomes 401
    const deactivateCashier = await fetch(`${baseUrl}/api/v1/admin/users/3`, {
      method: 'PATCH',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(deactivateCashier.status, 200);

    const cashierMeAfter = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: cashierCookie },
    });
    assert.equal(cashierMeAfter.status, 401);

    // Audit logs recorded USER_CREATED and USER_DEACTIVATED
    const auditRes = await fetch(`${baseUrl}/api/v1/admin/audit-logs`, {
      headers: { Cookie: managerCookie },
    });
    assert.equal(auditRes.status, 200);
    const auditBody = (await auditRes.json()) as { data: unknown[] };
    const parsedAudits = auditBody.data.map((row) => auditLogRowSchema.parse(row));
    assert.equal(parsedAudits.length, 2);
    assert.equal(parsedAudits[0]?.action, 'USER_DEACTIVATED');
    assert.equal(parsedAudits[1]?.action, 'USER_CREATED');
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
});
