import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MovieRow, TmdbBrowseItem } from '@cinemax/shared';
import { useAuth } from '../../context/AuthContext';
import { ApiClientError, apiRequest, apiRequestWithMeta } from '../../lib/api';

type BrowseCategory = 'now_playing' | 'upcoming' | 'popular';

const CATEGORY_TABS: Array<{ id: BrowseCategory; label: string }> = [
  { id: 'now_playing', label: 'Now Playing (Sedang Tayang)' },
  { id: 'upcoming', label: 'Upcoming (Segera Hadir)' },
  { id: 'popular', label: 'Popular Box Office' },
];

export function AdminTmdbBrowserPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [category, setCategory] = useState<BrowseCategory>('now_playing');
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [movies, setMovies] = useState<TmdbBrowseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadMovies = useCallback(async () => {
    setIsLoading(true);
    setBannerMessage(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
      });
      if (activeSearch.trim()) {
        params.set('search', activeSearch.trim());
      } else {
        params.set('category', category);
      }

      const res = await apiRequestWithMeta<
        TmdbBrowseItem[],
        { page: number; totalPages: number; total: number }
      >(`/admin/tmdb/movies?${params.toString()}`);

      setMovies(res.data);
      setTotalPages(res.meta.totalPages);
      setTotalItems(res.meta.total);
    } catch (err) {
      setBannerMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal memuat film dari TMDb',
      });
    } finally {
      setIsLoading(false);
    }
  }, [category, activeSearch, page]);

  useEffect(() => {
    void loadMovies();
  }, [loadMovies]);

  async function handleSyncMovie(tmdbId: number) {
    setSyncingId(tmdbId);
    setBannerMessage(null);
    try {
      const synced = await apiRequest<MovieRow>('/admin/movies/sync', {
        method: 'POST',
        body: JSON.stringify({ tmdbId }),
      });
      setBannerMessage({
        type: 'ok',
        text: `Berhasil menyinkronkan "${synced.title}" (${synced.runtimeMinutes} menit) ke katalog lokal.`,
      });
      // Mark as synced locally
      setMovies((prev) =>
        prev.map((m) =>
          m.tmdbId === tmdbId ? { ...m, isSynced: true, localMovieId: synced.id } : m,
        ),
      );
    } catch (err) {
      setBannerMessage({
        type: 'err',
        text: err instanceof ApiClientError ? err.message : 'Gagal sinkronisasi film TMDb',
      });
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Jelajah Film TMDb (Live API)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Katalog resmi The Movie Database terhubung via Bearer Token. Sinkronkan film untuk membuat jadwal tayang.
          </p>
        </div>
      </div>

      {bannerMessage && (
        <div
          className={`rounded-lg px-4 py-3 text-xs font-medium border ${
            bannerMessage.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {bannerMessage.text}
        </div>
      )}

      {/* Toolbar & Category Tabs */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex flex-wrap gap-1">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setCategory(tab.id);
                  setActiveSearch('');
                  setSearch('');
                  setPage(1);
                }}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  category === tab.id && !activeSearch
                    ? 'bg-burgundy-800 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setActiveSearch(search);
              setPage(1);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul di TMDb..."
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs text-slate-900 focus:border-burgundy-800 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Cari
            </button>
            {activeSearch && (
              <button
                type="button"
                onClick={() => {
                  setActiveSearch('');
                  setSearch('');
                  setPage(1);
                }}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Reset
              </button>
            )}
          </form>
        </div>

        {/* Movies Grid */}
        {isLoading ? (
          <div className="py-20 text-center text-sm text-slate-500">
            Mengambil data live dari TMDb API...
          </div>
        ) : movies.length === 0 ? (
          <div className="py-20 text-center text-sm text-slate-500">
            Tidak ada film ditemukan di TMDb.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {movies.map((m) => (
              <div
                key={m.tmdbId}
                className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-2xs hover:shadow-md transition-shadow"
              >
                {/* Poster */}
                <div className="relative aspect-[2/3] w-full bg-slate-200 overflow-hidden">
                  {m.posterUrl ? (
                    <img
                      src={m.posterUrl}
                      alt={m.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                      No Poster
                    </div>
                  )}

                  <div className="absolute top-2 right-2">
                    {m.isSynced ? (
                      <span className="rounded-full bg-emerald-600/90 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-xs">
                        ✓ SYNCED
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-slate-200 shadow-sm backdrop-blur-xs">
                        TMDb
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col justify-between p-3.5 space-y-2">
                  <div>
                    <h3 className="line-clamp-1 font-display text-sm font-bold text-slate-900" title={m.title}>
                      {m.title}
                    </h3>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                      <span>{m.releaseDate ? m.releaseDate.substring(0, 4) : 'TBA'}</span>
                      <span className="font-semibold text-amber-600">★ {m.voteAverage.toFixed(1)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">{m.overview || 'Sinopsis belum tersedia.'}</p>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-200 space-y-1.5">
                    {isAdmin && (
                      <button
                        type="button"
                        disabled={syncingId === m.tmdbId}
                        onClick={() => void handleSyncMovie(m.tmdbId)}
                        className={`w-full rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                          m.isSynced
                            ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                            : 'bg-slate-900 text-white hover:bg-slate-800'
                        } disabled:opacity-50`}
                      >
                        {syncingId === m.tmdbId ? 'Menyinkronkan...' : m.isSynced ? 'Update Sinkron' : 'Sync ke Katalog'}
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/showtimes?tmdbId=${m.tmdbId}`)}
                        className="w-full rounded-md bg-burgundy-800 px-2.5 py-1 text-xs font-semibold text-gold-400 hover:bg-burgundy-700"
                      >
                        + Buat Showtime
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 text-xs text-slate-600 tabular-nums">
          <span>
            Total <strong className="font-semibold text-slate-900">{totalItems}</strong> film ·
            Halaman <strong className="font-semibold text-slate-900">{page}</strong> dari{' '}
            <strong className="font-semibold text-slate-900">{totalPages}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage(page - 1)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage(page + 1)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
