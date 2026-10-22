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
          'flex flex-col items-center justify-center p-8 text-center bg-white/70 backdrop-blur-md rounded-2xl border border-[var(--accent-red)]/20 shadow-2xs space-y-3.5',
          className
        )}
        {...props}
      >
        <div className="w-10 h-10 rounded-full bg-[var(--accent-red)]/10 text-[var(--accent-red)] flex items-center justify-center border border-[var(--accent-red)]/25">
          {icon ?? <AlertCircle className="w-5 h-5" aria-hidden="true" />}
        </div>

        <div className="space-y-1 max-w-sm">
          <h4 className="font-semibold text-sm text-[var(--text-heading)]">{title}</h4>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{description}</p>
          {errorMessage && (
            <p className="mt-2 text-[11px] font-mono p-2 rounded bg-black/[0.03] text-[var(--accent-red)] border border-black/[0.04] break-all">
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
            className="gap-1.5 text-xs h-8 px-3 border-black/15 hover:bg-black/5"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{retryLabel}</span>
          </Button>
        )}
      </div>
    );
  }
);
ErrorState.displayName = 'ErrorState';
