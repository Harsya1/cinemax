# CINEMAX — Plan 02 Autentikasi & RBAC Design Spec

Tanggal: 2026-10-29
Ketergantungan: Plan 01 (Monorepo `@cinemax/shared`, `@cinemax/server`, `@cinemax/client`, PostgreSQL `cinemax-db`)
Target: Sistem autentikasi berbasis sesi database + HTTP-only cookie (`node:crypto` murni), pemisahan pintu login Pelanggan vs Staf/Admin, middleware RBAC 7 role di BE, serta halaman Login/Register Dual-Surface & route guard di FE.

---

## 1. Tujuan & Batasan Cakupan (YAGNI)

### Masuk Cakupan Plan 02
- Skema Drizzle tabel `users` dan `sessions` beserta migrasi PostgreSQL (`0001`).
- Utilitas kriptografi murni memakai `node:crypto`:
  - Hashing password dengan `scrypt` + salt acak 16-byte + verifikasi `timingSafeEqual`.
  - Token sesi acak 32-byte (`base64url`) yang disimpan di database hanya sebagai hash `SHA-256` (`token_hash`).
- Pemisahan keras endpoint login sesuai domain pengguna:
  - Pelanggan (`role === 'user'`): `POST /api/v1/auth/register`, `POST /api/v1/auth/login`.
  - Staf/Admin (`role !== 'user'`): `POST /api/v1/auth/staff/login`.
  - Sesi bersama: `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`.
- Middleware Express `attachSession`, `requireAuth`, dan `requireRole(...roles)` beserta endpoint uji proteksi `GET /api/v1/staff/ping`.
- Skrip seeder idempotent (`npm run db:seed`) untuk 7 akun default (`admin`, `manager`, `cashier`, `fnb_staff`, `cleaner`, `staff`, `user`).
- Frontend `AuthProvider` (`useAuth`), 3 route guard (`GuestOnlyRoute`, `CustomerProtectedRoute`, `StaffProtectedRoute`), halaman `/login` & `/register` di surface `cinema` (Dark Obsidian + Warm Gold + Deep Burgundy), serta `/admin/login` & `/admin` di surface `workspace` (Light bersih Burgundy + Gold).

### Di Luar Cakupan Plan 02 (Non-Goals)
- Lupa password berbasis email / SMTP (ditunda sesuai YAGNI; admin dapat mereset password user/staf melalui CRUD User di Plan 03).
- Manajemen CRUD User & tabel `audit_logs` di UI Admin (masuk Plan 03).

---

## 2. Desain Skema Database (`apps/server/src/db/schema.ts`)

### 2.1 Tabel `users`
- `id`: `serial` primary key
- `name`: `varchar(120)` not null
- `email`: `varchar(255)` not null, unique (selalu dinormalisasi ke `trim().toLowerCase()`)
- `passwordHash`: `text('password_hash')` not null
- `phoneNumber`: `varchar('phone_number', { length: 25 })` nullable
- `dateOfBirth`: `date('date_of_birth')` nullable
- `role`: `userRoleEnum('role').notNull().default('user')`
- `points`: `integer('points').notNull().default(0)`
- `isActive`: `boolean('is_active').notNull().default(true)`
- `createdAt`: `timestamp('created_at', { withTimezone: true }).notNull().defaultNow()`
- `updatedAt`: `timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()`

### 2.2 Tabel `sessions`
- `id`: `uuid('id').defaultRandom().primaryKey()`
- `userId`: `integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' })`
- `tokenHash`: `varchar('token_hash', { length: 64 }).notNull().unique()`
- `expiresAt`: `timestamp('expires_at', { withTimezone: true }).notNull()`
- `createdAt`: `timestamp('created_at', { withTimezone: true }).notNull().defaultNow()`
- Index tambahan pada `sessions.userId` untuk pencabutan sesi cepat saat user dinonaktifkan.

---

## 3. Keamanan Kriptografi & Sesi Cookie

