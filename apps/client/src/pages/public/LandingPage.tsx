import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PublicNowPlayingResponse } from '@cinemax/shared';
import { apiRequest } from '../../lib/api';
import { TrailerModal } from '../../components/public/TrailerModal';

export function LandingPage() {
  const [data, setData] = useState<PublicNowPlayingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTrailerKey, setActiveTrailerKey] = useState<string | null>(null);
  const [trailerTitle, setTrailerTitle] = useState<string>('');

  useEffect(() => {
    apiRequest<PublicNowPlayingResponse>('/public/movies/now-playing')
      .then(setData)
      .finally(() => setIsLoading(false));
  }, []);

  const hero = data?.heroMovie ?? null;
  const movies = data?.movies ?? [];

  return (
    <div className="space-y-12 pb-20">
      {/* Hero Spotlight Section */}
      {hero ? (
        <section className="relative overflow-hidden border-b border-white/10 bg-obsidian-950">
          {hero.backdropUrl && (
            <div className="absolute inset-0 z-0">
              <img
                src={hero.backdropUrl}
                alt={hero.title}
                className="h-full w-full object-cover object-top opacity-35"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-obsidian-950/70 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-obsidian-950 via-obsidian-950/80 to-transparent" />
            </div>
          )}

          <div className="cx-cinema-pattern relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-8 sm:py-28">
            <div className="max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-burgundy-700/80 bg-burgundy-900/60 px-3.5 py-1 text-xs font-semibold tracking-wider text-gold-400 uppercase">
                SPOTLIGHT SEDANG TAYANG
              </div>

              <h1 className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
                {hero.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold tabular-nums text-zinc-300">
                <span className="flex items-center gap-1 text-gold-400 font-bold">
                  ★ {hero.voteAverage.toFixed(1)}
                </span>
                <span>·</span>
                <span>{hero.runtimeMinutes} Menit</span>
                {hero.releaseDate && (
                  <>
                    <span>·</span>
                    <span>{hero.releaseDate.substring(0, 4)}</span>
                  </>
                )}
                {hero.genres.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-zinc-400">{hero.genres.join(', ')}</span>
                  </>
                )}
              </div>

              <p className="line-clamp-3 text-sm leading-relaxed text-zinc-300 sm:text-base">
                {hero.overview || 'Sinopsis film sedang dipersiapkan.'}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-4">
                <Link
                  to={`/movie/${hero.id}`}
                  className="rounded-xl bg-gold-500 px-6 py-3 font-display text-sm font-bold text-obsidian-950 transition-transform hover:scale-105 hover:bg-gold-400 shadow-lg shadow-gold-500/20"
                >
                  Pesan Tiket Sekarang
                </Link>

                <Link
                  to={`/movie/${hero.id}`}
                  className="rounded-xl border border-white/20 bg-white/5 px-6 py-3 font-display text-sm font-semibold text-white backdrop-blur-xs transition-colors hover:bg-white/10"
                >
                  Lihat Detail Film
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : isLoading ? (
        <div className="flex h-96 items-center justify-center text-sm text-muted">
          Memuat film unggulan CINEMAX...
        </div>
      ) : null}

      {/* Now Playing Grid Section */}
      <section id="now-playing" className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold text-white sm:text-3xl">
              Sedang Tayang di Bioskop
            </h2>
            <p className="mt-1 text-xs text-muted">
              Pilih film favorit Anda dan pesan kursi bioskop dengan mudah.
            </p>
          </div>

          <Link
            to="/coming-soon"
            className="text-xs font-semibold text-gold-400 hover:text-gold-500 hover:underline"
          >
            Lihat Film Segera Hadir →
          </Link>
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] w-full animate-pulse rounded-2xl bg-surface border border-white/5"
              />
            ))}
          </div>
        ) : movies.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted">
            Belum ada jadwal penayangan film saat ini.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {movies.map((m) => (
              <Link
                key={m.id}
                to={`/movie/${m.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-lg transition-transform hover:-translate-y-1 hover:border-gold-500/40"
              >
                {/* Poster */}
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-obsidian-950">
                  {m.posterUrl ? (
                    <img
                      src={m.posterUrl}
                      alt={m.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                      No Poster
                    </div>
                  )}

                  {/* Rating Badge */}
                  <div className="absolute top-3 left-3 rounded-md bg-obsidian-950/85 px-2 py-0.5 text-xs font-bold text-gold-400 backdrop-blur-xs tabular-nums shadow-sm border border-white/10">
                    ★ {m.voteAverage.toFixed(1)}
                  </div>

                  {/* Active Showtime Badge */}
                  {m.activeShowtimeCount > 0 ? (
                    <div className="absolute bottom-3 right-3 rounded-md bg-emerald-600/90 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-xs">
                      {m.activeShowtimeCount} Jadwal Tayang
                    </div>
                  ) : null}
                </div>

                {/* Details */}
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <h3
                      className="line-clamp-1 font-display text-base font-bold text-white group-hover:text-gold-400 transition-colors"
                      title={m.title}
                    >
                      {m.title}
                    </h3>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted tabular-nums">
                      <span>{m.releaseDate ? m.releaseDate.substring(0, 4) : 'TBA'}</span>
                      <span>{m.runtimeMinutes}m</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <span className="block w-full rounded-lg bg-white/5 py-2 text-center text-xs font-semibold text-zinc-200 group-hover:bg-gold-500 group-hover:text-obsidian-950 transition-colors">
                      Pilih Jadwal & Kursi
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
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
