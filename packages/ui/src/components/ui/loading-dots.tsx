import type React from 'react';
import { cn } from '../../lib/utils';

export interface LoadingDotsProps extends React.HTMLAttributes<HTMLSpanElement> {}

export function LoadingDots({ className, ...props }: LoadingDotsProps) {
  return (
    <span className={cn('inline-flex items-center space-x-1', className)} {...props}>
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
    </span>
  );
}
