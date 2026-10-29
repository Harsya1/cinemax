import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  USER_ROLES,
  adminCreateUserSchema,
  adminUpdateUserSchema,
  type AdminUserRow,
  type PaginationMeta,
} from '@cinemax/shared';
import { useAuth } from '../../context/AuthContext';
import { ApiClientError, apiRequest, apiRequestWithMeta } from '../../lib/api';
import { DataTable, type ColumnDef } from '../../components/admin/DataTable';
import {
  ResourceModalForm,
  type FieldConfig,
} from '../../components/admin/ResourceModalForm';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  cashier: 'Cashier',
  fnb_staff: 'FnB Staff',
  cleaner: 'Cleaner',
  staff: 'General Staff',
  user: 'Customer',
};

const ROLE_OPTIONS = USER_ROLES.map((r) => ({
  value: r,
  label: ROLE_LABELS[r] ?? r,
}));

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [staffOnly, setStaffOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [modalMode, setModalMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [editingRow, setEditingRow] = useState<AdminUserRow | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setBannerError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
      });
      if (search.trim()) params.set('search', search.trim());
      if (roleFilter) params.set('role', roleFilter);
      if (staffOnly) params.set('staffOnly', 'true');

      const res = await apiRequestWithMeta<AdminUserRow[]>(
        `/admin/users?${params.toString()}`,
      );
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Gagal memuat daftar user');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, roleFilter, staffOnly]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleToggleActive = useCallback(
    async (target: AdminUserRow) => {
      setBannerError(null);
      try {
        await apiRequest<AdminUserRow>(`/admin/users/${target.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: !target.isActive }),
        });
        await loadUsers();
      } catch (err) {
        setBannerError(
          err instanceof ApiClientError ? err.message : 'Gagal mengubah status akun',
        );
      }
    },
    [loadUsers],
  );

  const handleDelete = useCallback(
    async (target: AdminUserRow) => {
      if (!window.confirm(`Hapus permanen akun ${target.name} (${target.email})?`)) {
        return;
      }
      setBannerError(null);
      try {
        await apiRequest<{ deletedId: number }>(`/admin/users/${target.id}`, {
          method: 'DELETE',
        });
        await loadUsers();
      } catch (err) {
        setBannerError(
          err instanceof ApiClientError ? err.message : 'Gagal menghapus akun',
        );
      }
    },
    [loadUsers],
  );

  const columns = useMemo<ColumnDef<AdminUserRow>[]>(() => {
    const base: ColumnDef<AdminUserRow>[] = [
      {
        key: 'name',
        header: 'Nama & Email',
        render: (r) => (
          <div>
            <p className="font-semibold text-slate-900">{r.name}</p>
            <p className="text-xs text-slate-500">{r.email}</p>
          </div>
        ),
      },
      {
        key: 'role',
        header: 'Role',
        render: (r) => (
          <span
            className={
              r.role === 'admin'
                ? 'rounded-md bg-burgundy-800 px-2.5 py-1 text-xs font-bold uppercase text-gold-400'
                : r.role === 'user'
                  ? 'rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-600'
                  : 'rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold uppercase text-gold-600 ring-1 ring-amber-200'
            }
          >
            {ROLE_LABELS[r.role] ?? r.role}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (r) =>
          r.isActive ? (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              Aktif
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
              Nonaktif
            </span>
          ),
      },
      {
        key: 'points',
        header: 'Points',
        className: 'tabular-nums',
        render: (r) => <span className="font-medium text-slate-700">{r.points}</span>,
      },
      {
        key: 'joined',
        header: 'Terdaftar',
        className: 'tabular-nums text-xs text-slate-500',
        render: (r) => new Date(r.createdAt).toLocaleDateString('id-ID'),
      },
    ];

    if (isAdmin) {
      base.push({
        key: 'actions',
        header: 'Aksi',
        className: 'text-right',
        render: (r) => {
          const isSelf = r.id === currentUser?.id;
          return (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingRow(r);
                  setModalMode('edit');
                }}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={isSelf}
                onClick={() => void handleToggleActive(r)}
                className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-40"
              >
                {r.isActive ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
              <button
                type="button"
                disabled={isSelf}
                onClick={() => void handleDelete(r)}
                className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
              >
                Hapus
              </button>
            </div>
          );
        },
      });
    }

    return base;
  }, [isAdmin, currentUser?.id, handleToggleActive, handleDelete]);

  const formFields = useMemo<FieldConfig[]>(() => {
    const isSelfEdit = modalMode === 'edit' && editingRow?.id === currentUser?.id;
    return [
      { name: 'name', label: 'Nama Lengkap', type: 'text', required: true, colSpan: 1 },
      { name: 'email', label: 'Email', type: 'email', required: true, colSpan: 2 },
      {
        name: 'phoneNumber',
        label: 'No. Telepon',
        type: 'tel',
        placeholder: '0812xxxx',
        colSpan: 2,
      },
      {
        name: 'role',
        label: 'Role Akses',
        type: 'select',
        required: true,
        options: ROLE_OPTIONS,
        disabled: isSelfEdit,
        colSpan: 2,
      },
      { name: 'points', label: 'Poin Member', type: 'number', colSpan: 2 },
      {
        name: 'password',
        label: modalMode === 'create' ? 'Password Awal' : 'Password Baru (Opsional)',
        type: 'password',
        required: modalMode === 'create',
        placeholder:
          modalMode === 'create' ? 'Minimal 8 karakter' : 'Kosongkan bila tidak diganti',
        colSpan: 1,
      },
      {
        name: 'isActive',
        label: 'Akun Aktif (cabut centang untuk memutus sesi karyawan resign)',
        type: 'checkbox',
        disabled: isSelfEdit,
        colSpan: 1,
      },
    ];
  }, [modalMode, editingRow?.id, currentUser?.id]);

  const modalInitialValues = useMemo<Record<string, unknown>>(() => {
    if (modalMode === 'edit' && editingRow) {
      return {
        name: editingRow.name,
        email: editingRow.email,
        phoneNumber: editingRow.phoneNumber ?? '',
        role: editingRow.role,
        points: editingRow.points,
        password: '',
        isActive: editingRow.isActive,
      };
    }
    return {
      name: '',
      email: '',
      phoneNumber: '',
      role: 'staff',
      points: 0,
      password: '',
      isActive: true,
    };
  }, [modalMode, editingRow]);

  async function handleModalSubmit(values: Record<string, unknown>) {
    if (modalMode === 'create') {
      const parsed = adminCreateUserSchema.safeParse(values);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Input tidak valid');
      }
      await apiRequest<AdminUserRow>('/admin/users', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
    } else if (modalMode === 'edit' && editingRow) {
      const parsed = adminUpdateUserSchema.safeParse(values);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Input tidak valid');
      }
      await apiRequest<AdminUserRow>(`/admin/users/${editingRow.id}`, {
        method: 'PATCH',
        body: JSON.stringify(parsed.data),
      });
    }
    await loadUsers();
  }

  return (
    <div className="space-y-4">
      {bannerError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
          {bannerError}
        </div>
      )}

      <DataTable
        title="Manajemen Akun & Karyawan"
        subtitle="Kelola akses staf operasional, kasir POS, petugas kebersihan, dan akun member."
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        isLoading={isLoading}
        searchPlaceholder="Cari nama atau email..."
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        headerRightSlot={
          isAdmin ? (
            <button
              type="button"
              onClick={() => {
                setEditingRow(null);
                setModalMode('create');
              }}
              className="rounded-lg bg-burgundy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-burgundy-700"
            >
              + Tambah Akun
            </button>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Mode Baca (Manager Oversight)
            </span>
          )
        }
        filterSlot={
          <>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-burgundy-800 focus:outline-none"
            >
              <option value="">Semua Role</option>
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={staffOnly}
                onChange={(e) => {
                  setStaffOnly(e.target.checked);
                  setPage(1);
                }}
                className="h-3.5 w-3.5 rounded border-slate-300 text-burgundy-800"
              />
              Staf Saja
            </label>
          </>
        }
        page={meta.page}
        totalPages={meta.totalPages}
        totalItems={meta.total}
        onPageChange={setPage}
      />

      <ResourceModalForm
        open={modalMode !== 'closed'}
        title={modalMode === 'create' ? 'Tambah Akun Baru' : `Edit Akun — ${editingRow?.name ?? ''}`}
        description="Perubahan role atau status nonaktif tercatat otomatis di Audit Logs."
        fields={formFields}
        initialValues={modalInitialValues}
        submitLabel={modalMode === 'create' ? 'Buat Akun' : 'Simpan Perubahan'}
        onClose={() => setModalMode('closed')}
        onSubmit={handleModalSubmit}
      />
    </div>
  );
}
