import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { CustomerBookingSummary, WatchlistRow } from '@cinemax/shared';
import { useAuth } from '../../context/AuthContext';
import { ApiClientError, apiRequest } from '../../lib/api';
import { ETicketModal } from '../../components/public/ETicketModal';

export function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, refreshSession } = useAuth();

  const tabParam = (searchParams.get('tab') as 'tickets' | 'watchlist' | 'settings') || 'tickets';
  const [activeTab, setActiveTab] = useState<'tickets' | 'watchlist' | 'settings'>(tabParam);

  // Tickets
  const [activeTickets, setActiveTickets] = useState<CustomerBookingSummary[]>([]);
  const [pastTickets, setPastTickets] = useState<CustomerBookingSummary[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<CustomerBookingSummary | null>(null);

  // Watchlist
  const [watchlistItems, setWatchlistItems] = useState<WatchlistRow[]>([]);
  const [isLoadingWatchlist, setIsLoadingWatchlist] = useState(false);

  // Settings
  const [name, setName] = useState(user?.name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<{
    type: 'ok' | 'err';
    message: string;
  } | null>(null);

  const loadTickets = useCallback(async () => {
    setIsLoadingTickets(true);
    try {
      const res = await apiRequest<{
        activeTickets: CustomerBookingSummary[];
        pastTickets: CustomerBookingSummary[];
      }>('/profile/tickets');
      setActiveTickets(res.activeTickets);
      setPastTickets(res.pastTickets);
    } catch {
      // Ignored
    } finally {
      setIsLoadingTickets(false);
    }
  }, []);

  const loadWatchlist = useCallback(async () => {
    setIsLoadingWatchlist(true);
    try {
      const res = await apiRequest<WatchlistRow[]>('/public/watchlist');
      setWatchlistItems(res);
    } catch {
      // Ignored
    } finally {
      setIsLoadingWatchlist(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (activeTab === 'watchlist') {
      void loadWatchlist();
    }
  }, [activeTab, loadWatchlist]);

  // Sync tab with URL
  function handleSelectTab(t: 'tickets' | 'watchlist' | 'settings') {
    setActiveTab(t);
    setSearchParams({ tab: t }, { replace: true });
  }

  async function handleUpdateSettings(e: FormEvent) {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setSettingsFeedback(null);

    try {
      const payload: Record<string, unknown> = {
        name,
        phoneNumber,
      };
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      await apiRequest('/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setSettingsFeedback({
        type: 'ok',
        message: 'Profil berhasil diperbarui.',
      });
      setCurrentPassword('');
      setNewPassword('');
      await refreshSession();
    } catch (err) {
      setSettingsFeedback({
        type: 'err',
        message: err instanceof ApiClientError ? err.message : 'Gagal memperbarui profil',
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8 space-y-8">
      {/* Profile Header Card */}
      <div className="rounded-3xl border border-white/10 bg-surface p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar Initials */}
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-burgundy-700 to-burgundy-900 border-2 border-gold-400 font-display text-3xl font-black text-gold-400 shadow-lg">
            {user.name.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <h1 className="font-display text-2xl font-extrabold text-white sm:text-3xl">
              {user.name}
            </h1>
            <p className="text-xs text-muted">{user.email}</p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1">
              {/* Points Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-gold-500/10 px-4 py-1.5 text-xs font-bold text-gold-400 tabular-nums">
                <span>★</span>
                <span>{user.points.toLocaleString('id-ID')} Poin Member CINEMAX</span>
              </div>

              {user.phoneNumber && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                  {user.phoneNumber}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-4 overflow-x-auto">
        <button
          type="button"
          onClick={() => handleSelectTab('tickets')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'tickets'
              ? 'bg-gold-500 text-obsidian-950 shadow-md'
              : 'border border-white/10 bg-surface text-zinc-300 hover:bg-white/10'
          }`}
        >
          <span>🎟</span> Tiket Saya ({activeTickets.length})
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('watchlist')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'watchlist'
              ? 'bg-gold-500 text-obsidian-950 shadow-md'
              : 'border border-white/10 bg-surface text-zinc-300 hover:bg-white/10'
          }`}
        >
          <span>⭐</span> Watchlist Film
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('settings')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'settings'
              ? 'bg-gold-500 text-obsidian-950 shadow-md'
              : 'border border-white/10 bg-surface text-zinc-300 hover:bg-white/10'
          }`}
        >
          <span>⚙</span> Pengaturan Akun
        </button>
      </div>

      {/* Tab 1: Tickets */}
      {activeTab === 'tickets' && (
        <div className="space-y-8">
          {/* Active Tickets Section */}
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              Tiket Aktif Bioskop
            </h2>

            {isLoadingTickets ? (
              <div className="py-12 text-center text-xs text-muted">Memuat tiket Anda...</div>
            ) : activeTickets.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-surface p-10 text-center space-y-3">
                <p className="text-sm font-semibold text-white">Tidak ada tiket aktif saat ini</p>
                <p className="text-xs text-muted">
                  Tiket yang sudah lunas akan muncul di sini lengkap dengan QR Code pintu masuk.
                </p>
                <Link
                  to="/"
                  className="inline-block rounded-xl bg-gold-500 px-5 py-2 text-xs font-bold text-obsidian-950 hover:bg-gold-400 transition-colors"
                >
                  Pesan Tiket Film
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {activeTickets.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-col justify-between rounded-2xl border border-white/10 bg-surface p-5 space-y-4 hover:border-gold-500/40 transition-colors shadow-lg"
                  >
                    <div className="flex items-start gap-4">
                      {t.showtime.posterUrl && (
                        <img
                          src={t.showtime.posterUrl}
                          alt={t.showtime.movieTitle}
                          className="h-24 w-16 rounded-lg object-cover border border-white/10 shadow"
                        />
                      )}
                      <div className="space-y-1">
                        <span className="rounded bg-gold-500/10 border border-gold-500/40 px-2 py-0.5 text-[10px] font-bold text-gold-400 font-mono">
                          {t.bookingCode}
                        </span>
                        <h3 className="font-display text-base font-bold text-white line-clamp-1">
                          {t.showtime.movieTitle}
                        </h3>
                        <p className="text-xs text-gold-400">
                          {t.showtime.studioName} ({t.showtime.studioType.toUpperCase()})
                        </p>
                        <p className="text-[11px] text-zinc-300 tabular-nums">
                          {new Date(t.showtime.startTime).toLocaleDateString('id-ID', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}{' '}
                          ·{' '}
                          {new Date(t.showtime.startTime).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          WIB
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/5 bg-obsidian-950 p-3 flex items-center justify-between text-xs">
                      <div>
                        <p className="text-[10px] text-muted uppercase font-semibold">KURSI</p>
                        <p className="font-bold text-gold-400 text-sm">{t.seatCodes.join(', ')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted uppercase font-semibold">TOTAL</p>
                        <p className="font-bold text-white tabular-nums">
                          Rp {t.totalPrice.toLocaleString('id-ID')}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedTicket(t)}
                      className="w-full rounded-xl bg-gold-500 py-2.5 text-center font-display text-xs font-bold text-obsidian-950 shadow-md hover:bg-gold-400 transition-colors"
                    >
                      Buka E-Ticket QR Masuk Studio →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past / History Tickets */}
          {pastTickets.length > 0 && (
            <div className="space-y-3 pt-6 border-t border-white/10">
              <h3 className="font-display text-sm font-bold text-zinc-400 uppercase tracking-wider">
                Riwayat Tiket Sebelumnya
              </h3>
              <div className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-surface">
                {pastTickets.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs"
                  >
                    <div>
                      <p className="font-bold text-white">{t.showtime.movieTitle}</p>
                      <p className="text-muted text-[11px]">
                        {t.showtime.studioName} · Kursi: {t.seatCodes.join(', ')} ·{' '}
                        {new Date(t.showtime.startTime).toLocaleDateString('id-ID')}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-zinc-300 tabular-nums">
                        Rp {t.totalPrice.toLocaleString('id-ID')}
                      </span>
                      <span className="rounded bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-400">
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Watchlist */}
      {activeTab === 'watchlist' && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-bold text-white">Film yang Anda Simpan</h2>

          {isLoadingWatchlist ? (
            <div className="py-12 text-center text-xs text-muted">Memuat watchlist...</div>
          ) : watchlistItems.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-surface p-12 text-center space-y-3">
              <p className="text-sm font-semibold text-white">Watchlist Anda masih kosong</p>
              <Link
                to="/"
                className="inline-block rounded-xl bg-gold-500 px-5 py-2 text-xs font-bold text-obsidian-950"
              >
                Jelajahi Film
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {watchlistItems.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-white/10 bg-surface overflow-hidden p-3.5 space-y-3 shadow-md"
                >
                  <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-obsidian-950">
                    {m.posterUrl && (
                      <img src={m.posterUrl} alt={m.title} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-display text-sm font-bold text-white line-clamp-1">
                      {m.title}
                    </h4>
                    <p className="text-xs text-gold-400 mt-0.5">★ {m.voteAverage.toFixed(1)}</p>
                  </div>
                  <Link
                    to={`/movie/${m.tmdbId}`}
                    className="block w-full rounded-lg bg-white/5 py-1.5 text-center text-xs font-semibold text-zinc-200 hover:bg-gold-500 hover:text-obsidian-950 transition-colors"
                  >
                    Lihat Jadwal
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Settings */}
      {activeTab === 'settings' && (
        <div className="max-w-xl rounded-3xl border border-white/10 bg-surface p-6 sm:p-8 space-y-6">
          <h2 className="font-display text-xl font-bold text-white border-b border-white/10 pb-4">
            Pengaturan Akun & Password
          </h2>

          {settingsFeedback && (
            <div
              className={`rounded-xl p-3.5 text-xs font-medium border ${
                settingsFeedback.type === 'ok'
                  ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-200'
                  : 'border-rose-500/40 bg-rose-950/60 text-rose-200'
              }`}
            >
              {settingsFeedback.message}
            </div>
          )}

          <form onSubmit={handleUpdateSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300" htmlFor="prof-name">
                Nama Lengkap
              </label>
              <input
                id="prof-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-obsidian-950 px-3.5 py-2.5 text-sm text-white focus:border-gold-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300" htmlFor="prof-phone">
                Nomor Telepon / WhatsApp
              </label>
              <input
                id="prof-phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0812xxxxxxxx"
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-obsidian-950 px-3.5 py-2.5 text-sm text-white focus:border-gold-500 focus:outline-none"
              />
            </div>

            <div className="border-t border-white/10 pt-4 space-y-3">
              <p className="text-xs font-bold text-gold-400">Ganti Password (Opsional)</p>

              <div>
                <label className="block text-xs font-semibold text-zinc-300" htmlFor="prof-curr-pass">
                  Password Saat Ini
                </label>
                <input
                  id="prof-curr-pass"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-obsidian-950 px-3.5 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300" htmlFor="prof-new-pass">
                  Password Baru (Min. 8 karakter)
                </label>
                <input
                  id="prof-new-pass"
                  type="password"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-obsidian-950 px-3.5 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="mt-4 w-full rounded-xl bg-gold-500 py-3 text-xs font-bold text-obsidian-950 hover:bg-gold-400 transition-colors disabled:opacity-50"
            >
              {isUpdatingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </form>
        </div>
      )}

      {/* E-Ticket QR Modal */}
      <ETicketModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
    </div>
  );
}