1. **Password Hashing (`src/lib/crypto.ts`):**
   - `hashPassword(plain)`: `salt = randomBytes(16).toString('hex')`, `derived = scryptAsync(plain, salt, 64)`, disimpan sebagai `${salt}:${derived.toString('hex')}`.
   - `verifyPassword(plain, stored)`: ekstrak `salt` dan `keyHex`, hitung ulang `scryptAsync`, bandingkan buffer dengan `timingSafeEqual`.
2. **Token Sesi & Cookie (`src/lib/cookies.ts`):**
   - Nama cookie: `cx_session`
   - Masa berlaku: 7 hari (`604800` detik)
   - Atribut cookie: `HttpOnly; Path=/; SameSite=Lax` ditambah `; Secure` saat `NODE_ENV === 'production'`.
   - Saat logout atau sesi kedaluwarsa/user nonaktif (`isActive === false`), baris sesi dihapus dari tabel `sessions` dan browser menerima header penghapus cookie (`Max-Age=0`).
3. **Kerahasiaan Data / Anti-PII Leak:**
   - Objek user yang keluar dari service/endpoint dipetakan melalui `toPublicUser(row)` yang hanya menyertakan `{ id, name, email, phoneNumber, role, points }`. Kolom `passwordHash` tidak pernah meninggalkan layer service.
   - Dilarang keras melakukan `console.log`/`console.error` atas `req.body`, email, nomor telepon, password, maupun raw cookie token.

---

## 4. Kontrak `@cinemax/shared` & Endpoint API

### 4.1 Ekspor Baru di `@cinemax/shared`
- `STAFF_ROLES = ['admin', 'manager', 'cashier', 'fnb_staff', 'cleaner', 'staff'] as const`
- `isStaffRole(role: UserRole): boolean`
- `authUserSchema`: `{ id, name, email, phoneNumber, role, points }`
- `registerInputSchema`: `{ name, email, phoneNumber?, password (min 8), passwordConfirmation }` dengan `.refine` kesamaan konfirmasi password.
- `loginInputSchema`: `{ email, password (min 1) }`

### 4.2 Matriks Endpoint Backend (`/api/v1`)
1. `POST /api/v1/auth/register`
   - Validasi `registerInputSchema`.
   - Tolak `409 EMAIL_TAKEN` jika email sudah terdaftar.
   - Simpan user baru dengan `role = 'user'`, buat sesi di tabel `sessions`, pasang cookie `cx_session`, kembalikan `201 { data: AuthUser }`.
2. `POST /api/v1/auth/login` (Khusus Pelanggan)
   - Validasi `loginInputSchema`.
   - Verifikasi email, password, dan `isActive`. Jika salah -> `401 INVALID_CREDENTIALS`.
   - Jika akun valid tetapi `isStaffRole(user.role)` -> tolak `403 STAFF_MUST_USE_STAFF_PORTAL` tanpa membuat sesi.
   - Buat sesi + set cookie `cx_session`, kembalikan `200 { data: AuthUser }`.
3. `POST /api/v1/auth/staff/login` (Khusus Staf & Admin)
   - Validasi `loginInputSchema`.
   - Verifikasi email, password, dan `isActive`. Jika salah -> `401 INVALID_CREDENTIALS`.
   - Jika akun valid tetapi `user.role === 'user'` -> tolak `403 CUSTOMER_FORBIDDEN` tanpa membuat sesi.
   - Buat sesi + set cookie `cx_session`, kembalikan `200 { data: AuthUser }`.
4. `GET /api/v1/auth/me`
   - Wajib melalui `requireAuth`. Kembalikan `200 { data: AuthUser }` atau `401 UNAUTHORIZED`.
5. `POST /api/v1/auth/logout`
   - Jika cookie `cx_session` ada, hapus hash-nya dari `sessions`. Selalu bersihkan cookie `cx_session` dan kembalikan `200 { data: { loggedOut: true } }`.
