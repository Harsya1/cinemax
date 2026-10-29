import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { authUserSchema, type UserRole } from '@cinemax/shared';
import { createApp } from '../app.js';
import { createAuthService, type AuthStore, type StoredUser } from '../services/auth-service.js';
import { hashPassword } from '../lib/crypto.js';

function createMemoryAuthStore(seedUsers: StoredUser[] = []): AuthStore {
  const users = [...seedUsers];
  let nextId = users.length + 1;
  const sessions = new Map<string, { userId: number; expiresAt: Date }>();

  return {
    async findUserByEmail(email) {
      return users.find((u) => u.email === email) ?? null;
    },
    async createUser(input) {
      const created: StoredUser = {
        id: nextId++,
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        phoneNumber: input.phoneNumber,
        role: input.role,
        points: 0,
        isActive: true,
      };
      users.push(created);
      return created;
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
}

function extractCookie(res: Response): string {
  const raw = res.headers.get('set-cookie');
  assert.ok(raw, 'Expected Set-Cookie header');
  assert.match(raw, /HttpOnly/);
  return raw.split(';')[0]!;
}

async function withAuthApp(
  seedRoles: Array<{ email: string; role: UserRole; isActive?: boolean }>,
  run: (baseUrl: string) => Promise<void>,
) {
  const passwordHash = await hashPassword('Cinemax123!');
  const seeded: StoredUser[] = seedRoles.map((item, idx) => ({
    id: idx + 1,
    name: item.role.toUpperCase(),
    email: item.email,
    passwordHash,
    phoneNumber: null,
    role: item.role,
    points: 100,
    isActive: item.isActive ?? true,
  }));

  const authService = createAuthService(createMemoryAuthStore(seeded));
  const app = createApp({ checkDb: async () => true, authService });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

test('Customer register sets HttpOnly cookie, resolves /auth/me without passwordHash, and logs out', async () => {
  await withAuthApp([], async (baseUrl) => {
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rina Putri',
        email: 'RINA@Example.com',
        phoneNumber: '08123456789',
        password: 'Cinemax123!',
        passwordConfirmation: 'Cinemax123!',
      }),
    });
    assert.equal(regRes.status, 201);
    const cookie = extractCookie(regRes);
    const regBody = (await regRes.json()) as { data: Record<string, unknown> };
    assert.equal('passwordHash' in regBody.data, false);
    const parsedUser = authUserSchema.parse(regBody.data);
    assert.equal(parsedUser.email, 'rina@example.com');
    assert.equal(parsedUser.role, 'user');

    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: cookie },
    });
    assert.equal(meRes.status, 200);

    const logoutRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    assert.equal(logoutRes.status, 200);

    const meAfterLogout = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: cookie },
    });
    assert.equal(meAfterLogout.status, 401);
  });
});

test('Separated portals block staff on /auth/login and block customer on /auth/staff/login', async () => {
  await withAuthApp(
    [
      { email: 'admin@cinemax.local', role: 'admin' },
      { email: 'cashier@cinemax.local', role: 'cashier' },
      { email: 'user@cinemax.local', role: 'user' },
    ],
    async (baseUrl) => {
      // Staff rejected on customer login
      const staffOnPublic = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@cinemax.local', password: 'Cinemax123!' }),
      });
      assert.equal(staffOnPublic.status, 403);
      const err1 = (await staffOnPublic.json()) as { error: { code: string } };
      assert.equal(err1.error.code, 'STAFF_MUST_USE_STAFF_PORTAL');

      // Customer rejected on staff login
      const customerOnStaff = await fetch(`${baseUrl}/api/v1/auth/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@cinemax.local', password: 'Cinemax123!' }),
      });
      assert.equal(customerOnStaff.status, 403);
      const err2 = (await customerOnStaff.json()) as { error: { code: string } };
      assert.equal(err2.error.code, 'CUSTOMER_FORBIDDEN');

      // Admin succeeds on staff login & passes requireRole('admin', 'manager')
      const adminLogin = await fetch(`${baseUrl}/api/v1/auth/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@cinemax.local', password: 'Cinemax123!' }),
      });
      assert.equal(adminLogin.status, 200);
      const adminCookie = extractCookie(adminLogin);

      const adminPing = await fetch(`${baseUrl}/api/v1/staff/ping`, {
        headers: { Cookie: adminCookie },
      });
      assert.equal(adminPing.status, 200);

      // Cashier succeeds on staff login but gets 403 on admin/manager-only endpoint
      const cashierLogin = await fetch(`${baseUrl}/api/v1/auth/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'cashier@cinemax.local', password: 'Cinemax123!' }),
      });
      assert.equal(cashierLogin.status, 200);
      const cashierCookie = extractCookie(cashierLogin);

      const cashierPing = await fetch(`${baseUrl}/api/v1/staff/ping`, {
        headers: { Cookie: cashierCookie },
      });
      assert.equal(cashierPing.status, 403);
    },
  );
});
