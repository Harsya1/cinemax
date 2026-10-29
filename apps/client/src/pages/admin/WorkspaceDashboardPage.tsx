import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardSummary, HealthData } from '@cinemax/shared';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';

export function WorkspaceDashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sumRes, healthRes] = await Promise.all([
        apiRequest<DashboardSummary>('/dashboard/summary'),
        apiRequest<HealthData>('/health').catch(() => null),
      ]);
      setSummary(sumRes);
      setHealth(healthRes);
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (!user) return null;

  const isStaffOperations =
    user.role === 'admin' || user.role === 'manager' || user.role === 'cashier';

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Actions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-bold uppercase tracking-wider text-burgundy-800">
                CINEMAX Live Operations
              </p>
            </div>
            <h1 className="mt-1 font-display text-2xl font-black text-slate-900">
              Selamat bertugas, {user.name}
            </h1>
            <p className="text-xs text-slate-500">
              Sistem bioskop monorepo aktif · Database PostgreSQL:{' '}
              <strong className="text-emerald-700">
                {health ? `${health.db.toUpperCase()} (${health.latencyMs}ms)` : 'ONLINE'}
              </strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ↻ Refresh Data
            </button>
            <span className="rounded-lg bg-burgundy-800 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-gold-400 shadow-2xs">
              {user.role}
            </span>
          </div>
        </div>

        {/* Quick Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-2">
            Aksi Cepat:
          </span>

          {isStaffOperations && (
            <Link
              to="/pos/ticket"
              className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-2xs"
            >
              💵 Buka Ticket POS
            </Link>
          )}

          <Link
            to="/admin/validator"
            className="rounded-lg bg-burgundy-800 px-3.5 py-1.5 text-xs font-bold text-gold-400 hover:bg-burgundy-700 transition-colors shadow-2xs"
          >
            📱 Validator Masuk Studio
          </Link>

          {isStaffOperations && (
            <>
              <Link
                to="/admin/showtimes"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                🗓 Jadwal Tayang
              </Link>
              <Link
                to="/admin/movies"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                🎬 Sinkron TMDb
              </Link>
            </>
          )}
        </div>
      </div>

      {/* 4 Real-time KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Pendapatan Hari Ini */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Pendapatan Tiket Hari Ini
          </p>
          <p className="font-display text-2xl font-black text-slate-900 tabular-nums">
            {isLoading ? (
              <span className="text-slate-300">...</span>
            ) : (
              `Rp ${(summary?.todayRevenue ?? 0).toLocaleString('id-ID')}`
            )}
          </p>
          <p className="text-[11px] text-emerald-700 font-semibold">Transaksi lunas & walk-in POS</p>
        </div>

        {/* KPI 2: Tiket Terjual */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Tiket Terjual Hari Ini
          </p>
          <p className="font-display text-2xl font-black text-burgundy-800 tabular-nums">
            {isLoading ? (
              <span className="text-slate-300">...</span>
            ) : (
              `${summary?.todayTicketsSold ?? 0} Lembar`
            )}
          </p>
          <p className="text-[11px] text-slate-500">Kapasitas kursi terkonfirmasi</p>
        </div>

        {/* KPI 3: Check-in Pintu */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Penonton Check-in Studio
          </p>
          <p className="font-display text-2xl font-black text-slate-900 tabular-nums">
            {isLoading ? (
              <span className="text-slate-300">...</span>
            ) : (
              `${summary?.todayCheckInCount ?? 0} Orang`
            )}
          </p>
          <p className="text-[11px] text-slate-500">
            {summary && summary.todayTicketsSold > 0
              ? `${Math.round((summary.todayCheckInCount / summary.todayTicketsSold) * 100)}% dari tiket terjual`
              : 'Belum ada check-in'}
          </p>
        </div>

        {/* KPI 4: Okupansi Studio Rata-rata */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Okupansi Rata-rata
          </p>
          <p className="font-display text-2xl font-black text-gold-600 tabular-nums">
            {isLoading ? (
              <span className="text-slate-300">...</span>
            ) : (
              `${summary?.occupancyRatePercent ?? 0}%`
            )}
          </p>
          <p className="text-[11px] text-slate-500">Keterisian jadwal aktif hari ini</p>
        </div>
      </div>

      {/* Grid 2 Kolom: Studio Status & Live Activity Feed */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Kolom Kiri (7 cols): Okupansi Studio Hari Ini */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Status Studio Hari Ini
              </h2>
              <p className="text-xs text-slate-500">Kapasitas dan tingkat keterisian kursi per studio</p>
            </div>
            <Link
              to="/admin/studios"
              className="text-xs font-semibold text-burgundy-800 hover:text-burgundy-700"
            >
              Atur Studio →
            </Link>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Memuat data studio...</div>
          ) : !summary || summary.todayStudios.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Belum ada master studio aktif.
            </div>
          ) : (
            <div className="space-y-4">
              {summary.todayStudios.map((std) => (
                <div
                  key={std.studioId}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-display font-bold text-slate-900">{std.studioName}</span>
                      <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                        {std.studioType}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-burgundy-800 tabular-nums">
                      {std.occupiedSeats} kursi terisi ({std.occupancyPercent}%)
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full transition-all duration-500 ${
                        std.occupancyPercent > 75
                          ? 'bg-rose-500'
                          : std.occupancyPercent > 30
                            ? 'bg-emerald-500'
                            : 'bg-gold-500'
                      }`}
                      style={{ width: `${Math.min(100, std.occupancyPercent)}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>{std.activeShowtimesCount} sesi tayang aktif</span>
                    <span>Kapasitas: {std.totalSeats} kursi / sesi</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kolom Kanan (5 cols): Live Activity Feed */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Aktivitas Terkini
              </h2>
              <p className="text-xs text-slate-500">Audit log real-time transaksi & check-in</p>
            </div>
            {isStaffOperations && (
              <Link
                to="/admin/audit-logs"
                className="text-xs font-semibold text-burgundy-800 hover:text-burgundy-700"
              >
                Semua Log →
              </Link>
            )}
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Memuat aktivitas...</div>
          ) : !summary || summary.recentActivity.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Belum ada aktivitas tercatat hari ini.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto pr-1">
              {summary.recentActivity.map((log) => {
                let badge = 'bg-slate-100 text-slate-700';
                if (log.action.includes('PAYMENT')) badge = 'bg-emerald-100 text-emerald-800';
                else if (log.action.includes('CHECKOUT')) badge = 'bg-blue-100 text-blue-800';
                else if (log.action.includes('REDEEMED')) badge = 'bg-purple-100 text-purple-800';

                const timeStr = new Date(log.createdAt).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div key={log.id} className="py-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badge}`}>
                        {log.action}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                        {timeStr}
                      </span>
                    </div>
                    <p className="text-slate-800 text-[11px] leading-relaxed">
                      {log.description}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Oleh: <strong className="text-slate-600">{log.actorName ?? 'System'}</strong>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
