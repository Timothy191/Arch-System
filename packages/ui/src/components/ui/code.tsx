import * as React from 'react';
import { cn } from '../../lib/utils';

export interface CodeProps extends React.HTMLAttributes<HTMLElement> {
  syntax?: string;
  children: React.ReactNode;
}

export const Code = React.forwardRef<HTMLElement, CodeProps>(
  ({ syntax, className, children, ...props }, ref) => {
    return (
      <code
        ref={ref}
        data-syntax={syntax}
        className={cn(
          'rounded px-1.5 py-0.5 font-mono text-xs',
          'border border-neutral-200 bg-neutral-100 text-neutral-900',
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  }
);

Code.displayName = 'Code';
