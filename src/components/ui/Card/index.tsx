import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  accent?: boolean;
}

export function Card({ title, children, className, accent = false }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-lg border bg-gray-900 p-4',
        accent ? 'border-cyan-800/60' : 'border-gray-800',
        className,
      )}
    >
      {title && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}
