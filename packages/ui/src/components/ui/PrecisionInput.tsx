'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils';

export interface PrecisionInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string;
  suffix?: string;
  value?: number | null;
  onChange?: (_event: React.SyntheticEvent | null, _value: number | null) => void;
}

export const PrecisionInput = React.forwardRef<HTMLInputElement, PrecisionInputProps>(
  function PrecisionInput(
    { label, suffix, className, value, onChange, min, max, step = 1, ...props },
    ref
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
      if (valStr === '') {
        onChange?.(e, null);
        return;
      }
      const val = Number(valStr);
      if (!Number.isNaN(val)) {
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
            className="font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <div
            className={cn(
              'flex items-center overflow-hidden rounded-lg border border-[var(--border-emphasis)] bg-[var(--bg-primary)] transition-all focus-within:border-[#3ecf8e]/50 focus-within:ring-1 focus-within:ring-[#3ecf8e] hover:border-[#424242]',
              className
            )}
          >
            <input
              id={inputId}
              ref={(node) => {
                internalRef.current = node as HTMLInputElement;
                if (typeof ref === 'function') ref(node);
                else if (ref) ref.current = node;
              }}
              type="number"
              value={value ?? ''}
              onChange={handleChange}
              min={min}
              max={max}
              step={step}
              className="w-full bg-transparent px-3 py-2 text-[var(--text-heading)] text-sm placeholder-[var(--text-secondary)] outline-none"
              {...props}
            />
            <div className="flex flex-col border-[var(--border-emphasis)] border-l">
              <button
                type="button"
                onClick={handleIncrement}
                aria-label="Increment"
                className="flex items-center justify-center p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)]"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={handleDecrement}
                aria-label="Decrement"
                className="flex items-center justify-center border-[var(--border-emphasis)] border-t p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)]"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          </div>
          {suffix && (
            <div className="pointer-events-none absolute top-1/2 right-10 -translate-y-1/2 font-medium text-[#4a4a4a] text-xs">
              {suffix}
            </div>
          )}
        </div>
      </div>
    );
  }
);
