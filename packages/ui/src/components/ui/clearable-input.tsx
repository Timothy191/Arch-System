'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ClearableInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  cmdk?: boolean;
  onClear?: () => void;
  size?: 'small' | 'medium' | 'large';
}

export const ClearableInput = React.forwardRef<HTMLInputElement, ClearableInputProps>(
  (
    {
      value = '',
      onChange,
      onClear,
      placeholder,
      label,
      cmdk = false,
      disabled = false,
      size = 'medium',
      className,
      ...props
    },
    ref
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
          'value'
        )?.set;
        nativeSetter?.call(inputRef.current, '');

        const event = new Event('input', { bubbles: true });
        inputRef.current.dispatchEvent(event);
        inputRef.current.focus();
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape' && hasValue && !disabled) {
        e.preventDefault();
        onClear?.();

        if (inputRef.current) {
          const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
          )?.set;
          nativeSetter?.call(inputRef.current, '');
          const event = new Event('input', { bubbles: true });
          inputRef.current.dispatchEvent(event);
        }
      }
      props.onKeyDown?.(e);
    };

    return (
      <div className="w-full space-y-1">
        {label && <label className="block font-medium text-neutral-700 text-xs">{label}</label>}
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
              'w-full rounded-md border border-neutral-300',
              'bg-white text-neutral-900 placeholder:text-neutral-400',
              'transition-colors focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900',
              'disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:opacity-50',
              size === 'small'
                ? 'h-8 px-2.5 text-xs'
                : size === 'large'
                  ? 'h-11 px-3.5 text-base'
                  : 'h-9 px-3 text-sm',
              hasValue || cmdk ? 'pr-14' : '',
              className
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
                className="rounded-full p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {/* CMD-K or Esc Badge */}
            {cmdk && (
              <kbd className="hidden select-none items-center rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 sm:inline-flex">
                {hasValue ? 'Esc' : '⌘K'}
              </kbd>
            )}
          </div>
        </div>
      </div>
    );
  }
);

ClearableInput.displayName = 'ClearableInput';
