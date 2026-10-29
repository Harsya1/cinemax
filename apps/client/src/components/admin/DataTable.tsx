import type { ReactNode } from 'react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  title: string;
  subtitle?: string;
  columns: ColumnDef<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  isLoading: boolean;
  emptyMessage?: string;
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (next: string) => void;
  filterSlot?: ReactNode;
  headerRightSlot?: ReactNode;
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (nextPage: number) => void;
}

export function DataTable<T>({
  title,
  subtitle,
  columns,
  rows,
  rowKey,
  isLoading,
  emptyMessage = 'Tidak ada data yang cocok.',
  searchPlaceholder = 'Cari data...',
  searchValue,
  onSearchChange,
  filterSlot,
  headerRightSlot,
  page,
  totalPages,
  totalItems,
  onPageChange,
}: DataTableProps<T>) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {headerRightSlot && <div className="flex items-center gap-2">{headerRightSlot}</div>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-burgundy-800 focus:outline-none"
          />
          {filterSlot && <div className="flex flex-wrap items-center gap-2.5">{filterSlot}</div>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {columns.map((col) => (
                  <th key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    Memuat data...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={rowKey(row)} className="hover:bg-slate-50/80">
                    {columns.map((col) => (
                      <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-600 tabular-nums">
          <span>
            Total <strong className="font-semibold text-slate-900">{totalItems}</strong> data ·
            Halaman <strong className="font-semibold text-slate-900">{page}</strong> dari{' '}
            <strong className="font-semibold text-slate-900">{totalPages}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => onPageChange(page - 1)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={() => onPageChange(page + 1)}
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
