# CINEMAX — Plan 04 & 05 Combined Design Spec: Master Studios, Seat Grid, TMDb Sync, & Showtimes

Tanggal: 2026-10-29
Ketergantungan: Plan 01, Plan 02, Plan 03
Target: Penggabungan Plan 04 (Master Studio & Interactive Seat Grid Designer) dan Plan 05 (TMDb Live API Service, Katalog Film Lokal `movies`, serta Penjadwalan `showtimes` Anti-Bentrok dengan `flatpickr`).

---

## 1. Tujuan & Cakupan Gabungan (Plan 04 + Plan 05)

1. **Master Studio & Denah Kursi (`studios`):**
   - Mendukung tipe `regular`, `3d`, dan `premier` (dengan identitas visual Burgundy + Gold untuk `premier`).
   - Grid kursi dinamis `rows_count` (`1..26`, baris `A..Z`) x `cols_count` (`1..24`) ditambah array `disabled_seats` (`JSONB`, misal `["A5","B5"]`) untuk menandai lorong jalan atau kursi tidak aktif, sehingga `total_seats` dihitung akurat (`rows * cols - disabled_seats.length`).
   - Seeder idempotent otomatis menambahkan 3 studio awal (`Studio 1 Regular`, `Studio 2 3D`, `Studio 3 Premier Velvet`).

2. **Hybrid TMDb Service & Katalog `movies` Lokal:**
   - Koneksi live ke TMDb v3 memakai `TMDB_ACCESS_TOKEN` (Bearer) atau fallback `TMDB_API_KEY` dengan in-memory TTL cache (15 menit) agar hemat kuota & cepat.
   - Saat film di-sync atau dipilih untuk jadwal tayang, metadata lengkap (`runtime_minutes`, `genres`, `poster_path`, `backdrop_path`, `vote_average`, `release_date`, dan `trailer_youtube_key` dari `append_to_response=videos`) disimpan/diperbarui (`UPSERT` berdasarkan `tmdb_id`) di tabel `movies`. Fallback otomatis ke `en-US` apabila `overview` bahasa `id-ID` kosong.

3. **Penjadwalan `showtimes` Anti-Bentrok & Picker `flatpickr`:**
   - Perhitungan otomatis `end_time = start_time + runtime_minutes + 20 menit` (buffer pembersihan studio) apabila `end_time` tidak di-override manual.
   - Validasi overlap ketat di tingkat service backend (`409 SCHEDULE_CONFLICT`): menolak jadwal pada `studio_id` yang sama apabila `existing.start_time < new.end_time AND existing.end_time > new.start_time` (mengecualikan dirinya sendiri saat edit).
   - Komponen input waktu di Frontend wajib menggunakan `flatpickr` (24 jam, `minuteIncrement: 15`).

---

## 2. Skema Database Baru (`apps/server/src/db/schema.ts`, Migrasi `0003`)

1. **`studioTypeEnum`:** `pgEnum('studio_type', ['regular', '3d', 'premier'])`
2. **Tabel `studios`:**
   - `id`: `serial` PK
   - `name`: `varchar(80)` unique, not null
   - `type`: `studioTypeEnum` not null default `'regular'`
   - `rowsCount`: `integer('rows_count')` not null (1..26)
   - `colsCount`: `integer('cols_count')` not null (1..24)
   - `disabledSeats`: `jsonb('disabled_seats').$type<string[]>()` not null default `[]`
   - `totalSeats`: `integer('total_seats')` not null
   - `basePrice`: `integer('base_price')` not null (dalam Rupiah penuh, misal `50000`)
   - `createdAt`, `updatedAt`: `timestamptz`
3. **Tabel `movies`:**
   - `id`: `serial` PK
   - `tmdbId`: `integer('tmdb_id')` unique, not null
   - `title`: `varchar(255)` not null
   - `overview`: `text('overview')` not null default `''`
   - `posterPath`: `varchar('poster_path', { length: 255 })` nullable
   - `backdropPath`: `varchar('backdrop_path', { length: 255 })` nullable
   - `releaseDate`: `varchar('release_date', { length: 20 })` nullable
   - `runtimeMinutes`: `integer('runtime_minutes')` not null default `120`
   - `voteAverage`: `real('vote_average')` not null default `0`
   - `genres`: `jsonb('genres').$type<string[]>()` not null default `[]`
   - `trailerYoutubeKey`: `varchar('trailer_youtube_key', { length: 64 })` nullable
   - `syncedAt`: `timestamp('synced_at', { withTimezone: true })` not null defaultNow()
