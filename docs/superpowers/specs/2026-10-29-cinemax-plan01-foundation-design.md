# CINEMAX — Master Roadmap (10 Plans) & Plan 01 Foundation Design Spec

Tanggal: 2026-10-29
Referensi Legacy: `https://github.com/Harsya1/cinema-xxl.git` (Laravel 12, Filament 3, Livewire 3, MySQL 8)
Target Baru: Brand **CINEMAX** di atas Node.js (Express + TypeScript + Drizzle ORM + PostgreSQL) dan React (Vite + Tailwind CSS v4)

---

## 1. Latar Belakang & Keputusan Arsitektur Utama

Proyek ini membangun ulang (rework) sistem bioskop `cinema-xxl` dari ekosistem PHP Laravel ke ekosistem TypeScript penuh (Node.js + React) dengan identitas baru **CINEMAX**, sekaligus menyiapkan pondasi ekspansi ke modul layanan staf dan ceklog/absensi karyawan pada gelombang berikutnya.

Perbaikan struktural utama terhadap `cinema-xxl` lama:
1. **Perbaikan skema transaksi kursi (diimplementasikan di Plan 07, disiapkan menggunakan PostgreSQL sejak Plan 01):** Repo lama menyimpan 1 baris `bookings` per kursi dengan `UNIQUE(showtime_id, seat_number)`, menyebabkan pembelian multi-kursi terpecah menjadi banyak kode booking dan kursi berstatus `cancelled` terkunci permanen. Pemilihan PostgreSQL memungkinkan pemisahan tabel `bookings` (header) + `booking_seats` (detail) dengan *partial unique index* hanya untuk status aktif/ditahan.
2. **Pengganti efisiensi FilamentPHP:** Repo lama mengandalkan Filament untuk 8 modul CRUD admin. Di React, pembuatan CRUD manual satu per satu dicegah dengan komponen tabel/form generik berbasis konfigurasi (Plan 03).
3. **Lingkungan lokal hemat RAM (WSL):** Hanya PostgreSQL 16 Alpine yang berjalan di Docker Compose; server Node.js dan klien Vite dijalankan secara native di terminal WSL.
4. **Cakupan lokasi:** Single-location cinema (sama seperti `cinema-xxl` lama) untuk menjaga skema tetap ramping (YAGNI). Multi-cabang hanya ditambahkan bila di masa depan benar-benar dibutuhkan.

---

## 2. Peta Besar 10 Plan (Fokus Fase 1 & Fase 2)

Gelombang pertama dibagi menjadi 10 plan terisolasi yang mencakup **Fase 1 (Fondasi, Brand, Auth, Admin, Master Studio & Film)** dan **Fase 2 (Jadwal, Seat Lock, Booking Publik, E-Ticket, POS Kasir, & Operasional Tiket)**. Modul FnB, Service Operasional, dan Ceklog/Absensi Karyawan dijadwalkan untuk gelombang plan berikutnya (Fase 3–5), namun enum role staf disiapkan sejak Plan 01.

