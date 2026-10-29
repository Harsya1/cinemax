import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { BookingDetail } from '@cinemax/shared';
import { useAuth } from '../../context/AuthContext';
import { ApiClientError, apiRequest } from '../../lib/api';

export function PaymentPage() {
  const { bookingCode } = useParams<{ bookingCode: string }>();
  const navigate = useNavigate();
  const { user, refreshSession } = useAuth();

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [method, setMethod] = useState<'qris' | 'cash'>('qris');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paySuccess, setPaySuccess] = useState<boolean>(false);
  const [earnedPoints, setEarnedPoints] = useState<number>(0);

  const loadBooking = useCallback(async () => {
    if (!bookingCode) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<BookingDetail>(`/booking/${bookingCode}`);
      setBooking(data);
      setRemainingSeconds(data.remainingSeconds);
      if (data.status === 'paid') {
        setPaySuccess(true);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal memuat rincian pemesanan');
    } finally {
      setIsLoading(false);
    }
  }, [bookingCode]);

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  // Countdown timer
  useEffect(() => {
    if (paySuccess || remainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setError('Waktu pembayaran telah habis. Kursi Anda telah dibebaskan.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingSeconds, paySuccess]);

  async function handleProcessPayment(selectedMethod: 'qris' | 'cash') {
    if (!booking) return;
    setIsProcessing(true);
    setError(null);
    try {
      const res = await apiRequest<{
        bookingCode: string;
        status: string;
        pointsEarned: number;
        totalPrice: number;
      }>('/payment/process', {
        method: 'POST',
        body: JSON.stringify({
          bookingCode: booking.bookingCode,
          paymentMethod: selectedMethod,
        }),
      });

      setPaySuccess(true);
      setEarnedPoints(res.pointsEarned);
      // Refresh session so navbar shows new points immediately
      await refreshSession();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Pembayaran gagal diproses. Silakan coba kembali.',
      );
    } finally {
      setIsProcessing(false);
    }
  }

  const timerDisplay = useMemo(() => {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [remainingSeconds]);

  const qrImageUrl = booking
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
        `CINEMAX-QRIS:${booking.bookingCode}:${booking.totalPrice}`,
      )}`
    : null;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-muted">
        Menyiapkan jalur pembayaran aman CINEMAX...
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-xl py-24 text-center space-y-4">
        <h2 className="font-display text-2xl font-bold text-white">Pemesanan Tidak Ditemukan</h2>
        <p className="text-sm text-muted">{error || 'Data tiket tidak ditemukan.'}</p>
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
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8 space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-burgundy-700/80 bg-burgundy-900/60 px-3.5 py-1 text-xs font-semibold tracking-wider text-gold-400 uppercase">
          PEMBAYARAN TIKET BIOSKOP
        </div>
        <h1 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-4xl">
          {paySuccess ? 'Pembayaran Berhasil!' : 'Selesaikan Pembayaran'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Kode Pemesanan: <strong className="text-white font-mono">{booking.bookingCode}</strong>
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/60 p-4 text-xs font-medium text-rose-200">
          {error}
        </div>
      )}

      {paySuccess ? (
        /* Success State Banner */
        <div className="rounded-3xl border border-emerald-500/40 bg-surface p-8 shadow-2xl space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-3xl text-emerald-400">
            ✓
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-2xl font-bold text-white">
              E-Ticket Anda Telah Siap!
            </h2>
            <p className="text-sm text-zinc-300">
              Transaksi tiket bioskop lunas. Kursi Anda telah resmi dikonfirmasi.
            </p>
            {earnedPoints > 0 && (
              <p className="inline-block rounded-full border border-gold-500/40 bg-gold-500/10 px-4 py-1 text-xs font-bold text-gold-400">
                +{earnedPoints} Poin Member CINEMAX Ditambahkan ke Akun Anda!
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-obsidian-950 p-6 max-w-md mx-auto text-left space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">Film</span>
              <span className="font-bold text-white">{booking.showtime.movieTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Studio</span>
              <span className="font-bold text-white">{booking.showtime.studioName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Kursi</span>
              <span className="font-bold text-gold-400">{booking.seatCodes.join(', ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Waktu Tayang</span>
              <span className="font-medium text-white tabular-nums">
                {new Date(booking.showtime.startTime).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-3">
              <span className="text-sm font-bold text-white">Total</span>
              <span className="font-display text-lg font-bold text-gold-400 tabular-nums">
                Rp {booking.totalPrice.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              to="/profile?tab=tickets"
              className="rounded-xl bg-gold-500 px-8 py-3.5 font-display text-sm font-bold text-obsidian-950 shadow-lg shadow-gold-500/25 hover:bg-gold-400 transition-colors"
            >
              Buka E-Ticket di Profil Saya →
            </Link>
            <Link
              to="/"
              className="rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      ) : (
        /* Payment Options & Summary */
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left: Payment Method (7 cols) */}
          <div className="lg:col-span-7 rounded-3xl border border-white/10 bg-surface p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="font-display text-lg font-bold text-white">Metode Pembayaran</h2>
              <span className="rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1 text-xs font-bold text-gold-400 tabular-nums animate-pulse">
                Sisa Waktu: {timerDisplay}
              </span>
            </div>

            {/* Method Tabs */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMethod('qris')}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  method === 'qris'
                    ? 'border-gold-500 bg-gold-500/10 shadow-lg shadow-gold-500/10'
                    : 'border-white/10 bg-obsidian-950 text-zinc-400 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold text-white">QRIS Instan</span>
                  <span className="rounded bg-gold-500 px-1.5 py-0.5 text-[10px] font-bold text-obsidian-950">
                    POPULER
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-zinc-400">GoPay, OVO, Dana, BCA Mobile, ShopeePay</p>
              </button>

              <button
                type="button"
                onClick={() => setMethod('cash')}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  method === 'cash'
                    ? 'border-gold-500 bg-gold-500/10 shadow-lg shadow-gold-500/10'
                    : 'border-white/10 bg-obsidian-950 text-zinc-400 hover:border-white/20'
                }`}
              >
                <span className="font-display text-sm font-bold text-white">Cash di Kasir</span>
                <p className="mt-1 text-[11px] text-zinc-400">Bayar tunai sebelum waktu pemesanan habis</p>
              </button>
            </div>

            {/* Method Details */}
            {method === 'qris' ? (
              <div className="rounded-2xl border border-white/10 bg-obsidian-950 p-6 text-center space-y-4">
                <p className="text-xs font-semibold text-zinc-300">
                  Scan kode QRIS di bawah ini dengan aplikasi mobile banking atau e-wallet Anda:
                </p>

                <div className="mx-auto w-48 h-48 rounded-2xl bg-white p-3 shadow-md flex items-center justify-center">
                  {qrImageUrl ? (
                    <img
                      src={qrImageUrl}
                      alt="QRIS Code"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="text-xs text-slate-500">Generating QR...</div>
                  )}
                </div>

                <div className="space-y-1 text-[11px] text-zinc-400">
                  <p>Nominal: <strong className="text-gold-400">Rp {booking.totalPrice.toLocaleString('id-ID')}</strong></p>
                  <p>Kode Transaksi: {booking.bookingCode}</p>
                </div>

                <button
                  type="button"
                  disabled={isProcessing || remainingSeconds <= 0}
                  onClick={() => handleProcessPayment('qris')}
                  className="w-full rounded-xl bg-gold-500 py-3 font-display text-xs font-bold text-obsidian-950 shadow-md hover:bg-gold-400 transition-colors disabled:opacity-50"
                >
                  {isProcessing ? 'Memverifikasi Pembayaran...' : 'Simulasi Bayar QRIS Sukses'}
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-obsidian-950 p-6 space-y-4 text-xs">
                <div className="flex items-center gap-3 text-gold-400">
                  <span className="text-2xl">ℹ</span>
                  <p className="font-semibold">Pembayaran Tunai di Kasir Bioskop</p>
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  Tunjukkan kode booking <strong className="text-white font-mono">{booking.bookingCode}</strong> kepada kasir CINEMAX. Kursi Anda akan disimpan selama sisa waktu <strong>{timerDisplay}</strong>.
                </p>
                <button
                  type="button"
                  disabled={isProcessing || remainingSeconds <= 0}
                  onClick={() => handleProcessPayment('cash')}
                  className="w-full rounded-xl bg-gold-500 py-3 font-display text-xs font-bold text-obsidian-950 shadow-md hover:bg-gold-400 transition-colors disabled:opacity-50"
                >
                  {isProcessing ? 'Memproses...' : 'Simulasi Bayar di Kasir (Lunas)'}
                </button>
              </div>
            )}
          </div>

          {/* Right: Order Summary (5 cols) */}
          <div className="lg:col-span-5 rounded-3xl border border-white/10 bg-surface p-6 shadow-xl space-y-6">
            <h2 className="font-display text-lg font-bold text-white border-b border-white/10 pb-4">
              Rincian Tiket
            </h2>

            <div className="flex items-center gap-4">
              {booking.showtime.posterUrl && (
                <img
                  src={booking.showtime.posterUrl}
                  alt={booking.showtime.movieTitle}
                  className="h-20 w-14 rounded-lg object-cover border border-white/10 shadow"
                />
              )}
              <div>
                <p className="font-display text-base font-bold text-white line-clamp-1">
                  {booking.showtime.movieTitle}
                </p>
                <p className="text-xs text-gold-400 mt-0.5">
                  {booking.showtime.studioName} ({booking.showtime.studioType.toUpperCase()})
                </p>
                <p className="text-[11px] text-muted tabular-nums mt-0.5">
                  {new Date(booking.showtime.startTime).toLocaleDateString('id-ID', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}{' '}
                  ·{' '}
                  {new Date(booking.showtime.startTime).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  WIB
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs border-t border-white/10 pt-4">
              <div className="flex justify-between text-zinc-400">
                <span>Jumlah Kursi</span>
                <span className="font-bold text-white">{booking.totalSeats} Kursi</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Nomor Kursi</span>
                <span className="font-bold text-gold-400">{booking.seatCodes.join(', ')}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Harga per Tiket</span>
                <span className="font-medium text-white tabular-nums">
                  Rp {(booking.totalPrice / booking.totalSeats).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-3">
                <span className="text-sm font-bold text-white">Total Tagihan</span>
                <span className="font-display text-2xl font-extrabold text-gold-400 tabular-nums">
                  Rp {booking.totalPrice.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
