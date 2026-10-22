import * as React from 'react';
import { cn } from '../../lib/utils';
import { Loader } from './loader';
import { Skeleton } from './skeleton';

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string;
  variant?: 'spinner' | 'skeleton' | 'card';
  rows?: number;
}

export const LoadingState = React.forwardRef<HTMLDivElement, LoadingStateProps>(
  (
    {
      className,
      message = 'Loading operational telemetry...',
      variant = 'spinner',
      rows = 3,
      ...props
    },
    ref
  ) => {
    if (variant === 'skeleton') {
      return (
        <div
          ref={ref}
          role="status"
          aria-label={message}
          className={cn('space-y-3 p-4', className)}
          {...props}
        >
          <Skeleton className="h-6 w-1/3 rounded-lg" />
          <div className="space-y-2">
            {Array.from({ length: rows }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
          <span className="sr-only">{message}</span>
        </div>
      );
    }

    if (variant === 'card') {
      return (
        <div
          ref={ref}
          role="status"
          aria-label={message}
          className={cn(
            'p-6 bg-white/70 backdrop-blur-md rounded-2xl border border-black/[0.08] shadow-2xs space-y-4',
            className
          )}
          {...props}
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-8 w-36 rounded" />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
          <span className="sr-only">{message}</span>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        role="status"
        aria-label={message}
        className={cn(
          'flex flex-col items-center justify-center p-8 space-y-3 text-center',
          className
        )}
        {...props}
      >
        <Loader size="md" />
        <p className="text-xs font-medium text-[var(--text-secondary)]">{message}</p>
      </div>
    );
  }
);
LoadingState.displayName = 'LoadingState';
