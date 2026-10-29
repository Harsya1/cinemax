# CINEMAX Plan 06 — Public Movies & Watchlist Implementation Plan

> **For Hermes:** Implement this plan task-by-task using TDD. **PENTING:** Jangan menjalankan `git init` atau `git commit` tanpa instruksi user, jaga estetika Dark Obsidian (`#09090B`) + Warm Gold (`#F59E0B`) + Deep Burgundy (`#6B1D2F`), dan jangan pernah mencetak data sensitif/PII ke log.

**Goal:** Membangun seluruh antarmuka web publik sinematik CINEMAX (Landing Page dengan Hero Spotlight, Now Playing, Coming Soon, Movie Details dengan pengelompokan jadwal per tanggal & studio, Modal Trailer YouTube), serta fitur Watchlist pelanggan terintegrasi ke PostgreSQL.

**Architecture:** Kontrak skema respons publik ditaruh di `@cinemax/shared`. Di `@cinemax/server`, `publicMovieService` menggabungkan data live TMDb dan showtimes lokal aktif, mengelompokkan jadwal per tanggal (`YYYY-MM-DD`), dan mengelola tabel `watchlists`. Di `@cinemax/client`, halaman-halaman publik di `CinemaLayout` memuat komponen `TrailerModal`, kartu poster ber-glow halus, tab tanggal penayangan, serta integrasi toggle Watchlist dengan status autentikasi pelanggan.

**Tech Stack:** Node.js 22, Express 5, Drizzle ORM + PostgreSQL 16, Zod, React 19, React Router 7, Tailwind CSS v4.

---

### Task 1: Skema Public Movies & Watchlist di `@cinemax/shared` (TDD)

**Objective:** Menambahkan skema Zod `publicMovieSummarySchema`, `publicNowPlayingResponseSchema`, `publicMovieDetailSchema`, `watchlistToggleSchema`, dan `watchlistRowSchema`.

**Files:**
- Create: `/mnt/d/new-cinema/packages/shared/src/schemas/public-movies.ts`
- Modify: `/mnt/d/new-cinema/packages/shared/src/index.ts`
- Modify: `/mnt/d/new-cinema/packages/shared/src/__tests__/shared.test.ts`

**Verification:**
Run: `npm -w @cinemax/shared test && npm run build:shared`
Expected: PASS seluruh test shared.

---

### Task 2: Skema Drizzle `watchlists` & Migrasi PostgreSQL `0004`

**Objective:** Menambahkan tabel `watchlists` dengan foreign key `user_id -> users.id (ON DELETE CASCADE)` dan unique composite index `(userId, tmdbId)`.

**Files:**
- Modify: `/mnt/d/new-cinema/apps/server/src/db/schema.ts`
- Create: `/mnt/d/new-cinema/apps/server/drizzle/0004_*.sql` (via `drizzle-kit generate`)

**Verification:**
Run: `npm run db:generate && npm run db:migrate`
Expected: Tabel `watchlists` terbentuk di PostgreSQL `cinemax_db`.

---

### Task 3: `PublicMovieService`, Rute `/api/v1/public/*`, & Test Backend (TDD)

**Objective:** Mengimplementasikan service publik (Now Playing, Coming Soon, Detail Film + Showtimes aktif terkelompok, Watchlist toggle/list) dan rutenya.

**Files:**
- Create: `/mnt/d/new-cinema/apps/server/src/services/public-movie-service.ts`
- Create: `/mnt/d/new-cinema/apps/server/src/routes/public-movies.ts`
- Modify: `/mnt/d/new-cinema/apps/server/src/app.ts`
- Test: `/mnt/d/new-cinema/apps/server/src/__tests__/public-movies.test.ts`

**Verification:**
Run: `npm -w @cinemax/server test && npm -w @cinemax/server run typecheck`
Expected: Semua test `public-movies.test.ts` PASS.

---

### Task 4: Komponen Publik (`TrailerModal`) & Halaman Sinematik (`LandingPage`, `ComingSoonPage`, `MovieDetailsPage`, `WatchlistPage`)

**Objective:** Mengganti rute preview lama di `/` dengan `LandingPage` penuh, membuat halaman `ComingSoonPage`, `MovieDetailsPage`, `WatchlistPage`, memperbarui navigasi `CinemaLayout`, dan mendaftarkan rute di `App.tsx`.

**Files:**
- Create: `/mnt/d/new-cinema/apps/client/src/components/public/TrailerModal.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/pages/public/LandingPage.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/pages/public/ComingSoonPage.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/pages/public/MovieDetailsPage.tsx`
- Create: `/mnt/d/new-cinema/apps/client/src/pages/public/WatchlistPage.tsx`
- Modify: `/mnt/d/new-cinema/apps/client/src/layouts/CinemaLayout.tsx`
- Modify: `/mnt/d/new-cinema/apps/client/src/App.tsx`

**Verification:**
Run: `npm run build && npm test`
Expected: TypeScript compile, Vite build, dan seluruh test suite PASS.

---

### Task 5: Verifikasi Live End-to-End (`curl`) terhadap TMDb & `cinemax-db`

**Objective:** Membuktikan via `curl` bahwa endpoint `/api/v1/public/movies/now-playing`, `/coming-soon`, `/movies/:id`, dan `/watchlist/toggle` berfungsi utuh.
