# CINEMAX Plan 01 — Monorepo, DB Foundation, & Dual-Surface Brand Implementation Plan

> **For Hermes:** Use subagent-driven-development skill (or sequential task execution) to implement this plan task-by-task. **PENTING:** Jangan menjalankan `git init` atau `git commit` kecuali diperintahkan secara eksplisit oleh user, dan jangan pernah mencetak `req.body` atau PII ke log.

**Goal:** Membangun fondasi monorepo TypeScript (`@cinemax/shared`, `@cinemax/server`, `@cinemax/client`), container Docker PostgreSQL 16 ringan, pipa migrasi awal Drizzle ORM, endpoint `GET /api/v1/health` beramplop standar, serta sistem token Dual-Surface **CINEMAX** (Publik Dark Obsidian + Warm Gold + Deep Burgundy; Admin/POS Light bersih beraksen Burgundy + Gold).

**Architecture:** npm Workspaces ringan dengan 3 paket terisolasi di bawah `/mnt/d/new-cinema`. PostgreSQL berjalan sendiri di Docker menggunakan named volume (menghindari masalah izin NTFS di `/mnt/d`), sedangkan Express 5 (`port 4000`) dan Vite React 19 (`port 5173`, proxy `/api`) berjalan native di WSL. Seluruh pengujian otomatis menggunakan stdlib `node:test` + `node:assert/strict` + native `fetch` di Node 22 tanpa framework test tambahan.

**Tech Stack:** Node.js 22, npm Workspaces, TypeScript 5, Zod, Express 5, Drizzle ORM + `postgres` (`postgres.js`), PostgreSQL 16 Alpine, React 19, React Router 7, Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`).

---

### Task 1: Root Workspace, Konfigurasi TypeScript Dasar, & Docker PostgreSQL

**Objective:** Menyiapkan root npm workspaces, `.gitignore`, `.env.example`, `tsconfig.base.json`, dan `docker-compose.yml` khusus PostgreSQL 16 Alpine.

**Files:**
- Create: `/mnt/d/new-cinema/package.json`
- Create: `/mnt/d/new-cinema/tsconfig.base.json`
- Create: `/mnt/d/new-cinema/.gitignore`
- Create: `/mnt/d/new-cinema/.env.example`
- Create: `/mnt/d/new-cinema/.env`
- Create: `/mnt/d/new-cinema/docker-compose.yml`

**Step 1: Buat file konfigurasi root & Docker**

`/mnt/d/new-cinema/package.json`:
```json
{
  "name": "cinemax-monorepo",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "build:shared": "npm -w @cinemax/shared run build",
    "build": "npm run build:shared && npm -w @cinemax/server run build && npm -w @cinemax/client run build",
    "dev:server": "npm -w @cinemax/server run dev",
    "dev:client": "npm -w @cinemax/client run dev",
    "db:generate": "npm -w @cinemax/server run db:generate",
    "db:migrate": "npm -w @cinemax/server run db:migrate",
    "test": "npm run build:shared && npm -w @cinemax/shared test && npm -w @cinemax/server test",
    "typecheck": "npm run build:shared && npm -w @cinemax/server run typecheck && npm -w @cinemax/client run typecheck"
  },
  "devDependencies": {
    "typescript": "^5.8.2"
  }
}
```

`/mnt/d/new-cinema/tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true
  }
}
```

`/mnt/d/new-cinema/.gitignore`:
```gitignore
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
```

`/mnt/d/new-cinema/.env.example` (salin juga nilainya ke `/mnt/d/new-cinema/.env` untuk dev lokal):
```env
NODE_ENV=development
PORT=4000
POSTGRES_USER=cinemax
POSTGRES_PASSWORD=cinemax_dev_only
POSTGRES_DB=cinemax_db
POSTGRES_PORT=5432
DATABASE_URL=postgres://cinemax:cinemax_dev_only@127.0.0.1:5432/cinemax_db
CLIENT_ORIGIN=http://localhost:5173
```

`/mnt/d/new-cinema/docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: cinemax-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-cinemax}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-cinemax_dev_only}
      POSTGRES_DB: ${POSTGRES_DB:-cinemax_db}
    ports:
      - "127.0.0.1:${POSTGRES_PORT:-5432}:5432"
    volumes:
      - cinemax_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-cinemax} -d ${POSTGRES_DB:-cinemax_db}"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  cinemax_pgdata:
