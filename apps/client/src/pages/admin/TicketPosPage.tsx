import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  PosCheckoutResult,
  PosTodayShowtime,
  SeatMapResponse,
  SeatSlot,
} from '@cinemax/shared';
import { useAuth } from '../../context/AuthContext';
import { ApiClientError, apiRequest } from '../../lib/api';
import { TicketStubModal } from '../../components/admin/TicketStubModal';

export function TicketPosPage() {
  const { user } = useAuth();

  // 1. Today Showtimes
  const [showtimes, setShowtimes] = useState<PosTodayShowtime[]>([]);
  const [isLoadingShowtimes, setIsLoadingShowtimes] = useState(true);
  const [movieSearch, setMovieSearch] = useState('');
  const [selectedShowtimeId, setSelectedShowtimeId] = useState<number | null>(null);

  // 2. Seat Map
  const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null);
  const [isLoadingSeats, setIsLoadingSeats] = useState(false);
  const [selectedSeatCodes, setSelectedSeatCodes] = useState<string[]>([]);

  // 3. Checkout Form
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris'>('cash');
  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  const [memberEmail, setMemberEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // 4. Success Modal
  const [checkoutResult, setCheckoutResult] = useState<PosCheckoutResult | null>(null);

  // Load today's active showtimes
  const loadTodayShowtimes = useCallback(async () => {
    setIsLoadingShowtimes(true);
    try {
      const data = await apiRequest<PosTodayShowtime[]>('/pos/ticket/today-showtimes');
      setShowtimes(data);
      if (data.length > 0 && !selectedShowtimeId) {
        setSelectedShowtimeId(data[0]!.id);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoadingShowtimes(false);
    }
  }, [selectedShowtimeId]);

  useEffect(() => {
    void loadTodayShowtimes();
  }, [loadTodayShowtimes]);

  // Load seats when selected showtime changes
  const loadSeats = useCallback(async () => {
    if (!selectedShowtimeId) {
      setSeatMap(null);
      setSelectedSeatCodes([]);
      return;
    }
    setIsLoadingSeats(true);
    try {
      const res = await apiRequest<SeatMapResponse>(
        `/booking/showtimes/${selectedShowtimeId}/seats`,
      );
      setSeatMap(res);
      setSelectedSeatCodes([]);
    } catch {
      setSeatMap(null);
    } finally {
      setIsLoadingSeats(false);
    }
  }, [selectedShowtimeId]);

  useEffect(() => {
    void loadSeats();
  }, [loadSeats]);

  const activeShowtime = showtimes.find((st) => st.id === selectedShowtimeId);

  // Filtered showtimes by search
  const filteredShowtimes = useMemo(() => {
    if (!movieSearch.trim()) return showtimes;
    const q = movieSearch.toLowerCase();
    return showtimes.filter((st) => st.movieTitle.toLowerCase().includes(q));
  }, [showtimes, movieSearch]);

  // Price calculations
  const pricePerTicket = activeShowtime?.price ?? 0;
  const totalPrice = selectedSeatCodes.length * pricePerTicket;

  const numericPaid = typeof amountPaid === 'number' ? amountPaid : 0;
  const change = paymentMethod === 'cash' && numericPaid >= totalPrice ? numericPaid - totalPrice : 0;
  const isCashInsufficient = paymentMethod === 'cash' && selectedSeatCodes.length > 0 && numericPaid < totalPrice;

  function handleToggleSeat(slot: SeatSlot) {
    if (slot.status !== 'available') return;
    setCheckoutError(null);

    if (selectedSeatCodes.includes(slot.code)) {
      setSelectedSeatCodes((prev) => prev.filter((c) => c !== slot.code));
    } else {
      if (selectedSeatCodes.length >= 10) {
        setCheckoutError('Maksimal 10 kursi per transaksi kasir');
        return;
      }
      setSelectedSeatCodes((prev) => [...prev, slot.code].sort());
    }
  }

  function handleQuickCash(nominal: number) {
    setAmountPaid(nominal);
  }

  async function handleCheckout() {
    if (!selectedShowtimeId || selectedSeatCodes.length === 0) return;
    if (paymentMethod === 'cash' && numericPaid < totalPrice) {
      setCheckoutError('Uang tunai yang diterima kurang dari total harga tiket.');
      return;
    }

    setIsSubmitting(true);
    setCheckoutError(null);
    try {
      const res = await apiRequest<PosCheckoutResult>('/pos/ticket/checkout', {
        method: 'POST',
        body: JSON.stringify({
          showtimeId: selectedShowtimeId,
          seatCodes: selectedSeatCodes,
          paymentMethod,
          amountPaid: paymentMethod === 'cash' ? numericPaid : undefined,
          memberEmail: memberEmail.trim() || undefined,
        }),
      });

      setCheckoutResult(res);
      // Refresh seats and showtimes
      await Promise.all([loadSeats(), loadTodayShowtimes()]);
    } catch (err) {
      setCheckoutError(
        err instanceof ApiClientError ? err.message : 'Transaksi kasir gagal diproses',
      );
      await loadSeats();
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleResetTransaction() {
    setCheckoutResult(null);
    setSelectedSeatCodes([]);
    setAmountPaid('');
    setMemberEmail('');
    setCheckoutError(null);
  }

  return (
    <div className="space-y-4">
      {/* Top Bar Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            Ticket POS — Kasir Bioskop
          </h1>
          <p className="text-xs text-slate-500">
            Alur cepat penjualan tiket walk-in hari ini, kalkulator kembalian uang tunai, dan cetak slip kasir.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-burgundy-50 border border-burgundy-200 px-3 py-1.5 text-xs font-semibold text-burgundy-800">
            Kasir: <strong className="font-bold">{user?.name}</strong>
          </span>
          <button
            type="button"
            onClick={handleResetTransaction}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Bersihkan Pilihan
          </button>
        </div>
      </div>

      {checkoutError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
          {checkoutError}
        </div>
      )}

      {/* 3-Panel POS Workspace */}
      <div className="grid gap-4 lg:grid-cols-12 items-start">
        {/* Panel 1 (Left 4 cols): Today Showtimes & Search */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="font-display text-sm font-bold text-slate-900 uppercase tracking-wider">
              1. Jadwal Tayang Hari Ini
            </h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 tabular-nums">
              {filteredShowtimes.length} Jadwal
            </span>
          </div>

          <input
            type="search"
            value={movieSearch}
            onChange={(e) => setMovieSearch(e.target.value)}
            placeholder="Cari judul film hari ini..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-burgundy-800 focus:outline-none"
          />

          {isLoadingShowtimes ? (
            <div className="py-12 text-center text-xs text-slate-400">Memuat penayangan...</div>
          ) : filteredShowtimes.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Tidak ada jadwal tayang aktif hari ini.
            </div>
          ) : (
            <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
              {filteredShowtimes.map((st) => {
                const isSelected = st.id === selectedShowtimeId;
                const sTime = new Date(st.startTime).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const eTime = new Date(st.endTime).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSelectedShowtimeId(st.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'border-burgundy-800 bg-burgundy-50/70 shadow-xs ring-1 ring-burgundy-800'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-slate-100 border border-slate-200">
                      {st.posterUrl ? (
                        <img src={st.posterUrl} alt={st.movieTitle} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[8px] text-slate-400">
                          No Pic
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-0.5 min-w-0">
                      <p className="font-display text-xs font-bold text-slate-900 truncate" title={st.movieTitle}>
                        {st.movieTitle}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="font-semibold text-burgundy-800">{st.studioName}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">{st.studioType}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 tabular-nums">
                        <span className="font-bold text-slate-800">
                          {sTime} <span className="text-[10px] text-slate-400 font-normal">s/d</span> {eTime}
                        </span>
                        <span className="font-bold text-gold-600">
                          Rp {st.price.toLocaleString('id-ID')}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 tabular-nums">
                        Tersedia: <strong className="text-emerald-700">{st.availableSeatsCount}</strong> / {st.totalSeats} kursi
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel 2 (Center 5 cols): Seat Grid */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 uppercase tracking-wider">
                2. Pilih Kursi ({selectedSeatCodes.length})
              </h2>
              {activeShowtime && (
                <p className="text-[11px] text-slate-500">
                  {activeShowtime.studioName} ({activeShowtime.studioType.toUpperCase()})
                </p>
              )}
            </div>

            {selectedSeatCodes.length > 0 && (
              <span className="font-mono text-xs font-bold text-burgundy-800">
                {selectedSeatCodes.join(', ')}
              </span>
            )}
          </div>

          {/* Screen curve */}
          <div className="mx-auto max-w-xs text-center space-y-1">
            <div className="h-1.5 w-full rounded-t-full bg-gradient-to-r from-slate-200 via-slate-400 to-slate-200" />
            <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">LAYAR (SCREEN)</p>
          </div>

          {isLoadingSeats ? (
            <div className="py-24 text-center text-xs text-slate-400">Memuat denah kursi...</div>
          ) : !seatMap ? (
            <div className="py-24 text-center text-xs text-slate-400">
              Pilih jadwal penayangan di sebelah kiri untuk menampilkan denah kursi.
            </div>
          ) : (
            <div className="overflow-x-auto pb-2">
              <div className="inline-block min-w-full text-center">
                <div className="space-y-1.5">
                  {Array.from({ length: seatMap.studio.rowsCount }, (_, r) => {
                    const letter = String.fromCharCode(65 + r);
                    const rowSeats = seatMap.seats.filter((s) => s.row === letter);

                    return (
                      <div key={letter} className="flex items-center justify-center gap-1.5">
                        <span className="w-4 text-right font-display text-[10px] font-bold text-slate-400">
                          {letter}
                        </span>

                        <div className="flex gap-1">
                          {rowSeats.map((slot) => {
                            const isSelected = selectedSeatCodes.includes(slot.code);
                            const isDisabled = slot.status === 'disabled';
                            const isOccupied = slot.status === 'occupied' || slot.status === 'held';

                            let btnStyle = 'bg-white border-slate-300 text-slate-700 hover:border-burgundy-700';
                            if (isSelected) {
                              btnStyle = 'bg-burgundy-800 border-burgundy-900 text-gold-400 font-bold scale-105 shadow-xs';
                            } else if (isOccupied) {
                              btnStyle = 'bg-slate-200 border-slate-200 text-slate-400 cursor-not-allowed opacity-50';
                            } else if (isDisabled) {
                              btnStyle = 'border-transparent bg-transparent text-transparent pointer-events-none';
                            }

                            return (
                              <button
                                key={slot.code}
                                type="button"
                                disabled={isDisabled || isOccupied}
                                onClick={() => handleToggleSeat(slot)}
                                title={
                                  isDisabled
                                    ? 'Lorong'
                                    : isOccupied
                                      ? `Kursi ${slot.code} (Terisi)`
                                      : `Kursi ${slot.code}`
                                }
                                className={`flex h-7 w-7 items-center justify-center rounded text-[11px] font-semibold tabular-nums border transition-all ${btnStyle}`}
                              >
                                {isDisabled ? '' : slot.col}
                              </button>
                            );
                          })}
                        </div>

                        <span className="w-4 text-left font-display text-[10px] font-bold text-slate-400">
                          {letter}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Seat Legends */}
          <div className="flex flex-wrap items-center justify-center gap-4 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded border border-slate-300 bg-white" />
              <span>Tersedia</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded border border-burgundy-800 bg-burgundy-800 text-gold-400 font-bold" />
              <span>Dipilih</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded border border-slate-200 bg-slate-200 opacity-60" />
              <span>Terisi</span>
            </div>
          </div>
        </div>

        {/* Panel 3 (Right 3 cols): Checkout & Change Calculator */}
        <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="font-display text-sm font-bold text-slate-900 uppercase tracking-wider">
              3. Pembayaran Walk-in
            </h2>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Kursi ({selectedSeatCodes.length})</span>
              <span className="font-bold text-slate-900">
                {selectedSeatCodes.length > 0 ? selectedSeatCodes.join(', ') : '-'}
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Harga Satuan</span>
              <span className="font-semibold text-slate-700 tabular-nums">
                Rp {pricePerTicket.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 items-baseline">
              <span className="text-xs font-bold text-slate-700">Total Tagihan</span>
              <span className="font-display text-lg font-black text-burgundy-800 tabular-nums">
                Rp {totalPrice.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Payment Method Tabs */}
          <div className="space-y-1.5 border-t border-slate-100 pt-3">
            <label className="block text-[11px] font-bold text-slate-700 uppercase">Metode Pembayaran</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`rounded-lg border py-2 text-xs font-bold transition-all ${
                  paymentMethod === 'cash'
                    ? 'border-burgundy-800 bg-burgundy-800 text-white shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                💵 TUNAI / CASH
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('qris')}
                className={`rounded-lg border py-2 text-xs font-bold transition-all ${
                  paymentMethod === 'qris'
                    ? 'border-burgundy-800 bg-burgundy-800 text-white shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                📱 QRIS INSTAN
              </button>
            </div>
          </div>

          {/* Cash Change Calculator */}
          {paymentMethod === 'cash' && (
            <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700" htmlFor="pos-cash-input">
                  Uang Diterima (Rp)
                </label>
                <input
                  id="pos-cash-input"
                  type="number"
                  step={5000}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value ? Number(e.target.value) : '')}
                  placeholder={`Min. ${totalPrice.toLocaleString('id-ID')}`}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-900 tabular-nums focus:border-burgundy-800 focus:outline-none"
                />
              </div>

              {/* Quick Cash Buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={totalPrice === 0}
                  onClick={() => handleQuickCash(totalPrice)}
                  className="rounded border border-slate-300 bg-white py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  Uang Pas
                </button>
                <button
                  type="button"
                  disabled={totalPrice === 0}
                  onClick={() => handleQuickCash(Math.ceil(totalPrice / 50000) * 50000)}
                  className="rounded border border-slate-300 bg-white py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  Bulat Rp 50k
                </button>
              </div>

              {/* Kembalian Display */}
              <div className="border-t border-slate-200 pt-2 flex items-baseline justify-between text-xs">
                <span className="font-semibold text-slate-600">Kembalian:</span>
                <span
                  className={`font-display text-base font-black tabular-nums ${
                    isCashInsufficient ? 'text-rose-600' : 'text-emerald-700'
                  }`}
                >
                  {isCashInsufficient ? 'Uang Kurang' : `Rp ${change.toLocaleString('id-ID')}`}
                </span>
              </div>
            </div>
          )}

          {/* Member Email (Optional for reward points) */}
          <div className="border-t border-slate-100 pt-3">
            <label className="block text-[11px] font-semibold text-slate-600" htmlFor="pos-member-email">
              Email Member (Opsional)
            </label>
            <input
              id="pos-member-email"
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="member@cinemax.local"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-burgundy-800 focus:outline-none"
            />
            <p className="mt-0.5 text-[10px] text-slate-400">Poin tiket otomatis masuk ke akun member.</p>
          </div>

          {/* Big Action Submit Button */}
          <button
            type="button"
            disabled={
              selectedSeatCodes.length === 0 ||
              isSubmitting ||
              (paymentMethod === 'cash' && isCashInsufficient)
            }
            onClick={handleCheckout}
            className="w-full rounded-xl bg-burgundy-800 py-3.5 text-center font-display text-sm font-bold text-gold-400 shadow-md hover:bg-burgundy-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Memproses Transaksi...' : `PROSES & CETAK (${selectedSeatCodes.length})`}
          </button>
        </div>
      </div>

      {/* Ticket Stub Modal */}
      <TicketStubModal
        stub={checkoutResult?.stub ?? null}
        change={checkoutResult?.change ?? 0}
        amountPaid={checkoutResult?.amountPaid}
        onClose={() => setCheckoutResult(null)}
        onNewTransaction={handleResetTransaction}
      />
    </div>
  );
}
