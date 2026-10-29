# CINEMAX — Peta Master 10 Plan (Fase 1 & Fase 2)

Dokumen ini menjadi indeks acuan untuk 10 plan terisolasi pada gelombang pertama rework `cinema-xxl` (Laravel + Filament) menjadi **CINEMAX** (Node.js Express + Drizzle PostgreSQL + React Vite Tailwind v4). Modul FnB, Service, dan Ceklog Karyawan masuk ke gelombang berikutnya (Fase 3–5).

Spesifikasi desain acuan: `docs/superpowers/specs/2026-10-29-cinemax-plan01-foundation-design.md`

## Aturan Lintas-Plan
- **Database:** PostgreSQL 16 Alpine di Docker (`cinemax-db` dengan named volume agar aman di WSL `/mnt/d`); Node.js & Vite berjalan native di WSL.
- **Keamanan Log:** Dilarang mencetak `req.body` atau PII ke `console.log`/`console.error`.
- **Disiplin Git:** Jangan menjalankan `git init` / `git commit` / `git push` tanpa instruksi eksplisit dari user; jangan commit file `.md` dokumentasi kecuali diminta.
- **Prinsip Ponytail (YAGNI):** Single-location cinema; gunakan stdlib (`fetch`, `node:test`, `node:crypto`) sebelum menambah library eksternal.

---

## Daftar 10 Plan

### Plan 01 — Monorepo Setup, Fondasi DB, & Sistem Token Brand CINEMAX
- **Status:** Selesai & terverifikasi (`.hermes/plans/2026-10-29_084600-cinemax-plan01-foundation.md`)
- **Cakupan:** npm workspaces (`@cinemax/shared`, `@cinemax/server`, `@cinemax/client`), Docker PostgreSQL, Drizzle setup + migrasi enum `user_role`, kontrak amplop API + global error handler, `GET /api/v1/health`, dan Dual-Surface CSS Token (`cinema` Dark Obsidian+Gold+Burgundy vs `workspace` Light Burgundy+Gold).

### Plan 02 — Autentikasi & RBAC 6+1 Role
- **Status:** Selesai & terverifikasi (`.hermes/plans/2026-10-29_091500-cinemax-plan02-auth-rbac.md`)
- **Ketergantungan:** Plan 01
- **Tabel Baru:** `users` (`id`, `name`, `email`, `password_hash`, `role`, `points`, timestamps), `sessions` (HTTP-only cookie session).
- **Cakupan:** Hash password (`node:crypto` `scrypt`), endpoint `POST /api/v1/auth/register`, `login`, `logout`, `GET /api/v1/auth/me`, middleware `requireAuth` & `requireRole(...)`, halaman Login/Register CINEMAX, serta route guard FE untuk area publik terautentikasi vs Admin/POS.

### Plan 03 — Kerangka Admin Generik (Pengganti Filament) + CRUD User & Audit Log
- **Status:** Selesai & terverifikasi (`.hermes/plans/2026-10-29_100500-cinemax-plan03-admin-users-audit.md`)
- **Ketergantungan:** Plan 02
- **Tabel Baru:** `audit_logs` (`id`, `user_id`, `action`, `description`, `created_at`).
- **Cakupan:** Komponen generik `DataTable` (pencarian, paginasi, kolom deklaratif) dan `ResourceModalForm` di `WorkspaceLayout` Light, helper pencatat audit di BE, serta modul Admin Users & Audit Logs beserta seeder akun default per role.

### Plan 04 — Master Studio & Konfigurasi Denah Kursi
- **Status:** Selesai & terverifikasi (`.hermes/plans/2026-10-29_102500-cinemax-plan04-05-studios-tmdb-showtimes.md`)
- **Ketergantungan:** Plan 03
- **Tabel Baru:** `studios` (`id`, `name`, `type` [`regular` | `3d` | `premier`], `rows_count`, `cols_count`, `disabled_seats` JSONB, `total_seats`, `base_price`).
- **Cakupan:** CRUD Studio di Admin Light + editor preview grid kursi interaktif (badge Burgundy khusus tipe `premier`).

