import type React from "react";
import { cn } from "../../lib/utils";

export interface FieldsetProps
  extends Omit<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, "title"> {
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
        "rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden",
        className
      )}
      {...props}
    >
      <div className="flex flex-col gap-6 p-6">
        {(title || subtitle) && (
          <div className="flex flex-col gap-1.5">
            {title && (
              <legend className="text-xl font-semibold leading-none tracking-tight">{title}</legend>
            )}
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        )}
        <div className="flex flex-col gap-4">{children}</div>
      </div>
      {footer && (
        <div className="flex items-center justify-between border-t border-border bg-muted/40 px-6 py-4">
          {footer}
        </div>
      )}
    </fieldset>
  );
}
