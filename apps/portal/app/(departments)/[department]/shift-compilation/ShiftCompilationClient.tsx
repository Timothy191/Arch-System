'use client';

import type { MachineTimeAllocationInput } from '@repo/contract';
import type { MultiSiteShiftReport } from '@repo/contract/types/multi-site-production.types';
import type { UnifiedShiftReport } from '@repo/contract/types/shift-compilation.types';
import {
  BreakdownsShiftWidget,
  FleetKpiTable,
  MultiSiteShiftReportClient,
  ProductionSummaryCard,
  ShiftCompilationHeader,
  UnifiedShiftCloseoutModal,
} from '@repo/departments/ui';
import { KPICard, KPIGrid } from '@repo/ui/KPI';
import { cn } from '@repo/ui/lib/utils';
import { BarChart3, CheckSquare, ClipboardCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ShiftCloseoutForm } from '../../control-room/components/ShiftCloseoutForm';
import {
  type ShiftReportSummary,
  SupervisorApprovalPanel,
} from '../../control-room/components/SupervisorApprovalPanel';
import { ShiftCoverageClient } from '../shift-coverage/ShiftCoverageClient';
import { lockAndSignUnifiedShift } from './actions';
import { exportSignedShiftReportPdf } from './pdf-actions';

interface ShiftCompilationClientProps {
  initialReport: UnifiedShiftReport;
  multiSiteReport?: MultiSiteShiftReport | null;
  departmentId: string;
  departmentSlug: string;
  shiftDate: string;
  shiftType: 'day' | 'night';
  initialSection?: 'handover' | 'coverage' | 'closeout';
  closeoutFleet?: MachineTimeAllocationInput[];
  recentCloseoutReports?: ShiftReportSummary[];
  currentEmployeeId?: string;
  currentRole?: string;
}

export function ShiftCompilationClient({
  initialReport,
  multiSiteReport,
  departmentId,
  departmentSlug,
  shiftDate,
  shiftType,
  initialSection = 'handover',
  closeoutFleet = [],
  recentCloseoutReports = [],
  currentEmployeeId,
  currentRole,
}: ShiftCompilationClientProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'handover' | 'coverage' | 'closeout'>(
    initialSection
  );
  const [activeTab, setActiveTab] = useState<'department' | 'multisite'>('department');

  const report = initialReport;
  const activeMachines = report.fleet_performance.length;
  const totalLoads = report.production.total_loads;
  const activeBreakdowns = report.breakdowns.filter((b) => b.status === 'active').length;
  const avgAvailability =
    activeMachines > 0
      ? (
          report.fleet_performance.reduce(
            (acc, curr) => acc + curr.mechanical_availability_pct,
            0
          ) / activeMachines
        ).toFixed(1)
      : '100.0';

  const isSupervisorOrAdmin = Boolean(currentRole && ['supervisor', 'admin'].includes(currentRole));

  return (
    <div className="space-y-6">
      {/* Dashboard / Shift Operations Sub-tab Navigation */}
      <div
        aria-label="Control Room Dashboard Sub-tabs"
        className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)]/60 pb-2.5"
      >
        <Link
          href={`/${departmentSlug}`}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-black/[0.04] border border-transparent hover:border-[var(--border-subtle)] transition-all"
        >
          <BarChart3 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span>Dashboard</span>
        </Link>
        <Link
          href={`/${departmentSlug}/shift-compilation`}
          aria-current="page"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] gold-steel-border gold-steel-border-slim transition-all"
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          <span>Shift Operations</span>
        </Link>
      </div>

      {/* Unified Shift Operations Section Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-heading)]">
            Shift Operations
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Unified shift handover compilation, roster &amp; machine coverage, and atomic shift
            closeout.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Shift Operations Views"
          className="inline-flex items-center gap-1 bg-[var(--bg-secondary)]/80 p-1 rounded-xl border border-[var(--border-subtle)]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'handover'}
            onClick={() => setActiveSection('handover')}
            className={cn(
              'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              activeSection === 'handover'
                ? 'bg-white text-[var(--text-heading)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
            )}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            Shift Handover
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'coverage'}
            onClick={() => setActiveSection('coverage')}
            className={cn(
              'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              activeSection === 'coverage'
                ? 'bg-white text-[var(--text-heading)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
            )}
          >
            <Users className="w-3.5 h-3.5" />
            Roster &amp; Coverage
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'closeout'}
            onClick={() => setActiveSection('closeout')}
            className={cn(
              'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              activeSection === 'closeout'
                ? 'bg-white text-[var(--text-heading)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
            )}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Shift Closeout
          </button>
        </div>
      </div>

      {activeSection === 'coverage' ? (
        <ShiftCoverageClient
          departmentId={departmentId}
          departmentSlug={departmentSlug}
          initialDate={shiftDate}
          initialShift={shiftType}
        />
      ) : activeSection === 'closeout' ? (
        <div className="space-y-8">
          {isSupervisorOrAdmin && (
            <SupervisorApprovalPanel
              reports={recentCloseoutReports}
              currentEmployeeId={currentEmployeeId}
              currentRole={currentRole}
            />
          )}
          <ShiftCloseoutForm
            deptId={departmentId}
            shiftDate={shiftDate}
            initialFleet={closeoutFleet}
          />
        </div>
      ) : (
        <>
          <ShiftCompilationHeader
            departmentId={departmentId}
            departmentSlug={departmentSlug}
            shiftDate={shiftDate}
            shiftType={shiftType}
            status={report.shift_status.status}
            closedAt={report.shift_status.closed_at}
            onOpenCloseoutModal={() => setModalOpen(true)}
            onExportPdf={exportSignedShiftReportPdf}
          />

          {/* View Switcher: Department Shift vs Multi-Site Operations */}
          <div className="flex items-center justify-between border-b border-arch-border-subtle pb-2">
            <div className="flex items-center gap-2 bg-arch-surface-secondary/70 p-1 rounded-lg border border-arch-border-subtle">
              <button
                type="button"
                onClick={() => setActiveTab('department')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                  activeTab === 'department'
                    ? 'bg-white text-arch-text-primary shadow-card'
                    : 'text-arch-text-tertiary hover:text-arch-text-secondary'
                )}
              >
                Department Breakdown
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('multisite')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                  activeTab === 'multisite'
                    ? 'bg-white text-arch-text-primary shadow-card'
                    : 'text-arch-text-tertiary hover:text-arch-text-secondary'
                )}
              >
                Multi-Site Operational Report (BKF / EXT / PLANT)
              </button>
            </div>
          </div>

          {activeTab === 'multisite' && multiSiteReport ? (
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
                  color={Number(avgAvailability) >= 85 ? 'green' : 'default'}
                />
                <KPICard
                  label="Active Breakdowns"
                  value={`${activeBreakdowns} Units`}
                  color={activeBreakdowns > 0 ? 'red' : 'green'}
                />
              </KPIGrid>

              {/* Production & Hauling Breakdown */}
              <ProductionSummaryCard production={report.production} shiftType={shiftType} />

              {/* Machine Performance & Delays */}
              <FleetKpiTable fleet={report.fleet_performance} />

              {/* Engineering Breakdowns & Stoppages */}
              <BreakdownsShiftWidget breakdowns={report.breakdowns} />
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
        </>
      )}
    </div>
  );
}
