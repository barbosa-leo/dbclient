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
        className="font-display text-[11px] font-semibold tracking-wider text-brand-700 uppercase"
      >
        {label}
      </label>
      <select
        id={id}
        className="cursor-pointer rounded-lg border border-brand-300/70 bg-white/90 px-3.5 py-2 text-sm text-brand-900 shadow-xs transition-all outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-accent/60"
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
