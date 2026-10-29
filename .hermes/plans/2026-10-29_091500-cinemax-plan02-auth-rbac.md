# CINEMAX Plan 02 — Authentication & RBAC Implementation Plan

> **For Hermes:** Implement this plan task-by-task using TDD. **PENTING:** Jangan menjalankan `git init` atau `git commit` tanpa perintah eksplisit user, dan jangan pernah mencatat `req.body`, password, token sesi, atau PII ke console log.

**Goal:** Membangun sistem autentikasi penuh berbasis sesi PostgreSQL + cookie `HttpOnly` (`cx_session`), hashing password murni dengan `node:crypto` (`scrypt` + `timingSafeEqual`), pemisahan keras endpoint login Pelanggan (`/auth/login`, `/auth/register`) vs Staf/Admin (`/auth/staff/login`), middleware RBAC 7 role, seeder 7 akun default, serta halaman Login/Register Dual-Surface dan route guard di React.

**Architecture:** Skema validasi input dan tipe `AuthUser` ditempatkan satu sumber di `@cinemax/shared`. Di `@cinemax/server`, token sesi 32-byte acak dikirim via cookie `HttpOnly` dan disimpan sebagai hash `SHA-256` di tabel `sessions` sehingga kebocoran DB tidak membocorkan sesi aktif. Di `@cinemax/client`, `AuthProvider` memuat `/api/v1/auth/me` saat startup dan membungkus rute publik (`CinemaLayout` Dark Obsidian+Gold+Burgundy) serta rute kerja internal (`WorkspaceLayout` Light Burgundy+Gold) melalui komponen guard deklaratif.

**Tech Stack:** Node.js 22 (`node:crypto`, `node:test`), Express 5, Drizzle ORM + PostgreSQL 16, Zod, React 19, React Router 7, Tailwind CSS v4.

---

### Task 1: Ekspansi `@cinemax/shared` untuk Skema Auth & Helper Role Staf (TDD)

**Objective:** Menambahkan `STAFF_ROLES`, `isStaffRole`, `authUserSchema`, `registerInputSchema`, dan `loginInputSchema` ke `@cinemax/shared`.

**Files:**
- Modify: `/mnt/d/new-cinema/packages/shared/src/enums.ts`
- Create: `/mnt/d/new-cinema/packages/shared/src/schemas/auth.ts`
- Modify: `/mnt/d/new-cinema/packages/shared/src/index.ts`
- Modify: `/mnt/d/new-cinema/packages/shared/src/__tests__/shared.test.ts`

**Verification:**
Run: `npm -w @cinemax/shared test && npm run build:shared`
Expected: Semua test shared PASS (termasuk validasi ketidakcocokan `passwordConfirmation` dan helper `isStaffRole`).

---

### Task 2: Utilitas Kriptografi (`scrypt` & `SHA-256`) dan Cookie Parser/Setter di `@cinemax/server` (TDD)

**Objective:** Membuat utilitas hash/verifikasi password timing-safe, generator/hasher token sesi, dan parser/setter cookie `cx_session` tanpa dependency eksternal.

**Files:**
- Create: `/mnt/d/new-cinema/apps/server/src/lib/crypto.ts`
- Create: `/mnt/d/new-cinema/apps/server/src/lib/cookies.ts`
- Test: `/mnt/d/new-cinema/apps/server/src/__tests__/crypto.test.ts`

**Verification:**
Run: `npm -w @cinemax/server test`
Expected: `crypto.test.ts` PASS (random salt menghasilkan hash berbeda, password benar valid, password salah ditolak, cookie header dengan karakter URL-encoded atau malformed terurai aman).

---

### Task 3: Skema Drizzle `users` & `sessions` + Migrasi Database `0001`

**Objective:** Menambahkan tabel `users` dan `sessions` pada `apps/server/src/db/schema.ts`, men-generate migrasi SQL `0001`, dan menerapkannya ke `cinemax-db`.

**Files:**
- Modify: `/mnt/d/new-cinema/apps/server/src/db/schema.ts`
- Create: `/mnt/d/new-cinema/apps/server/drizzle/0001_*.sql` (via `drizzle-kit generate`)

**Verification:**
Run: `npm run db:generate && npm run db:migrate`
Expected: Tabel `users` dan `sessions` terbentuk di PostgreSQL `cinemax_db`.

