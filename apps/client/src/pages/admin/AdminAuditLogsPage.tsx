import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuditLogRow, PaginationMeta } from '@cinemax/shared';
import { apiRequestWithMeta } from '../../lib/api';
import { DataTable, type ColumnDef } from '../../components/admin/DataTable';

const AUDIT_ACTIONS = [
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DEACTIVATED',
  'USER_ACTIVATED',
  'USER_DELETED',
];

export function AdminAuditLogsPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);

  const loadAudits = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
      });
      if (search.trim()) params.set('search', search.trim());
      if (actionFilter) params.set('action', actionFilter);

      const res = await apiRequestWithMeta<AuditLogRow[]>(
        `/admin/audit-logs?${params.toString()}`,
      );
      setRows(res.data);
      setMeta(res.meta);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, actionFilter]);

  useEffect(() => {
    void loadAudits();
  }, [loadAudits]);

  const columns = useMemo<ColumnDef<AuditLogRow>[]>(
    () => [
      {
        key: 'createdAt',
        header: 'Waktu',
        className: 'whitespace-nowrap tabular-nums text-xs text-slate-600',
        render: (r) => new Date(r.createdAt).toLocaleString('id-ID'),
      },
      {
        key: 'actor',
        header: 'Pelaku (Actor)',
        render: (r) =>
          r.actor ? (
            <div>
              <p className="font-semibold text-slate-900">{r.actor.name}</p>
              <p className="text-xs text-slate-500">
                {r.actor.email} · <span className="uppercase">{r.actor.role}</span>
              </p>
            </div>
          ) : (
            <span className="text-xs italic text-slate-400">System / Deleted Actor</span>
          ),
      },
      {
        key: 'action',
        header: 'Aksi',
        render: (r) => (
          <span
            className={
              r.action.includes('DELETED') || r.action.includes('DEACTIVATED')
                ? 'rounded-md bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-200'
                : 'rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-gold-600 ring-1 ring-amber-200'
            }
          >
            {r.action}
          </span>
        ),
      },
      {
        key: 'target',
        header: 'Target',
        className: 'text-xs font-medium text-slate-600 tabular-nums',
        render: (r) => `${r.targetType}${r.targetId ? ` #${r.targetId}` : ''}`,
      },
      {
        key: 'description',
        header: 'Rincian',
        className: 'text-sm text-slate-700',
        render: (r) => r.description,
      },
    ],
    [],
  );

  return (
    <DataTable
      title="Audit Logs Sistem"
      subtitle="Jejak aktivitas administrasi dan operasional CINEMAX secara kronologis."
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      isLoading={isLoading}
      emptyMessage="Belum ada jejak audit yang tercatat."
      searchPlaceholder="Cari deskripsi atau kode aksi..."
      searchValue={search}
      onSearchChange={(val) => {
        setSearch(val);
        setPage(1);
      }}
      filterSlot={
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-burgundy-800 focus:outline-none"
        >
          <option value="">Semua Kode Aksi</option>
          {AUDIT_ACTIONS.map((act) => (
            <option key={act} value={act}>
              {act}
            </option>
          ))}
        </select>
      }
      page={meta.page}
      totalPages={meta.totalPages}
      totalItems={meta.total}
      onPageChange={setPage}
    />
  );
}
