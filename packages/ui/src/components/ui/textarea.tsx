import { cn } from '@repo/ui/lib/utils';
import * as React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
  errored?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows, errored, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
        errored
          ? 'border-red-500 focus-visible:ring-red-500/20 text-red-900 placeholder:text-red-300'
          : 'border-input focus-visible:ring-ring focus-visible:border-ring',
        className
      )}
      rows={rows}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export { Textarea };
