import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { PublicMovieDetail } from '@cinemax/shared';
import { useAuth } from '../../context/AuthContext';
import { ApiClientError, apiRequest } from '../../lib/api';
import { TrailerModal } from '../../components/public/TrailerModal';

export function MovieDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [movie, setMovie] = useState<PublicMovieDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const [isTogglingWatchlist, setIsTogglingWatchlist] = useState(false);

  const loadMovie = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<PublicMovieDetail>(`/public/movies/${id}`);
      setMovie(data);
      if (data.showtimeDates.length > 0) {
        setSelectedDate(data.showtimeDates[0]!.date);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Film tidak ditemukan');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadMovie();
  }, [loadMovie]);

  async function handleToggleWatchlist() {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!movie) return;

    setIsTogglingWatchlist(true);
    try {
      const res = await apiRequest<{ isInWatchlist: boolean }>('/public/watchlist/toggle', {
        method: 'POST',
        body: JSON.stringify({ tmdbId: movie.tmdbId }),
      });
      setMovie((prev) => (prev ? { ...prev, isInWatchlist: res.isInWatchlist } : null));
    } catch {
      // Ignored
    } finally {
      setIsTogglingWatchlist(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-muted">
        Memuat detail film sinematik...
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="mx-auto max-w-xl py-24 text-center space-y-4">
        <h2 className="font-display text-2xl font-bold text-white">Film Tidak Ditemukan</h2>
        <p className="text-sm text-muted">{error || 'Data film tidak tersedia.'}</p>
        <Link
          to="/"
          className="inline-block rounded-xl bg-gold-500 px-6 py-2.5 text-xs font-bold text-obsidian-950"
        >
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  const activeDateGroup = movie.showtimeDates.find((d) => d.date === selectedDate);

  return (
    <div className="space-y-12 pb-24">
      {/* Backdrop Header */}
      <section className="relative overflow-hidden border-b border-white/10 bg-obsidian-950">
        {movie.backdropUrl && (
          <div className="absolute inset-0 z-0">
            <img
              src={movie.backdropUrl}
              alt={movie.title}
              className="h-full w-full object-cover opacity-25"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-obsidian-950/80 to-transparent" />
          </div>
        )}

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-16">
          <div className="flex flex-col gap-8 md:flex-row md:items-start">
            {/* Poster Card */}
            <div className="w-56 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl mx-auto md:mx-0">
              {movie.posterUrl ? (
                <img
                  src={movie.posterUrl}
                  alt={movie.title}
                  className="aspect-[2/3] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[2/3] items-center justify-center text-xs text-muted">
                  No Poster
                </div>
              )}
            </div>

            {/* Movie Info */}
            <div className="flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {movie.genres.map((g) => (
                  <span
                    key={g}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300"
                  >
                    {g}
                  </span>
                ))}
              </div>

              <h1 className="font-display text-3xl font-extrabold text-white sm:text-5xl">
                {movie.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold tabular-nums text-zinc-300">
                <span className="flex items-center gap-1 text-gold-400 font-bold">
                  ★ {movie.voteAverage.toFixed(1)} / 10
                </span>
                <span>·</span>
                <span>{movie.runtimeMinutes} Menit</span>
                {movie.releaseDate && (
                  <>
                    <span>·</span>
                    <span>Rilis {movie.releaseDate}</span>
                  </>
                )}
              </div>

              <p className="max-w-3xl text-sm leading-relaxed text-zinc-300 sm:text-base">
                {movie.overview || 'Sinopsis belum tersedia untuk film ini.'}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-3">
                {movie.trailerYoutubeKey && (
                  <button
                    type="button"
                    onClick={() => setIsTrailerOpen(true)}
                    className="flex items-center gap-2 rounded-xl bg-burgundy-800 px-5 py-2.5 text-xs font-bold text-gold-400 hover:bg-burgundy-700 transition-colors shadow-md"
                  >
                    <span>▶</span> Putar Trailer Resmi
                  </button>
                )}

                <button
                  type="button"
                  disabled={isTogglingWatchlist}
                  onClick={handleToggleWatchlist}
                  className={`flex items-center gap-2 rounded-xl border px-5 py-2.5 text-xs font-semibold transition-colors ${
                    movie.isInWatchlist
                      ? 'border-gold-500/50 bg-gold-500/10 text-gold-400'
                      : 'border-white/20 bg-white/5 text-white hover:bg-white/10'
                  }`}
                >
                  <span>{movie.isInWatchlist ? '✓ Tersimpan di Watchlist' : '+ Tambah ke Watchlist'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Showtimes Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-8 space-y-6">
        <div className="border-b border-white/10 pb-4">
          <h2 className="font-display text-2xl font-bold text-white">
            Jadwal Penayangan & Tiket Bioskop
          </h2>
          <p className="mt-1 text-xs text-muted">
            Pilih tanggal dan jam tayang untuk melanjutkan pemesanan kursi.
          </p>
        </div>

        {movie.showtimeDates.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-surface p-12 text-center text-sm text-muted">
            Belum ada jadwal penayangan aktif untuk film ini di bioskop CINEMAX saat ini.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Date Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
              {movie.showtimeDates.map((dg) => (
                <button
                  key={dg.date}
                  type="button"
                  onClick={() => setSelectedDate(dg.date)}
                  className={`rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                    selectedDate === dg.date
                      ? 'bg-gold-500 text-obsidian-950 shadow-md scale-105'
                      : 'border border-white/10 bg-surface text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  {dg.dateLabel}
                </button>
              ))}
            </div>

            {/* Showtime Slots for Active Date */}
            {activeDateGroup && (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {activeDateGroup.showtimes.map((slot) => {
                  const sTime = new Date(slot.startTime).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const eTime = new Date(slot.endTime).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={slot.id}
                      className="flex flex-col justify-between rounded-2xl border border-white/10 bg-surface p-5 space-y-4 hover:border-gold-500/30 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-display text-base font-bold text-white">
                            {slot.studioName}
                          </p>
                          <span
                            className={
                              slot.studioType === 'premier'
                                ? 'inline-block mt-1 rounded bg-burgundy-900/90 border border-burgundy-700 px-2 py-0.5 text-[10px] font-bold uppercase text-gold-400'
                                : slot.studioType === '3d'
                                  ? 'inline-block mt-1 rounded bg-sky-950 border border-sky-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-300'
                                  : 'inline-block mt-1 rounded bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase text-zinc-300'
                            }
                          >
                            {slot.studioType}
                          </span>
                        </div>

                        <div className="text-right">
                          <p className="font-display text-sm font-bold text-gold-400 tabular-nums">
                            Rp {slot.price.toLocaleString('id-ID')}
                          </p>
                          <p className="text-[11px] text-muted">per tiket</p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/5 bg-obsidian-950 p-3 text-center tabular-nums">
                        <p className="text-lg font-bold text-white">
                          {sTime} <span className="text-xs text-muted font-normal">s/d</span> {eTime}
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-400">
                          Tersedia {slot.availableSeatsCount} kursi
                        </p>
                      </div>

                      <Link
                        to={`/booking/${slot.id}`}
                        className="block w-full rounded-xl bg-gold-500 py-2.5 text-center text-xs font-bold text-obsidian-950 hover:bg-gold-400 transition-colors"
                      >
                        Pilih Kursi Bioskop →
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Trailer Modal */}
      <TrailerModal
        youtubeKey={movie.trailerYoutubeKey}
        title={movie.title}
        onClose={() => setIsTrailerOpen(false)}
      />
    </div>
  );
}
