"use client";

import { ShiftCoverageWidget } from "@repo/departments/ui";
import { verifyPin, closeShift } from "@/lib/shift-closeout";

interface ShiftCoveragePortalProps {
  departmentId: string;
  departmentSlug: string;
  today: string;
  currentShift: "day" | "night";
}

export function ShiftCoveragePortal(props: ShiftCoveragePortalProps) {
  return <ShiftCoverageWidget {...props} shiftCloseout={{ verifyPin, closeShift }} />;
}