- **Plan 01 (Dokumen Ini):** Monorepo Setup (`shared`, `server`, `client`), Docker PostgreSQL, fondasi Drizzle & migrasi enum dasar, kontrak API & error handler, serta sistem token Brand Dual-Surface **CINEMAX**.
- **Plan 02:** Autentikasi (Register, Login, Logout, sesi/token aman) dan RBAC middleware BE + route guard FE untuk seluruh role.
- **Plan 03:** Kerangka Admin Generik (`DataTable` + `ResourceForm` berbasis konfigurasi di surface Light) + CRUD User & Audit Log.
- **Plan 04:** Master Studio & Denah Kursi (tipe `regular`, `3d`, `premier`, konfigurasi grid baris-kolom & kursi terblokir/aisle).
- **Plan 05:** Integrasi TMDb API (pencarian, detail, now playing, upcoming), sinkronisasi katalog film lokal, dan CRUD Showtime dengan validasi anti-bentrok jadwal per studio.
- **Plan 06:** Halaman Publik Film di surface Dark Obsidian (Landing Hero + Now Playing, Coming Soon, Detail Film, Trailer Modal, Watchlist).
- **Plan 07:** Engine Booking & Seat Lock (tabel `bookings` + `booking_seats`, penahanan kursi sementara anti-race-condition, batas maks 6 kursi per transaksi).
- **Plan 08:** Pembayaran Web (simulasi Cash/QRIS), penerbitan E-Ticket QR + unduh PDF, poin member, serta halaman Profil User (Riwayat Tiket & Watchlist).
- **Plan 09:** Ticket POS Kasir di surface Light (pemilihan jadwal & kursi cepat walk-in, pembayaran instan Cash/QRIS, cetak tiket/stub kasir).
- **Plan 10:** Pemindaian/Redeem kode QR E-Ticket di pintu studio serta Dashboard Operasional Harian (Stats Overview, Today's Showtimes, Latest Bookings).

---

## 3. Cakupan & Non-Goals Plan 01

### Masuk Cakupan Plan 01
- Setup npm workspaces pada root `/mnt/d/new-cinema` (`packages/shared`, `apps/server`, `apps/client`).
- `docker-compose.yml` khusus `postgres:16-alpine` beserta `.env.example` yang jelas.
- Paket `@cinemax/shared`: konstanta brand, enum domain bersama, dan skema Zod respons dasar.
- Paket `@cinemax/server`: Express 5 + TypeScript + `tsx`, validasi env fail-fast, koneksi Drizzle + `postgres`, migrasi awal (`0000`) berisi PostgreSQL enum `user_role`, wrapper respons seragam, PII-safe global error handler, dan endpoint `GET /api/v1/health`.
- Paket `@cinemax/client`: React 19 + Vite + React Router + Tailwind CSS v4, proxy `/api` ke server, sistem token CSS Dual-Surface **CINEMAX** (Dark Obsidian + Warm Gold + Deep Burgundy untuk Publik; Light bersih beraksen Burgundy + Gold untuk Admin/POS), serta 2 rute preview shell (`/` dan `/workspace-preview`) yang menampilkan status live `GET /api/v1/health`.
- Pengujian otomatis ringan berbasis `node --test` bawaan Node.js.

### Di Luar Cakupan Plan 01 (Non-Goals)
- Tabel bisnis (`users`, `studios`, `movies`, `showtimes`, `bookings`, dll) — dibuat bertahap mulai Plan 02.
- Endpoint login/register atau state autentikasi pengguna — masuk Plan 02.
- Integrasi eksternal TMDb — masuk Plan 05.

---

## 4. Struktur Direktori Monorepo

```text
/mnt/d/new-cinema/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── package.json                  # npm workspaces: ["packages/*", "apps/*"]
├── tsconfig.base.json            # Konfigurasi TypeScript ketat bersama
├── packages/
│   └── shared/
│       ├── package.json          # name: "@cinemax/shared"
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── brand.ts          # Konstanta identitas CINEMAX
│           ├── enums.ts          # USER_ROLES, STUDIO_TYPES, BOOKING_STATUSES, PAYMENT_METHODS
│           └── schemas/
│               └── health.ts     # Zod schema untuk GET /api/v1/health & amplop error
└── apps/
    ├── server/
    │   ├── package.json          # name: "@cinemax/server"
    │   ├── tsconfig.json
    │   ├── drizzle.config.ts
    │   ├── drizzle/              # File SQL hasil drizzle-kit generate
    │   └── src/
    │       ├── env.ts            # Validasi Zod atas variabel environment
    │       ├── app.ts            # Instansiasi Express (dipisah dari listen agar mudah dites)
    │       ├── index.ts          # Entry point HTTP server (port 4000)
    │       ├── db/
    │       │   ├── index.ts      # Koneksi postgres.js + drizzle instance
    │       │   └── schema.ts     # pgEnum user_role (fondasi awal)
    │       ├── lib/
    │       │   ├── http-error.ts # Kelas AppError domain
    │       │   └── response.ts   # Helper sendSuccess / sendError
    │       ├── middleware/
    │       │   └── error-handler.ts
    │       ├── routes/
    │       │   └── health.ts     # GET /api/v1/health
    │       └── __tests__/
    │           └── health.test.ts
    └── client/
        ├── package.json          # name: "@cinemax/client"
        ├── tsconfig.json
        ├── vite.config.ts        # Port 5173 + proxy /api -> http://localhost:4000
        ├── index.html            # Memuat Google/Bunny Fonts: Outfit & Inter
        └── src/
            ├── main.tsx
            ├── App.tsx           # Router: "/" (CinemaShell) & "/workspace-preview" (WorkspaceShell)
            ├── styles/
            │   └── theme.css     # Single source token CINEMAX + Tailwind v4 @theme
            ├── lib/
            │   └── api.ts        # Fetch wrapper tipis ke /api/v1 tanpa global Content-Type paksa
            ├── layouts/
            │   ├── CinemaLayout.tsx     # Wrapper data-surface="cinema"
            │   └── WorkspaceLayout.tsx  # Wrapper data-surface="workspace"
            └── pages/
                ├── CinemaPreviewPage.tsx
                └── WorkspacePreviewPage.tsx
```

---

## 5. Kontrak Paket `@cinemax/shared`

Satu sumber kebenaran tipe dan validasi untuk BE dan FE:

- **`USER_ROLES`:** `['admin', 'manager', 'cashier', 'fnb_staff', 'cleaner', 'staff', 'user'] as const`
  *(Catatan: mempertahankan 6 role asli `cinema-xxl` ditambah `'staff'` umum apabila diperlukan untuk modul Ceklog/Service di Fase 4–5).*
- **`STUDIO_TYPES`:** `['regular', '3d', 'premier'] as const`
- **`BOOKING_STATUSES`:** `['held', 'booked', 'paid', 'redeemed', 'cancelled', 'expired'] as const`
- **`PAYMENT_METHODS`:** `['cash', 'qris'] as const`
- **Skema Amplop API:**
  - Sukses: `{ data: T, meta?: Record<string, unknown> }`
  - Gagal: `{ error: { code: string, message: string, details?: unknown } }`
- **`healthDataSchema`:** `{ service: 'cinemax-api', status: 'ok' | 'degraded', db: 'connected' | 'disconnected', latencyMs: number, timestamp: string }`

---

## 6. Desain Backend (`@cinemax/server`) & Database

### 6.1 Docker PostgreSQL
- Image: `postgres:16-alpine`
- Container name: `cinemax-db`
- Port mapping: `127.0.0.1:5432:5432`
- Default dev DB: `cinemax_db`, user `cinemax`, password `cinemax_dev_only` (dikonfigurasi lewat `.env`).
- Volume bernama `cinemax_pgdata` agar data tidak hilang saat `docker compose stop` / `down`.

### 6.2 Validasi Environment (`src/env.ts`)
Server menolak menyala (exit code 1 dengan daftar variabel yang kurang) apabila variabel wajib tidak valid:
- `NODE_ENV`: `'development' | 'test' | 'production'` (default `'development'`)
- `PORT`: angka (default `4000`)
- `DATABASE_URL`: string URL PostgreSQL wajib
- `CLIENT_ORIGIN`: string URL (default `'http://localhost:5173'`)

### 6.3 Skema Awal Drizzle (`src/db/schema.ts`)
Hanya mendefinisikan `userRoleEnum = pgEnum('user_role', USER_ROLES)` pada Plan 01 sehingga pipa `drizzle-kit generate` dan `drizzle-kit migrate` terbukti berjalan end-to-end ke PostgreSQL tanpa membuat tabel spekulatif sebelum waktunya.

### 6.4 Endpoint & Penanganan Error
- **`GET /api/v1/health`:** Menjalankan `SELECT 1` berbatas waktu ke PostgreSQL dan menghitung `latencyMs`. Mengembalikan HTTP `200` saat DB tersambung dan HTTP `503` dengan `status: 'degraded'` bila DB mati (tanpa membocorkan kredensial `DATABASE_URL`).
- **Keamanan Log (Aturan Ketat):** Global error middleware **dilarang** mencetak `req.body` atau data PII ke console. Hanya mencetak ringkasan error generik (`console.error('[API_ERROR]', err.code ?? 'INTERNAL_ERROR')`) untuk error tak terduga. `ZodError` otomatis dipetakan ke HTTP `400` (`VALIDATION_ERROR`).

---

## 7. Sistem Token Brand **CINEMAX** & Frontend (`@cinemax/client`)

### 7.1 Prinsip Single-Source Token (`src/styles/theme.css`)
Seluruh palet inti didefinisikan satu kali di CSS custom properties dan diekspos ke utilitas Tailwind CSS v4 melalui `@theme`, lalu dipetakan ke token semantik berdasarkan atribut `data-surface`:

1. **Palet Inti Brand CINEMAX:**
   - Obsidian: `--cx-obsidian-950: #09090B`, `--cx-obsidian-900: #121216`, `--cx-obsidian-800: #1C1C22`
   - Warm Gold: `--cx-gold-400: #FBBF24`, `--cx-gold-500: #F59E0B`, `--cx-gold-600: #D97706`
   - Deep Burgundy: `--cx-burgundy-900: #4C1120`, `--cx-burgundy-800: #6B1D2F`, `--cx-burgundy-700: #881337`

2. **Surface Publik — `data-surface="cinema"` (Dark Mewah):**
   - `--bg-canvas`: `#09090B` (Obsidian 950)
   - `--bg-surface`: `#121216` (Bento card surface)
   - `--bg-elevated`: `#1C1C22`
   - `--text-primary`: `#FAFAFA`, `--text-muted`: `#A1A1AA`
   - `--accent-primary`: `#F59E0B` (Warm Gold untuk tombol CTA utama & indikator kursi dipilih)
   - `--accent-luxury`: `#6B1D2F` / border `#881337` (Deep Burgundy untuk badge Studio Premier, aksen kartu unggulan, dan gradasi atmosferik hero)
   - `--border-subtle`: `rgba(255, 255, 255, 0.08)`
   - **Pattern Modern:** Latar hero memakai perpaduan grid geometris tipis (`rgba(255,255,255,0.03)`) dengan radial spotlight lembut Deep Burgundy & Gold di belakang konten utama.

3. **Surface Admin & POS Staf — `data-surface="workspace"` (Light Bersih & Ergonomis):**
   - `--bg-canvas`: `#F8FAFC`
   - `--bg-surface`: `#FFFFFF`
   - `--bg-elevated`: `#F1F5F9`
   - `--text-primary`: `#0F172A`, `--text-muted`: `#475569`
   - `--accent-primary`: `#6B1D2F` (Deep Burgundy untuk tombol aksi utama kerja, header aktif sidebar)
   - `--accent-highlight`: `#D97706` (Gold gelap berkontras tinggi di atas putih untuk indikator aktif/badge penting)
   - `--border-subtle`: `#E2E8F0`
   - Tanpa efek glow atau pattern latar belakang; angka harga/kursi/jam menggunakan `font-variant-numeric: tabular-nums`.

4. **Tipografi:**
   - Display (`--font-display`): `'Outfit', sans-serif` (untuk wordmark `CINEMAX` dan judul film).
   - UI & Data (`--font-sans`): `'Inter', sans-serif` (untuk navigasi, form, tabel admin, dan layar POS).

### 7.2 Klien HTTP (`src/lib/api.ts`)
Wrapper tipis di atas `fetch` bawaan browser dengan `baseURL = '/api/v1'`. Tidak memasang header `Content-Type: application/json` secara paksa pada request tanpa body / `FormData` supaya bersih untuk upload file di fase mendatang, serta langsung mengurai amplop `{ data }` atau melempar objek `ApiClientError` terstruktur.

### 7.3 Halaman Preview Verifikasi Plan 01
- **`/` (`CinemaPreviewPage` di dalam `CinemaLayout`):** Menampilkan navbar glass CINEMAX, hero bento berpattern baru (Obsidian + Gold + Deep Burgundy), sampel tombol & badge (`Regular`, `3D`, `Premier`), serta kartu indikator live status koneksi `GET /api/v1/health`.
- **`/workspace-preview` (`WorkspacePreviewPage` di dalam `WorkspaceLayout`):** Menampilkan kerangka sidebar + topbar Light bersih beraksen Burgundy + Gold, sampel kartu metrik dengan `tabular-nums`, dan indikator health API yang sama. Kedua rute ini menjadi fondasi layout nyata untuk Plan 02–06.

---

## 8. Strategi Pengujian & Kriteria Selesai (Definition of Done Plan 01)

1. `docker compose up -d` menyalakan `cinemax-db` dalam keadaan healthy.
2. `npm run db:generate` & `npm run db:migrate` berhasil mengeksekusi migrasi awal Drizzle ke `cinemax_db`.
3. `npm test` menjalankan test bawaan `node --test`:
   - Memastikan `@cinemax/shared` mengekspor enum dan skema Zod yang valid.
   - Memastikan `env.ts` menolak konfigurasi kosong dan menerima konfigurasi valid.
   - Memastikan Express app merespons `GET /api/v1/health` sesuai skema `healthDataSchema` dan mengembalikan amplop JSON `404` seragam untuk rute tak dikenal.
4. `npm run build` berhasil mem-build `@cinemax/shared`, `@cinemax/server`, dan `@cinemax/client` tanpa error TypeScript (`tsc --noEmit` bersih).
5. Kedua permukaan UI (`/` Cinema Dark dan `/workspace-preview` Workspace Light) tampil dengan token warna CINEMAX yang tepat dan menampilkan status `db: connected` dari backend.
