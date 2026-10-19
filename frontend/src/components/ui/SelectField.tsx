import { useId } from 'react';
import type { SelectHTMLAttributes } from 'react';

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: readonly string[];
}

export function SelectField({ label, options, ...props }: SelectFieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-xs font-medium text-ink-secondary"
      >
        {label}
      </label>
      <select
        id={id}
        className="cursor-pointer rounded-lg border border-line bg-panel px-3 py-2.5 text-base text-ink lg:py-2 lg:text-xs transition-colors outline-none focus:border-line-strong focus:ring-1 focus:ring-line-strong"
        {...props}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
