'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'warning';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary:   'bg-cyan-700 hover:bg-cyan-600 text-white border-cyan-600',
  secondary: 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-600',
  danger:    'bg-red-800 hover:bg-red-700 text-white border-red-700',
  warning:   'bg-yellow-800 hover:bg-yellow-700 text-white border-yellow-700',
  ghost:     'bg-transparent hover:bg-gray-800 text-gray-400 border-gray-700',
};

const sizes: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      fullWidth = false,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded border font-medium',
        'transition-colors duration-150 focus-visible:outline-none',
        'focus-visible:ring-1 focus-visible:ring-cyan-500',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