6. `GET /api/v1/staff/ping`
   - Diproteksi `requireRole('admin', 'manager')` sebagai pembuktian integrasi RBAC (`200` untuk admin/manager, `403 FORBIDDEN` untuk cashier/user, `401` untuk anonim).

---

## 5. Arsitektur Frontend (`@cinemax/client`)

1. **`AuthContext` (`src/context/AuthContext.tsx`):**
   - Menyimpan `{ user: AuthUser | null, isLoading: boolean }`.
   - Memuat sesi awal via `GET /api/v1/auth/me` saat aplikasi mount.
   - Menyediakan fungsi `loginCustomer`, `registerCustomer`, `loginStaff`, `logout`, dan `refreshSession`.
2. **Route Guards (`src/components/RouteGuards.tsx`):**
   - `GuestOnlyRoute`: sedang loading tampilkan indikator tipis; jika sudah login arahkan pelanggan ke `/` dan staf ke `/admin`.
   - `CustomerProtectedRoute`: jika belum login arahkan ke `/login`; jika staf arahkan ke `/admin`.
   - `StaffProtectedRoute`: menerima prop opsional `allowedRoles?: UserRole[]`. Jika belum login arahkan ke `/admin/login`; jika `user.role === 'user'` arahkan ke `/`; jika role staf tidak masuk `allowedRoles`, render tampilan `403 Akses Ditolak` di dalam Workspace.
3. **Rute & Halaman Baru:**
   - `/login` (`CustomerLoginPage` di dalam `CinemaLayout` — Dark Obsidian + Gold + Burgundy).
   - `/register` (`CustomerRegisterPage` di dalam `CinemaLayout`).
   - `/admin/login` (`StaffLoginPage` mandiri dengan `data-surface="workspace"` — Light bersih beraksen Burgundy + Gold).
   - `/admin` (`WorkspaceDashboardPage` di dalam `WorkspaceLayout` yang dibungkus `StaffProtectedRoute`; rute lama `/workspace-preview` melakukan `<Navigate to="/admin" replace />`).

---

## 6. Seeder Akun Default (`apps/server/src/db/seed.ts`)

Menjalankan `npm run db:seed` akan melakukan upsert/insert aman (`onConflictDoNothing` pada `email`) untuk 7 akun dev dengan password seragam dev `Cinemax123!`:
- `admin@cinemax.local` (`admin`)
- `manager@cinemax.local` (`manager`)
- `cashier@cinemax.local` (`cashier`)
- `fnb@cinemax.local` (`fnb_staff`)
- `cleaner@cinemax.local` (`cleaner`)
- `staff@cinemax.local` (`staff`)
- `user@cinemax.local` (`user`, `points: 250`)

---

## 7. Strategi Pengujian & Kriteria Selesai

1. Unit test `crypto.test.ts`: memastikan hash berbeda tiap panggilan (random salt), password benar lulus, password salah ditolak, dan hash token konsisten SHA-256 64 karakter hex.
2. Integration test `auth.test.ts` (dengan repositori in-memory atau DB terinjeksi di `createApp` + verifikasi E2E nyata ke `cinemax-db`):
   - Registrasi pelanggan sukses (`201`) + mengembalikan `Set-Cookie: cx_session=...; HttpOnly`.
   - `GET /api/v1/auth/me` memakai cookie tersebut mengembalikan `200` tanpa `passwordHash`.
   - Akun staf ditolak di `POST /api/v1/auth/login` (`403`) dan diterima di `POST /api/v1/auth/staff/login` (`200`).
   - Akun pelanggan ditolak di `POST /api/v1/auth/staff/login` (`403`).
   - Middleware RBAC `GET /api/v1/staff/ping` mengembalikan `200` untuk `admin`, `403` untuk `cashier`, dan `401` setelah `POST /api/v1/auth/logout`.
3. `npm run db:migrate && npm run db:seed`, `npm run build`, dan `npm test` seluruhnya lulus bersih.
