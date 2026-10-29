import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginInputSchema } from '@cinemax/shared';
import { useAuth } from '../../context/AuthContext';
import { ApiClientError } from '../../lib/api';

export function CustomerLoginPage() {
  const navigate = useNavigate();
  const { loginCustomer } = useAuth();
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
      await loginCustomer(parsed.data);
      navigate('/', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Gagal masuk ke akun pelanggan',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="cx-cinema-pattern flex min-h-[calc(100vh-4.5rem)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-8 shadow-2xl">
        <div className="mb-6">
          <span className="inline-block rounded-full border border-burgundy-700/80 bg-burgundy-900/60 px-3 py-1 text-[11px] font-semibold tracking-wider text-gold-400 uppercase">
            Member Access
          </span>
          <h1 className="mt-3 font-display text-2xl font-extrabold text-white">
            Sign In to CINEMAX
          </h1>
          <p className="mt-1 text-sm text-muted">
            Masuk untuk memesan kursi, kelola watchlist, dan kumpulkan poin tiket.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-rose-500/40 bg-rose-950/60 px-4 py-3 text-xs font-medium text-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300" htmlFor="cust-email">
              Email
            </label>
            <input
              id="cust-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@cinemax.local"
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-obsidian-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-gold-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300" htmlFor="cust-pass">
              Password
            </label>
            <input
              id="cust-pass"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-obsidian-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-gold-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-lg bg-gold-500 px-4 py-3 text-sm font-bold text-obsidian-950 transition-colors hover:bg-gold-400 disabled:opacity-60"
          >
            {submitting ? 'Memproses...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-muted">
          <span>
            Belum punya akun?{' '}
            <Link to="/register" className="font-semibold text-gold-400 hover:text-gold-500">
              Daftar Member
            </Link>
          </span>
          <Link to="/admin/login" className="text-zinc-400 hover:text-white">
            Portal Staf
          </Link>
        </div>
      </div>
    </section>
  );
}
