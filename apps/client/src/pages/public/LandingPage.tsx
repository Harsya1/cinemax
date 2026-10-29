import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PublicMovieSummary, PublicNowPlayingResponse } from '@cinemax/shared';
import { apiRequest } from '../../lib/api';
import { TrailerModal } from '../../components/public/TrailerModal';
import { HeroSkeleton, MovieGridSkeleton } from '../../components/common/Skeletons';

export function LandingPage() {
  const [data, setData] = useState<PublicNowPlayingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'popular' | 'scheduled'>('all');
  const [activeTrailerKey, setActiveTrailerKey] = useState<string | null>(null);
  const [trailerTitle, setTrailerTitle] = useState<string>('');

  useEffect(() => {
    apiRequest<PublicNowPlayingResponse>('/public/movies/now-playing')
      .then(setData)
      .finally(() => setIsLoading(false));
  }, []);

  const hero = data?.heroMovie ?? null;
  const rawMovies = data?.movies ?? [];

  // Filter movies based on active tab
  const filteredMovies = useMemo(() => {
    if (filterMode === 'popular') {
      return rawMovies.filter((m) => m.voteAverage >= 7.5);
    }
    if (filterMode === 'scheduled') {
      return rawMovies.filter((m) => m.activeShowtimeCount > 0);
    }
    return rawMovies;
  }, [rawMovies, filterMode]);

  return (
    <div className="space-y-16 pb-24 text-zinc-100">
      {/* 1. Hero Spotlight Section */}
      {hero ? (
        <section className="relative overflow-hidden border-b border-white/10 bg-obsidian-950">
          {/* Ambient Lighting & Backdrop Layer */}
          <div className="absolute inset-0 z-0">
            {hero.backdropUrl ? (
              <img
                src={hero.backdropUrl}
                alt={hero.title}
                className="h-full w-full object-cover object-top opacity-40 filter contrast-125 brightness-90"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-burgundy-950/40 via-obsidian-950 to-obsidian-900" />
            )}
            {/* Cinematic Gradient Vignettes */}
            <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-obsidian-950/75 to-obsidian-950/30" />
            <div className="absolute inset-0 bg-gradient-to-r from-obsidian-950 via-obsidian-950/85 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(136,19,55,0.35),transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(245,158,11,0.12),transparent_45%)]" />
          </div>

          <div className="cx-cinema-pattern relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-24 lg:py-32">
            <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
              {/* Left Column: Hero Content */}
              <div className="space-y-6 lg:col-span-8">
                {/* Visual Accent Pill */}
                <div className="inline-flex items-center gap-2 rounded-full border border-burgundy-500/50 bg-burgundy-950/80 px-4 py-1.5 text-xs font-bold tracking-wider text-gold-400 backdrop-blur-md shadow-lg shadow-burgundy-950/50">
                  <span className="h-2 w-2 rounded-full bg-gold-400 animate-pulse" />
                  <span>SPOTLIGHT FILM UNGGULAN HARI INI</span>
                </div>

                {/* Movie Title */}
                <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white drop-shadow-md leading-none">
                  {hero.title}
                </h1>

                {/* Metadata Badges */}
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold tabular-nums text-zinc-300">
                  <span className="flex items-center gap-1.5 rounded-lg border border-gold-500/40 bg-gold-500/10 px-3 py-1 font-bold text-gold-400">
                    <svg
                      className="h-3.5 w-3.5 fill-current"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span>{hero.voteAverage.toFixed(1)} / 10</span>
                  </span>

                  <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-zinc-300">
                    {hero.runtimeMinutes} Menit
                  </span>

                  {hero.releaseDate && (
                    <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-zinc-300">
                      Rilis {hero.releaseDate.substring(0, 4)}
                    </span>
                  )}

                  <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-gold-400 font-bold uppercase tracking-wider text-[10px]">
                    DOLBY ATMOS · 4K LASER
                  </span>
                </div>

                {/* Genre Pills */}
                {hero.genres.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {hero.genres.map((g) => (
                      <span
                        key={g}
                        className="rounded-full border border-burgundy-500/30 bg-burgundy-950/40 px-3 py-0.5 text-[11px] font-semibold text-zinc-300"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                {/* Overview / Synopsis with Controlled Measure */}
                <p className="max-w-2xl text-sm sm:text-base leading-relaxed text-zinc-300 font-normal line-clamp-3 sm:line-clamp-4">
                  {hero.overview ||
                    'Saksikan pertunjukan sinematik spektakuler ini di studio CINEMAX dengan ketajaman proyeksi Christie 4K Laser dan sistem tata suara multi-dimensi.'}
                </p>

                {/* Action CTA Buttons */}
                <div className="flex flex-wrap items-center gap-4 pt-4">
                  <Link
                    to={`/movie/${hero.id}`}
                    className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 px-7 py-3.5 font-display text-sm font-bold text-obsidian-950 shadow-xl shadow-gold-500/20 transition-all duration-300 hover:scale-105 hover:from-gold-400 hover:to-gold-500"
                  >
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                      <path d="M4 4h16v4H4V4zm0 6h16v10H4V10zm2 2v6h12v-6H6z" />
                    </svg>
                    <span>Pesan Tiket & Pilih Kursi</span>
                  </Link>

                  <Link
                    to={`/movie/${hero.id}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 font-display text-sm font-semibold text-white backdrop-blur-sm transition-all hover:border-gold-500/50 hover:bg-white/10"
                  >
                    <span>Lihat Jadwal & Detail</span>
                    <span className="text-gold-400">→</span>
                  </Link>
                </div>
              </div>

              {/* Right Column: Mini Experience Card */}
              <div className="hidden lg:block lg:col-span-4">
                <div className="rounded-2xl border border-white/15 bg-obsidian-900/80 p-6 backdrop-blur-md shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="font-display text-xs font-bold uppercase tracking-wider text-gold-400">
                      STUDIO TERSEDIA
                    </span>
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                      Buka Pemesanan
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="rounded-xl border border-white/5 bg-white/5 p-3 space-y-1">
                      <div className="flex justify-between font-bold text-white">
                        <span>Premier Velvet Class</span>
                        <span className="text-gold-400">Rp 100.000</span>
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        Motorized Recliner, blanket & in-seat food service.
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/5 bg-white/5 p-3 space-y-1">
                      <div className="flex justify-between font-bold text-white">
                        <span>Studio 3D RealD</span>
                        <span className="text-gold-400">Rp 65.000</span>
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        Stereoscopic active laser 3D & immersive surround.
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/5 bg-white/5 p-3 space-y-1">
                      <div className="flex justify-between font-bold text-white">
                        <span>Studio 1 Regular Deluxe</span>
                        <span className="text-gold-400">Rp 50.000</span>
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        Dolby Atmos 7.1, stadium seating & extra legroom.
                      </p>
                    </div>
                  </div>

                  <p className="text-center text-[10px] text-zinc-400 pt-1">
                    Dapatkan poin loyalitas hingga 15 pts per lembar tiket.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : isLoading ? (
        <HeroSkeleton />
      ) : null}

      {/* 2. Now Playing Movie Section */}
      <section id="now-playing" className="mx-auto max-w-7xl px-4 sm:px-8 space-y-8">
        {/* Header & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Sedang Tayang di Bioskop
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-zinc-400 max-w-xl">
              Pilih film favorit Anda, cek ketersediaan kursi secara real-time, dan pesan tiket langsung tanpa antre.
            </p>
          </div>

          {/* Interactive Filter Pills */}
          <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-obsidian-900 p-1">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                filterMode === 'all'
                  ? 'bg-burgundy-800 text-gold-400 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Semua Film
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('popular')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                filterMode === 'popular'
                  ? 'bg-burgundy-800 text-gold-400 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Rating Tinggi (7.5+)
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('scheduled')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                filterMode === 'scheduled'
                  ? 'bg-burgundy-800 text-gold-400 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Terjadwal Hari Ini
            </button>
          </div>
        </div>

        {/* Movies Grid */}
        {isLoading ? (
          <MovieGridSkeleton count={5} />
        ) : filteredMovies.length === 0 ? (
          <div className="py-24 text-center rounded-2xl border border-white/10 bg-obsidian-900/50 p-8 space-y-3">
            <p className="font-display text-base font-bold text-white">
              Tidak ada film untuk filter yang dipilih
            </p>
            <p className="text-xs text-zinc-400">
              Coba ganti filter ke "Semua Film" atau kunjungi halaman film mendatang.
            </p>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className="mt-2 rounded-lg bg-burgundy-800 px-4 py-2 text-xs font-bold text-gold-400 hover:bg-burgundy-700"
            >
              Tampilkan Semua Film
            </button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredMovies.map((m) => (
              <Link
                key={m.id}
                to={`/movie/${m.id}`}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-obsidian-900/90 shadow-xl transition-all duration-300 hover:-translate-y-1.5 hover:border-gold-500/50 hover:shadow-2xl hover:shadow-gold-500/10"
              >
                {/* Poster Frame */}
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-obsidian-950">
                  {m.posterUrl ? (
                    <img
                      src={m.posterUrl}
                      alt={m.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                      Poster Tidak Tersedia
                    </div>
                  )}

                  {/* Gradient bottom shadow inside poster */}
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-obsidian-900 to-transparent" />

                  {/* Rating Tag */}
                  <div className="absolute top-3 left-3 flex items-center gap-1 rounded-md border border-white/10 bg-obsidian-950/85 px-2 py-0.5 text-xs font-bold text-gold-400 backdrop-blur-md tabular-nums shadow-sm">
                    <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span>{m.voteAverage.toFixed(1)}</span>
                  </div>

                  {/* Showtime Availability Badge */}
                  {m.activeShowtimeCount > 0 ? (
                    <div className="absolute bottom-2.5 right-2.5 rounded-md border border-emerald-500/30 bg-emerald-950/90 px-2 py-0.5 text-[10px] font-bold text-emerald-400 backdrop-blur-md">
                      {m.activeShowtimeCount} Sesi Hari Ini
                    </div>
                  ) : null}
                </div>

                {/* Details Section */}
                <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
                  <div>
                    <h3
                      className="line-clamp-1 font-display text-base font-bold text-white group-hover:text-gold-400 transition-colors"
                      title={m.title}
                    >
                      {m.title}
                    </h3>

                    <div className="mt-1 flex items-center justify-between text-xs text-zinc-400 tabular-nums">
                      <span>{m.releaseDate ? m.releaseDate.substring(0, 4) : 'TBA'}</span>
                      <span>{m.runtimeMinutes} Menit</span>
                    </div>

                    {m.genres && m.genres.length > 0 && (
                      <p className="mt-1 text-[11px] text-zinc-500 truncate">
                        {m.genres.slice(0, 2).join(' · ')}
                      </p>
                    )}
                  </div>

                  <div>
                    <span className="block w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-center text-xs font-bold text-zinc-200 transition-all duration-200 group-hover:border-gold-500 group-hover:bg-gold-500 group-hover:text-obsidian-950 shadow-sm">
                      Pilih Kursi & Beli
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 3. Luxury Cinema Experience Showcase */}
      <section className="mx-auto max-w-7xl px-4 sm:px-8 pt-8">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-obsidian-900 to-obsidian-950 p-8 sm:p-12 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="font-display text-xs font-bold uppercase tracking-widest text-gold-400">
              STANDAR KELAS SINEMA DUNIA
            </span>
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Pengalaman Menonton Standar Tertinggi
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Setiap studio CINEMAX dirancang khusus dengan akustik terkalibrasi, proyektor laser generasi terbaru, dan kenyamanan tempat duduk tanpa kompromi.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Tier 1: Premier Velvet */}
            <div className="rounded-2xl border border-burgundy-700/50 bg-gradient-to-b from-burgundy-950/40 to-obsidian-950 p-6 space-y-4 shadow-xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-burgundy-900/80 text-gold-400 font-display text-lg font-black border border-burgundy-600/40">
                PV
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gold-400">
                  ULTIMATE LUXURY
                </span>
                <h3 className="font-display text-lg font-bold text-white">
                  Premier Velvet Class
                </h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Kursi elektrik recline 180° berbalut kain beledu mewah, selimut hangat higienis, port pengisi daya USB, dan hidangan gourmet yang diantar langsung ke kursi Anda.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-2 text-[10px] font-semibold text-zinc-300">
                <span className="rounded bg-white/5 px-2 py-1">Motorized Recliner</span>
                <span className="rounded bg-white/5 px-2 py-1">In-Seat Dining</span>
                <span className="rounded bg-white/5 px-2 py-1">Dolby Atmos</span>
              </div>
            </div>

            {/* Tier 2: Studio 3D RealD */}
            <div className="rounded-2xl border border-white/10 bg-obsidian-900/60 p-6 space-y-4 shadow-xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-gold-400 font-display text-lg font-black border border-white/10">
                3D
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                  IMMERSIVE DEPTH
                </span>
                <h3 className="font-display text-lg font-bold text-white">
                  Studio 3D RealD Laser
                </h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Ketajaman kristal laser 4K Christie dengan teknologi active stereoscopic 3D. Kacamata ultra-ringan anti-pusing untuk visual yang melompat nyata keluar dari layar.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-2 text-[10px] font-semibold text-zinc-300">
                <span className="rounded bg-white/5 px-2 py-1">Christie 4K Laser</span>
                <span className="rounded bg-white/5 px-2 py-1">RealD 3D Active</span>
                <span className="rounded bg-white/5 px-2 py-1">360° Surround</span>
              </div>
            </div>

            {/* Tier 3: Regular Deluxe */}
            <div className="rounded-2xl border border-white/10 bg-obsidian-900/60 p-6 space-y-4 shadow-xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-gold-400 font-display text-lg font-black border border-white/10">
                DX
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  OPTIMAL COMFORT
                </span>
                <h3 className="font-display text-lg font-bold text-white">
                  Studio Regular Deluxe
                </h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Kapasitas luas dengan penataan kursi berundak (stadium seating) dan jarak antar baris ekstra lega (extra legroom). Suara surround Dolby 7.1 yang kaya dan seimbang.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-2 text-[10px] font-semibold text-zinc-300">
                <span className="rounded bg-white/5 px-2 py-1">Ergonomic Foam</span>
                <span className="rounded bg-white/5 px-2 py-1">Extra Legroom</span>
                <span className="rounded bg-white/5 px-2 py-1">Dolby 7.1</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Member Privilege & Loyalty Banner */}
      <section className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-gold-500/30 bg-gradient-to-r from-burgundy-950 via-obsidian-950 to-obsidian-900 p-8 sm:p-12 shadow-2xl">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
            <div className="space-y-3 lg:col-span-8">
              <span className="inline-block rounded-full bg-gold-500/10 border border-gold-500/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gold-400">
                CINEMAX LOYALTY CLUB
              </span>
              <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                Dapatkan Poin Setiap Menonton, Tukar Tiket Gratis
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-2xl">
                Setiap tiket yang Anda beli otomatis menghasilkan poin member: Regular (+10 poin), 3D (+13 poin), dan Premier Velvet (+15 poin). Kumpulkan poin dan tukarkan dengan tiket gratis serta diskon F&B lezat.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:col-span-4 lg:items-end">
              <Link
                to="/profile"
                className="rounded-xl bg-gold-500 px-6 py-3 text-center font-display text-xs font-bold text-obsidian-950 hover:bg-gold-400 transition-colors shadow-lg shadow-gold-500/20"
              >
                Cek Akun & Poin Saya
              </Link>
              <Link
                to="/coming-soon"
                className="rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-center font-display text-xs font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Lihat Jadwal Segera Hadir
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trailer Modal */}
      <TrailerModal
        youtubeKey={activeTrailerKey}
        title={trailerTitle}
        onClose={() => setActiveTrailerKey(null)}
      />
    </div>
  );
}
