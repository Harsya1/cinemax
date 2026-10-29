import { useEffect } from 'react';
import type { PosTicketStub } from '@cinemax/shared';

interface TicketStubModalProps {
  stub: PosTicketStub | null;
  change?: number;
  amountPaid?: number;
  onClose: () => void;
  onNewTransaction: () => void;
}

export function TicketStubModal({
  stub,
  change = 0,
  amountPaid,
  onClose,
  onNewTransaction,
}: TicketStubModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ' && e.ctrlKey) {
        e.preventDefault();
        onNewTransaction();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNewTransaction]);

  if (!stub) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative my-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-6"
      >
        {/* Header Notification (Screen Only) */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 print:hidden">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-lg font-bold">
              ✓
            </span>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900">
                Transaksi Kasir Selesai!
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Booking: <strong className="text-slate-800">{stub.bookingCode}</strong> · Kasir: {stub.cashierName}
              </p>
            </div>
          </div>

          {change > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-right">
              <p className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">UANG KEMBALIAN</p>
              <p className="font-display text-xl font-black text-emerald-700 tabular-nums">
                Rp {change.toLocaleString('id-ID')}
              </p>
            </div>
          )}
        </div>

        {/* Printable Ticket Stub (Landscape / Slip Format) */}
        <div
          id="printable-pos-stub"
          className="rounded-xl border-2 border-slate-900 bg-white p-0 text-slate-900 overflow-hidden shadow-sm font-sans"
        >
          <div className="flex flex-col sm:flex-row">
            {/* Main Part - Left 70% */}
            <div className="flex-1 p-5 border-b-2 sm:border-b-0 sm:border-r-2 border-dashed border-slate-300 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-burgundy-800 font-display text-xs font-bold text-gold-400">
                    CX
                  </span>
                  <span className="font-display text-sm font-black tracking-wider text-slate-900">
                    CINEMAX BOX OFFICE
                  </span>
                </div>
                <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                  {stub.studioType}
                </span>
              </div>

              <div>
                <h4 className="font-display text-lg font-black text-slate-900 line-clamp-1">
                  {stub.movieTitle}
                </h4>
                <p className="text-xs font-bold text-burgundy-800">{stub.studioName}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs border-t border-slate-100 pt-2">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">JADWAL</p>
                  <p className="font-bold text-slate-800">{stub.dateFormatted}</p>
                  <p className="text-xs font-black text-burgundy-800 tabular-nums">{stub.timeFormatted}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">KURSI</p>
                  <p className="font-display text-xl font-black text-slate-900 tracking-wide">
                    {stub.seatCodes.join(', ')}
                  </p>
                  <p className="text-[10px] text-slate-500">{stub.totalSeats} Tiket</p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-xs tabular-nums">
                <div>
                  <span className="text-[10px] text-slate-400">Metode: </span>
                  <span className="font-bold text-slate-700">{stub.paymentMethod}</span>
                  {amountPaid !== undefined && amountPaid > 0 && (
                    <span className="text-slate-500 text-[10px]"> (Bayar: Rp {amountPaid.toLocaleString('id-ID')})</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400">Total: </span>
                  <span className="font-display text-base font-black text-slate-900">
                    Rp {stub.totalPrice.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            {/* Stub Tear-Off Part - Right 30% */}
            <div className="w-full sm:w-52 bg-slate-50 p-4 flex flex-col justify-between text-center space-y-2">
              <div className="space-y-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                  SOBEKAN TIKET
                </p>
                <p className="font-display text-xs font-bold text-slate-900 line-clamp-1">
                  {stub.movieTitle}
                </p>
                <p className="text-[11px] font-semibold text-burgundy-800">{stub.studioName}</p>
                <p className="font-display text-sm font-black text-slate-900">
                  {stub.seatCodes.join(', ')}
                </p>
              </div>

              {/* QR Code */}
              <div className="mx-auto h-24 w-24 rounded-lg bg-white p-1 border border-slate-200 shadow-2xs flex items-center justify-center">
                <img
                  src={stub.qrUrl}
                  alt={`QR ${stub.bookingCode}`}
                  className="h-full w-full object-contain"
                />
              </div>

              <div>
                <p className="font-mono text-xs font-bold text-slate-900 tracking-widest">
                  {stub.bookingCode}
                </p>
                <p className="text-[9px] text-slate-400">{stub.paidAtFormatted}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls (Screen Only) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Tutup
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center gap-1.5"
            >
              <span>🖨</span> Cetak Slip Tiket (Print)
            </button>

            <button
              type="button"
              onClick={onNewTransaction}
              className="rounded-lg bg-burgundy-800 px-6 py-2 text-xs font-bold text-white hover:bg-burgundy-700 transition-colors shadow-sm"
            >
              + Transaksi Baru (Space)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
