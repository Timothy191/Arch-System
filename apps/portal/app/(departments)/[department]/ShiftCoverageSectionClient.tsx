"use client";

import { useShiftCoverage } from "@/hooks/useDashboardQueries";
import { getCurrentShift } from "@repo/utils";
import { ShiftCoverageWidget } from "@/features/departments";

interface ShiftCoverageSectionClientProps {
  deptId: string;
  deptSlug: string;
  today: string;
}

export function ShiftCoverageSectionClient({
  deptId,
  deptSlug,
  today,
}: ShiftCoverageSectionClientProps) {
  const { data } = useShiftCoverage(deptId, today);

  if (!data) return null;

  const currentShift = (data.latestShift as "day" | "night") || getCurrentShift();

  return (
    <ShiftCoverageWidget
      departmentId={deptId}
      departmentSlug={deptSlug}
      today={today}
      currentShift={currentShift}
    />
  );
}
