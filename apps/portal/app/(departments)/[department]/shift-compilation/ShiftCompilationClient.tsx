"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UnifiedShiftReport } from "@repo/contract/types/shift-compilation.types";
import type { MultiSiteShiftReport } from "@repo/contract/types/multi-site-production.types";
import {
  ShiftCompilationHeader,
  FleetKpiTable,
  ProductionSummaryCard,
  BreakdownsShiftWidget,
  TireAlertsBanner,
  UnifiedShiftCloseoutModal,
  MultiSiteShiftReportClient,
  ExportPdfButton,
} from "@repo/departments/ui";
import { KPIGrid, KPICard } from "@repo/ui/KPI";
import { lockAndSignUnifiedShift } from "./actions";
import { exportSignedShiftReportPdf } from "./pdf-actions";
import { cn } from "@repo/ui/lib/utils";

interface ShiftCompilationClientProps {
  initialReport: UnifiedShiftReport;
  multiSiteReport?: MultiSiteShiftReport | null;
  departmentId: string;
  departmentSlug: string;
  shiftDate: string;
  shiftType: "day" | "night";
}

export function ShiftCompilationClient({
  initialReport,
  multiSiteReport,
  departmentId,
  departmentSlug,
  shiftDate,
  shiftType,
}: ShiftCompilationClientProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"department" | "multisite">("department");

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

  const isClosed = report.shift_status.status === "closed";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <ShiftCompilationHeader
          departmentSlug={departmentSlug}
          shiftDate={shiftDate}
          shiftType={shiftType}
          status={report.shift_status.status}
          closedAt={report.shift_status.closed_at}
          onOpenCloseoutModal={() => setModalOpen(true)}
        />
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Export PDF Button with cryptographic seal */}
          <ExportPdfButton
            departmentId={departmentId}
            shiftDate={shiftDate}
            shiftType={shiftType}
            isShiftClosed={isClosed}
            onExport={exportSignedShiftReportPdf}
          />
        </div>
      </div>

      {/* View Switcher: Department Shift vs Multi-Site Operations */}
      <div className="flex items-center justify-between border-b border-arch-border-subtle pb-2">
        <div className="flex items-center gap-2 bg-arch-surface-secondary/70 p-1 rounded-lg border border-arch-border-subtle">
          <button
            type="button"
            onClick={() => setActiveTab("department")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
              activeTab === "department"
                ? "bg-white text-arch-text-primary shadow-card"
                : "text-arch-text-tertiary hover:text-arch-text-secondary",
            )}
          >
            Department Breakdown
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("multisite")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
              activeTab === "multisite"
                ? "bg-white text-arch-text-primary shadow-card"
                : "text-arch-text-tertiary hover:text-arch-text-secondary",
            )}
          >
            Multi-Site Operational Report (BKF / EXT / PLANT)
          </button>
        </div>
      </div>

      {activeTab === "multisite" && multiSiteReport ? (
        <MultiSiteShiftReportClient initialReport={multiSiteReport} />
      ) : (
        <>
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
        </>
      )}

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
