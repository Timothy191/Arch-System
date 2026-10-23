'use client';

import { Check, Minus } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  size?: 'small' | 'medium';
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
      size = 'medium',
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
          'inline-flex cursor-pointer select-none items-center gap-2 font-medium text-sm',
          disabled && 'pointer-events-none cursor-not-allowed opacity-50',
          className
        )}
      >
        <input
          ref={inputRef}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-checked={indeterminate ? 'mixed' : checked}
          onChange={handleChange}
          className="peer sr-only"
          {...props}
        />
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded border transition-colors duration-150',
            size === 'small' ? 'h-3.5 w-3.5 text-[10px]' : 'h-4 w-4 text-xs',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-neutral-900 peer-focus-visible:ring-offset-2',
            isChecked
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-white/10 bg-white/5 hover:border-white/20'
          )}
          aria-hidden="true"
        >
          {indeterminate ? (
            <Minus className="h-3 w-3 stroke-[3]" />
          ) : checked ? (
            <Check className="h-3 w-3 stroke-[3]" />
          ) : null}
        </span>
        {(children || label) && (
          <span className="text-neutral-900 leading-none">{children || label}</span>
        )}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
