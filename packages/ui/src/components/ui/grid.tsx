import React from "react";
import { cn } from "../../lib/utils";

export interface GridSystemProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: number;
  gap?: number | string;
}

export function GridSystem({
  columns = 12,
  gap = 6,
  className,
  children,
  style,
  ...props
}: GridSystemProps) {
  return (
    <div
      className={cn("grid", className)}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: typeof gap === "number" ? `${gap * 0.25}rem` : gap,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: number;
  gap?: number | string;
}

export function Grid({ columns, gap, className, children, ...props }: GridProps) {
  return (
    <GridSystem columns={columns} gap={gap} className={className} {...props}>
      {children}
    </GridSystem>
  );
}

export interface GridCellProps extends React.HTMLAttributes<HTMLDivElement> {
  columnSpan?: number;
  rowSpan?: number;
}

export function GridCell({
  columnSpan = 1,
  rowSpan = 1,
  className,
  style,
  children,
  ...props
}: GridCellProps) {
  return (
    <div
      className={cn(className)}
      style={{
        gridColumn: `span ${columnSpan} / span ${columnSpan}`,
        gridRow: `span ${rowSpan} / span ${rowSpan}`,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export interface GridPageProps extends React.HTMLAttributes<HTMLDivElement> {}

export function GridPage({ className, children, ...props }: GridPageProps) {
  return (
    <div className={cn("max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8", className)} {...props}>
      {children}
    </div>
  );
}

export function GridCross({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("relative w-4 h-4 text-muted", className)} {...props}>
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-currentColor -translate-x-1/2" />
      <div className="absolute top-1/2 left-0 right-0 h-px bg-currentColor -translate-y-1/2" />
    </div>
  );
}
