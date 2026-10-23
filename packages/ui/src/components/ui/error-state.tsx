import { AlertCircle, RefreshCw } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils';
import { Button } from './button';

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  error?: Error | string;
  onRetry?: () => void;
  retryLabel?: string;
  icon?: React.ReactNode;
}

export const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  (
    {
      className,
      title = 'Unable to Load Data',
      description = 'An error occurred while fetching operational data. Check your network or permissions.',
      error,
      onRetry,
      retryLabel = 'Try Again',
      icon,
      ...props
    },
    ref
  ) => {
    const errorMessage =
      error instanceof Error ? error.message : typeof error === 'string' ? error : null;

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'flex flex-col items-center justify-center space-y-3.5 rounded-2xl border border-[var(--accent-red)]/20 bg-white/70 p-8 text-center shadow-2xs backdrop-blur-md',
          className
        )}
        {...props}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--accent-red)]/25 bg-[var(--accent-red)]/10 text-[var(--accent-red)]">
          {icon ?? <AlertCircle className="h-5 w-5" aria-hidden="true" />}
        </div>

        <div className="max-w-sm space-y-1">
          <h4 className="font-semibold text-[var(--text-heading)] text-sm">{title}</h4>
          <p className="text-[var(--text-secondary)] text-xs leading-relaxed">{description}</p>
          {errorMessage && (
            <p className="mt-2 break-all rounded border border-black/[0.04] bg-black/[0.03] p-2 font-mono text-[11px] text-[var(--accent-red)]">
              {errorMessage}
            </p>
          )}
        </div>

        {onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="h-8 gap-1.5 border-black/15 px-3 text-xs hover:bg-black/5"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{retryLabel}</span>
          </Button>
        )}
      </div>
    );
  }
);
ErrorState.displayName = 'ErrorState';
