import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  createShowtimeSchema,
  updateShowtimeSchema,
  type MovieRow,
  type PaginationMeta,
  type ShowtimeRow,
  type StudioRow,
} from '@cinemax/shared';
import { useAuth } from '../../context/AuthContext';
import { ApiClientError, apiRequest, apiRequestWithMeta } from '../../lib/api';
import { DataTable, type ColumnDef } from '../../components/admin/DataTable';
import { FlatpickrDateTimeInput } from '../../components/admin/FlatpickrDateTimeInput';

export function AdminShowtimesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [showtimes, setShowtimes] = useState<ShowtimeRow[]>([]);
  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [localMovies, setLocalMovies] = useState<MovieRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [studioFilter, setStudioFilter] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'today'>('all');
  const [page, setPage] = useState(1);

  // Modal State
  const [modalMode, setModalMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [editingShowtime, setEditingShowtime] = useState<ShowtimeRow | null>(null);

  // Form State
  const [formMovieId, setFormMovieId] = useState<number | ''>('');
  const [formTmdbId, setFormTmdbId] = useState<string>('');
  const [formStudioId, setFormStudioId] = useState<number | ''>('');
  const [formStartTime, setFormStartTime] = useState<string>('');
  const [formEndTime, setFormEndTime] = useState<string>('');
  const [formPrice, setFormPrice] = useState<number>(50000);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setBannerError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
        timeFilter,
      });
      if (search.trim()) params.set('search', search.trim());
      if (studioFilter) params.set('studioId', studioFilter);

      const [stRes, stds, mvs] = await Promise.all([
        apiRequestWithMeta<ShowtimeRow[]>(`/admin/showtimes?${params.toString()}`),
        apiRequest<StudioRow[]>('/admin/studios'),
        apiRequest<MovieRow[]>('/admin/movies'),
      ]);

      setShowtimes(stRes.data);
      setMeta(stRes.meta);
      setStudios(stds);
      setLocalMovies(mvs);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Gagal memuat jadwal tayang');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, studioFilter, timeFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handle URL pre-fill from TMDb Browser (?tmdbId=123)
  useEffect(() => {
    const tmdbParam = searchParams.get('tmdbId');
    if (tmdbParam && isAdmin) {
      setFormTmdbId(tmdbParam);
      setModalMode('create');
      // Clear search param so it doesn't reopen if refreshed
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, isAdmin, setSearchParams]);

  function openCreateModal() {
    setEditingShowtime(null);
    setFormMovieId(localMovies[0]?.id ?? '');
    setFormTmdbId('');
    const defaultStudio = studios[0];
    setFormStudioId(defaultStudio?.id ?? '');
    setFormPrice(defaultStudio?.basePrice ?? 50000);
    // Default tomorrow at 14:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);
    setFormStartTime(tomorrow.toISOString());
    setFormEndTime('');
    setModalError(null);
    setModalMode('create');
  }

  function openEditModal(st: ShowtimeRow) {
    setEditingShowtime(st);
    setFormMovieId(st.movieId);
    setFormTmdbId(String(st.movie.tmdbId));
    setFormStudioId(st.studioId);
    setFormStartTime(st.startTime);
    setFormEndTime(st.endTime);
    setFormPrice(st.price);
    setModalError(null);
    setModalMode('edit');
  }

  function handleAutoCalculateEndTime() {
    if (!formStartTime) {
      setModalError('Pilih waktu mulai terlebih dahulu');
      return;
    }
    const selectedMovie = localMovies.find((m) => m.id === formMovieId);
    const runtime = selectedMovie?.runtimeMinutes ?? 120;
    const start = new Date(formStartTime).getTime();
    const bufferMinutes = 20;
    const end = new Date(start + (runtime + bufferMinutes) * 60 * 1000);
    setFormEndTime(end.toISOString());
  }

  async function handleDelete(st: ShowtimeRow) {
    if (!window.confirm(`Hapus jadwal tayang ${st.movie.title} di ${st.studio.name}?`)) {
      return;
    }
    setBannerError(null);
    try {
      await apiRequest(`/admin/showtimes/${st.id}`, { method: 'DELETE' });
      await loadData();
    } catch (err) {
      setBannerError(err instanceof ApiClientError ? err.message : 'Gagal menghapus jadwal tayang');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setModalError(null);
    setSubmitting(true);

    try {
      if (modalMode === 'create') {
        const payload: Record<string, unknown> = {
          studioId: formStudioId,
          startTime: formStartTime,
          price: formPrice,
        };
        if (formEndTime) payload.endTime = formEndTime;
        if (formMovieId) payload.movieId = formMovieId;
        if (formTmdbId) payload.tmdbId = Number(formTmdbId);

        const parsed = createShowtimeSchema.parse(payload);
        await apiRequest('/admin/showtimes', {
          method: 'POST',
          body: JSON.stringify(parsed),
        });
      } else if (modalMode === 'edit' && editingShowtime) {
        const parsed = updateShowtimeSchema.parse({
          studioId: formStudioId ? Number(formStudioId) : undefined,
          startTime: formStartTime,
          endTime: formEndTime || undefined,
          price: formPrice,
        });
        await apiRequest(`/admin/showtimes/${editingShowtime.id}`, {
          method: 'PATCH',
          body: JSON.stringify(parsed),
        });
      }
      setModalMode('closed');
      await loadData();
    } catch (err) {
      setModalError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Gagal menyimpan jadwal tayang',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const columns = useMemo<ColumnDef<ShowtimeRow>[]>(() => {
    const cols: ColumnDef<ShowtimeRow>[] = [
      {
        key: 'movie',
        header: 'Film & Durasi',
        render: (st) => (
          <div className="flex items-center gap-3">
            <div className="h-12 w-8 shrink-0 overflow-hidden rounded bg-slate-200">
              {st.movie.posterUrl ? (
                <img
                  src={st.movie.posterUrl}
                  alt={st.movie.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-400">
                  No Pic
                </div>
              )}
            </div>
            <div>
              <p className="font-semibold text-slate-900 line-clamp-1">{st.movie.title}</p>
              <p className="text-xs text-slate-500 tabular-nums">
                {st.movie.runtimeMinutes} Menit
              </p>
            </div>
          </div>
        ),
      },
      {
        key: 'studio',
        header: 'Studio',
        render: (st) => (
          <div>
            <span
              className={
                st.studio.type === 'premier'
                  ? 'rounded-md bg-burgundy-800 px-2.5 py-0.5 text-xs font-bold uppercase text-gold-400'
                  : st.studio.type === '3d'
                    ? 'rounded-md bg-sky-50 px-2.5 py-0.5 text-xs font-semibold uppercase text-sky-700 ring-1 ring-sky-200'
                    : 'rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold uppercase text-slate-700'
              }
            >
              {st.studio.name}
            </span>
            <p className="mt-0.5 text-[11px] text-slate-400">{st.studio.totalSeats} kursi</p>
          </div>
        ),
      },
      {
        key: 'schedule',
        header: 'Waktu Tayang',
        className: 'tabular-nums text-xs',
        render: (st) => {
          const sDate = new Date(st.startTime);
          const eDate = new Date(st.endTime);
          return (
            <div>
              <p className="font-bold text-slate-900">
                {sDate.toLocaleDateString('id-ID', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
              <p className="text-slate-600">
                {sDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} -{' '}
                {eDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
              </p>
            </div>
          );
        },
      },
      {
        key: 'price',
        header: 'Harga Tiket',
        className: 'tabular-nums font-semibold text-slate-800',
        render: (st) => `Rp ${st.price.toLocaleString('id-ID')}`,
      },
      {
        key: 'status',
        header: 'Status',
        render: (st) => (
          <span
            className={
              st.status === 'playing'
                ? 'rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 animate-pulse'
                : st.status === 'upcoming'
                  ? 'rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200'
                  : 'rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500'
            }
          >
            {st.status.toUpperCase()}
          </span>
        ),
      },
    ];

    if (isAdmin) {
      cols.push({
        key: 'actions',
        header: 'Aksi',
        className: 'text-right',
        render: (st) => (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => openEditModal(st)}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(st)}
              className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              Hapus
            </button>
          </div>
        ),
      });
    }

    return cols;
  }, [isAdmin]);

  return (
    <div className="space-y-4">
      {bannerError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
          {bannerError}
        </div>
      )}

      <DataTable
        title="Jadwal Tayang (Showtimes)"
        subtitle="Kelola jam tayang per studio dengan validasi anti-bentrok dan jeda pembersihan otomatis."
        columns={columns}
        rows={showtimes}
        rowKey={(st) => st.id}
        isLoading={isLoading}
        searchPlaceholder="Cari judul film..."
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        headerRightSlot={
          isAdmin ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-lg bg-burgundy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-burgundy-700"
            >
              + Jadwalkan Tayang
            </button>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Mode Baca
            </span>
          )
        }
        filterSlot={
          <>
            <select
              value={studioFilter}
              onChange={(e) => {
                setStudioFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-burgundy-800 focus:outline-none"
            >
              <option value="">Semua Studio</option>
              {studios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs">
              {(['all', 'upcoming', 'today'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTimeFilter(t);
                    setPage(1);
                  }}
                  className={`rounded-md px-2.5 py-1 font-semibold uppercase ${
                    timeFilter === t
                      ? 'bg-burgundy-800 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </>
        }
        page={meta.page}
        totalPages={meta.totalPages}
        totalItems={meta.total}
        onPageChange={setPage}
      />

      {/* Showtime Form Modal */}
      {modalMode !== 'closed' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl my-8">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  {modalMode === 'create' ? 'Jadwalkan Penayangan Film' : 'Edit Jadwal Tayang'}
                </h3>
                <p className="text-xs text-slate-500">
                  Sistem otomatis menghitung durasi film + 20 menit jeda pembersihan studio.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalMode('closed')}
                className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
              >
                Tutup
              </button>
            </div>

            {modalError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Movie Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700" htmlFor="st-movie">
                  Pilih Film Terdaftar
                </label>
                <select
                  id="st-movie"
                  value={formMovieId}
                  onChange={(e) => {
                    setFormMovieId(e.target.value ? Number(e.target.value) : '');
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-burgundy-800 focus:outline-none"
                >
                  <option value="">Pilih dari katalog lokal...</option>
                  {localMovies.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.runtimeMinutes}m)
                    </option>
                  ))}
                </select>

                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-slate-400">Atau TMDb ID:</span>
                  <input
                    type="number"
                    placeholder="Contoh: 550"
                    value={formTmdbId}
                    onChange={(e) => setFormTmdbId(e.target.value)}
                    className="w-32 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-800 focus:border-burgundy-800 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500 italic">
                    (Auto-sync jika belum ada di lokal)
                  </span>
                </div>
              </div>

              {/* Studio & Price */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700" htmlFor="st-studio">
                    Studio
                  </label>
                  <select
                    id="st-studio"
                    required
                    value={formStudioId}
                    onChange={(e) => {
                      const sid = Number(e.target.value);
                      setFormStudioId(sid);
                      const std = studios.find((s) => s.id === sid);
                      if (std) setFormPrice(std.basePrice);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-burgundy-800 focus:outline-none"
                  >
                    <option value="">Pilih studio...</option>
                    {studios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.type.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700" htmlFor="st-price">
                    Harga Tiket (Rp)
                  </label>
                  <input
                    id="st-price"
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-burgundy-800 focus:outline-none tabular-nums"
                  />
                </div>
              </div>

              {/* Start & End Time with flatpickr */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Waktu Mulai Tayang
                  </label>
                  <div className="mt-1">
                    <FlatpickrDateTimeInput
                      value={formStartTime}
                      onChange={(iso) => setFormStartTime(iso)}
                      placeholder="Pilih tanggal & jam..."
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700">
                      Waktu Selesai
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoCalculateEndTime}
                      className="text-[11px] font-semibold text-burgundy-800 hover:underline"
                    >
                      Hitung Otomatis
                    </button>
                  </div>
                  <div className="mt-1">
                    <FlatpickrDateTimeInput
                      value={formEndTime}
                      onChange={(iso) => setFormEndTime(iso)}
                      placeholder="Otomatis durasi + 20m..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setModalMode('closed')}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-burgundy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-burgundy-700 disabled:opacity-60"
                >
                  {submitting ? 'Menjadwalkan...' : modalMode === 'create' ? 'Simpan Jadwal' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
