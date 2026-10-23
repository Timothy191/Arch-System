'use client';

import { cn } from '../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'login';
}

export function Input({ variant = 'default', className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'w-full rounded-lg border text-[var(--text-heading)] transition-all duration-200 placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-4 focus:ring-[var(--accent-blue)]/20',
        variant === 'default'
          ? 'border-[var(--border-emphasis)] bg-[var(--bg-secondary)]'
          : 'border-white/10 bg-white/5 backdrop-blur-md',
        className
      )}
      {...props}
    />
  );
}
