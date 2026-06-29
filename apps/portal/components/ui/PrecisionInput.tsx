"use client";

import * as React from "react";
import { cn } from "@repo/ui/lib/utils";
import { ChevronUp, ChevronDown } from "lucide-react";

interface PrecisionInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  label?: string;
  suffix?: string;
  value?: number | null;
  onChange?: (_event: React.SyntheticEvent | null, _value: number | null) => void;
}

export const PrecisionInput = React.forwardRef<HTMLInputElement, PrecisionInputProps>(
  function PrecisionInput(
    { label, suffix, className, value, onChange, min, max, step = 1, ...props },
    ref,
  ) {
    const internalRef = React.useRef<HTMLInputElement>(null);

    const handleIncrement = () => {
      const current = value ?? 0;
      const next = current + Number(step);
      if (max !== undefined && next > Number(max)) return;
      onChange?.(null, next);
    };

    const handleDecrement = () => {
      const current = value ?? 0;
      const next = current - Number(step);
      if (min !== undefined && next < Number(min)) return;
      onChange?.(null, next);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const valStr = e.target.value;
      if (valStr === "") {
        onChange?.(e, null);
        return;
      }
      const val = Number(valStr);
      if (!isNaN(val)) {
        onChange?.(e, val);
      }
    };

    const defaultId = React.useId();
    const inputId = props.id || defaultId;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <div
            className={cn(
              "flex items-center rounded-lg border border-[var(--border-emphasis)] bg-[var(--bg-primary)] hover:border-[#424242] transition-all overflow-hidden focus-within:ring-1 focus-within:ring-[#3ecf8e] focus-within:border-[#3ecf8e]/50",
              className,
            )}
          >
            <input
              id={inputId}
              ref={(node) => {
                internalRef.current = node as HTMLInputElement;
                if (typeof ref === "function") ref(node);
                else if (ref) ref.current = node;
              }}
              type="number"
              value={value ?? ""}
              onChange={handleChange}
              min={min}
              max={max}
              step={step}
              className="w-full bg-transparent px-3 py-2 text-sm text-[var(--text-heading)] outline-none placeholder-[var(--text-secondary)]"
              {...props}
            />
            <div className="flex flex-col border-l border-[var(--border-emphasis)]">
              <button
                type="button"
                onClick={handleIncrement}
                aria-label="Increment"
                className="flex items-center justify-center p-1 hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-colors"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={handleDecrement}
                aria-label="Decrement"
                className="flex items-center justify-center p-1 hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] border-t border-[var(--border-emphasis)] transition-colors"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>
          {suffix && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-[#4a4a4a] font-medium">
              {suffix}
            </div>
          )}
        </div>
      </div>
    );
  },
);
