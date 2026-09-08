import * as React from "react";
import { cn } from "../../lib/utils";
import { X } from "lucide-react";

export interface ClearableInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  cmdk?: boolean;
  onClear?: () => void;
  size?: "small" | "medium" | "large";
}

export const ClearableInput = React.forwardRef<HTMLInputElement, ClearableInputProps>(
  (
    {
      value = "",
      onChange,
      onClear,
      placeholder,
      label,
      cmdk = false,
      disabled = false,
      size = "medium",
      className,
      ...props
    },
    ref,
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => inputRef.current!);

    const hasValue = String(value).length > 0;

    const handleClear = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;

      onClear?.();

      if (inputRef.current) {
        // Synthesize native change event so React form handlers work
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        )?.set;
        nativeSetter?.call(inputRef.current, "");

        const event = new Event("input", { bubbles: true });
        inputRef.current.dispatchEvent(event);
        inputRef.current.focus();
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape" && hasValue && !disabled) {
        e.preventDefault();
        onClear?.();

        if (inputRef.current) {
          const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value",
          )?.set;
          nativeSetter?.call(inputRef.current, "");
          const event = new Event("input", { bubbles: true });
          inputRef.current.dispatchEvent(event);
        }
      }
      props.onKeyDown?.(e);
    };

    return (
      <div className="w-full space-y-1">
        {label && (
          <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            className={cn(
              "w-full rounded-md border border-neutral-300 dark:border-neutral-700",
              "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400",
              "transition-colors focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-100 focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-neutral-100 dark:disabled:bg-neutral-800",
              size === "small"
                ? "h-8 px-2.5 text-xs"
                : size === "large"
                  ? "h-11 px-3.5 text-base"
                  : "h-9 px-3 text-sm",
              hasValue || cmdk ? "pr-14" : "",
              className,
            )}
            {...props}
          />

          <div className="absolute right-2 flex items-center gap-1">
            {/* Clear Button */}
            {hasValue && !disabled && (
              <button
                type="button"
                tabIndex={-1}
                onClick={handleClear}
                aria-label="Clear input"
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* CMD-K or Esc Badge */}
            {cmdk && (
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-[10px] font-mono text-neutral-500 select-none">
                {hasValue ? "Esc" : "⌘K"}
              </kbd>
            )}
          </div>
        </div>
      </div>
    );
  },
);

ClearableInput.displayName = "ClearableInput";
