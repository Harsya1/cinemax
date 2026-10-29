import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PublicComingSoonResponse, PublicMovieSummary } from '@cinemax/shared';
import { apiRequest } from '../../lib/api';
import { MovieGridSkeleton } from '../../components/common/Skeletons';

export function ComingSoonPage() {
  const [movies, setMovies] = useState<PublicMovieSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiRequest<PublicComingSoonResponse>('/public/movies/coming-soon')
      .then((res) => setMovies(res.movies))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8 space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-burgundy-700/80 bg-burgundy-900/60 px-3.5 py-1 text-xs font-semibold tracking-wider text-gold-400 uppercase">
          SEGERA HADIR DI BIOSKOP
        </div>
        <h1 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-5xl">
          Film Yang Akan Datang
        </h1>
        <p className="mt-2 text-sm text-muted">
          Nantikan penayangan film-film blockbuster terbaru di studio CINEMAX.
        </p>
      </div>

      {isLoading ? (
        <MovieGridSkeleton count={10} />
      ) : movies.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted">
          Belum ada informasi film mendatang.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {movies.map((m) => (
            <Link
              key={m.id}
              to={`/movie/${m.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-lg transition-transform hover:-translate-y-1 hover:border-gold-500/40"
            >
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

                {m.releaseDate && (
                  <div className="absolute top-3 left-3 rounded-md bg-burgundy-900/90 border border-burgundy-700 px-2 py-0.5 text-[11px] font-bold text-gold-400 backdrop-blur-xs shadow-sm">
                    {new Date(m.releaseDate).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                )}

                <div className="absolute bottom-3 right-3 rounded-md bg-obsidian-950/85 px-2 py-0.5 text-xs font-bold text-gold-400 backdrop-blur-xs tabular-nums shadow-sm border border-white/10">
                  ★ {m.voteAverage.toFixed(1)}
                </div>
              </div>

              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  <h3
                    className="line-clamp-1 font-display text-base font-bold text-white group-hover:text-gold-400 transition-colors"
                    title={m.title}
                  >
                    {m.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">
                    {m.overview || 'Sinopsis segera hadir.'}
                  </p>
                </div>

                <div className="mt-4">
                  <span className="block w-full rounded-lg bg-white/5 py-2 text-center text-xs font-semibold text-zinc-300 group-hover:bg-gold-500 group-hover:text-obsidian-950 transition-colors">
                    Lihat Trailer & Info
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
