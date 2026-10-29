# CINEMAX Plan 07 — Booking Engine & Seat Lock Implementation Plan

> **For Hermes:** Implement this plan task-by-task using TDD. **PENTING:** Gunakan PostgreSQL Partial Unique Index `ON booking_seats (showtime_id, seat_code) WHERE is_active = true`, jaga batas maksimal 6 kursi per transaksi, dan jangan pernah mencatat PII ke log.

**Goal:** Membangun booking engine yang memisahkan tabel header transaksi (`bookings`) dan item kursi (`booking_seats`), penahanan kursi sementara (10 menit TTL) anti-race-condition, serta antarmuka web pemilihan kursi bioskop di `/booking/:showtimeId`.

**Architecture:** Kontrak skema `booking` dan validasi input di `@cinemax/shared`. Di `@cinemax/server`, `bookingService` mengelola transaksi PostgreSQL atomik dengan `SELECT ... FOR UPDATE` untuk mencegah bentrok dua orang memilih kursi yang sama dalam milidetik yang sama, otomatis membebaskan kursi yang melewati batas waktu 10 menit. Di `@cinemax/client`, halaman `/booking/:showtimeId` menyajikan denah kursi interaktif di permukaan `cinema` (Dark Obsidian + Gold + Burgundy), panel ringkasan kalkulasi harga tiket, dan timer hitung mundur.

**Tech Stack:** Node.js 22, Express 5, Drizzle ORM + PostgreSQL 16, Zod, React 19, React Router 7, Tailwind CSS v4.

---

### Task 1: Skema Booking di `@cinemax/shared` (TDD)

**Objective:** Menambahkan skema Zod `holdSeatsInputSchema`, `seatMapSlotSchema`, `seatMapResponseSchema`, dan `bookingDetailSchema`.

**Files:**
- Create: `/mnt/d/new-cinema/packages/shared/src/schemas/booking.ts`
- Modify: `/mnt/d/new-cinema/packages/shared/src/index.ts`
- Modify: `/mnt/d/new-cinema/packages/shared/src/__tests__/shared.test.ts`

**Verification:**
Run: `npm -w @cinemax/shared test && npm run build:shared`
Expected: PASS seluruh test shared.

---

### Task 2: Skema Drizzle `bookings`, `booking_seats`, & Migrasi PostgreSQL `0005`

**Objective:** Menambahkan `bookingStatusEnum`, `paymentMethodEnum`, tabel `bookings`, dan tabel `booking_seats` dengan Partial Unique Index di Drizzle ORM, lalu mengeksekusi migrasi ke PostgreSQL `cinemax-db`.

**Files:**
- Modify: `/mnt/d/new-cinema/apps/server/src/db/schema.ts`
- Create: `/mnt/d/new-cinema/apps/server/drizzle/0005_*.sql` (via `drizzle-kit generate`)

**Verification:**
Run: `npm run db:generate && npm run db:migrate`
Expected: Tabel `bookings` dan `booking_seats` terbentuk di PostgreSQL `cinemax_db`.

---

### Task 3: `BookingService`, Rute `/api/v1/booking/*`, & Test Backend (TDD)

**Objective:** Mengimplementasikan service penahanan kursi atomik, pembebasan kursi kedaluwarsa otomatis, rute `/api/v1/booking/*`, dan pengujian skenario konkurensi/bentrok kursi.

**Files:**
- Create: `/mnt/d/new-cinema/apps/server/src/services/booking-service.ts`
- Create: `/mnt/d/new-cinema/apps/server/src/routes/booking.ts`
- Modify: `/mnt/d/new-cinema/apps/server/src/app.ts`
- Test: `/mnt/d/new-cinema/apps/server/src/__tests__/booking.test.ts`

**Verification:**
Run: `npm -w @cinemax/server test && npm -w @cinemax/server run typecheck`
Expected: Semua test `booking.test.ts` PASS (termasuk penolakan 409 saat kursi sedang di-hold orang lain, pembebasan kursi otomatis setelah expired, dan pembatalan manual).

---

### Task 4: Halaman Pemilihan Kursi Bioskop (`BookingPage`) di Frontend

**Objective:** Membangun halaman `/booking/:showtimeId` lengkap dengan denah kursi dinamis (kursi tersedia, dipilih, occupied, dan held), panel ringkasan pemesanan, dan pengalihan ke pembayaran.

**Files:**
- Create: `/mnt/d/new-cinema/apps/client/src/pages/public/BookingPage.tsx`
- Modify: `/mnt/d/new-cinema/apps/client/src/App.tsx`

**Verification:**
Run: `npm run build && npm test`
Expected: TypeScript compile, Vite build, dan seluruh test suite PASS.

---

### Task 5: Verifikasi Live End-to-End (`curl`) terhadap PostgreSQL `cinemax-db`

**Objective:** Membuktikan secara nyata dengan dua user konkuren bahwa kursi yang di-hold user A tidak dapat diambil oleh user B (HTTP 409), dan langsung bisa diambil setelah user A membatalkan hold (HTTP 200).
