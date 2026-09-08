"use client";

import { cn } from "@repo/ui/lib/utils";
import type * as React from "react";

export { Checkbox, type CheckboxProps } from "./ui/checkbox";

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