### Plan 05 — Service TMDb API, Katalog Film Lokal, & Penjadwalan Showtime
- **Status:** Selesai & terverifikasi (`.hermes/plans/2026-10-29_102500-cinemax-plan04-05-studios-tmdb-showtimes.md`)
- **Ketergantungan:** Plan 04
- **Tabel Baru:** `movies` (cache metadata TMDb lokal agar hemat kuota & cepat join), `showtimes` (`id`, `movie_id`, `studio_id`, `start_time`, `end_time`, `price`).
- **Cakupan:** Service TMDb di BE (search, detail, now playing, upcoming), browser import film TMDb di Admin, dan CRUD Showtime dengan validasi anti-bentrok jam tayang pada studio yang sama.

### Plan 06 — Website Publik Film (Landing, Coming Soon, Detail Film, Watchlist)
- **Status:** Selesai & terverifikasi (`.hermes/plans/2026-10-29_110000-cinemax-plan06-public-movies-watchlist.md`)
- **Ketergantungan:** Plan 05
- **Tabel Baru:** `watchlists` (`user_id`, `movie_id`, unique composite).
- **Cakupan:** Implementasi penuh halaman publik `CinemaLayout` (Obsidian + Warm Gold + Deep Burgundy): Hero Spotlight film unggulan, grid Now Playing, halaman Coming Soon, halaman Movie Details (sinopsis, trailer modal, daftar jadwal tayang per tanggal & tipe studio), serta tombol toggle Watchlist.

### Plan 07 — Engine Booking & Seat Lock Anti-Bentrok
- **Status:** Selesai & terverifikasi (`.hermes/plans/2026-10-29_114500-cinemax-plan07-booking-engine.md`)
- **Ketergantungan:** Plan 05, Plan 06
- **Tabel Baru:** `bookings` (header transaksi: `id`, `booking_code` `CX-XXXX`, `user_id`, `cashier_id`, `showtime_id`, `status`, `payment_method`, `total_price`, `expires_at`), `booking_seats` (`id`, `booking_id`, `showtime_id`, `seat_code`, `price`) dengan PostgreSQL *partial unique index* `ON (showtime_id, seat_code) WHERE active`.
- **Cakupan:** Endpoint ketersediaan kursi real-time, penahanan kursi sementara (misal TTL 10 menit, maks 6 kursi per transaksi), pembebasan kursi kedaluwarsa otomatis, dan UI pemilih kursi interaktif di web publik.

### Plan 08 — Pembayaran Web, E-Ticket QR + PDF, Poin Member, & Profil User
- **Ketergantungan:** Plan 07
- **Cakupan:** Penyelesaian pembayaran booking web (Cash di kasir / simulasi QRIS), kalkulasi & penambahan poin member saat `paid`, generator kode QR & unduh E-Ticket PDF berdesain tiket perforasi CINEMAX, serta halaman User Profile (tab My Tickets, QR Modal, & My Watchlist).

### Plan 09 — Ticket POS Kasir (Walk-in Cepat & Cetak Stub)
- **Ketergantungan:** Plan 07, Plan 08
- **Cakupan:** Antarmuka khusus `/pos/ticket` di surface Light ergonomis untuk role `cashier`/`manager`/`admin`: pilih film & jam tayang hari ini dalam 1 layar, klik kursi tersedia, proses bayar instan (`paid`), dan tampilan cetak thermal/stub tiket (`print-stub`).

### Plan 10 — Pemindaian/Redeem Tiket & Dashboard Operasional Harian
- **Ketergantungan:** Plan 08, Plan 09
- **Cakupan:** Fitur input/scan `booking_code` QR untuk mengubah status `paid` menjadi `redeemed` (anti-pakai-ulang), pembatalan booking beserta pelepasan kursi otomatis, serta widget Dashboard Admin/Manager/Cashier (`StatsOverview`, `TodayShowtimes`, `LatestBookings`).