4. **Tabel `showtimes`:**
   - `id`: `serial` PK
   - `movieId`: `integer('movie_id').notNull().references(() => movies.id, { onDelete: 'restrict' })`
   - `studioId`: `integer('studio_id').notNull().references(() => studios.id, { onDelete: 'restrict' })`
   - `startTime`: `timestamp('start_time', { withTimezone: true }).notNull()`
   - `endTime`: `timestamp('end_time', { withTimezone: true }).notNull()`
   - `price`: `integer('price').notNull()`
   - `createdAt`: `timestamp('created_at', { withTimezone: true }).notNull().defaultNow()`
   - Index: `(studioId, startTime, endTime)` dan `(movieId, startTime)`.

---

## 3. Matriks RBAC & Kontrak API Backend (`/api/v1/admin/*`)

1. **Studios (`StudioPolicy`):**
   - `GET /api/v1/admin/studios` (`admin`, `manager`, `cashier`, `cleaner`)
   - `POST /api/v1/admin/studios` (`admin`) -> audit `STUDIO_CREATED`
   - `PATCH /api/v1/admin/studios/:id` (`admin`) -> audit `STUDIO_UPDATED`
   - `DELETE /api/v1/admin/studios/:id` (`admin`) -> tolak `409 STUDIO_IN_USE` bila sudah memiliki showtime; audit `STUDIO_DELETED`

2. **TMDb & Local Movies (`ShowtimePolicy`):**
   - `GET /api/v1/admin/tmdb/movies?category=now_playing|upcoming|popular&search=...&page=1` (`admin`, `manager`, `cashier`) -> mengembalikan daftar film dari TMDb beserta flag `isSynced` terhadap tabel `movies` lokal.
   - `GET /api/v1/admin/movies` (`admin`, `manager`, `cashier`) -> daftar film yang sudah tersinkron di DB lokal.
   - `POST /api/v1/admin/movies/sync` (`admin`) body `{ tmdbId }` -> tarik detail + video trailer dari TMDb, upsert ke `movies`, catat `MOVIE_SYNCED` di `audit_logs`.

3. **Showtimes (`ShowtimePolicy`):**
   - `GET /api/v1/admin/showtimes` (`admin`, `manager`, `cashier`) dengan filter `studioId`, `timeFilter` (`all` | `upcoming` | `today`), `search`, `page`, `limit`.
   - `POST /api/v1/admin/showtimes` (`admin`): menerima `{ tmdbId? | movieId?, studioId, startTime, endTime?, price? }`. Jika diberi `tmdbId` yang belum ada di DB lokal, otomatis memanggil `syncMovieByTmdbId`. Menghitung `endTime` otomatis bila kosong (`startTime + runtimeMinutes + 20m`), memvalidasi anti-bentrok jadwal pada `studioId` yang sama (`409 SCHEDULE_CONFLICT`), lalu mencatat `SHOWTIME_CREATED`.
   - `PATCH /api/v1/admin/showtimes/:id` (`admin`): validasi overlap (mengecualikan `:id` sendiri) -> audit `SHOWTIME_UPDATED`.
   - `DELETE /api/v1/admin/showtimes/:id` (`admin`) -> audit `SHOWTIME_DELETED`.

---

## 4. Antarmuka Frontend (`@cinemax/client`)

1. **`SeatGridDesigner` & `/admin/studios` (`AdminStudiosPage`):**
   - Tabel daftar studio + modal pembuatan/pengeditan studio kustom yang memuat editor denah kursi visual (layar melengkung di atas, tombol kursi `A1..Z24` klik untuk menonaktifkan kursi/lorong, lencana warna Burgundy khusus `premier`).
2. **`/admin/movies` (`AdminTmdbBrowserPage`):**
   - Penjelajah film TMDb live (`Now Playing`, `Upcoming`, `Popular`, `Search`), indikator `Synced`, tombol `Sync Katalog`, dan tombol `+ Jadwalkan Tayang` yang membuka `/admin/showtimes?tmdbId=<id>`.
3. **`FlatpickrDateTimeInput` & `/admin/showtimes` (`AdminShowtimesPage`):**
   - Menggunakan library `flatpickr` (`enableTime: true`, `time_24hr: true`, `minuteIncrement: 15`) untuk memilih `startTime` dan `endTime`, otomatis menghitung estimasi selesai berdasarkan durasi film + 20 menit cleaning, serta otomatis mengisi harga dasar saat studio dipilih.
