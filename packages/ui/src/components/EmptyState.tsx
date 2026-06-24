import * as React from "react";
import { cn } from "@repo/ui/lib/utils";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 rounded-lg",
        className,
      )}
      {...props}
    >
      {Icon && (
        <div className="p-3 bg-[var(--bg-tertiary)]/60 rounded-full mb-4">
          <Icon className="w-8 h-8 text-[var(--text-muted)]" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--text-muted)] max-w-sm mb-6">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
