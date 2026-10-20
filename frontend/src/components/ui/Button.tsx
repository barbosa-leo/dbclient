import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const sizes: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3.5 py-2 text-xs',
};

const variants: Record<Variant, string> = {
  primary: 'bg-cta text-cta-fg hover:bg-cta-hover',
  secondary:
    'border border-line bg-panel text-ink hover:bg-muted',
  danger:
    'border border-danger/40 bg-panel text-danger hover:border-danger hover:bg-danger/10',
  ghost: 'text-ink-secondary hover:bg-muted hover:text-ink',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`cursor-pointer rounded-lg font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
