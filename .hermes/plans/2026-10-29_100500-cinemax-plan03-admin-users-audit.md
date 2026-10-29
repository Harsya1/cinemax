# CINEMAX Plan 03 — Generic Admin Framework, User CRUD, & Audit Logs Implementation Plan

> **For Hermes:** Implement this plan task-by-task using TDD. **PENTING:** Jangan menjalankan `git init` atau `git commit` tanpa instruksi eksplisit user, pertahankan semantik `colSpan` (`1 = Penuh`, `2 = Setengah`), dan jangan pernah mencetak `req.body` atau PII ke log.

**Goal:** Membangun kerangka Admin generik pengganti Filament (`DataTable` + `ResourceModalForm` berbasis `<dialog>` native), tabel dan pencatat `audit_logs`, serta modul manajemen User (`admin` full CRUD + pencabutan sesi instan saat nonaktif; `manager` read-only) dan Audit Logs di Workspace Light.

**Architecture:** Kontrak skema paginasi, form user admin, dan baris audit ditaruh terpusat di `@cinemax/shared`. Di `@cinemax/server`, `adminUserService` menangani CRUD user, mencegah `admin` mengunci/menghapus dirinya sendiri, langsung menghapus baris `sessions` saat staf dinonaktifkan (`isActive = false`), dan mencatat setiap mutasi ke `audit_logs`. Di `@cinemax/client`, `DataTable` dan `ResourceModalForm` dibangun tanpa library pihak ketiga tambahan dan langsung digunakan oleh `/admin/users` serta `/admin/audit-logs`.

**Tech Stack:** Node.js 22 (`node:test`), Express 5, Drizzle ORM + PostgreSQL 16, Zod, React 19, React Router 7, Tailwind CSS v4.

---

### Task 1: Skema Admin & Audit di `@cinemax/shared` (TDD)

**Objective:** Menambahkan `paginationMetaSchema`, `adminUserListQuerySchema`, `adminCreateUserSchema`, `adminUpdateUserSchema`, `adminUserRowSchema`, `auditLogQuerySchema`, dan `auditLogRowSchema`.

**Files:**
- Create: `/mnt/d/new-cinema/packages/shared/src/schemas/admin.ts`
- Modify: `/mnt/d/new-cinema/packages/shared/src/index.ts`
- Modify: `/mnt/d/new-cinema/packages/shared/src/__tests__/shared.test.ts`

**Verification:**
Run: `npm -w @cinemax/shared test && npm run build:shared`
Expected: PASS (password kosong pada `adminUpdateUserSchema` diubah menjadi `undefined`, sedangkan password < 8 karakter ditolak).

---

### Task 2: Skema Drizzle `audit_logs` & Migrasi PostgreSQL `0002`

**Objective:** Menambahkan tabel `audit_logs` dengan relasi opsional `actor_id -> users.id (ON DELETE SET NULL)` dan indeks waktu/aksi, lalu menerapkan migrasi ke `cinemax-db`.

**Files:**
- Modify: `/mnt/d/new-cinema/apps/server/src/db/schema.ts`
- Create: `/mnt/d/new-cinema/apps/server/drizzle/0002_*.sql` (via `drizzle-kit generate`)

**Verification:**
Run: `npm run db:generate && npm run db:migrate`
Expected: Tabel `audit_logs` terbentuk di `cinemax_db`.

---

### Task 3: `AdminUserService`, Pencabutan Sesi Instan, & Endpoint `/api/v1/admin/*` (TDD)

**Objective:** Mengimplementasikan `GET/POST/PATCH/DELETE /api/v1/admin/users` dan `GET /api/v1/admin/audit-logs` dengan matriks izin `admin` vs `manager`, pengaman self-lockout/self-delete, pencabutan sesi instan saat `isActive: false`, dan pencatatan audit otomatis.

**Files:**
- Create: `/mnt/d/new-cinema/apps/server/src/services/admin-user-service.ts`
- Create: `/mnt/d/new-cinema/apps/server/src/routes/admin-users.ts`
- Modify: `/mnt/d/new-cinema/apps/server/src/app.ts`
- Test: `/mnt/d/new-cinema/apps/server/src/__tests__/admin-users.test.ts`

**Verification:**
Run: `npm -w @cinemax/server test && npm -w @cinemax/server run typecheck`
Expected: Semua skenario `admin-users.test.ts` PASS (CRUD admin + jejak `audit_logs`, manager read-only `200`/`403`, cashier `403`, self-delete/lockout `400`, serta staf yang dinonaktifkan langsung kehilangan sesi aktif `401`).

---

### Task 4: Komponen Generik `DataTable` & `ResourceModalForm` + Halaman `/admin/users` & `/admin/audit-logs`

**Objective:** Membangun komponen tabel dan modal form reusable di `@cinemax/client`, menambahkan `apiRequestWithMeta`, serta mengaktifkan halaman manajemen User dan Audit Logs di `WorkspaceLayout`.

**Files:**
- Modify: `/mnt/d/new-cinema/apps/client/src/lib/api.ts`
- Create: `/mnt/d/new-cinema/apps/client/src/components/admin/DataTable.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/components/admin/ResourceModalForm.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/pages/admin/AdminUsersPage.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/pages/admin/AdminAuditLogsPage.tsx`
- Modify: `/mnt/d/new-cinema/apps/client/src/layouts/WorkspaceLayout.tsx`
- Modify: `/mnt/d/new-cinema/apps/client/src/App.tsx`

**Verification:**
Run: `npm run build && npm test`
Expected: Build penuh TypeScript + Vite dan seluruh test suite PASS.

---

### Task 5: Verifikasi End-to-End Live (`curl`) terhadap `cinemax-db`

**Objective:** Membuktikan secara nyata lewat `curl` bahwa pembuatan staf baru, penonaktifan staf (memutus sesi aktifnya), proteksi read-only `manager`, dan pembacaan `audit-logs` berjalan utuh di atas PostgreSQL `cinemax-db`.
