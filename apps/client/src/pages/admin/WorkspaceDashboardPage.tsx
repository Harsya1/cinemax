import { useEffect, useState } from 'react';
import { STAFF_ROLES, type HealthData } from '@cinemax/shared';
import { useAuth } from '../../context/AuthContext';
import { apiRequest, ApiClientError } from '../../lib/api';

const ROLE_CAPABILITIES: Record<string, string> = {
  admin: 'Akses penuh seluruh modul sistem, master studio, jadwal, POS, dan manajemen user.',
  manager: 'Pemantauan operasional bioskop, laporan harian, jadwal, dan audit.',
  cashier: 'Akses Ticket POS walk-in, manajemen booking tiket, dan cetak stub.',
  fnb_staff: 'Akses FnB POS, menu, resep, dan pemantauan stok bahan baku (Fase 3).',
  cleaner: 'Penerimaan & penyelesaian tugas pembersihan studio pasca tayang (Fase 4).',
  staff: 'Akses operasional staf umum dan ceklog kehadiran karyawan (Fase 5).',
};

export function WorkspaceDashboardPage() {
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [managerCheck, setManagerCheck] = useState<string>('Checking...');

  useEffect(() => {
    apiRequest<HealthData>('/health')
      .then(setHealth)
      .catch(() => setHealth(null));

    apiRequest<{ ok: boolean; role: string }>('/staff/ping')
      .then((res) => setManagerCheck(`GRANTED (${res.role})`))
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 403) {
          setManagerCheck('RESTRICTED (403 — Admin/Manager Only)');
        } else {
          setManagerCheck('UNAVAILABLE');
        }
      });
  }, []);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gold-600">
              Active Staff Session
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-slate-900">
              Selamat bertugas, {user.name}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {ROLE_CAPABILITIES[user.role] ?? 'Akses internal CINEMAX.'}
            </p>
          </div>
          <span className="rounded-lg bg-burgundy-800 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-gold-400">
            ROLE: {user.role}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">PostgreSQL & API Health</p>
          <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {health ? `${health.db.toUpperCase()} (${health.latencyMs}ms)` : 'OFFLINE'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">Executive Guard (/staff/ping)</p>
          <p className="mt-2 font-display text-lg font-bold text-burgundy-800 tabular-nums">
            {managerCheck}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">Active Staff Roles</p>
          <p className="mt-2 font-display text-2xl font-bold text-gold-600 tabular-nums">
            {STAFF_ROLES.length} Staff Tiers
          </p>
        </div>
      </div>
    </div>
  );
}
