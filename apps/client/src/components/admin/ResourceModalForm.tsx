import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiClientError } from '../../lib/api';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'tel' | 'number' | 'select' | 'checkbox';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  options?: FieldOption[];
  helperText?: string;
  /** Semantic tier: 1 = Penuh (full width), 2 = Setengah (half width) */
  colSpan?: 1 | 2;
}

interface ResourceModalFormProps {
  open: boolean;
  title: string;
  description?: string;
  fields: FieldConfig[];
  initialValues: Record<string, unknown>;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
}

export function ResourceModalForm({
  open,
  title,
  description,
  fields,
  initialValues,
  submitLabel,
  onClose,
  onSubmit,
}: ResourceModalFormProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      setValues(initialValues);
      setError(null);
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, initialValues]);

  function updateField(name: string, nextVal: unknown) {
    setValues((prev) => ({ ...prev, [name]: nextVal }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Gagal menyimpan data',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50"
    >
      <form onSubmit={handleSubmit} className="p-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900">{title}</h3>
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            Tutup
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {fields.map((field) => {
            const spanClass = field.colSpan === 2 ? 'sm:col-span-1' : 'sm:col-span-2';
            const id = `modal-field-${field.name}`;
            const rawVal = values[field.name];

            if (field.type === 'checkbox') {
              return (
                <div key={field.name} className={`${spanClass} flex items-center gap-2.5 pt-1`}>
                  <input
                    id={id}
                    type="checkbox"
                    disabled={field.disabled}
                    checked={Boolean(rawVal)}
                    onChange={(e) => updateField(field.name, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-burgundy-800 focus:ring-burgundy-800"
                  />
                  <label htmlFor={id} className="text-xs font-semibold text-slate-700">
                    {field.label}
                  </label>
                </div>
              );
            }

            return (
              <div key={field.name} className={spanClass}>
                <label htmlFor={id} className="block text-xs font-semibold text-slate-700">
                  {field.label}
                </label>

                {field.type === 'select' ? (
                  <select
                    id={id}
                    required={field.required}
                    disabled={field.disabled}
                    value={String(rawVal ?? '')}
                    onChange={(e) => updateField(field.name, e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-burgundy-800 focus:outline-none disabled:bg-slate-100"
                  >
                    {(field.options ?? []).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    type={field.type}
                    required={field.required}
                    disabled={field.disabled}
                    placeholder={field.placeholder}
                    value={String(rawVal ?? '')}
                    onChange={(e) =>
                      updateField(
                        field.name,
                        field.type === 'number' ? Number(e.target.value) : e.target.value,
                      )
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-burgundy-800 focus:outline-none disabled:bg-slate-100"
                  />
                )}

                {field.helperText && (
                  <p className="mt-1 text-[11px] text-slate-500">{field.helperText}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-burgundy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-burgundy-700 disabled:opacity-60"
          >
            {submitting ? 'Menyimpan...' : submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
