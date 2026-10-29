import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { BookingDetail, SeatMapResponse, SeatSlot } from '@cinemax/shared';
import { useAuth } from '../../context/AuthContext';
import { ApiClientError, apiRequest } from '../../lib/api';

const POINTS_PER_TICKET: Record<string, number> = {
  regular: 10,
  '3d': 13,
  premier: 15,
};

export function BookingPage() {
  const { showtimeId } = useParams<{ showtimeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState<SeatMapResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection
  const [selectedSeatCodes, setSelectedSeatCodes] = useState<string[]>([]);
  const [isHolding, setIsHolding] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);

  // Active Held Booking State
  const [activeBooking, setActiveBooking] = useState<BookingDetail | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isCancelling, setIsCancelling] = useState(false);

  const loadSeatMap = useCallback(async () => {
    if (!showtimeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest<SeatMapResponse>(
        `/booking/showtimes/${showtimeId}/seats`,
      );
      setData(res);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal memuat denah kursi');
    } finally {
      setIsLoading(false);
    }
  }, [showtimeId]);

  useEffect(() => {
    void loadSeatMap();
  }, [loadSeatMap]);

  // Countdown timer for held booking
  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          // Time expired
          setActiveBooking(null);
          void loadSeatMap();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingSeconds, loadSeatMap]);

  function toggleSeat(slot: SeatSlot) {
    if (activeBooking) return; // Cannot modify while in active hold
    if (slot.status !== 'available') return;

    setHoldError(null);
    if (selectedSeatCodes.includes(slot.code)) {
      setSelectedSeatCodes((prev) => prev.filter((c) => c !== slot.code));
    } else {
      if (selectedSeatCodes.length >= 6) {
        setHoldError('Maksimal pemesanan adalah 6 kursi per transaksi.');
        return;
      }
      setSelectedSeatCodes((prev) => [...prev, slot.code].sort());
    }
  }

  async function handleHoldSeats() {
    if (!user) {
      navigate('/login');
      return;
    }
    if (selectedSeatCodes.length === 0) {
      setHoldError('Silakan pilih minimal 1 kursi.');
      return;
    }

    setIsHolding(true);
    setHoldError(null);
    try {
      const res = await apiRequest<BookingDetail>('/booking/hold', {
        method: 'POST',
        body: JSON.stringify({
          showtimeId: Number(showtimeId),
          seatCodes: selectedSeatCodes,
        }),
      });

      setActiveBooking(res);
      setRemainingSeconds(res.remainingSeconds);
      // Reload seat map so seats show as selected/held
      await loadSeatMap();
    } catch (err) {
      setHoldError(
        err instanceof ApiClientError
          ? err.message
          : 'Kursi tidak dapat diproses saat ini. Silakan muat ulang denah.',
      );
      await loadSeatMap();
    } finally {
      setIsHolding(false);
    }
  }

  async function handleCancelHold() {
    if (!activeBooking) return;
    setIsCancelling(true);
    try {
      await apiRequest(`/booking/${activeBooking.bookingCode}/cancel`, {
        method: 'POST',
      });
      setActiveBooking(null);
      setSelectedSeatCodes([]);
      setRemainingSeconds(0);
      await loadSeatMap();
    } catch {
      // Ignored
    } finally {
      setIsCancelling(false);
    }
  }

  const studio = data?.studio;
  const showtime = data?.showtime;
  const seats = data?.seats ?? [];

  // Price calculations
  const pricePerTicket = showtime?.price ?? 0;
  const totalPrice = activeBooking
    ? activeBooking.totalPrice
    : selectedSeatCodes.length * pricePerTicket;

  const pointsPerTicket = POINTS_PER_TICKET[studio?.type ?? 'regular'] ?? 10;
  const pointsEarned = (activeBooking ? activeBooking.totalSeats : selectedSeatCodes.length) * pointsPerTicket;

  const timerDisplay = useMemo(() => {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [remainingSeconds]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-muted">
        Menyiapkan denah kursi bioskop CINEMAX...
      </div>
    );
  }

  if (error || !studio || !showtime) {
    return (
      <div className="mx-auto max-w-xl py-24 text-center space-y-4">
        <h2 className="font-display text-2xl font-bold text-white">Jadwal Tidak Ditemukan</h2>
        <p className="text-sm text-muted">{error || 'Data penayangan tidak tersedia.'}</p>
        <Link
          to="/"
          className="inline-block rounded-xl bg-gold-500 px-6 py-2.5 text-xs font-bold text-obsidian-950"
        >
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 space-y-8">
      {/* Showtime Breadcrumb & Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-4">
          {showtime.movie.posterUrl && (
            <img
              src={showtime.movie.posterUrl}
              alt={showtime.movie.title}
              className="h-16 w-11 rounded-lg object-cover shadow-md border border-white/10"
            />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span
                className={
                  studio.type === 'premier'
                    ? 'rounded bg-burgundy-900/90 border border-burgundy-700 px-2 py-0.5 text-[10px] font-bold uppercase text-gold-400'
                    : studio.type === '3d'
                      ? 'rounded bg-sky-950 border border-sky-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-300'
                      : 'rounded bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase text-zinc-300'
                }
              >
                {studio.name}
              </span>
              <span className="text-xs text-muted">· {studio.totalSeats} Kursi</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
              {showtime.movie.title}
            </h1>
            <p className="mt-0.5 text-xs text-zinc-300 tabular-nums">
              {new Date(showtime.startTime).toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}{' '}
              ·{' '}
              {new Date(showtime.startTime).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              WIB
            </p>
          </div>
        </div>

        {/* Active Hold Countdown Banner */}
        {activeBooking && (
          <div className="rounded-2xl border border-gold-500/40 bg-gold-500/10 px-5 py-3 text-right">
            <p className="text-[11px] font-bold tracking-wider text-gold-400 uppercase">
              SISA WAKTU PEMBAYARAN
            </p>
            <p className="font-display text-2xl font-extrabold text-gold-400 tabular-nums animate-pulse">
              {timerDisplay}
            </p>
            <p className="text-[10px] text-zinc-400">Kode: {activeBooking.bookingCode}</p>
          </div>
        )}
      </div>

      {holdError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/60 p-4 text-xs font-medium text-rose-200">
          {holdError}
        </div>
      )}

      {/* Main Booking Workspace: Seat Grid & Sidebar */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left: Seat Grid (8 cols) */}
        <div className="lg:col-span-8 rounded-3xl border border-white/10 bg-surface p-6 sm:p-8 space-y-8">
          {/* Cinema Screen Header */}
          <div className="mx-auto max-w-lg text-center space-y-2">
            <div className="h-2 w-full rounded-t-full bg-gradient-to-r from-zinc-700 via-gold-500 to-zinc-700 shadow-lg shadow-gold-500/10" />
            <p className="text-[11px] font-bold tracking-widest text-zinc-400 uppercase">
              LAYAR BIOSKOP (SCREEN)
            </p>
          </div>

          {/* Interactive Seat Layout */}
          <div className="overflow-x-auto pb-4">
            <div className="inline-block min-w-full text-center">
              <div className="space-y-2">
                {Array.from({ length: studio.rowsCount }, (_, r) => {
                  const letter = String.fromCharCode(65 + r);
                  const rowSeats = seats.filter((s) => s.row === letter);

                  return (
                    <div key={letter} className="flex items-center justify-center gap-2">
                      <span className="w-6 text-right font-display text-xs font-bold text-zinc-500">
                        {letter}
                      </span>

                      <div className="flex gap-1.5">
                        {rowSeats.map((slot) => {
                          const isLocallySelected =
                            selectedSeatCodes.includes(slot.code) || slot.status === 'selected';
                          const isDisabled = slot.status === 'disabled';
                          const isOccupied = slot.status === 'occupied';
                          const isHeld = slot.status === 'held';

                          let buttonStyle = 'bg-obsidian-900 border-white/15 text-zinc-200 hover:border-gold-500';
                          if (studio.type === 'premier') {
                            buttonStyle =
                              'bg-burgundy-900/60 border-burgundy-700 text-rose-200 hover:border-gold-400';
                          }

                          if (isLocallySelected) {
                            buttonStyle =
                              'bg-gold-500 border-gold-400 text-obsidian-950 font-bold scale-110 shadow-lg shadow-gold-500/20';
                          } else if (isOccupied) {
                            buttonStyle =
                              'bg-zinc-800/80 border-white/5 text-zinc-600 cursor-not-allowed opacity-50';
                          } else if (isHeld) {
                            buttonStyle =
                              'bg-amber-950/80 border-amber-600 text-amber-400 cursor-not-allowed opacity-60';
                          } else if (isDisabled) {
                            buttonStyle =
                              'border-transparent bg-transparent text-transparent pointer-events-none';
                          }

                          return (
                            <button
                              key={slot.code}
                              type="button"
                              disabled={isDisabled || isOccupied || isHeld}
                              onClick={() => toggleSeat(slot)}
                              title={
                                isDisabled
                                  ? 'Lorong'
                                  : isOccupied
                                    ? `Kursi ${slot.code} (Sudah Dipesan)`
                                    : isHeld
                                      ? `Kursi ${slot.code} (Sedang Diproses)`
                                      : `Kursi ${slot.code} — Rp ${slot.price.toLocaleString('id-ID')}`
                              }
                              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold tabular-nums border transition-all ${buttonStyle}`}
                            >
                              {isDisabled ? '' : slot.col}
                            </button>
                          );
                        })}
                      </div>

                      <span className="w-6 text-left font-display text-xs font-bold text-zinc-500">
                        {letter}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Seat Legends */}
          <div className="flex flex-wrap items-center justify-center gap-6 border-t border-white/10 pt-6 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-md border border-white/20 bg-obsidian-900" />
              <span>Tersedia</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-md border border-gold-400 bg-gold-500" />
              <span className="text-white font-medium">Pilihan Anda</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-md border border-white/5 bg-zinc-800/80 opacity-50" />
              <span>Terisi</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-md border border-amber-600 bg-amber-950/80 opacity-60" />
              <span>Sedang Diproses</span>
            </div>
          </div>
        </div>

        {/* Right: Order Summary Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-surface p-6 shadow-xl space-y-6">
            <h2 className="font-display text-lg font-bold text-white border-b border-white/10 pb-4">
              Ringkasan Pemesanan
            </h2>

            <div className="space-y-4 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Studio</span>
                <span className="font-semibold text-white">{studio.name}</span>
              </div>

              <div className="flex justify-between text-zinc-400">
                <span>Harga per Tiket</span>
                <span className="font-semibold text-white tabular-nums">
                  Rp {pricePerTicket.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="flex justify-between text-zinc-400">
                <span>Kursi Dipilih</span>
                <span className="font-bold text-gold-400">
                  {activeBooking
                    ? activeBooking.seatCodes.join(', ')
                    : selectedSeatCodes.length > 0
                      ? selectedSeatCodes.join(', ')
                      : 'Belum memilih kursi'}
                </span>
              </div>

              <div className="flex justify-between text-zinc-400">
                <span>Reward Poin</span>
                <span className="font-semibold text-emerald-400 tabular-nums">
                  +{pointsEarned} Poin
                </span>
              </div>

              <div className="border-t border-white/10 pt-4 flex justify-between items-baseline">
                <span className="text-sm font-bold text-white">Total Bayar</span>
                <span className="font-display text-2xl font-extrabold text-gold-400 tabular-nums">
                  Rp {totalPrice.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            {activeBooking ? (
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/payment/${activeBooking.bookingCode}`, {
                      state: { booking: activeBooking },
                    })
                  }
                  className="w-full rounded-xl bg-gold-500 py-3.5 text-center font-display text-sm font-bold text-obsidian-950 shadow-lg shadow-gold-500/20 hover:bg-gold-400 transition-colors"
                >
                  Lanjut ke Pembayaran ({timerDisplay}) →
                </button>

                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={handleCancelHold}
                  className="w-full rounded-xl border border-rose-500/30 bg-rose-950/20 py-2.5 text-center text-xs font-semibold text-rose-300 hover:bg-rose-900/30 transition-colors disabled:opacity-50"
                >
                  {isCancelling ? 'Membatalkan...' : 'Batalkan Pilihan Kursi'}
                </button>
              </div>
            ) : (
              <div className="pt-2">
                <button
                  type="button"
                  disabled={selectedSeatCodes.length === 0 || isHolding}
                  onClick={handleHoldSeats}
                  className="w-full rounded-xl bg-gold-500 py-3.5 text-center font-display text-sm font-bold text-obsidian-950 shadow-lg shadow-gold-500/20 hover:bg-gold-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isHolding
                    ? 'Mengunci Kursi...'
                    : user
                      ? `Kunci Kursi (${selectedSeatCodes.length}) & Bayar`
                      : 'Login untuk Memesan Tiket'}
                </button>
                <p className="mt-2 text-center text-[11px] text-zinc-500">
                  Kursi akan dikunci selama 10 menit untuk menyelesaikan pembayaran.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