```

**Step 2: Validasi konfigurasi Docker Compose**

Run: `docker compose config --quiet && echo "COMPOSE_VALID"`
Expected: `COMPOSE_VALID`

---

### Task 2: Paket `@cinemax/shared` (Brand, Enums, & Skema Zod Bersama) dengan TDD

**Objective:** Membangun paket `@cinemax/shared` berisi konstanta brand CINEMAX, enum role/studio/status/pembayaran, dan skema Zod amplop respons + health check.

**Files:**
- Create: `/mnt/d/new-cinema/packages/shared/package.json`
- Create: `/mnt/d/new-cinema/packages/shared/tsconfig.json`
- Create: `/mnt/d/new-cinema/packages/shared/src/brand.ts`
- Create: `/mnt/d/new-cinema/packages/shared/src/enums.ts`
- Create: `/mnt/d/new-cinema/packages/shared/src/schemas/health.ts`
- Create: `/mnt/d/new-cinema/packages/shared/src/index.ts`
- Test: `/mnt/d/new-cinema/packages/shared/src/__tests__/shared.test.ts`

**Step 1: Buat `package.json`, `tsconfig.json`, dan test awal yang gagal**

`/mnt/d/new-cinema/packages/shared/package.json`:
```json
{
  "name": "@cinemax/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "node --import tsx --test src/__tests__/shared.test.ts"
  },
  "dependencies": {
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "tsx": "^4.19.3"
  }
}
```

`/mnt/d/new-cinema/packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/__tests__/**", "dist"]
}
```

`/mnt/d/new-cinema/packages/shared/src/__tests__/shared.test.ts`:
```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAND,
  USER_ROLES,
  STUDIO_TYPES,
  BOOKING_STATUSES,
  PAYMENT_METHODS,
  healthDataSchema,
} from '../index.js';

test('BRAND exposes CINEMAX identity and booking prefix', () => {
  assert.equal(BRAND.name, 'CINEMAX');
  assert.equal(BRAND.bookingPrefix, 'CX');
});

test('enums preserve legacy cinema-xxl roles plus staff and held/expired statuses', () => {
  assert.deepEqual(USER_ROLES, [
    'admin',
    'manager',
    'cashier',
    'fnb_staff',
    'cleaner',
    'staff',
    'user',
  ]);
  assert.deepEqual(STUDIO_TYPES, ['regular', '3d', 'premier']);
  assert.ok(BOOKING_STATUSES.includes('held'));
  assert.ok(BOOKING_STATUSES.includes('cancelled'));
  assert.deepEqual(PAYMENT_METHODS, ['cash', 'qris']);
});

test('healthDataSchema validates valid payload and rejects negative latency', () => {
  const valid = healthDataSchema.safeParse({
    service: 'cinemax-api',
    status: 'ok',
    db: 'connected',
    latencyMs: 4,
    timestamp: new Date().toISOString(),
  });
  assert.equal(valid.success, true);

  const invalid = healthDataSchema.safeParse({
    service: 'cinemax-api',
    status: 'ok',
    db: 'connected',
    latencyMs: -1,
    timestamp: 'not-iso',
  });
  assert.equal(invalid.success, false);
});
```

**Step 2: Install dependency awal & jalankan test untuk memverifikasi gagal**

Run: `npm install && npm -w @cinemax/shared test`
Expected: FAIL — `Cannot find module '../index.js'`

**Step 3: Tulis implementasi minimal `@cinemax/shared`**

`/mnt/d/new-cinema/packages/shared/src/brand.ts`:
```ts
export const BRAND = {
  name: 'CINEMAX',
  tagline: 'Luxury Cinema & Studio Experience',
  bookingPrefix: 'CX',
  colors: {
    obsidian: '#09090B',
    gold: '#F59E0B',
    burgundy: '#6B1D2F',
  },
} as const;
```

`/mnt/d/new-cinema/packages/shared/src/enums.ts`:
```ts
export const USER_ROLES = [
  'admin',
  'manager',
  'cashier',
  'fnb_staff',
  'cleaner',
  'staff',
  'user',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const STUDIO_TYPES = ['regular', '3d', 'premier'] as const;
export type StudioType = (typeof STUDIO_TYPES)[number];

export const BOOKING_STATUSES = [
  'held',
  'booked',
  'paid',
  'redeemed',
  'cancelled',
  'expired',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_METHODS = ['cash', 'qris'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
```

`/mnt/d/new-cinema/packages/shared/src/schemas/health.ts`:
```ts
import { z } from 'zod';

export const healthDataSchema = z.object({
  service: z.literal('cinemax-api'),
  status: z.enum(['ok', 'degraded']),
  db: z.enum(['connected', 'disconnected']),
  latencyMs: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});

export type HealthData = z.infer<typeof healthDataSchema>;

export const apiErrorPayloadSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiErrorPayload = z.infer<typeof apiErrorPayloadSchema>;

export interface ApiSuccessPayload<T> {
  data: T;
  meta?: Record<string, unknown>;
}
```

`/mnt/d/new-cinema/packages/shared/src/index.ts`:
```ts
export * from './brand.js';
export * from './enums.js';
export * from './schemas/health.js';
```

**Step 4: Jalankan test & build `@cinemax/shared`**

Run: `npm -w @cinemax/shared test && npm run build:shared`
Expected: PASS (3 tests pass, `packages/shared/dist/index.js` & `index.d.ts` terbuat).

---

### Task 3: Validasi Environment & Fondasi Database Drizzle di `@cinemax/server`

**Objective:** Membangun paket `@cinemax/server`, validasi Zod atas variabel environment (`parseEnv`), koneksi Drizzle + `postgres.js`, serta skema awal `user_role` dan file migrasi SQL pertamanya.

**Files:**
- Create: `/mnt/d/new-cinema/apps/server/package.json`
- Create: `/mnt/d/new-cinema/apps/server/tsconfig.json`
- Create: `/mnt/d/new-cinema/apps/server/drizzle.config.ts`
- Create: `/mnt/d/new-cinema/apps/server/src/env.ts`
- Create: `/mnt/d/new-cinema/apps/server/src/db/schema.ts`
- Create: `/mnt/d/new-cinema/apps/server/src/db/index.ts`
- Test: `/mnt/d/new-cinema/apps/server/src/__tests__/env.test.ts`

**Step 1: Buat `package.json`, `tsconfig.json`, dan test gagal untuk `parseEnv`**

`/mnt/d/new-cinema/apps/server/package.json`:
```json
{
  "name": "@cinemax/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "test": "node --import tsx --test src/__tests__/*.test.ts"
  },
  "dependencies": {
    "@cinemax/shared": "0.1.0",
    "dotenv": "^16.4.7",
    "drizzle-orm": "^0.40.0",
    "express": "^5.1.0",
    "postgres": "^3.4.5",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.13.10",
    "drizzle-kit": "^0.30.5",
    "tsx": "^4.19.3"
  }
}
```

`/mnt/d/new-cinema/apps/server/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/__tests__/**", "dist"]
}
```

`/mnt/d/new-cinema/apps/server/src/__tests__/env.test.ts`:
```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from '../env.js';

test('parseEnv throws when DATABASE_URL is missing', () => {
  assert.throws(() => parseEnv({}), /DATABASE_URL/);
});

test('parseEnv parses valid environment with sensible defaults', () => {
  const env = parseEnv({
    DATABASE_URL: 'postgres://cinemax:secret@127.0.0.1:5432/cinemax_db',
  });
  assert.equal(env.PORT, 4000);
  assert.equal(env.NODE_ENV, 'development');
  assert.equal(env.CLIENT_ORIGIN, 'http://localhost:5173');
});
```

**Step 2: Install dependency `@cinemax/server` & jalankan test untuk memverifikasi gagal**

Run: `npm install && npm -w @cinemax/server test`
Expected: FAIL — `Cannot find module '../env.js'`

**Step 3: Tulis `env.ts`, `db/schema.ts`, `db/index.ts`, dan `drizzle.config.ts`**

`/mnt/d/new-cinema/apps/server/src/env.ts`:
```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection URL'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, string | undefined>): AppEnv {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const fields = Object.keys(parsed.error.flatten().fieldErrors).join(', ');
    throw new Error(`Invalid environment configuration for: ${fields}`);
  }
  return parsed.data;
}
```

`/mnt/d/new-cinema/apps/server/src/db/schema.ts`:
```ts
import { pgEnum } from 'drizzle-orm/pg-core';
import { USER_ROLES } from '@cinemax/shared';

export const userRoleEnum = pgEnum('user_role', USER_ROLES);
```

`/mnt/d/new-cinema/apps/server/src/db/index.ts`:
```ts
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import * as schema from './schema.js';
import { parseEnv } from '../env.js';

let sqlClient: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!sqlClient) {
    const env = parseEnv(process.env);
    // ponytail: max 10 connections covers single-location cinema traffic
    sqlClient = postgres(env.DATABASE_URL, { max: 10, connect_timeout: 5 });
  }
  return drizzle(sqlClient, { schema });
}

export async function pingDatabase(): Promise<boolean> {
  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

export async function closeDb(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end({ timeout: 2 });
    sqlClient = null;
  }
}
```

`/mnt/d/new-cinema/apps/server/drizzle.config.ts`:
```ts
import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://cinemax:cinemax_dev_only@127.0.0.1:5432/cinemax_db',
  },
});
```

**Step 4: Jalankan test `env.test.ts` & generate migrasi awal Drizzle**

Run: `npm -w @cinemax/server test && npm run db:generate`
Expected: PASS pada `env.test.ts` dan terbuat file SQL di `apps/server/drizzle/0000_*.sql` berisi `CREATE TYPE "public"."user_role" AS ENUM(...)`.

---

### Task 4: Express App, Amplop Respons, PII-Safe Error Handler, & Endpoint `/api/v1/health`

**Objective:** Membangun `createApp` Express 5 dengan format respons `{ data }` / `{ error }`, global error handler yang aman dari kebocoran PII, serta rute `GET /api/v1/health`.

**Files:**
- Create: `/mnt/d/new-cinema/apps/server/src/lib/http-error.ts`
- Create: `/mnt/d/new-cinema/apps/server/src/lib/response.ts`
- Create: `/mnt/d/new-cinema/apps/server/src/middleware/error-handler.ts`
- Create: `/mnt/d/new-cinema/apps/server/src/routes/health.ts`
- Create: `/mnt/d/new-cinema/apps/server/src/app.ts`
- Create: `/mnt/d/new-cinema/apps/server/src/index.ts`
- Test: `/mnt/d/new-cinema/apps/server/src/__tests__/health.test.ts`

**Step 1: Tulis test kontrak HTTP untuk `/api/v1/health` dan `404` amplop JSON**

`/mnt/d/new-cinema/apps/server/src/__tests__/health.test.ts`:
```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { healthDataSchema, apiErrorPayloadSchema } from '@cinemax/shared';
import { createApp } from '../app.js';

async function withServer(
  checkDb: () => Promise<boolean>,
  run: (baseUrl: string) => Promise<void>,
) {
  const app = createApp({ checkDb });
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

test('GET /api/v1/health returns 200 ok envelope when DB is connected', async () => {
  await withServer(async () => true, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: unknown };
    const parsed = healthDataSchema.parse(body.data);
    assert.equal(parsed.status, 'ok');
    assert.equal(parsed.db, 'connected');
  });
});

test('GET /api/v1/health returns 503 degraded envelope when DB is disconnected', async () => {
  await withServer(async () => false, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(res.status, 503);
    const body = (await res.json()) as { data: unknown };
    const parsed = healthDataSchema.parse(body.data);
    assert.equal(parsed.status, 'degraded');
    assert.equal(parsed.db, 'disconnected');
  });
});

test('Unknown API route returns uniform 404 JSON error envelope', async () => {
  await withServer(async () => true, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/does-not-exist`);
    assert.equal(res.status, 404);
    const body = await res.json();
    const parsed = apiErrorPayloadSchema.parse(body);
    assert.equal(parsed.error.code, 'NOT_FOUND');
  });
});
```

**Step 2: Jalankan test untuk memverifikasi gagal**

Run: `npm -w @cinemax/server test`
Expected: FAIL — `Cannot find module '../app.js'`

**Step 3: Tulis implementasi helper error, respons, route health, `app.ts`, dan `index.ts`**

`/mnt/d/new-cinema/apps/server/src/lib/http-error.ts`:
```ts
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

`/mnt/d/new-cinema/apps/server/src/lib/response.ts`:
```ts
import type { Response } from 'express';
import type { ApiSuccessPayload } from '@cinemax/shared';

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: Record<string, unknown>,
): Response {
  const payload: ApiSuccessPayload<T> = meta ? { data, meta } : { data };
  return res.status(statusCode).json(payload);
}
```

`/mnt/d/new-cinema/apps/server/src/middleware/error-handler.ts`:
```ts
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/http-error.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Requested endpoint does not exist',
    },
  });
};

// Never log req.body or PII in error handler
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  console.error('[API_ERROR]', err instanceof Error ? err.name : 'UnknownError');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected server error occurred',
    },
  });
};
```

`/mnt/d/new-cinema/apps/server/src/routes/health.ts`:
```ts
import { Router } from 'express';
import type { HealthData } from '@cinemax/shared';
import { sendSuccess } from '../lib/response.js';

export function createHealthRouter(checkDb: () => Promise<boolean>): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    const startedAt = performance.now();
    const isConnected = await checkDb();
    const latencyMs = Math.round(performance.now() - startedAt);

    const payload: HealthData = {
      service: 'cinemax-api',
      status: isConnected ? 'ok' : 'degraded',
      db: isConnected ? 'connected' : 'disconnected',
      latencyMs,
      timestamp: new Date().toISOString(),
    };

    sendSuccess(res, payload, isConnected ? 200 : 503);
  });

  return router;
}
```

`/mnt/d/new-cinema/apps/server/src/app.ts`:
```ts
import express, { type Express } from 'express';
import { pingDatabase } from './db/index.js';
import { createHealthRouter } from './routes/health.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

export interface AppDependencies {
  checkDb?: () => Promise<boolean>;
}

export function createApp(deps: AppDependencies = {}): Express {
  const app = express();
  const checkDb = deps.checkDb ?? pingDatabase;

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/v1', createHealthRouter(checkDb));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
```

`/mnt/d/new-cinema/apps/server/src/index.ts`:
```ts
import { parseEnv } from './env.js';
import { createApp } from './app.js';
import { closeDb } from './db/index.js';

const env = parseEnv(process.env);
const app = createApp();

const server = app.listen(env.PORT, () => {
  console.info(`[CINEMAX] API listening on http://localhost:${env.PORT}`);
});

function shutdown() {
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

**Step 4: Jalankan test & typecheck server**

Run: `npm -w @cinemax/server test && npm -w @cinemax/server run typecheck`
Expected: PASS semua test (`env.test.ts` + `health.test.ts`) dan `tsc --noEmit` keluar kode 0.

---

### Task 5: Paket `@cinemax/client` & Sistem Token Dual-Surface CINEMAX

**Objective:** Membangun aplikasi React 19 + Vite + Tailwind CSS v4 dengan proxy `/api`, fetch wrapper tipis tanpa global `Content-Type` paksa, dan sistem token CSS single-source untuk `data-surface="cinema"` (Obsidian + Warm Gold + Deep Burgundy) dan `data-surface="workspace"` (Light bersih beraksen Burgundy + Gold).

**Files:**
- Create: `/mnt/d/new-cinema/apps/client/package.json`
- Create: `/mnt/d/new-cinema/apps/client/tsconfig.json`
- Create: `/mnt/d/new-cinema/apps/client/vite.config.ts`
- Create: `/mnt/d/new-cinema/apps/client/index.html`
- Create: `/mnt/d/new-cinema/apps/client/src/styles/theme.css`
- Create: `/mnt/d/new-cinema/apps/client/src/lib/api.ts`
- Create: `/mnt/d/new-cinema/apps/client/src/layouts/CinemaLayout.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/layouts/WorkspaceLayout.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/pages/CinemaPreviewPage.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/pages/WorkspacePreviewPage.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/App.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/main.tsx`

**Step 1: Buat `package.json`, `tsconfig.json`, `vite.config.ts`, dan `index.html`**

`/mnt/d/new-cinema/apps/client/package.json`:
```json
{
  "name": "@cinemax/client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@cinemax/shared": "0.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.2.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.9",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^4.0.9",
    "vite": "^6.2.0"
  }
}
```

`/mnt/d/new-cinema/apps/client/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true
  },
  "include": ["src"]
}
```

`/mnt/d/new-cinema/apps/client/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
```

`/mnt/d/new-cinema/apps/client/index.html`:
```html
<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CINEMAX — Luxury Cinema Experience</title>
    <link rel="preconnect" href="https://fonts.bunny.net" />
    <link
      href="https://fonts.bunny.net/css?family=inter:400,500,600,700|outfit:600,700,800&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 2: Buat single-source token CSS (`src/styles/theme.css`) dan API client (`src/lib/api.ts`)**

`/mnt/d/new-cinema/apps/client/src/styles/theme.css`:
```css
@import "tailwindcss";

:root {
  /* Core CINEMAX Brand Palette */
  --cx-obsidian-950: #09090b;
  --cx-obsidian-900: #121216;
  --cx-obsidian-800: #1c1c22;

  --cx-gold-400: #fbbf24;
  --cx-gold-500: #f59e0b;
  --cx-gold-600: #d97706;

  --cx-burgundy-900: #4c1120;
  --cx-burgundy-800: #6b1d2f;
  --cx-burgundy-700: #881337;
}

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Outfit", "Inter", ui-sans-serif, system-ui, sans-serif;

  --color-obsidian-950: var(--cx-obsidian-950);
  --color-obsidian-900: var(--cx-obsidian-900);
  --color-obsidian-800: var(--cx-obsidian-800);

  --color-gold-400: var(--cx-gold-400);
  --color-gold-500: var(--cx-gold-500);
  --color-gold-600: var(--cx-gold-600);

  --color-burgundy-900: var(--cx-burgundy-900);
  --color-burgundy-800: var(--cx-burgundy-800);
  --color-burgundy-700: var(--cx-burgundy-700);

  --color-canvas: var(--bg-canvas);
  --color-surface: var(--bg-surface);
  --color-elevated: var(--bg-elevated);
  --color-ink: var(--text-primary);
  --color-muted: var(--text-muted);
  --color-accent: var(--accent-primary);
  --color-luxury: var(--accent-luxury);
}

