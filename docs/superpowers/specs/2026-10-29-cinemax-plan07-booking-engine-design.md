# CINEMAX — Plan 07 Booking Engine & Seat Lock Design Spec

Tanggal: 2026-10-29
Ketergantungan: Plan 01, Plan 02, Plan 04, Plan 05, Plan 06
Target: Booking Engine terpisah header transaksi (`bookings`) dan item kursi (`booking_seats`), penahanan kursi atomik anti-race-condition (10 menit TTL), PostgreSQL Partial Unique Index untuk kursi aktif, serta UI denah kursi interaktif di web publik.

---

## 1. Tujuan & Perbaikan Arsitektur

1. **Header + Item Kursi Terpisah:**
   - 1 transaksi pemesanan (1 sampai 6 tiket) memiliki 1 kode booking utama berformat `CX-XXXXXX` (misal `CX-98A2F1`).
   - Setiap kursi disimpan dalam tabel `booking_seats` berelasi ke `booking_id` dan `showtime_id`.
2. **Partial Unique Index PostgreSQL:**
   - Index unik `ON booking_seats (showtime_id, seat_code) WHERE (is_active = true)` menjamin integritas tingkat database: tidak ada dua transaksi aktif yang dapat memiliki kursi yang sama di penayangan yang sama.
   - Saat status booking kedaluwarsa (`expired`) atau dibatalkan (`cancelled`), flag `is_active` diubah menjadi `false`, membebaskan kursi seketika tanpa melanggar constraint riwayat masa lalu.
3. **Seat Lock Sementara (10 Menit):**
   - Menggunakan atomisitas database (`SELECT ... FOR UPDATE`) saat memverifikasi dan mengunci kursi.
   - Status awal saat pelanggan memilih kursi adalah `held` dengan `held_expires_at = now() + 10 menit`.

---

## 2. Skema Database Baru (`apps/server/src/db/schema.ts`, Migrasi `0005`)

1. **`bookingStatusEnum`:** `pgEnum('booking_status', ['held', 'booked', 'paid', 'redeemed', 'cancelled', 'expired'])`
2. **`paymentMethodEnum`:** `pgEnum('payment_method', ['cash', 'qris'])`
3. **Tabel `bookings`:**
   - `id`: `serial` PK
   - `bookingCode`: `varchar('booking_code', { length: 32 }).notNull().unique()`
   - `userId`: `integer('user_id').references(() => users.id, { onDelete: 'set null' })` (nullable untuk walk-in kasir tanpa akun)
   - `cashierId`: `integer('cashier_id').references(() => users.id, { onDelete: 'set null' })`
   - `showtimeId`: `integer('showtime_id').notNull().references(() => showtimes.id, { onDelete: 'restrict' })`
   - `status`: `bookingStatusEnum('status').notNull().default('held')`
   - `totalSeats`: `integer('total_seats').notNull()`
   - `totalPrice`: `integer('total_price').notNull()`
   - `paymentMethod`: `paymentMethodEnum('payment_method')` nullable
   - `heldExpiresAt`: `timestamp('held_expires_at', { withTimezone: true })` nullable
   - `paidAt`: `timestamp('paid_at', { withTimezone: true })` nullable
   - `redeemedAt`: `timestamp('redeemed_at', { withTimezone: true })` nullable
   - `createdAt`, `updatedAt`: `timestamptz`
4. **Tabel `booking_seats`:**
   - `id`: `serial` PK
   - `bookingId`: `integer('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' })`
   - `showtimeId`: `integer('showtime_id').notNull().references(() => showtimes.id, { onDelete: 'restrict' })`
   - `seatCode`: `varchar('seat_code', { length: 10 }).notNull()`
   - `price`: `integer('price').notNull()`
   - `isActive`: `boolean('is_active').notNull().default(true)`
   - `createdAt`: `timestamp('created_at', { withTimezone: true }).notNull().defaultNow()`
   - Index komposit `(showtimeId, isActive)`.

---

## 3. Kontrak API Backend (`/api/v1/booking/*`)

1. `GET /api/v1/booking/showtimes/:showtimeId/seats`:
   - Mengembalikan detail showtime (film, studio, jam, harga tiket) dan peta seluruh kursi studio dengan status masing-masing:
     - `available`: kursi aktif studio yang belum dipesan/dikunci.
     - `occupied`: kursi yang sudah berstatus `booked`, `paid`, atau `redeemed`.
     - `held`: kursi yang sedang dikunci transaksi lain dan `held_expires_at > now()`.
     - `disabled`: kursi lorong/rusak bawaan konfigurasi studio.
2. `POST /api/v1/booking/hold` (Wajib Login Pelanggan `requireAuth`):
   - Menerima `{ showtimeId, seatCodes: string[] }` (1 hingga 6 kursi).
   - Di dalam transaksi DB:
     - Bersihkan kursi kedaluwarsa showtime terkait yang `held_expires_at < now()`.
     - Kunci baris kursi (`SELECT ... FOR UPDATE`).
     - Jika ada kursi yang sedang `is_active = true` -> tolak `409 SEATS_UNAVAILABLE` dengan daftar kursi yang bentrok.
     - Buat header `bookings` (`status = 'held'`, `heldExpiresAt = now() + 10m`) dan detail `booking_seats` (`isActive = true`).
   - Mengembalikan data booking terperinci beserta sisa detik TTL.
3. `POST /api/v1/booking/:bookingCode/cancel` (Auth Pelanggan):
   - Batalkan penahanan kursi sebelum 10 menit, set `status = 'cancelled'`, dan ubah `is_active = false` pada seluruh `booking_seats`.
4. `GET /api/v1/booking/:bookingCode` (Auth Pelanggan):
   - Cek detail booking terkini dan sisa waktu pembayaran.
