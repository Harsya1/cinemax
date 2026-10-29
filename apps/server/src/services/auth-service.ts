import { eq } from 'drizzle-orm';
import {
  isStaffRole,
  type AuthUser,
  type LoginInput,
  type ParsedRegisterInput,
  type UserRole,
} from '@cinemax/shared';
import { getDb } from '../db/index.js';
import { sessions, users } from '../db/schema.js';
import { AppError } from '../lib/http-error.js';
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from '../lib/crypto.js';

export interface StoredUser {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  phoneNumber: string | null;
  role: UserRole;
  points: number;
  isActive: boolean;
}

export interface AuthStore {
  findUserByEmail(email: string): Promise<StoredUser | null>;
  createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    phoneNumber: string | null;
    role: UserRole;
  }): Promise<StoredUser>;
  createSession(input: { userId: number; tokenHash: string; expiresAt: Date }): Promise<void>;
  findSessionWithUser(
    tokenHash: string,
  ): Promise<{ expiresAt: Date; user: StoredUser } | null>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
}

function toPublicUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
    points: user.points,
  };
}

export function createDrizzleAuthStore(): AuthStore {
  return {
    async findUserByEmail(email) {
      const rows = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
      return rows[0] ?? null;
    },
    async createUser(input) {
      const rows = await getDb()
        .insert(users)
        .values({
          name: input.name,
          email: input.email,
          passwordHash: input.passwordHash,
          phoneNumber: input.phoneNumber,
          role: input.role,
        })
        .returning();
      return rows[0]!;
    },
    async createSession(input) {
      await getDb().insert(sessions).values(input);
    },
    async findSessionWithUser(tokenHash) {
      const rows = await getDb()
        .select({
          expiresAt: sessions.expiresAt,
          user: users,
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.tokenHash, tokenHash))
        .limit(1);
      return rows[0] ?? null;
    },
    async deleteSessionByTokenHash(tokenHash) {
      await getDb().delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    },
  };
}

export function createAuthService(store: AuthStore = createDrizzleAuthStore()) {
  async function issueSessionForUser(user: StoredUser): Promise<{
    user: AuthUser;
    rawToken: string;
  }> {
    const { rawToken, tokenHash, expiresAt } = generateSessionToken();
    await store.createSession({ userId: user.id, tokenHash, expiresAt });
    return { user: toPublicUser(user), rawToken };
  }

  return {
    async registerCustomer(input: ParsedRegisterInput) {
      const existing = await store.findUserByEmail(input.email);
      if (existing) {
        throw new AppError(409, 'EMAIL_TAKEN', 'Email sudah terdaftar');
      }
      const passwordHash = await hashPassword(input.password);
      const created = await store.createUser({
        name: input.name,
        email: input.email,
        passwordHash,
        phoneNumber: input.phoneNumber,
        role: 'user',
      });
      return issueSessionForUser(created);
    },

    async loginCustomer(input: LoginInput) {
      const user = await store.findUserByEmail(input.email);
      if (!user || !user.isActive || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Email atau password salah');
      }
      if (isStaffRole(user.role)) {
        throw new AppError(
          403,
          'STAFF_MUST_USE_STAFF_PORTAL',
          'Akun staf dan admin wajib login melalui portal Workspace Staf',
        );
      }
      return issueSessionForUser(user);
    },

    async loginStaff(input: LoginInput) {
      const user = await store.findUserByEmail(input.email);
      if (!user || !user.isActive || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Email atau password salah');
      }
      if (!isStaffRole(user.role)) {
        throw new AppError(
          403,
          'CUSTOMER_FORBIDDEN',
          'Portal ini khusus untuk karyawan dan administrator CINEMAX',
        );
      }
      return issueSessionForUser(user);
    },

    async getUserFromRawToken(rawToken: string | undefined): Promise<AuthUser | null> {
      if (!rawToken) return null;
      const tokenHash = hashSessionToken(rawToken);
      const found = await store.findSessionWithUser(tokenHash);
      if (!found) return null;

      if (!found.user.isActive || found.expiresAt.getTime() <= Date.now()) {
        await store.deleteSessionByTokenHash(tokenHash);
        return null;
      }

      return toPublicUser(found.user);
    },

    async logoutByRawToken(rawToken: string | undefined): Promise<void> {
      if (!rawToken) return;
      const tokenHash = hashSessionToken(rawToken);
      await store.deleteSessionByTokenHash(tokenHash);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
