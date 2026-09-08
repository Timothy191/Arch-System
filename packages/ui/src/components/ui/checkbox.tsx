"use client";

import { Check, Minus } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  size?: "small" | "medium";
  label?: React.ReactNode;
  onCheckedChange?: (checked: boolean) => void;
  children?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      checked = false,
      indeterminate = false,
      disabled = false,
      size = "medium",
      label,
      onChange,
      onCheckedChange,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => inputRef.current!);

    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      onCheckedChange?.(e.target.checked);
      onChange?.(e);
    };

    const isChecked = checked || indeterminate;

    return (
      <label
        className={cn(
          "inline-flex items-center gap-2 select-none cursor-pointer text-sm font-medium",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          className
        )}
      >
        <input
          ref={inputRef}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-checked={indeterminate ? "mixed" : checked}
          onChange={handleChange}
          className="sr-only peer"
          {...props}
        />
        <span
          className={cn(
            "flex items-center justify-center shrink-0 rounded border transition-all duration-150",
            size === "small" ? "w-3.5 h-3.5 text-[10px]" : "w-4 h-4 text-xs",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-neutral-900 dark:peer-focus-visible:ring-neutral-100",
            isChecked
              ? "bg-neutral-900 border-neutral-900 text-white dark:bg-neutral-100 dark:border-neutral-100 dark:text-neutral-900"
              : "bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600"
          )}
          aria-hidden="true"
        >
          {indeterminate ? (
            <Minus className="w-3 h-3 stroke-[3]" />
          ) : checked ? (
            <Check className="w-3 h-3 stroke-[3]" />
          ) : null}
        </span>
        {(children || label) && (
          <span className="text-neutral-900 dark:text-neutral-100 leading-none">
            {children || label}
          </span>
        )}
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";