/* Public Surface: Dark Obsidian + Warm Gold + Deep Burgundy */
[data-surface="cinema"] {
  --bg-canvas: var(--cx-obsidian-950);
  --bg-surface: var(--cx-obsidian-900);
  --bg-elevated: var(--cx-obsidian-800);
  --text-primary: #fafafa;
  --text-muted: #a1a1aa;
  --accent-primary: var(--cx-gold-500);
  --accent-luxury: var(--cx-burgundy-800);
  --border-subtle: rgba(255, 255, 255, 0.08);
  background-color: var(--bg-canvas);
  color: var(--text-primary);
}

/* Admin & Staff POS Surface: Clean Light + Deep Burgundy + High-Contrast Gold */
[data-surface="workspace"] {
  --bg-canvas: #f8fafc;
  --bg-surface: #ffffff;
  --bg-elevated: #f1f5f9;
  --text-primary: #0f172a;
  --text-muted: #475569;
  --accent-primary: var(--cx-burgundy-800);
  --accent-luxury: var(--cx-gold-600);
  --border-subtle: #e2e8f0;
  background-color: var(--bg-canvas);
  color: var(--text-primary);
}

/* Modernized Cinema Hero Pattern (Grid + Burgundy/Gold Velvet Spotlight) */
.cx-cinema-pattern {
  background-image:
    radial-gradient(circle at 18% 20%, rgba(136, 19, 55, 0.28), transparent 45%),
    radial-gradient(circle at 82% 15%, rgba(245, 158, 11, 0.14), transparent 40%),
    linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 100% 100%, 100% 100%, 40px 40px, 40px 40px;
}

