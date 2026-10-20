import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
  error?: string;
}

export function CheckboxField({
  label,
  description,
  error,
  ...props
}: CheckboxFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const descId = `${id}-desc`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 select-none">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [description ? descId : null, error ? errorId : null].filter(Boolean).join(' ') ||
            undefined
          }
          className="mt-0.5 h-4 w-4 rounded border-line text-cta focus:ring-1 focus:ring-line-strong accent-cta cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          {...props}
        />
        <div className="flex flex-col">
          <span className="text-xs font-medium text-ink">{label}</span>
          {description && (
            <span id={descId} className="text-xs text-ink-muted">
              {description}
            </span>
          )}
        </div>
      </label>
      {error && (
        <p id={errorId} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

