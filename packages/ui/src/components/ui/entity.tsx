import React from "react";
import { cn } from "../../lib/utils";

export interface EntityProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  thumbnail?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export function Entity({
  thumbnail,
  title,
  description,
  actions,
  className,
  ...props
}: EntityProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 p-4 rounded-xl border bg-card text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-4 min-w-0">
        {thumbnail && <div className="flex-shrink-0">{thumbnail}</div>}
        <div className="flex flex-col min-w-0">
          <div className="font-medium text-base truncate">{title}</div>
          {description && (
            <div className="text-sm text-muted-foreground truncate">{description}</div>
          )}
        </div>
      </div>
      {actions && <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}