.tabular-nums {
  font-variant-numeric: tabular-nums;
}
```

`/mnt/d/new-cinema/apps/client/src/lib/api.ts`:
```ts
import type { ApiErrorPayload, ApiSuccessPayload } from '@cinemax/shared';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export async function apiRequest<T>(
  endpoint: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  // Do not force global Content-Type when body is FormData or absent
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`/api/v1${endpoint}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  const json = (await response.json().catch(() => null)) as
    | ApiSuccessPayload<T>
    | ApiErrorPayload
    | null;

  if (!response.ok || !json || 'error' in json) {
    const errObj = json && 'error' in json ? json.error : null;
    throw new ApiClientError(
      response.status,
      errObj?.code ?? 'HTTP_ERROR',
      errObj?.message ?? `Request failed with status ${response.status}`,
      errObj?.details,
    );
  }

  return json.data;
}
```

**Step 3: Buat kedua Layout (`CinemaLayout` & `WorkspaceLayout`) dan halaman preview yang memanggil `/api/v1/health`**

`/mnt/d/new-cinema/apps/client/src/layouts/CinemaLayout.tsx`:
```tsx
import { Link, Outlet } from 'react-router-dom';
import { BRAND } from '@cinemax/shared';

export function CinemaLayout() {
  return (
    <div data-surface="cinema" className="min-h-screen font-sans antialiased">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-obsidian-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-burgundy-700 to-burgundy-900 ring-1 ring-gold-500/40 font-display text-lg font-extrabold text-gold-400">
              C
            </span>
            <span className="font-display text-xl font-extrabold tracking-wider text-white">
              CINE<span className="text-gold-500">MAX</span>
            </span>
          </Link>

          <nav className="flex items-center gap-6 text-sm font-medium text-muted">
            <Link to="/" className="text-white transition-colors hover:text-gold-400">
              Now Playing
            </Link>
            <Link
              to="/workspace-preview"
              className="rounded-lg border border-burgundy-700/60 bg-burgundy-900/50 px-3.5 py-1.5 text-xs font-semibold text-gold-400 transition-colors hover:bg-burgundy-800"
            >
              Workspace Light Preview ({BRAND.bookingPrefix})
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
```

`/mnt/d/new-cinema/apps/client/src/layouts/WorkspaceLayout.tsx`:
```tsx
import { Link, Outlet } from 'react-router-dom';

export function WorkspaceLayout() {
  return (
    <div data-surface="workspace" className="flex min-h-screen font-sans antialiased">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-burgundy-800 font-display text-sm font-bold text-gold-400">
            CX
          </span>
          <div>
            <p className="font-display text-base font-bold tracking-wide text-slate-900">
              CINEMAX
            </p>
            <p className="text-[11px] font-medium text-slate-500">Operations & POS</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3 text-sm">
          <div className="rounded-lg bg-burgundy-800 px-3 py-2 font-medium text-white">
            System Overview
          </div>
          <div className="rounded-lg px-3 py-2 font-medium text-slate-600">
            Studios & Showtimes (Plan 04-05)
          </div>
          <div className="rounded-lg px-3 py-2 font-medium text-slate-600">
            Ticket POS (Plan 09)
          </div>
        </nav>

        <div className="border-t border-slate-200 p-4">
          <Link
            to="/"
            className="block rounded-lg border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-burgundy-800 hover:bg-slate-50"
          >
            Back to Public Cinema
          </Link>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <h1 className="font-display text-lg font-bold text-slate-900">
            Admin & Staff Workspace Surface
          </h1>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-gold-600 ring-1 ring-amber-200">
            Plan 01 Foundation
          </span>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

`/mnt/d/new-cinema/apps/client/src/pages/CinemaPreviewPage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { STUDIO_TYPES, type HealthData } from '@cinemax/shared';
import { apiRequest } from '../lib/api';

export function CinemaPreviewPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<HealthData>('/health')
      .then(setHealth)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Unable to reach API'),
      );
  }, []);

  return (
    <section className="cx-cinema-pattern border-b border-white/10 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-burgundy-700/80 bg-burgundy-900/60 px-3.5 py-1 text-xs font-semibold tracking-wide text-gold-400">
          PREMIER VELVET & GOLD EDITION
        </div>

        <h1 className="mt-5 max-w-3xl font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
          Experience Cinema in <span className="text-gold-500">Obsidian</span> &{' '}
          <span className="text-rose-300">Burgundy</span>
        </h1>

        <p className="mt-4 max-w-2xl text-base text-muted">
          Fondasi monorepo CINEMAX siap. Surface publik memakai Obsidian pekat, CTA Warm Gold,
          dan aksen mewah Deep Burgundy untuk kelas studio Premier.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            className="rounded-lg bg-gold-500 px-6 py-3 text-sm font-bold text-obsidian-950 transition-colors hover:bg-gold-400"
          >
            Book Ticket CTA
          </button>
          <button
            type="button"
            className="rounded-lg border border-burgundy-700 bg-burgundy-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-burgundy-700"
          >
            Premier Lounge
          </button>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Backend & PostgreSQL Status
            </p>
            {health ? (
              <div className="mt-3 flex items-baseline justify-between tabular-nums">
                <span className="text-lg font-bold text-emerald-400">
                  DB: {health.db} ({health.status})
                </span>
                <span className="text-xs text-muted">{health.latencyMs} ms</span>
              </div>
            ) : (
              <p className="mt-3 text-sm text-amber-400">
                {error ?? 'Checking /api/v1/health...'}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Studio Tiers (@cinemax/shared)
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STUDIO_TYPES.map((tier) => (
                <span
                  key={tier}
                  className={
                    tier === 'premier'
                      ? 'rounded-md border border-burgundy-700 bg-burgundy-900/80 px-2.5 py-1 text-xs font-bold uppercase text-gold-400'
                      : 'rounded-md border border-white/10 bg-elevated px-2.5 py-1 text-xs font-medium uppercase text-zinc-200'
                  }
                >
                  {tier}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

`/mnt/d/new-cinema/apps/client/src/pages/WorkspacePreviewPage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { USER_ROLES, type HealthData } from '@cinemax/shared';
import { apiRequest } from '../lib/api';

export function WorkspacePreviewPage() {
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    apiRequest<HealthData>('/health')
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">API & Database Health</p>
          <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {health ? `${health.db.toUpperCase()} (${health.latencyMs}ms)` : 'OFFLINE'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">Sample POS Price Readability</p>
          <p className="mt-2 font-display text-2xl font-bold text-burgundy-800 tabular-nums">
            Rp 150.000
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">Registered Roles</p>
          <p className="mt-2 font-display text-2xl font-bold text-gold-600 tabular-nums">
            {USER_ROLES.length} Roles
          </p>
        </div>
      </div>
    </div>
  );
}
```

`/mnt/d/new-cinema/apps/client/src/App.tsx`:
```tsx
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { CinemaLayout } from './layouts/CinemaLayout';
import { WorkspaceLayout } from './layouts/WorkspaceLayout';
import { CinemaPreviewPage } from './pages/CinemaPreviewPage';
import { WorkspacePreviewPage } from './pages/WorkspacePreviewPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<CinemaLayout />}>
          <Route path="/" element={<CinemaPreviewPage />} />
        </Route>
        <Route element={<WorkspaceLayout />}>
          <Route path="/workspace-preview" element={<WorkspacePreviewPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

`/mnt/d/new-cinema/apps/client/src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

**Step 4: Install dependency client, jalankan typecheck & production build**

Run: `npm install && npm run build`
Expected: PASS — `@cinemax/shared`, `@cinemax/server`, dan `@cinemax/client` berhasil di-build tanpa error TypeScript maupun Vite.

---

### Task 6: Verifikasi End-to-End dengan Docker PostgreSQL Live

**Objective:** Menyalakan container `cinemax-db`, menjalankan migrasi Drizzle ke PostgreSQL nyata, dan membuktikan endpoint `GET /api/v1/health` mengembalikan `db: "connected"` (HTTP 200) baik langsung ke server maupun lewat Vite proxy.

**Files:**
- Modify: Tidak ada file baru (verifikasi integrasi penuh atas artefak Tasks 1–5).

**Step 1: Nyalakan PostgreSQL di Docker & tunggu status healthy**

Run: `docker compose up -d && docker compose ps`
Expected: Container `cinemax-db` berstatus `Up (healthy)` pada `127.0.0.1:5432`.

**Step 2: Jalankan migrasi Drizzle ke database `cinemax_db`**

Run: `npm run db:migrate`
Expected: Migrasi `0000` sukses dieksekusi; enum `user_role` terdaftar di PostgreSQL.

**Step 3: Verifikasi `npm test` dan bukti langsung `curl` ke `/api/v1/health`**

Run:
1. `npm test` -> Expected: Semua test `@cinemax/shared` dan `@cinemax/server` PASS.
2. Jalankan server sementara dan uji dengan `curl -i http://127.0.0.1:4000/api/v1/health` -> Expected: HTTP `200` dengan `{"data":{"service":"cinemax-api","status":"ok","db":"connected",...}}`.
3. (Opsional — HANYA jika diminta user): Commit artefak kode Plan 01 tanpa menyertakan file `.md` di `docs/`.
