import { useEffect, useRef } from 'react';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';

interface FlatpickrDateTimeInputProps {
  id?: string;
  value: string;
  onChange: (isoString: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date | string;
  className?: string;
}

export function FlatpickrDateTimeInput({
  id,
  value,
  onChange,
  placeholder = 'Pilih tanggal & jam...',
  disabled = false,
  minDate,
  className = '',
}: FlatpickrDateTimeInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fpRef = useRef<flatpickr.Instance | null>(null);

  useEffect(() => {
    if (!inputRef.current) return;

    fpRef.current = flatpickr(inputRef.current, {
      enableTime: true,
      time_24hr: true,
      minuteIncrement: 15,
      dateFormat: 'Z',
      altInput: true,
      altFormat: 'Y-m-d H:i',
      altInputClass: `w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-burgundy-800 focus:outline-none disabled:bg-slate-100 ${className}`,
      defaultDate: value || undefined,
      minDate: minDate || undefined,
      onChange: (selectedDates) => {
        if (selectedDates[0]) {
          onChange(selectedDates[0].toISOString());
        } else {
          onChange('');
        }
      },
    });

    return () => {
      fpRef.current?.destroy();
      fpRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (fpRef.current && value) {
      fpRef.current.setDate(value, false);
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      disabled={disabled}
      placeholder={placeholder}
      className="hidden"
    />
  );
}