---

### Task 4: Auth Service, Middleware RBAC (`requireAuth` / `requireRole`), & Endpoint Auth Terpisah (TDD)

**Objective:** Mengimplementasikan `authService` (repositori Drizzle + injeksi store untuk test), middleware `requireAuth` & `requireRole`, serta endpoint `/api/v1/auth/register`, `/auth/login`, `/auth/staff/login`, `/auth/me`, `/auth/logout`, dan `/api/v1/staff/ping`.

**Files:**
- Create: `/mnt/d/new-cinema/apps/server/src/services/auth-service.ts`
- Create: `/mnt/d/new-cinema/apps/server/src/middleware/auth.ts`
- Create: `/mnt/d/new-cinema/apps/server/src/routes/auth.ts`
- Modify: `/mnt/d/new-cinema/apps/server/src/app.ts`
- Test: `/mnt/d/new-cinema/apps/server/src/__tests__/auth.test.ts`

**Verification:**
Run: `npm -w @cinemax/server test && npm -w @cinemax/server run typecheck`
Expected: Semua skenario `auth.test.ts` PASS (`201` register + cookie `HttpOnly`, blokir staf `403` di `/auth/login`, blokir pelanggan `403` di `/auth/staff/login`, RBAC `200` vs `403` di `/staff/ping`, pencabutan sesi setelah `/auth/logout`).

---

### Task 5: Seeder Idempotent 7 Akun Role Default (`npm run db:seed`)

**Objective:** Menyediakan skrip `seed.ts` untuk mengisi 7 akun default (`admin`, `manager`, `cashier`, `fnb_staff`, `cleaner`, `staff`, `user`) dengan aman (`onConflictDoNothing`).

**Files:**
- Create: `/mnt/d/new-cinema/apps/server/src/db/seed.ts`
- Modify: `/mnt/d/new-cinema/apps/server/package.json`
- Modify: `/mnt/d/new-cinema/package.json`

**Verification:**
Run: `npm run db:seed`
Expected: 7 akun terdaftar di tabel `users` `cinemax_db`, dan pemanggilan ulang kedua kali tetap aman (idempotent).

---

### Task 6: Frontend `AuthContext`, Route Guards, & Halaman Login/Register Dual-Surface

**Objective:** Mengintegrasikan state autentikasi, guard rute publik vs staf, halaman `/login` & `/register` pelanggan (Dark Obsidian + Warm Gold + Deep Burgundy), serta `/admin/login` & `/admin` staf (Light Burgundy + Gold).

**Files:**
- Create: `/mnt/d/new-cinema/apps/client/src/context/AuthContext.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/components/RouteGuards.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/pages/auth/CustomerLoginPage.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/pages/auth/CustomerRegisterPage.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/pages/auth/StaffLoginPage.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/pages/admin/WorkspaceDashboardPage.tsx`
- Modify: `/mnt/d/new-cinema/apps/client/src/layouts/CinemaLayout.tsx`
- Modify: `/mnt/d/new-cinema/apps/client/src/layouts/WorkspaceLayout.tsx`
- Modify: `/mnt/d/new-cinema/apps/client/src/App.tsx`

**Verification:**
Run: `npm run build && npm test`
Expected: Seluruh workspace lulus `tsc` + `vite build` dan seluruh test lulus.

---

### Task 7: Verifikasi End-to-End Live dengan `curl` Cookie Jar terhadap `cinemax-db`

**Objective:** Membuktikan alur login pelanggan, blokir silang portal, login staf, pengecekan RBAC `/staff/ping`, `/auth/me`, dan `/auth/logout` secara nyata di atas server & PostgreSQL live menggunakan `curl`.

**Verification:**
- `POST /api/v1/auth/login` memakai akun `admin@cinemax.local` -> HTTP `403` (`STAFF_MUST_USE_STAFF_PORTAL`).
- `POST /api/v1/auth/staff/login` memakai akun `user@cinemax.local` -> HTTP `403` (`CUSTOMER_FORBIDDEN`).
- `POST /api/v1/auth/staff/login` memakai akun `admin@cinemax.local` -> HTTP `200` + cookie `cx_session` -> `GET /api/v1/staff/ping` HTTP `200` -> `POST /api/v1/auth/logout` HTTP `200` -> `GET /api/v1/auth/me` HTTP `401`.
