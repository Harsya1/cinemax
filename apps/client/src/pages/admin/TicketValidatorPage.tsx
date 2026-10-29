import { useEffect, useRef, useState } from 'react';
import type { TicketScanResult } from '@cinemax/shared';
import { useAuth } from '../../context/AuthContext';
import { ApiClientError, apiRequest } from '../../lib/api';

interface ScanHistoryItem {
  id: string;
  bookingCode: string;
  timestamp: string;
  result: TicketScanResult['result'];
  movieTitle?: string;
  studioName?: string;
  seats?: string[];
}

export function TicketValidatorPage() {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [bookingCode, setBookingCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<TicketScanResult | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);

  // Focus input automatically on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleScanSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const code = bookingCode.trim().toUpperCase();
    if (!code || isScanning) return;

    setIsScanning(true);
    setScanResult(null);

    try {
      const res = await apiRequest<TicketScanResult>('/validator/scan', {
        method: 'POST',
        body: JSON.stringify({ bookingCode: code }),
      });

      setScanResult(res);

      // Add to session history
      setHistory((prev) => [
        {
          id: `${Date.now()}-${code}`,
          bookingCode: code,
          timestamp: new Date().toLocaleTimeString('id-ID'),
          result: res.result,
          movieTitle: res.ticket?.movieTitle,
          studioName: res.ticket?.studioName,
          seats: res.ticket?.seatCodes,
        },
        ...prev.slice(0, 19), // keep last 20
      ]);

      // Clear input and refocus
      setBookingCode('');
    } catch (err) {
      setScanResult({
        result: 'not_found',
        message:
          err instanceof ApiClientError
            ? err.message
            : 'Terjadi kesalahan saat memvalidasi tiket.',
        ticket: null,
      });
    } finally {
      setIsScanning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  // Visual card color mapping
  const resultCardStyles: Record<
    TicketScanResult['result'],
    { bg: string; border: string; titleColor: string; icon: string; title: string }
  > = {
    valid: {
      bg: 'bg-emerald-500 text-white',
      border: 'border-emerald-600',
      titleColor: 'text-white',
      icon: '✓',
      title: 'SILAKAN MASUK — TIKET VALID',
    },
    already_redeemed: {
      bg: 'bg-rose-600 text-white',
      border: 'border-rose-700',
      titleColor: 'text-white',
      icon: '✕',
      title: 'DITOLAK — TIKET SUDAH DIGUNAKAN',
    },
    invalid_status: {
      bg: 'bg-amber-500 text-slate-950',
      border: 'border-amber-600',
      titleColor: 'text-slate-950',
      icon: '⚠',
      title: 'DITOLAK — TIKET BELUM LUNAS / BATAL',
    },
    wrong_schedule: {
      bg: 'bg-amber-400 text-slate-950',
      border: 'border-amber-500',
      titleColor: 'text-slate-950',
      icon: '⚠',
      title: 'PERINGATAN — JADWAL PENAYANGAN BERBEDA',
    },
    not_found: {
      bg: 'bg-slate-800 text-white',
      border: 'border-slate-900',
      titleColor: 'text-rose-400',
      icon: '✕',
      title: 'DITOLAK — KODE TIKET TIDAK DITEMUKAN',
    },
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            Validator Pintu Masuk Studio
          </h1>
          <p className="text-xs text-slate-500">
            Pemindaian barcode/QR code tiket penonton, verifikasi status lunas, dan pencegahan double check-in.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-burgundy-50 border border-burgundy-200 px-3 py-1.5 text-xs font-semibold text-burgundy-800">
            Petugas: <strong>{user?.name}</strong> ({user?.role})
          </span>
        </div>
      </div>

      {/* Scanner Input Area */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <form onSubmit={handleScanSubmit} className="space-y-3">
          <label
            htmlFor="ticket-scanner-input"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700"
          >
            Arahkan Scanner atau Masukkan Kode Booking (Contoh: CX-XXXXXX):
          </label>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                id="ticket-scanner-input"
                type="text"
                autoComplete="off"
                disabled={isScanning}
                value={bookingCode}
                onChange={(e) => setBookingCode(e.target.value.toUpperCase())}
                placeholder="Scan QR / Barcode / Ketik Kode Booking..."
                className="w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-4 py-3.5 font-mono text-lg font-bold text-slate-900 tracking-wider placeholder-slate-400 focus:border-burgundy-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-burgundy-800/20"
              />
              <span className="absolute right-3.5 top-3.5 text-xs font-bold text-slate-400">
                ↵ ENTER
              </span>
            </div>

            <button
              type="submit"
              disabled={isScanning || !bookingCode.trim()}
              className="rounded-xl bg-burgundy-800 px-8 py-3.5 font-display text-sm font-bold text-gold-400 shadow-md hover:bg-burgundy-700 disabled:opacity-40 transition-colors"
            >
              {isScanning ? 'Memeriksa...' : 'Validasi Tiket'}
            </button>
          </div>
        </form>
      </div>

      {/* Large Scan Result Display */}
      {scanResult && (
        <div
          className={`rounded-2xl border-2 p-6 shadow-lg transition-all animate-in fade-in-50 duration-200 ${
            resultCardStyles[scanResult.result].bg
          } ${resultCardStyles[scanResult.result].border}`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-black/20 text-3xl font-black">
                {resultCardStyles[scanResult.result].icon}
              </span>
              <div>
                <p className="text-xs uppercase font-bold tracking-widest opacity-80">
                  HASIL PEMINDAIAN
                </p>
                <h2 className="font-display text-xl sm:text-2xl font-black tracking-wide">
                  {resultCardStyles[scanResult.result].title}
                </h2>
                <p className="mt-1 text-xs sm:text-sm font-medium opacity-90">
                  {scanResult.message}
                </p>
              </div>
            </div>

            {scanResult.ticket && (
              <div className="rounded-xl bg-black/20 px-4 py-2 text-right">
                <p className="text-[10px] uppercase font-bold tracking-widest opacity-70">
                  KODE TIKET
                </p>
                <p className="font-mono text-lg font-black tracking-wider">
                  {scanResult.ticket.bookingCode}
                </p>
              </div>
            )}
          </div>

          {/* Ticket Metadata Breakdown */}
          {scanResult.ticket && (
            <div className="mt-6 rounded-xl bg-black/15 p-4 grid gap-4 sm:grid-cols-4 text-xs">
              <div>
                <p className="text-[10px] uppercase font-bold opacity-75">JUDUL FILM</p>
                <p className="font-display text-sm font-bold truncate">
                  {scanResult.ticket.movieTitle}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold opacity-75">STUDIO</p>
                <p className="font-bold">
                  {scanResult.ticket.studioName} ({scanResult.ticket.studioType.toUpperCase()})
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold opacity-75">NOMOR KURSI</p>
                <p className="font-display text-lg font-black tracking-wider">
                  {scanResult.ticket.seatCodes.join(', ')}
                </p>
                <p className="text-[10px] opacity-75">{scanResult.ticket.totalSeats} Orang</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold opacity-75">JAM CHECK-IN</p>
                <p className="font-mono text-sm font-bold">
                  {scanResult.ticket.redeemedAt
                    ? new Date(scanResult.ticket.redeemedAt).toLocaleTimeString('id-ID')
                    : 'Belum'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Session Scan Log */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="font-display text-sm font-bold text-slate-900 uppercase tracking-wider">
            Riwayat Pemindaian Sesi Ini ({history.length})
          </h3>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setHistory([])}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Bersihkan Riwayat
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Belum ada tiket yang dipindai pada sesi ini.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {history.map((item) => {
              let badge = 'bg-slate-100 text-slate-700';
              if (item.result === 'valid') badge = 'bg-emerald-100 text-emerald-800 font-bold';
              else if (item.result === 'already_redeemed') badge = 'bg-rose-100 text-rose-800 font-bold';
              else if (item.result === 'wrong_schedule') badge = 'bg-amber-100 text-amber-800 font-bold';

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2.5 text-xs text-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-400 text-[11px]">{item.timestamp}</span>
                    <span className="font-mono font-bold text-slate-900">{item.bookingCode}</span>
                    {item.movieTitle && (
                      <span className="font-semibold text-slate-800">{item.movieTitle}</span>
                    )}
                    {item.seats && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-burgundy-800">
                        {item.seats.join(', ')}
                      </span>
                    )}
                  </div>

                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] uppercase ${badge}`}>
                    {item.result}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
