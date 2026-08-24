"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UnifiedShiftReport } from "@repo/contract/types/shift-compilation.types";
import {
  ShiftCompilationHeader,
  FleetKpiTable,
  ProductionSummaryCard,
  BreakdownsShiftWidget,
  TireAlertsBanner,
  UnifiedShiftCloseoutModal,
} from "@repo/departments/ui";
import { KPIGrid, KPICard } from "@repo/ui/KPI";
import { lockAndSignUnifiedShift } from "./actions";

interface ShiftCompilationClientProps {
  initialReport: UnifiedShiftReport;
  departmentId: string;
  departmentSlug: string;
  shiftDate: string;
  shiftType: "day" | "night";
}

export function ShiftCompilationClient({
  initialReport,
  departmentId,
  departmentSlug,
  shiftDate,
  shiftType,
}: ShiftCompilationClientProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  const report = initialReport;
  const activeMachines = report.fleet_performance.length;
  const totalLoads = report.production.total_loads;
  const activeBreakdowns = report.breakdowns.filter((b) => b.status === "active").length;
  const avgAvailability =
    activeMachines > 0
      ? (
          report.fleet_performance.reduce(
            (acc, curr) => acc + curr.mechanical_availability_pct,
            0,
          ) / activeMachines
        ).toFixed(1)
      : "100.0";

  return (
    <div className="space-y-6">
      <ShiftCompilationHeader
        departmentSlug={departmentSlug}
        shiftDate={shiftDate}
        shiftType={shiftType}
        status={report.shift_status.status}
        closedAt={report.shift_status.closed_at}
        onOpenCloseoutModal={() => setModalOpen(true)}
      />

      {/* KPI Overview Summary */}
      <KPIGrid cols={4}>
        <KPICard
          label="Shift Production"
          value={`${totalLoads.toLocaleString()} Loads`}
          color="green"
        />
        <KPICard label="Active Fleet" value={`${activeMachines} Units`} color="blue" />
        <KPICard
          label="Avg Mechanical Availability"
          value={`${avgAvailability}%`}
          color={Number(avgAvailability) >= 85 ? "green" : "default"}
        />
        <KPICard
          label="Active Breakdowns"
          value={`${activeBreakdowns} Units`}
          color={activeBreakdowns > 0 ? "red" : "green"}
        />
      </KPIGrid>

      {/* Production & Hauling Breakdown */}
      <ProductionSummaryCard production={report.production} shiftType={shiftType} />

      {/* Machine Performance & Delays */}
      <FleetKpiTable fleet={report.fleet_performance} />

      {/* 2-Column Grid: Breakdowns & Tire Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BreakdownsShiftWidget breakdowns={report.breakdowns} />
        <TireAlertsBanner tireEvents={report.tire_management} />
      </div>

      {/* Supervisor Closeout Modal */}
      <UnifiedShiftCloseoutModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        departmentId={departmentId}
        departmentSlug={departmentSlug}
        shiftDate={shiftDate}
        shiftType={shiftType}
        onSignShift={lockAndSignUnifiedShift}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
