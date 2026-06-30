"use client";

import * as React from "react";
import { cn } from "@repo/ui/lib/utils";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <label className={cn("cir-check select-none", className)}>
        <input type="checkbox" ref={ref} {...props} />
        <span className="cir-check-box" />
        {label && <span className="cir-check-label">{label}</span>}
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";

export interface ChecklistProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Checklist({ className, children, ...props }: ChecklistProps) {
  return (
    <div className={cn("cir-checks", className)} {...props}>
      {children}
    </div>
  );
}
