import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  errored?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, prefix, suffix, errored, ...props }, ref) => {
    return (
      <div className={cn("relative flex items-center w-full group", className)}>
        {prefix && (
          <span className="absolute left-3 flex items-center justify-center text-muted-foreground">
            {prefix}
          </span>
        )}
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
            errored
              ? "border-red-500 focus-visible:ring-red-500/20 text-red-900 placeholder:text-red-300"
              : "border-input focus-visible:ring-ring focus-visible:border-ring",
            prefix && "pl-9",
            suffix && "pr-9",
            className,
          )}
          ref={ref}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 flex items-center justify-center text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export interface SearchInputProps extends InputProps {
  onClear?: () => void;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onClear, onKeyDown, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
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
  },
);
SearchInput.displayName = "SearchInput";

export { Input, SearchInput };
