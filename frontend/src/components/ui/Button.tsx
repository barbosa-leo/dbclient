import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-brand-500 to-brand-700 text-white shadow-glow hover:from-brand-700 hover:to-brand-900',
  secondary:
    'border border-brand-300/70 bg-white text-brand-700 shadow-xs hover:border-brand-500/50 hover:bg-brand-50/70 hover:text-brand-900',
  danger:
    'border border-danger/40 bg-white text-danger shadow-xs hover:border-danger hover:bg-danger/5',
  ghost: 'text-brand-50 hover:bg-brand-700/50',
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`cursor-pointer rounded-lg px-4 py-2 text-xs font-semibold tracking-wide transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
