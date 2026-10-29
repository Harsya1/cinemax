import { useEffect } from 'react';
import type { CustomerBookingSummary } from '@cinemax/shared';

interface ETicketModalProps {
  ticket: CustomerBookingSummary | null;
  onClose: () => void;
}

export function ETicketModal({ ticket, onClose }: ETicketModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!ticket) return null;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
    ticket.bookingCode,
  )}`;

  const sDate = new Date(ticket.showtime.startTime);
  const formattedDate = sDate.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = sDate.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/85 p-4 backdrop-blur-md overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative my-8 w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-obsidian-900 shadow-2xl"
      >
        {/* Printable Ticket Area */}
        <div id="printable-ticket" className="bg-surface text-white">
          {/* Top Banner */}
          <div className="bg-gradient-to-r from-burgundy-950 via-burgundy-900 to-obsidian-900 p-5 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-burgundy-700 font-display text-xs font-black text-gold-400">
                  C
                </span>
                <span className="font-display text-sm font-black tracking-wider text-white">
                  CINE<span className="text-gold-500">MAX</span>
                </span>
              </div>
              <span className="rounded bg-gold-500 px-2 py-0.5 text-[10px] font-bold text-obsidian-950">
                LUNAS / E-TICKET
              </span>
            </div>

            <div className="mt-4">
              <h3 className="font-display text-lg font-extrabold text-white line-clamp-1">
                {ticket.showtime.movieTitle}
              </h3>
              <p className="text-xs text-gold-400 font-medium">
                {ticket.showtime.studioName} ({ticket.showtime.studioType.toUpperCase()})
              </p>
            </div>
          </div>

          {/* Ticket Body with Details */}
          <div className="p-5 space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 border-b border-white/10 pb-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">TANGGAL</p>
                <p className="font-bold text-white mt-0.5">{formattedDate}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">JAM TAYANG</p>
                <p className="font-bold text-gold-400 text-sm mt-0.5 tabular-nums">
                  {formattedTime} WIB
                </p>
              </div>
            </div>

            <div className="border-b border-white/10 pb-3">
              <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">NOMOR KURSI</p>
              <p className="font-display text-2xl font-black text-gold-400 tracking-wide mt-1">
                {ticket.seatCodes.join(', ')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 border-b border-white/10 pb-3 tabular-nums">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">TOTAL TIKET</p>
                <p className="font-bold text-white mt-0.5">{ticket.totalSeats} Kursi</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">TOTAL BAYAR</p>
                <p className="font-bold text-white mt-0.5">
                  Rp {ticket.totalPrice.toLocaleString('id-ID')}
                </p>
              </div>
            </div>

            {/* QR Code Section for Entrance Scanner */}
            <div className="pt-2 text-center space-y-2">
              <div className="mx-auto w-40 h-40 rounded-2xl bg-white p-2.5 shadow-md flex items-center justify-center">
                <img
                  src={qrUrl}
                  alt={`QR ${ticket.bookingCode}`}
                  className="h-full w-full object-contain"
                />
              </div>

              <p className="font-mono text-sm font-bold tracking-widest text-gold-400">
                {ticket.bookingCode}
              </p>
              <p className="text-[10px] text-muted">
                Tunjukkan QR Code ini kepada staf di pintu masuk studio.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer (Screen-only Buttons) */}
        <div className="flex items-center justify-end gap-2 border-t border-white/10 bg-obsidian-950 px-5 py-3.5 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
          >
            Cetak / PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gold-500 px-4 py-2 text-xs font-bold text-obsidian-950 hover:bg-gold-400 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
