import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { WatchlistRow } from '@cinemax/shared';
import { apiRequest } from '../../lib/api';

export function WatchlistPage() {
  const [items, setItems] = useState<WatchlistRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadWatchlist = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<WatchlistRow[]>('/public/watchlist');
      setItems(data);
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWatchlist();
  }, [loadWatchlist]);

  async function handleRemove(tmdbId: number) {
    try {
      await apiRequest('/public/watchlist/toggle', {
        method: 'POST',
        body: JSON.stringify({ tmdbId }),
      });
      setItems((prev) => prev.filter((i) => i.tmdbId !== tmdbId));
    } catch {
      // Ignored
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8 space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-burgundy-700/80 bg-burgundy-900/60 px-3.5 py-1 text-xs font-semibold tracking-wider text-gold-400 uppercase">
          DAFTAR KEINGINAN SAYA
        </div>
        <h1 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-5xl">
          Watchlist Film Favorit
        </h1>
        <p className="mt-2 text-sm text-muted">
          Film yang Anda simpan untuk ditonton di bioskop CINEMAX.
        </p>
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
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-surface p-16 text-center space-y-4">
          <p className="text-base font-semibold text-white">Watchlist Anda masih kosong</p>
          <p className="text-xs text-muted">
            Jelajahi film sedang tayang atau segera hadir lalu klik "Tambah ke Watchlist".
          </p>
          <Link
            to="/"
            className="inline-block rounded-xl bg-gold-500 px-6 py-2.5 text-xs font-bold text-obsidian-950 hover:bg-gold-400 transition-colors"
          >
            Jelajahi Film Sekarang
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((m) => (
            <div
              key={m.id}
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

                <div className="absolute top-3 left-3 rounded-md bg-obsidian-950/85 px-2 py-0.5 text-xs font-bold text-gold-400 backdrop-blur-xs tabular-nums shadow-sm border border-white/10">
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
                    {m.overview || 'Sinopsis belum tersedia.'}
                  </p>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <Link
                    to={`/movie/${m.tmdbId}`}
                    className="w-full rounded-lg bg-gold-500 py-2 text-center text-xs font-bold text-obsidian-950 hover:bg-gold-400 transition-colors"
                  >
                    Lihat Jadwal
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleRemove(m.tmdbId)}
                    className="w-full rounded-lg border border-white/10 py-1.5 text-center text-[11px] font-medium text-zinc-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
                  >
                    Hapus dari Watchlist
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
