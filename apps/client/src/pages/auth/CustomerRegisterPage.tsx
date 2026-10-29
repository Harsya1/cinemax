import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerInputSchema } from '@cinemax/shared';
import { useAuth } from '../../context/AuthContext';
import { ApiClientError } from '../../lib/api';

export function CustomerRegisterPage() {
  const navigate = useNavigate();
  const { registerCustomer } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = registerInputSchema.safeParse({
      name,
      email,
      phoneNumber,
      password,
      passwordConfirmation,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Input registrasi belum valid');
      return;
    }

    setSubmitting(true);
    try {
      await registerCustomer({
        name,
        email,
        phoneNumber,
        password,
        passwordConfirmation,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Registrasi gagal');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="cx-cinema-pattern flex min-h-[calc(100vh-4.5rem)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-8 shadow-2xl">
        <div className="mb-6">
          <span className="inline-block rounded-full border border-burgundy-700/80 bg-burgundy-900/60 px-3 py-1 text-[11px] font-semibold tracking-wider text-gold-400 uppercase">
            CINEMAX Club
          </span>
          <h1 className="mt-3 font-display text-2xl font-extrabold text-white">
            Buat Akun Pelanggan
          </h1>
          <p className="mt-1 text-sm text-muted">
            Nikmati akses booking cepat dan e-ticket QR langsung di profil Anda.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-rose-500/40 bg-rose-950/60 px-4 py-3 text-xs font-medium text-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300" htmlFor="reg-name">
              Nama Lengkap
            </label>
            <input
              id="reg-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama Anda"
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-obsidian-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-gold-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300" htmlFor="reg-email">
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-obsidian-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-gold-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300" htmlFor="reg-phone">
              Nomor Telepon (Opsional)
            </label>
            <input
              id="reg-phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="0812xxxxxxxx"
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-obsidian-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-gold-500 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-300" htmlFor="reg-pass">
                Password
              </label>
              <input
                id="reg-pass"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 karakter"
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-obsidian-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-gold-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold text-zinc-300"
                htmlFor="reg-pass-confirm"
              >
                Konfirmasi
              </label>
              <input
                id="reg-pass-confirm"
                type="password"
                required
                minLength={8}
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                placeholder="Ulangi password"
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-obsidian-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-gold-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-lg bg-gold-500 px-4 py-3 text-sm font-bold text-obsidian-950 transition-colors hover:bg-gold-400 disabled:opacity-60"
          >
            {submitting ? 'Mendaftarkan...' : 'Buat Akun Sekarang'}
          </button>
        </form>

        <p className="mt-6 border-t border-white/10 pt-5 text-center text-xs text-muted">
          Sudah punya akun?{' '}
          <Link to="/login" className="font-semibold text-gold-400 hover:text-gold-500">
            Sign In di sini
          </Link>
        </p>
      </div>
    </section>
  );
}
