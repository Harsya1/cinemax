# CINEMAX — Plan 06 Public Movies & Watchlist Design Spec

Tanggal: 2026-10-29
Ketergantungan: Plan 01, Plan 02, Plan 04, Plan 05
Target: Website Publik Sinematik CINEMAX (Hero Spotlight, Now Playing, Coming Soon, Movie Details dengan pengelompokan jadwal tayang per tanggal & tipe studio, Modal Trailer YouTube responsif, serta sistem Watchlist pelanggan).

---

## 1. Tujuan & Batasan Cakupan

1. **Tema Sinematik Surface Publik (`data-surface="cinema"`):**
   - Menggunakan fondasi Obsidian `#09090B`, Warm Gold `#F59E0B`, dan Deep Burgundy `#6B1D2F` yang mewah.
2. **Katalog Publik Cerdas (Hybrid TMDb + Jadwal Lokal):**
   - Halaman Now Playing memprioritaskan film yang sudah memiliki jadwal tayang aktif di bioskop, disusul film terpopuler yang sedang tayang di bioskop Indonesia dari TMDb.
   - Halaman Coming Soon menampilkan film-film rilis mendatang di Indonesia lengkap dengan poster, tanggal rilis, rating, dan trailer.
   - Halaman Movie Details menyajikan informasi sinematik lengkap (backdrop, poster, sinopsis, genre, durasi, rating, trailer video YouTube tersemat via modal), serta daftar jadwal tayang aktif yang dikelompokkan berdasarkan tanggal dan studio tier (`Regular`, `3D`, `Premier Velvet`).
3. **Sistem Watchlist Pelanggan:**
   - Tabel `watchlists` menyimpan film favorit pelanggan berdasarkan `(user_id, tmdb_id)`.
   - Tombol toggle Watchlist di halaman detail & kartu film (langsung simpan untuk pelanggan yang login, atau arahkan ke `/login` untuk tamu).
   - Halaman `/watchlist` khusus pelanggan untuk melihat film yang disimpan.

---

## 2. Skema Database Baru (`apps/server/src/db/schema.ts`, Migrasi `0004`)

### Tabel `watchlists`
- `id`: `serial` PK
- `userId`: `integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' })`
- `tmdbId`: `integer('tmdb_id').notNull()`
- `title`: `varchar('title', { length: 255 }).notNull()`
- `posterPath`: `varchar('poster_path', { length: 255 })`
- `overview`: `text('overview')`
- `voteAverage`: `real('vote_average').notNull().default(0)`
- `releaseDate`: `varchar('release_date', { length: 20 })`
- `createdAt`: `timestamp('created_at', { withTimezone: true }).notNull().defaultNow()`
- Indeks & constraint unik: `(userId, tmdbId)`.

---

## 3. Kontrak API Backend (`/api/v1/public/*`)

1. `GET /api/v1/public/movies/now-playing`:
   - Mengembalikan `{ heroMovie, movies: PublicMovieSummary[] }`.
   - `heroMovie` diambil dari film lokal berjadwal aktif dengan rating tertinggi atau film teratas dari TMDb now-playing.
2. `GET /api/v1/public/movies/coming-soon`:
   - Mengembalikan daftar film rilis mendatang dari TMDb upcoming.
3. `GET /api/v1/public/movies/:idOrTmdbId`:
   - Menerima ID lokal atau TMDb ID.
   - Memeriksa cookie login opsional: jika pelanggan login, kembalikan status `isInWatchlist: boolean`.
   - Mengembalikan detail film, video trailer YouTube, dan showtimes aktif yang dikelompokkan per tanggal (`YYYY-MM-DD`) dan studio.
4. `POST /api/v1/public/watchlist/toggle` (Memerlukan Login Pelanggan `requireAuth`):
   - Menerima `{ tmdbId }`. Jika sudah ada -> hapus. Jika belum -> simpan metadata film ke `watchlists`.
   - Mengembalikan `{ isInWatchlist: boolean }`.
5. `GET /api/v1/public/watchlist` (Memerlukan Login Pelanggan `requireAuth`):
   - Mengembalikan daftar film watchlist user yang sedang login.

---

## 4. Antarmuka Frontend (`@cinemax/client`)

1. **`TrailerModal` (`src/components/public/TrailerModal.tsx`):**
   - Modal pop-up iframe YouTube resmi dengan overlay gelap dan tombol tutup tanpa reload halaman.
2. **`LandingPage` (`src/pages/public/LandingPage.tsx` di rute `/`):**
   - Hero banner penuh dengan backdrop gradasi Obsidian-Burgundy, tombol *Watch Trailer*, tombol *Pesan Tiket*, dan grid kartu film Now Playing.
3. **`ComingSoonPage` (`src/pages/public/ComingSoonPage.tsx` di rute `/coming-soon`):**
   - Grid film mendatang dengan badge tanggal rilis dan tombol simpan ke watchlist.
4. **`MovieDetailsPage` (`src/pages/public/MovieDetailsPage.tsx` di rute `/movie/:id`):**
   - Tampilan sinematik detail film, tombol bookmark Watchlist, pemutar trailer, serta tab jadwal tayang per tanggal + tombol *Pilih Kursi*.
5. **`WatchlistPage` (`src/pages/public/WatchlistPage.tsx` di rute `/watchlist`):**
   - Daftar film tersimpan pelanggan terproteksi `CustomerProtectedRoute`.
