'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Download,
  Layers,
  Printer,
  RefreshCw,
  Target,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { ProductionMonthReportData } from './actions';
import { getProductionDepartmentData, upsertMonthlyProductionTarget } from './actions';

interface ProductionCommandCenterClientProps {
  initialData: ProductionMonthReportData;
  deptId: string;
}

const SOURCE_TILE_CLASS =
  'rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3';
const ACTION_PILL_LINK_CLASS =
  'rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5 font-medium text-[var(--text-heading)] text-xs transition-all hover:border-[var(--accent-blue)]';
const TH_RIGHT_CLASS = 'px-3 py-2.5 text-right';
const TD_NUM_MUTED_CLASS = 'px-3 py-2.5 text-right font-mono text-[var(--text-secondary)]';
const TD_NUM_EMPTY_CLASS = 'px-3 py-2.5 text-right font-mono text-[var(--text-muted)]';

export function ProductionCommandCenterClient({
  initialData,
  deptId,
}: ProductionCommandCenterClientProps) {
  const [report, setReport] = useState<ProductionMonthReportData>(initialData);
  const [selectedMonth, setSelectedMonth] = useState<string>(initialData.selectedMonth);
  const [showTargetEditor, setShowTargetEditor] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [targetForm, setTargetForm] = useState({
    coal_target_tonnes: initialData.target.coal_target_tonnes,
    waste_target_tonnes: initialData.target.waste_target_tonnes,
    bcm_target: initialData.target.bcm_target,
    notes: initialData.target.notes ?? '',
  });

  const handleMonthChange = (nextMonth: string) => {
    setSelectedMonth(nextMonth);
    startTransition(async () => {
      try {
        const nextData = await getProductionDepartmentData(nextMonth, deptId);
        setReport(nextData);
        setTargetForm({
          coal_target_tonnes: nextData.target.coal_target_tonnes,
          waste_target_tonnes: nextData.target.waste_target_tonnes,
          bcm_target: nextData.target.bcm_target,
          notes: nextData.target.notes ?? '',
        });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to load monthly production report'
        );
      }
    });
  };

  const handleSaveTarget = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await upsertMonthlyProductionTarget({
          target_month: selectedMonth,
          coal_target_tonnes: Number(targetForm.coal_target_tonnes) || 0,
          waste_target_tonnes: Number(targetForm.waste_target_tonnes) || 0,
          bcm_target: Number(targetForm.bcm_target) || 0,
          notes: targetForm.notes,
        });
        const refreshed = await getProductionDepartmentData(selectedMonth, deptId);
        setReport(refreshed);
        setShowTargetEditor(false);
        toast.success(
          `Monthly Coal & Waste targets updated for ${refreshed.monthLabel} and synced across departments!`
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save monthly target');
      }
    });
  };

  const handleExportCsv = () => {
    const headers = [
      'Date',
      'Status',
      'Day Shift Coal (t)',
      'Night Shift Coal (t)',
      'Total Coal (t)',
      'Day Shift Waste (t)',
      'Night Shift Waste (t)',
      'Total Waste (t)',
      'Haul Loads',
      'Haul Pit BCM',
      'Excavator Pit BCM',
      'Dozer Rollover BCM',
      'Total Pit BCM',
      'Fleet SMR Hours',
      'Strip Ratio (W:C)',
    ];
    const rows = report.dailyRows.map((r) => [
      r.date,
      r.hasData ? 'Captured' : 'No data captured',
      r.dayShiftCoalTonnes,
      r.nightShiftCoalTonnes,
      r.totalCoalTonnes,
      r.dayShiftWasteTonnes,
      r.nightShiftWasteTonnes,
      r.totalWasteTonnes,
      r.haulTruckLoads,
      r.haulTruckBcm,
      r.excavatorBcm,
      r.dozerPushBcm,
      r.totalBcm,
      r.fleetOperatingHours,
      r.stripRatio,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `production-report-${report.selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${report.monthLabel} Production Report CSV`);
  };

  const { totals, target } = report;
  const passedMonthOption = report.availableMonths[1];

  const monthlyShiftTotals = useMemo(() => {
    let dayShiftCoal = 0;
    let nightShiftCoal = 0;
    for (const r of report.dailyRows) {
      dayShiftCoal += r.dayShiftCoalTonnes;
      nightShiftCoal += r.nightShiftCoalTonnes;
    }
    return { dayShiftCoal, nightShiftCoal };
  }, [report.dailyRows]);

  return (
    <div className="space-y-6">
      {/* ── Top Header: Month Switcher, Passed Month Quick-View, & Target Editor Trigger ── */}
      <GlassCard className="p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-bold text-2xl text-[var(--text-heading)] tracking-tight">
                Production Command &amp; Pit BCM Ledger
              </h2>
              <Badge
                variant="outline"
                className="border-emerald-500/25 bg-emerald-500/10 font-mono text-emerald-700 text-xs"
              >
                Auto-Pulled Pit BCM SSoT
              </Badge>
            </div>
            <p className="mt-1 text-[var(--text-secondary)] text-xs">
              Automatically aggregates Pit BCM Moved, ROM Coal, Overburden Waste, Haul Truck Loads,
              Excavator Pit BCM, and Dozer Rollover across Control Room &amp; Production logs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {passedMonthOption && (
              <Button
                type="button"
                size="sm"
                variant={selectedMonth === passedMonthOption.value ? 'default' : 'outline'}
                onClick={() => handleMonthChange(passedMonthOption.value)}
                disabled={isPending}
                className="gap-1.5 text-xs"
              >
                <Calendar className="h-3.5 w-3.5" />
                Passed Month Report ({passedMonthOption.value})
              </Button>
            )}

            <select
              aria-label="Select production report month"
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              disabled={isPending}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 font-medium text-[var(--text-heading)] text-xs"
            >
              {report.availableMonths.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowTargetEditor((v) => !v)}
              className="gap-1.5 text-xs"
            >
              <Target className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
              Set Monthly Target
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              className="gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => typeof window !== 'undefined' && window.print()}
              className="gap-1.5 text-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* ── Monthly Target Configuration Drawer (Coal & Waste) ── */}
      {showTargetEditor && (
        <GlassCard className="space-y-4 border-2 border-[var(--accent-blue)]/40 p-6">
          <div className="flex items-center justify-between border-[var(--border-subtle)] border-b pb-3">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-base">
                <Target className="h-4 w-4 text-[var(--accent-blue)]" />
                Set Monthly Production Targets — {report.monthLabel} ({selectedMonth})
              </h3>
              <p className="mt-0.5 text-[var(--text-secondary)] text-xs">
                Targets set here are stored in{' '}
                <code className="font-mono">production_monthly_targets</code> and automatically
                pulled by Control Room, Drilling, and Executive Reports.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveTarget} className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
                Monthly Coal Target (Tonnes) *
              </label>
              <input
                type="number"
                min={0}
                step={500}
                required
                value={targetForm.coal_target_tonnes}
                onChange={(e) =>
                  setTargetForm((prev) => ({
                    ...prev,
                    coal_target_tonnes: Number(e.target.value),
                  }))
                }
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-[var(--text-heading)] text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
                Monthly Waste Target (Tonnes) *
              </label>
              <input
                type="number"
                min={0}
                step={1000}
                required
                value={targetForm.waste_target_tonnes}
                onChange={(e) =>
                  setTargetForm((prev) => ({
                    ...prev,
                    waste_target_tonnes: Number(e.target.value),
                  }))
                }
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-[var(--text-heading)] text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
                Monthly Pit BCM Target *
              </label>
              <input
                type="number"
                min={0}
                step={1000}
                required
                value={targetForm.bcm_target}
                onChange={(e) =>
                  setTargetForm((prev) => ({
                    ...prev,
                    bcm_target: Number(e.target.value),
                  }))
                }
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-[var(--text-heading)] text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
                Target Notes / Seam Reference
              </label>
              <input
                type="text"
                value={targetForm.notes}
                onChange={(e) => setTargetForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="e.g. Seam 2 & 4 ROM Plan"
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-[var(--border-subtle)] border-t pt-2 md:col-span-4">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowTargetEditor(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="gap-1.5 bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isPending ? 'Saving Target…' : 'Save & Broadcast Monthly Target'}
              </Button>
            </div>
          </form>
        </GlassCard>
      )}

      {/* ── Monthly Target vs Actual Progress Cards (Coal, Waste, Pit BCM, Strip Ratio) ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <GlassCard className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              Coal Production ({report.selectedMonth})
            </span>
            <Badge className="border border-emerald-500/30 bg-emerald-500/15 font-mono text-emerald-700 text-xs">
              {totals.coalTargetProgressPct}% of Target
            </Badge>
          </div>
          <div>
            <p className="font-bold font-mono text-2xl text-[var(--text-heading)]">
              {totals.coalTonnes.toLocaleString('en-US')} t
            </p>
            <p className="mt-0.5 text-[var(--text-muted)] text-xs">
              Target:{' '}
              <strong className="text-[var(--text-heading)]">
                {target.coal_target_tonnes.toLocaleString('en-US')} t
              </strong>{' '}
              · Rem: {totals.remainingCoalTonnes.toLocaleString('en-US')} t
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${Math.min(100, totals.coalTargetProgressPct)}%` }}
            />
          </div>
          <p className="font-mono text-[11px] text-[var(--text-secondary)]">
            Req. Run-Rate: {totals.requiredDailyCoalRate.toLocaleString('en-US')} t/day
          </p>
        </GlassCard>

        <GlassCard className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              Waste Stripping ({report.selectedMonth})
            </span>
            <Badge className="border border-blue-500/30 bg-blue-500/15 font-mono text-blue-700 text-xs">
              {totals.wasteTargetProgressPct}% of Target
            </Badge>
          </div>
          <div>
            <p className="font-bold font-mono text-2xl text-[var(--text-heading)]">
              {totals.wasteTonnes.toLocaleString('en-US')} t
            </p>
            <p className="mt-0.5 text-[var(--text-muted)] text-xs">
              Target:{' '}
              <strong className="text-[var(--text-heading)]">
                {target.waste_target_tonnes.toLocaleString('en-US')} t
              </strong>{' '}
              · Rem: {totals.remainingWasteTonnes.toLocaleString('en-US')} t
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${Math.min(100, totals.wasteTargetProgressPct)}%` }}
            />
          </div>
          <p className="font-mono text-[11px] text-[var(--text-secondary)]">
            Req. Run-Rate: {totals.requiredDailyWasteRate.toLocaleString('en-US')} t/day
          </p>
        </GlassCard>

        <GlassCard className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              Pit BCM Moved ({report.selectedMonth})
            </span>
            <Badge variant="outline" className="font-mono text-xs">
              {totals.bcmTargetProgressPct}% of Plan
            </Badge>
          </div>
          <div>
            <p className="font-bold font-mono text-2xl text-[var(--text-heading)]">
              {totals.totalBcm.toLocaleString('en-US')} BCM
            </p>
            <p className="mt-0.5 text-[var(--text-muted)] text-xs">
              Target:{' '}
              <strong className="text-[var(--text-heading)]">
                {target.bcm_target.toLocaleString('en-US')} BCM
              </strong>{' '}
              · {totals.haulTruckLoads.toLocaleString('en-US')} Haul Loads
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${Math.min(100, totals.bcmTargetProgressPct)}%` }}
            />
          </div>
          <p className="font-mono text-[11px] text-[var(--text-secondary)]">
            Haul: {totals.haulTruckBcm.toLocaleString('en-US')} · Dozer:{' '}
            {totals.dozerPushBcm.toLocaleString('en-US')} BCM
          </p>
        </GlassCard>

        <GlassCard className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              Strip Ratio &amp; Fleet SMR
            </span>
            <Badge variant="outline" className="font-mono text-xs">
              {totals.daysLogged} / {totals.totalDaysInMonth} Days
            </Badge>
          </div>
          <div>
            <p className="font-bold font-mono text-2xl text-[var(--text-heading)]">
              {totals.stripRatio.toFixed(2)} : 1
            </p>
            <p className="mt-0.5 text-[var(--text-muted)] text-xs">
              Target Ratio:{' '}
              <strong className="text-[var(--text-heading)]">
                {target.coal_target_tonnes > 0
                  ? (target.waste_target_tonnes / target.coal_target_tonnes).toFixed(2)
                  : '2.80'}{' '}
                : 1
              </strong>{' '}
              (W:C)
            </p>
          </div>
          <div className="flex items-center justify-between border-[var(--border-subtle)] border-t pt-1 text-xs">
            <span className="text-[var(--text-muted)]">Fleet Operating Hours:</span>
            <span className="font-mono font-semibold text-[var(--text-heading)]">
              {totals.fleetOperatingHours.toLocaleString('en-US')} SMR hrs
            </span>
          </div>
        </GlassCard>
      </div>

      {/* ── Pit BCM Moved Only Upstream Source Breakdown & Quick Navigation ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <GlassCard className="flex flex-col justify-between gap-4 p-5 lg:col-span-12">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-1.5 font-bold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                <Layers className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                Auto-Synchronized Upstream Sources — Pit BCM Moved Only
              </h3>
              <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                Production accounting is anchored exclusively on Pit BCM Moved across haulage,
                excavation, dozer rollover, and fleet SMR hours.
              </p>
            </div>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] text-emerald-700">
              Pit BCM SSoT Active
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div className={SOURCE_TILE_CLASS}>
              <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                1. Haul Truck Pit BCM
              </p>
              <p className="mt-0.5 font-bold font-mono text-[var(--text-heading)] text-sm">
                {totals.haulTruckBcm.toLocaleString('en-US')} BCM
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                {totals.haulTruckLoads.toLocaleString('en-US')} loads moved
              </p>
            </div>
            <div className={SOURCE_TILE_CLASS}>
              <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                2. Excavator Pit BCM
              </p>
              <p className="mt-0.5 font-bold font-mono text-[var(--text-heading)] text-sm">
                {totals.excavatorBcm.toLocaleString('en-US')} BCM
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Direct bench excavation</p>
            </div>
            <div className={SOURCE_TILE_CLASS}>
              <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                3. Dozer Rollover Pit BCM
              </p>
              <p className="mt-0.5 font-bold font-mono text-[var(--text-heading)] text-sm">
                {totals.dozerPushBcm.toLocaleString('en-US')} BCM
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                Overburden push rollover
              </p>
            </div>
            <div className={SOURCE_TILE_CLASS}>
              <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                4. Fleet SMR Ops
              </p>
              <p className="mt-0.5 font-bold font-mono text-[var(--text-heading)] text-sm">
                {totals.fleetOperatingHours.toLocaleString('en-US')} hrs
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Verified machine hours</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-[var(--border-subtle)] border-t pt-3">
            <Link
              href="/production/daily-log"
              className="rounded-lg bg-[var(--accent-blue)] px-3 py-1.5 font-medium text-white text-xs transition-all hover:bg-[var(--accent-blue)]/90"
            >
              Production Targets
            </Link>
            <Link href="/production/hourly-loads" className={ACTION_PILL_LINK_CLASS}>
              Hourly Loads Matrix
            </Link>
            <Link href="/production/reports" className={ACTION_PILL_LINK_CLASS}>
              Detailed Shift Logs
            </Link>
          </div>
        </GlassCard>
      </div>

      {/* ── Daily & Passed Month Full-Calendar Production Report Table ── */}
      <GlassCard className="space-y-4 p-5">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-base">
              <BarChart3 className="h-4 w-4 text-[var(--accent-blue)]" />
              {report.monthLabel} — Automated Daily Production &amp; Stripping Ledger
            </h3>
            <p className="text-[var(--text-muted)] text-xs">
              Showing full month (all {totals.totalDaysInMonth} days) for {report.monthLabel} —{' '}
              {totals.daysLogged} active production day(s) captured. Switch month above at any time
              to inspect passed-month reports.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => handleMonthChange(selectedMonth)}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
            Refresh Auto-Pull
          </Button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
          <table className="w-full text-left text-xs">
            <thead className="border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)] font-mono text-[11px] text-[var(--text-secondary)] uppercase">
              <tr>
                <th className="px-3 py-2.5">Date</th>
                <th className={TH_RIGHT_CLASS}>Day Coal (t)</th>
                <th className={TH_RIGHT_CLASS}>Night Coal (t)</th>
                <th className="px-3 py-2.5 text-right font-bold text-emerald-700">
                  Total Coal (t)
                </th>
                <th className="px-3 py-2.5 text-right font-bold text-blue-700">Total Waste (t)</th>
                <th className={TH_RIGHT_CLASS}>Strip Ratio</th>
                <th className={TH_RIGHT_CLASS}>Haul Loads</th>
                <th className={TH_RIGHT_CLASS}>Pit BCM</th>
                <th className={TH_RIGHT_CLASS}>Fleet SMR (h)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {report.dailyRows.map((row) =>
                row.hasData ? (
                  <tr key={row.date} className="hover:bg-[var(--bg-secondary)]/50">
                    <td className="px-3 py-2.5 font-medium font-mono text-[var(--text-heading)]">
                      {row.date}
                    </td>
                    <td className={TD_NUM_MUTED_CLASS}>
                      {row.dayShiftCoalTonnes.toLocaleString('en-US')}
                    </td>
                    <td className={TD_NUM_MUTED_CLASS}>
                      {row.nightShiftCoalTonnes.toLocaleString('en-US')}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-700">
                      {row.totalCoalTonnes.toLocaleString('en-US')}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-blue-700">
                      {row.totalWasteTonnes.toLocaleString('en-US')}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[var(--text-heading)]">
                      {row.stripRatio.toFixed(2)}:1
                    </td>
                    <td className={TD_NUM_MUTED_CLASS}>
                      {row.haulTruckLoads.toLocaleString('en-US')}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium font-mono text-[var(--text-heading)]">
                      {row.totalBcm.toLocaleString('en-US')}
                    </td>
                    <td className={TD_NUM_MUTED_CLASS}>{row.fleetOperatingHours.toFixed(1)}h</td>
                  </tr>
                ) : (
                  <tr key={row.date} className="bg-[var(--bg-secondary)]/30 opacity-75">
                    <td className="px-3 py-2.5 font-mono text-[var(--text-muted)]">
                      <span>{row.date}</span>
                      <span className="ml-2 inline-flex rounded-full border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-0.5 font-sans text-[10px] text-[var(--text-muted)]">
                        No data captured
                      </span>
                    </td>
                    <td className={TD_NUM_EMPTY_CLASS}>—</td>
                    <td className={TD_NUM_EMPTY_CLASS}>—</td>
                    <td className={TD_NUM_EMPTY_CLASS}>—</td>
                    <td className={TD_NUM_EMPTY_CLASS}>—</td>
                    <td className={TD_NUM_EMPTY_CLASS}>—</td>
                    <td className={TD_NUM_EMPTY_CLASS}>—</td>
                    <td className={TD_NUM_EMPTY_CLASS}>—</td>
                    <td className={TD_NUM_EMPTY_CLASS}>—</td>
                  </tr>
                )
              )}
              {report.dailyRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[var(--text-muted)]">
                    No shift logs or haulage loads recorded for {report.monthLabel} yet.
                  </td>
                </tr>
              )}
            </tbody>
            {report.dailyRows.length > 0 && (
              <tfoot className="border-[var(--border-default)] border-t-2 bg-[var(--bg-secondary)] font-bold font-mono text-[var(--text-heading)]">
                <tr>
                  <td className="px-3 py-2.5">MONTHLY TOTAL</td>
                  <td className="px-3 py-2.5 text-right">
                    {monthlyShiftTotals.dayShiftCoal.toLocaleString('en-US')}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {monthlyShiftTotals.nightShiftCoal.toLocaleString('en-US')}
                  </td>
                  <td className="px-3 py-2.5 text-right text-emerald-700">
                    {totals.coalTonnes.toLocaleString('en-US')} t
                  </td>
                  <td className="px-3 py-2.5 text-right text-blue-700">
                    {totals.wasteTonnes.toLocaleString('en-US')} t
                  </td>
                  <td className="px-3 py-2.5 text-right">{totals.stripRatio.toFixed(2)}:1</td>
                  <td className="px-3 py-2.5 text-right">
                    {totals.haulTruckLoads.toLocaleString('en-US')}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {totals.totalBcm.toLocaleString('en-US')} BCM
                  </td>
                  <td className="px-3 py-2.5 text-right">{totals.fleetOperatingHours}h</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
