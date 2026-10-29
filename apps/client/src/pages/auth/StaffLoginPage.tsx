import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginInputSchema } from '@cinemax/shared';
import { useAuth } from '../../context/AuthContext';
import { ApiClientError } from '../../lib/api';

export function StaffLoginPage() {
  const navigate = useNavigate();
  const { loginStaff } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = loginInputSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Input tidak valid');
      return;
    }

    setSubmitting(true);
    try {
      await loginStaff(parsed.data);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Gagal masuk ke Workspace Staf',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-surface="workspace"
      className="flex min-h-screen flex-col items-center justify-center px-4 py-12 font-sans antialiased"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-burgundy-800 font-display text-base font-bold text-gold-400">
            CX
          </span>
          <div>
            <p className="font-display text-lg font-extrabold tracking-wide text-slate-900">
              CINEMAX WORKSPACE
            </p>
            <p className="text-xs font-medium text-gold-600">
              Internal Portal — Admin, POS, Service & Attendance
            </p>
          </div>
        </div>

        <h1 className="mt-6 font-display text-xl font-bold text-slate-900">
          Login Karyawan & Administrator
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Gunakan kredensial staf resmi CINEMAX. Akun pelanggan publik tidak diizinkan masuk.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700" htmlFor="staff-email">
              Email Karyawan
            </label>
            <input
              id="staff-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@cinemax.local"
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-burgundy-800 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700" htmlFor="staff-pass">
              Password
            </label>
            <input
              id="staff-pass"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-burgundy-800 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-lg bg-burgundy-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-burgundy-700 disabled:opacity-60"
          >
            {submitting ? 'Memverifikasi...' : 'Masuk ke Workspace'}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
          <Link to="/" className="font-semibold text-burgundy-800 hover:underline">
            Kembali ke Website Publik CINEMAX
          </Link>
        </div>
      </div>
    </div>
  );
}
