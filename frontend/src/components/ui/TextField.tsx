import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function TextField({ label, ...props }: TextFieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-brand-700">
        {label}
      </label>
      <input
        id={id}
        className="rounded-md border border-brand-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-accent"
        {...props}
      />
    </div>
  );
}
