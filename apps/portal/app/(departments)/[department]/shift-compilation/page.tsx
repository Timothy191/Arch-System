import { getDepartmentContext } from "~/lib/dept-context";
import { getCurrentShift } from "@repo/utils";
import type { UnifiedShiftReport } from "@repo/contract/types/shift-compilation.types";
import { getUnifiedShiftReport, getMultiSiteShiftReport } from "./actions";
import { ShiftCompilationClient } from "./ShiftCompilationClient";

export const dynamic = "force-dynamic";

export default async function ShiftCompilationPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams: Promise<{ date?: string; shift?: string }>;
}) {
  const { department } = await params;
  const { date: queryDate, shift: queryShift } = await searchParams;

  const { deptId, today } = await getDepartmentContext({
    department,
  });

  const shiftDate = queryDate || today;
  const shiftType = queryShift === "day" || queryShift === "night" ? queryShift : getCurrentShift();

  const [{ data: compiledReport }, { data: multiSiteReport }] = await Promise.all([
    getUnifiedShiftReport(deptId, shiftDate, shiftType),
    getMultiSiteShiftReport(deptId, shiftDate, shiftType),
  ]);

  const fallbackReport: UnifiedShiftReport = {
    meta: {
      department_id: deptId,
      shift_date: shiftDate,
      shift_type: shiftType,
      compiled_at: new Date().toISOString(),
    },
    shift_status: {
      status: "open",
    },
    production: {
      total_loads: 0,
      machines: [],
    },
    fleet_performance: [],
    breakdowns: [],
    tire_management: [],
  };

  const report = compiledReport || fallbackReport;

  return (
    <ShiftCompilationClient
      initialReport={report}
      multiSiteReport={multiSiteReport || null}
      departmentId={deptId}
      departmentSlug={department}
      shiftDate={shiftDate}
      shiftType={shiftType}
    />
  );
}
