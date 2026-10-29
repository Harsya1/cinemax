# CINEMAX Plan 04 & 05 Combined — Studios, Seat Grid, TMDb Sync, & Showtimes Implementation Plan

> **For Hermes:** Implement this plan task-by-task using TDD. **PENTING:** Jangan menjalankan `git init` atau `git commit` tanpa perintah eksplisit user, gunakan `flatpickr` untuk pemilih tanggal/jam showtime, dan jangan pernah mencetak token TMDb, `req.body`, atau PII ke console log.

**Goal:** Membangun Master Studio lengkap dengan perancang denah kursi interaktif (`regular`, `3d`, `premier` + `disabled_seats`), layanan live TMDb API + sinkronisasi katalog `movies` lokal, serta penjadwalan `showtimes` anti-bentrok berbasis `flatpickr`.

**Architecture:** Perhitungan denah kursi (`generateStudioSeatCodes`), pembangun URL gambar TMDb, dan seluruh skema Zod diletakkan satu sumber di `@cinemax/shared`. Di `@cinemax/server`, `tmdbService` membungkus TMDb v3 API dengan cache memori 15 menit dan fallback bahasa `id-ID` -> `en-US`, sementara `operationsService` mengelola CRUD `studios`, sinkronisasi `movies`, serta validasi anti-overlap `showtimes` (`startTime + runtime + 20m cleaning`) dan pencatatan `audit_logs`. Di `@cinemax/client`, `SeatGridDesigner` dan `FlatpickrDateTimeInput` dipasang ke halaman `/admin/studios`, `/admin/movies`, dan `/admin/showtimes`.

**Tech Stack:** Node.js 22 (`fetch`, `node:test`), Express 5, Drizzle ORM + PostgreSQL 16, Zod, React 19, `flatpickr`, Tailwind CSS v4.

---

### Task 1: Skema Studio, Movie, Showtime, & Seat Grid Helper di `@cinemax/shared` (TDD)

**Objective:** Menambahkan fungsi murni kalkulasi grid kursi (`generateStudioSeatCodes`, `sanitizeDisabledSeats`), helper gambar TMDb (`buildTmdbImageUrl`), dan skema Zod untuk Studio, TMDb Browse, Movie, serta Showtime.

**Files:**
- Create: `/mnt/d/new-cinema/packages/shared/src/schemas/operations.ts`
- Modify: `/mnt/d/new-cinema/packages/shared/src/index.ts`
- Modify: `/mnt/d/new-cinema/packages/shared/src/__tests__/shared.test.ts`

**Verification:**
Run: `npm -w @cinemax/shared test && npm run build:shared`
Expected: Semua test shared PASS (termasuk pemangkasan kursi `disabledSeats` yang berada di luar batas `rowsCount x colsCount` saat ukuran studio diperkecil).

---

### Task 2: Skema Drizzle `studios`, `movies`, `showtimes`, Migrasi `0003`, & Seeder 3 Studio Awal

**Objective:** Menambahkan `studioTypeEnum`, tabel `studios`, `movies`, dan `showtimes` ke Drizzle, menerapkan migrasi `0003` ke `cinemax-db`, serta memperbarui `db:seed` agar mengisi 3 studio default secara idempotent.

**Files:**
- Modify: `/mnt/d/new-cinema/apps/server/src/db/schema.ts`
- Modify: `/mnt/d/new-cinema/apps/server/src/db/seed.ts`
- Create: `/mnt/d/new-cinema/apps/server/drizzle/0003_*.sql` (via `drizzle-kit generate`)

**Verification:**
Run: `npm run db:generate && npm run db:migrate && npm run db:seed`
Expected: Tabel `studios`, `movies`, `showtimes` terbuat dan 3 studio awal (`Regular`, `3D`, `Premier Velvet`) terisi di PostgreSQL.

---

### Task 3: `TmdbService`, `OperationsService` (Anti-Bentrok Showtime), & Rute `/api/v1/admin/*` (TDD)

**Objective:** Mengimplementasikan integrasi TMDb bercache memori, sinkronisasi `movies`, CRUD `studios` (blokir hapus jika dipakai showtime), CRUD `showtimes` (auto-sync `tmdbId`, kalkulasi `runtime + 20m`, deteksi `409 SCHEDULE_CONFLICT`), matriks RBAC (`StudioPolicy` & `ShowtimePolicy`), dan pencatatan `audit_logs`.

**Files:**
- Create: `/mnt/d/new-cinema/apps/server/src/services/tmdb-service.ts`
- Create: `/mnt/d/new-cinema/apps/server/src/services/operations-service.ts`
- Create: `/mnt/d/new-cinema/apps/server/src/routes/admin-operations.ts`
- Modify: `/mnt/d/new-cinema/apps/server/src/app.ts`
- Test: `/mnt/d/new-cinema/apps/server/src/__tests__/operations.test.ts`

**Verification:**
Run: `npm -w @cinemax/server test && npm -w @cinemax/server run typecheck`
Expected: Semua test di `operations.test.ts` PASS (termasuk auto-sync TMDb saat buat showtime, penolakan `409 SCHEDULE_CONFLICT` pada jam bertumpukan di studio sama, izinkan jam sama di studio berbeda, dan RBAC `cleaner`/`cashier`/`admin`).

---

### Task 4: Instalasi `flatpickr` & UI Workspace (`/admin/studios`, `/admin/movies`, `/admin/showtimes`)

**Objective:** Memasang `flatpickr`, membangun `FlatpickrDateTimeInput` dan `SeatGridDesigner`, serta mengaktifkan halaman manajemen Studio, TMDb Movie Browser, dan Showtime di `WorkspaceLayout`.

**Files:**
- Modify: `/mnt/d/new-cinema/apps/client/package.json`
- Create: `/mnt/d/new-cinema/apps/client/src/components/admin/FlatpickrDateTimeInput.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/components/admin/SeatGridDesigner.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/pages/admin/AdminStudiosPage.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/pages/admin/AdminTmdbBrowserPage.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/pages/admin/AdminShowtimesPage.tsx`
- Modify: `/mnt/d/new-cinema/apps/client/src/layouts/WorkspaceLayout.tsx`
- Modify: `/mnt/d/new-cinema/apps/client/src/App.tsx`

**Verification:**
Run: `npm run build && npm test`
Expected: Seluruh workspace lulus typecheck, Vite build, dan test suite.

---

### Task 5: Verifikasi Live End-to-End (`curl`) dengan TMDb Nyata & PostgreSQL `cinemax-db`

**Objective:** Membuktikan via `curl` ke server + `cinemax-db` + TMDb live bahwa:
1. Browse live TMDb mengembalikan daftar film nyata.
2. Membuat showtime dengan `tmdbId` nyata otomatis menyinkronkan film ke tabel `movies` (termasuk `runtimeMinutes` & trailer) dan menghitung `endTime`.
3. Jadwal kedua yang bertumpukan di studio yang sama ditolak `409 SCHEDULE_CONFLICT`.
