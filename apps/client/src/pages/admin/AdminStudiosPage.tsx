import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  STUDIO_TYPES,
  createStudioSchema,
  updateStudioSchema,
  type StudioRow,
  type StudioType,
} from '@cinemax/shared';
import { useAuth } from '../../context/AuthContext';
import { ApiClientError, apiRequest } from '../../lib/api';
import { DataTable, type ColumnDef } from '../../components/admin/DataTable';
import { SeatGridDesigner } from '../../components/admin/SeatGridDesigner';

const STUDIO_TYPE_LABELS: Record<StudioType, string> = {
  regular: 'Regular Cinema',
  '3d': '3D RealD',
  premier: 'Premier Velvet VIP',
};

export function AdminStudiosPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // Modal State
  const [modalMode, setModalMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [editingStudio, setEditingStudio] = useState<StudioRow | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<StudioType>('regular');
  const [rowsCount, setRowsCount] = useState(8);
  const [colsCount, setColsCount] = useState(10);
  const [disabledSeats, setDisabledSeats] = useState<string[]>([]);
  const [basePrice, setBasePrice] = useState(50000);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadStudios = useCallback(async () => {
    setIsLoading(true);
    setBannerError(null);
    try {
      const data = await apiRequest<StudioRow[]>('/admin/studios');
      setStudios(data);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Gagal memuat daftar studio');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStudios();
  }, [loadStudios]);

  function openCreateModal() {
    setEditingStudio(null);
    setName('');
    setType('regular');
    setRowsCount(8);
    setColsCount(10);
    setDisabledSeats([]);
    setBasePrice(50000);
    setFormError(null);
    setModalMode('create');
  }

  function openEditModal(s: StudioRow) {
    setEditingStudio(s);
    setName(s.name);
    setType(s.type);
    setRowsCount(s.rowsCount);
    setColsCount(s.colsCount);
    setDisabledSeats(s.disabledSeats);
    setBasePrice(s.basePrice);
    setFormError(null);
    setModalMode('edit');
  }

  async function handleDelete(s: StudioRow) {
    if (!window.confirm(`Hapus studio ${s.name}?`)) return;
    setBannerError(null);
    try {
      await apiRequest(`/admin/studios/${s.id}`, { method: 'DELETE' });
      await loadStudios();
    } catch (err) {
      setBannerError(err instanceof ApiClientError ? err.message : 'Gagal menghapus studio');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      if (modalMode === 'create') {
        const parsed = createStudioSchema.parse({
          name,
          type,
          rowsCount,
          colsCount,
          disabledSeats,
          basePrice,
        });
        await apiRequest('/admin/studios', {
          method: 'POST',
          body: JSON.stringify(parsed),
        });
      } else if (modalMode === 'edit' && editingStudio) {
        const parsed = updateStudioSchema.parse({
          name,
          type,
          rowsCount,
          colsCount,
          disabledSeats,
          basePrice,
        });
        await apiRequest(`/admin/studios/${editingStudio.id}`, {
          method: 'PATCH',
          body: JSON.stringify(parsed),
        });
      }
      setModalMode('closed');
      await loadStudios();
    } catch (err) {
      setFormError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Gagal menyimpan studio',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const columns = useMemo<ColumnDef<StudioRow>[]>(() => {
    const cols: ColumnDef<StudioRow>[] = [
      {
        key: 'name',
        header: 'Studio',
        render: (s) => (
          <div>
            <p className="font-semibold text-slate-900">{s.name}</p>
            <p className="text-xs text-slate-500">
              Grid: {s.rowsCount} Baris x {s.colsCount} Kolom
            </p>
          </div>
        ),
      },
      {
        key: 'type',
        header: 'Tipe Layar',
        render: (s) => (
          <span
            className={
              s.type === 'premier'
                ? 'rounded-md bg-burgundy-800 px-2.5 py-1 text-xs font-bold uppercase text-gold-400'
                : s.type === '3d'
                  ? 'rounded-md bg-sky-50 px-2.5 py-1 text-xs font-semibold uppercase text-sky-700 ring-1 ring-sky-200'
                  : 'rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-700'
            }
          >
            {STUDIO_TYPE_LABELS[s.type] ?? s.type}
          </span>
        ),
      },
      {
        key: 'seats',
        header: 'Kapasitas Kursi',
        className: 'tabular-nums',
        render: (s) => (
          <div>
            <span className="font-bold text-slate-900">{s.totalSeats} Kursi</span>
            {s.disabledSeats.length > 0 && (
              <span className="ml-1 text-xs text-slate-400">
                ({s.disabledSeats.length} lorong/nonaktif)
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'price',
        header: 'Harga Dasar',
        className: 'tabular-nums font-semibold text-slate-800',
        render: (s) => `Rp ${s.basePrice.toLocaleString('id-ID')}`,
      },
    ];

    if (isAdmin) {
      cols.push({
        key: 'actions',
        header: 'Aksi',
        className: 'text-right',
        render: (s) => (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => openEditModal(s)}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Edit & Denah
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(s)}
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
        title="Master Studio & Denah Kursi"
        subtitle="Konfigurasi studio bioskop, grid baris-kolom, harga dasar, dan lorong kursi."
        columns={columns}
        rows={studios}
        rowKey={(s) => s.id}
        isLoading={isLoading}
        searchValue=""
        onSearchChange={() => {}}
        searchPlaceholder=""
        headerRightSlot={
          isAdmin ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-lg bg-burgundy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-burgundy-700"
            >
              + Tambah Studio
            </button>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Mode Baca
            </span>
          )
        }
        page={1}
        totalPages={1}
        totalItems={studios.length}
        onPageChange={() => {}}
      />

      {/* Modal Studio Designer */}
      {modalMode !== 'closed' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl my-8">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  {modalMode === 'create' ? 'Tambah Studio Baru' : `Edit ${editingStudio?.name}`}
                </h3>
                <p className="text-xs text-slate-500">
                  Atur ukuran grid baris-kolom lalu klik kursi untuk menandai lorong atau kursi rusak.
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

            {formError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700" htmlFor="std-name">
                    Nama Studio
                  </label>
                  <input
                    id="std-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Studio 4 Atmos"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-burgundy-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700" htmlFor="std-type">
                    Tipe Studio
                  </label>
                  <select
                    id="std-type"
                    value={type}
                    onChange={(e) => {
                      const nextType = e.target.value as StudioType;
                      setType(nextType);
                      if (nextType === 'premier' && basePrice < 100000) setBasePrice(100000);
                      if (nextType === '3d' && basePrice < 65000) setBasePrice(65000);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-burgundy-800 focus:outline-none"
                  >
                    {STUDIO_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {STUDIO_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700" htmlFor="std-rows">
                    Jumlah Baris (A–Z)
                  </label>
                  <input
                    id="std-rows"
                    type="number"
                    min={1}
                    max={26}
                    required
                    value={rowsCount}
                    onChange={(e) => setRowsCount(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-burgundy-800 focus:outline-none tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700" htmlFor="std-cols">
                    Jumlah Kolom (1–24)
                  </label>
                  <input
                    id="std-cols"
                    type="number"
                    min={1}
                    max={24}
                    required
                    value={colsCount}
                    onChange={(e) => setColsCount(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-burgundy-800 focus:outline-none tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700" htmlFor="std-price">
                    Harga Dasar (Rp)
                  </label>
                  <input
                    id="std-price"
                    type="number"
                    min={1000}
                    step={5000}
                    required
                    value={basePrice}
                    onChange={(e) => setBasePrice(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-burgundy-800 focus:outline-none tabular-nums"
                  />
                </div>
              </div>

              {/* Interactive Seat Grid Designer */}
              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-700">
                  Denah Kursi Interaktif (Klik kursi untuk mengubahnya jadi lorong jalan/rusak)
                </p>
                <SeatGridDesigner
                  rowsCount={rowsCount}
                  colsCount={colsCount}
                  disabledSeats={disabledSeats}
                  onChangeDisabledSeats={setDisabledSeats}
                  studioType={type}
                />
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
                  {submitting ? 'Menyimpan...' : modalMode === 'create' ? 'Buat Studio' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
