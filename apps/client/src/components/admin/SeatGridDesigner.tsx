import { useMemo } from 'react';
import { getRowLetter } from '@cinemax/shared';

interface SeatGridDesignerProps {
  rowsCount: number;
  colsCount: number;
  disabledSeats: string[];
  onChangeDisabledSeats: (nextDisabled: string[]) => void;
  studioType: 'regular' | '3d' | 'premier';
}

export function SeatGridDesigner({
  rowsCount,
  colsCount,
  disabledSeats,
  onChangeDisabledSeats,
  studioType,
}: SeatGridDesignerProps) {
  const disabledSet = useMemo(
    () => new Set(disabledSeats.map((s) => s.trim().toUpperCase())),
    [disabledSeats],
  );

  function toggleSeat(code: string) {
    const next = new Set(disabledSet);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    onChangeDisabledSeats(Array.from(next).sort());
  }

  const totalSeats = rowsCount * colsCount - disabledSet.size;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      {/* Screen Curved Header */}
      <div className="mx-auto max-w-md text-center">
        <div className="h-2 w-full rounded-t-full bg-gradient-to-r from-slate-300 via-burgundy-800 to-slate-300 shadow-sm" />
        <p className="mt-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
          LAYAR BIOSKOP (SCREEN)
        </p>
      </div>

      {/* Seat Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-full text-center">
          <div className="space-y-1.5">
            {Array.from({ length: rowsCount }, (_, r) => {
              const letter = getRowLetter(r);
              return (
                <div key={letter} className="flex items-center justify-center gap-1.5">
                  <span className="w-5 text-right font-display text-xs font-bold text-slate-400">
                    {letter}
                  </span>

                  <div className="flex gap-1">
                    {Array.from({ length: colsCount }, (_, c) => {
                      const code = `${letter}${c + 1}`;
                      const isDisabled = disabledSet.has(code);

                      let activeColor = 'bg-white border-slate-300 text-slate-700 hover:border-slate-400';
                      if (studioType === 'premier') {
                        activeColor =
                          'bg-burgundy-900 border-burgundy-700 text-gold-400 font-bold hover:bg-burgundy-800';
                      } else if (studioType === '3d') {
                        activeColor =
                          'bg-sky-50 border-sky-300 text-sky-800 font-semibold hover:bg-sky-100';
                      }

                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => toggleSeat(code)}
                          title={`${code} ${isDisabled ? '(Nonaktif / Lorong)' : '(Aktif)'} — Klik untuk toggle`}
                          className={`flex h-7 w-7 items-center justify-center rounded text-[11px] transition-all tabular-nums border ${
                            isDisabled
                              ? 'border-dashed border-slate-300 bg-slate-200/50 text-slate-400 line-through opacity-50'
                              : activeColor
                          }`}
                        >
                          {c + 1}
                        </button>
                      );
                    })}
                  </div>

                  <span className="w-5 text-left font-display text-xs font-bold text-slate-400">
                    {letter}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 text-xs text-slate-600">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-4 w-4 rounded border ${
                studioType === 'premier'
                  ? 'border-burgundy-700 bg-burgundy-900'
                  : 'border-slate-300 bg-white'
              }`}
            />
            <span>Kursi Aktif</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-4 w-4 rounded border border-dashed border-slate-300 bg-slate-200/50" />
            <span>Lorong / Rusak</span>
          </div>
        </div>

        <div className="tabular-nums font-semibold text-slate-800">
          Kapasitas Aktif:{' '}
          <span className="text-burgundy-800 font-bold">
            {totalSeats}
          </span>{' '}
          / {rowsCount * colsCount} kursi
        </div>
      </div>
    </div>
  );
}
