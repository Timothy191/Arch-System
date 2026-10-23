import type React from 'react';
import { cn } from '../../lib/utils';

export interface FieldsetProps
  extends Omit<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
}

export function Fieldset({
  title,
  subtitle,
  footer,
  children,
  className,
  ...props
}: FieldsetProps) {
  return (
    <fieldset
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm',
        className
      )}
      {...props}
    >
      <div className="flex flex-col gap-6 p-6">
        {(title || subtitle) && (
          <div className="flex flex-col gap-1.5">
            {title && (
              <legend className="font-semibold text-xl leading-none tracking-tight">{title}</legend>
            )}
            {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
          </div>
        )}
        <div className="flex flex-col gap-4">{children}</div>
      </div>
      {footer && (
        <div className="flex items-center justify-between border-border border-t bg-muted/40 px-6 py-4">
          {footer}
        </div>
      )}
    </fieldset>
  );
}
