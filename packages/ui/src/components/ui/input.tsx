import { cn } from '@repo/ui/lib/utils';
import { Search } from 'lucide-react';
import * as React from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  errored?: boolean;
  wrapperClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, wrapperClassName, type, prefix, suffix, errored, ...props }, ref) => {
    const gridSpanClass = className
      ?.split(/\s+/)
      .filter((c) => c.includes('col-span'))
      .join(' ');
    return (
      <div
        className={cn('group relative flex w-full items-center', gridSpanClass, wrapperClassName)}
      >
        {prefix && (
          <span className="pointer-events-none absolute left-3 z-10 flex items-center justify-center text-muted-foreground">
            {prefix}
          </span>
        )}
        <input
          type={type}
          className={cn(
            'flex h-10 w-full rounded-md border bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
            errored
              ? 'border-red-500 text-red-900 placeholder:text-red-300 focus-visible:ring-red-500/20'
              : 'border-input focus-visible:border-ring focus-visible:ring-ring',
            prefix && 'pl-9',
            suffix && 'pr-9',
            className
          )}
          ref={ref}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 z-10 flex items-center justify-center text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface SearchInputProps extends InputProps {
  onClear?: () => void;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onClear, onKeyDown, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        if (onClear) onClear();
        // optionally clear uncontrolled value here if needed, but usually controlled via onClear
      }
      if (onKeyDown) onKeyDown(e);
    };

    return (
      <Input
        ref={ref}
        type="search"
        prefix={<Search className="h-4 w-4" />}
        onKeyDown={handleKeyDown}
        className={className}
        {...props}
      />
    );
  }
);
SearchInput.displayName = 'SearchInput';

export { Input, SearchInput };
