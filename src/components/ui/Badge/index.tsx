import { clsx } from 'clsx';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  variant?: Variant;
  label: string;
  dot?: boolean;
  className?: string;
}

const variants: Record<Variant, string> = {
  success: 'bg-green-950 text-green-400 border-green-800',
  warning: 'bg-yellow-950 text-yellow-400 border-yellow-800',
  danger:  'bg-red-950 text-red-400 border-red-800',
  info:    'bg-cyan-950 text-cyan-400 border-cyan-800',
  neutral: 'bg-gray-900 text-gray-400 border-gray-700',
};

const dots: Record<Variant, string> = {
  success: 'bg-green-400',
  warning: 'bg-yellow-400',
  danger:  'bg-red-400',
  info:    'bg-cyan-400',
  neutral: 'bg-gray-400',
};

export function Badge({
  variant = 'neutral',
  label,
  dot = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded border px-2 py-0.5',
        'text-xs font-semibold uppercase tracking-wider',
        variants[variant],
        className,
      )}
    >
      {dot && (
        <span
          className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', dots[variant])}
        />
      )}
      {label}
    </span>
  );
}
