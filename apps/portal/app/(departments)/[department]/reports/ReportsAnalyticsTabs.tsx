'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Input } from '@repo/ui/Input';
import { Archive, Calendar, Clock, FileText, Search, Table2, Wrench } from 'lucide-react';
import type { ArchivedReportData, DailyAggregatedRow, ReportSubtab } from './reports-types';

interface ReportsSubtabsToolbarProps {
  activeTab: ReportSubtab;
  onSelectTab: (tab: ReportSubtab) => void;
  filteredShiftRowsCount: number;
  dailyAggregatedRowsCount: number;
  monthlyRollupsCount: number;
  historicalRowsCount: number;
  pdfSiteGroupsCount: number;
  fleetMachinesCount?: number;
  shiftFilter: 'all' | 'day' | 'night';
  onShiftFilterChange: (shift: 'all' | 'day' | 'night') => void;
  allSites: string[];
  siteFilter: string;
  onSiteFilterChange: (site: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

export function ReportsSubtabsToolbar({
  activeTab,
  onSelectTab,
  filteredShiftRowsCount,
  dailyAggregatedRowsCount,
  monthlyRollupsCount,
  historicalRowsCount,
  pdfSiteGroupsCount,
  fleetMachinesCount = 0,
  shiftFilter,
  onShiftFilterChange,
  allSites,
  siteFilter,
  onSiteFilterChange,
  searchQuery,
  onSearchQueryChange,
}: ReportsSubtabsToolbarProps) {
  return (
    <div className="no-print flex flex-col justify-between gap-4 border-[var(--border-default)] border-b pb-3 md:flex-row md:items-center">
      <div
        role="tablist"
        aria-label="Report Views"
        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-1.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'shift'}
          onClick={() => onSelectTab('shift')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-sm transition-all ${
            activeTab === 'shift'
              ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
          }`}
        >
          <Clock className="h-4 w-4" />
          Shift
          <span
            className={`rounded-full px-1.5 py-0.2 text-xs ${
              activeTab === 'shift'
                ? 'bg-white/20 text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
            }`}
          >
            {filteredShiftRowsCount}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'day'}
          onClick={() => onSelectTab('day')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-sm transition-all ${
            activeTab === 'day'
              ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
          }`}
        >
          <Calendar className="h-4 w-4" />
          Day
          <span
            className={`rounded-full px-1.5 py-0.2 text-xs ${
              activeTab === 'day'
                ? 'bg-white/20 text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
            }`}
          >
            {dailyAggregatedRowsCount}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'machine-30d'}
          onClick={() => onSelectTab('machine-30d')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-sm transition-all ${
            activeTab === 'machine-30d'
              ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
          }`}
        >
          <Wrench className="h-4 w-4" />
          30-Day Machine Sheet
          <span
            className={`rounded-full px-1.5 py-0.2 text-xs ${
              activeTab === 'machine-30d'
                ? 'bg-white/20 text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
            }`}
          >
            30d
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'monthly-summary'}
          onClick={() => onSelectTab('monthly-summary')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-sm transition-all ${
            activeTab === 'monthly-summary'
              ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
          }`}
        >
          <Table2 className="h-4 w-4" />
          Monthly Summary
          <span
            className={`rounded-full px-1.5 py-0.2 text-xs ${
              activeTab === 'monthly-summary'
                ? 'bg-white/20 text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
            }`}
          >
            {fleetMachinesCount}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'archived'}
          onClick={() => onSelectTab('archived')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-sm transition-all ${
            activeTab === 'archived'
              ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
          }`}
        >
          <Archive className="h-4 w-4" />
          Archived
          <span
            className={`rounded-full px-1.5 py-0.2 text-xs ${
              activeTab === 'archived'
                ? 'bg-white/20 text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
            }`}
          >
            {monthlyRollupsCount}m / {historicalRowsCount}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'pdf-report'}
          onClick={() => onSelectTab('pdf-report')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-sm transition-all ${
            activeTab === 'pdf-report'
              ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
          }`}
        >
          <FileText className="h-4 w-4" />
          PDF Report
          <span
            className={`rounded-full px-1.5 py-0.2 text-xs ${
              activeTab === 'pdf-report'
                ? 'bg-white/20 text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
            }`}
          >
            {pdfSiteGroupsCount} site{pdfSiteGroupsCount === 1 ? '' : 's'}
          </span>
        </button>
      </div>

      {/* Interactive Quick Filters (Shift, Site, Search) */}
      <div className="flex flex-wrap items-center gap-2.5">
        {activeTab !== 'day' && (
          <div className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-1">
            {(['all', 'day', 'night'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onShiftFilterChange(s)}
                className={`rounded-md px-3 py-1 font-medium text-xs transition-colors ${
                  shiftFilter === s
                    ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                {s === 'all' ? 'All Shifts' : s === 'day' ? 'Day Shift' : 'Night Shift'}
              </button>
            ))}
          </div>
        )}

        {allSites.length > 0 && (
          <select
            aria-label="Filter by site"
            value={siteFilter}
            onChange={(e) => onSiteFilterChange(e.target.value)}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[var(--text-heading)] text-xs focus:border-[var(--accent-blue)] focus:outline-none"
          >
            <option value="all">All Sites ({allSites.length})</option>
            {allSites.map((site) => (
              <option key={site} value={site}>
                {site}
              </option>
            ))}
          </select>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search machine, site, date..."
            className="w-48 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] py-1.5 pr-3 pl-8 text-[var(--text-heading)] text-xs placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none sm:w-56"
          />
        </div>
      </div>
    </div>
  );
}

interface ReportsDayViewTabProps {
  dailyAggregatedRows: DailyAggregatedRow[];
  todayStr: string;
}

export function ReportsDayViewTab({ dailyAggregatedRows, todayStr }: ReportsDayViewTabProps) {
  return (
    <div className="space-y-6">
      {/* Visual Daily Volume Trend Bars */}
      <GlassCard className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-[var(--text-heading)] text-base">
              Daily Consolidated Production Trend (Day + Night Combined)
            </h3>
            <p className="text-[var(--text-muted)] text-xs">
              Visual daily volume comparison (Haul BCM + Dozer Roll-over BCM) for CEO &amp;
              Operational review
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-[var(--accent-blue)]">
              <span className="h-2.5 w-2.5 rounded-sm bg-[var(--accent-blue)]" />
              Haul / Excavator BCM
            </span>
            <span className="flex items-center gap-1.5 text-accent-green">
              <span className="h-2.5 w-2.5 rounded-sm bg-accent-green" />
              Dozer Roll-over BCM (Hours &times; 250)
            </span>
          </div>
        </div>

        <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
          {dailyAggregatedRows.slice(0, 14).map((d) => {
            const haulRatio = d.totalBcm > 0 ? (d.haulBcm / d.totalBcm) * d.bcmPct : 0;
            const dozerRatio = d.totalBcm > 0 ? (d.dozerRolloverBcm / d.totalBcm) * d.bcmPct : 0;
            return (
              <div key={d.date} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium font-mono text-[var(--text-heading)]">
                    {d.date}
                    {d.date === todayStr && (
                      <span className="ml-2 rounded bg-accent-green/10 px-1.5 py-0.5 text-[10px] text-accent-green">
                        TODAY
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-heading)]">
                      {Number(d.totalBcm.toFixed(1)).toLocaleString()} BCM
                    </strong>{' '}
                    ({d.loads.toLocaleString()} loads · {d.hours.toFixed(1)}h ·{' '}
                    {d.bcmPerHour.toFixed(1)} BCM/h)
                  </span>
                </div>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                  <div
                    className="h-full bg-[var(--accent-blue)] transition-all"
                    style={{ width: `${Math.max(haulRatio, d.haulBcm > 0 ? 2 : 0)}%` }}
                  />
                  <div
                    className="h-full bg-accent-green transition-all"
                    style={{
                      width: `${Math.max(dozerRatio, d.dozerRolloverBcm > 0 ? 2 : 0)}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
          {dailyAggregatedRows.length === 0 && (
            <p className="py-8 text-center text-[var(--text-muted)] text-xs">
              No daily production records found.
            </p>
          )}
        </div>
      </GlassCard>

      {/* Daily Consolidated Log Table */}
      <GlassCard className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-[var(--border-default)] border-b px-6 py-4">
          <div>
            <h3 className="font-semibold text-[var(--text-heading)] text-base">
              Daily Consolidated Operational Log
            </h3>
            <p className="text-[var(--text-muted)] text-xs">
              Full-day (24h) aggregated metrics combining Day &amp; Night shifts per calendar date
            </p>
          </div>
          <span className="font-mono text-[var(--text-muted)] text-xs">
            {dailyAggregatedRows.length} day{dailyAggregatedRows.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/60">
                <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Date
                </th>
                <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Active Sites
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Total Hours
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Total Loads
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Haul BCM
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Dozer Roll-over BCM
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Total Daily BCM
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  BCM / Hour
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Delays (min)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {dailyAggregatedRows.map((d) => (
                <tr key={d.date} className="transition-colors hover:bg-[var(--bg-tertiary)]/60">
                  <td className="px-5 py-3.5 font-medium font-mono text-[var(--text-heading)] text-sm">
                    {d.date}
                  </td>
                  <td className="px-5 py-3.5 text-[var(--text-secondary)] text-xs">
                    {d.siteList.length > 0 ? d.siteList.join(', ') : 'All Sites'} ({d.shiftCount}{' '}
                    shift{d.shiftCount === 1 ? '' : 's'})
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-[var(--text-heading)] text-sm">
                    {d.hours.toFixed(1)}h
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium font-mono text-[var(--accent-blue)] text-sm">
                    {d.loads.toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-[var(--text-secondary)] text-sm">
                    {Number(d.haulBcm.toFixed(1)).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-[var(--accent-blue)] text-sm">
                    {Number(d.dozerRolloverBcm.toFixed(1)).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-semibold text-accent-green text-sm">
                    {Number(d.totalBcm.toFixed(1)).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-[var(--accent-blue)] text-sm">
                    {d.bcmPerHour.toFixed(1)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-[var(--text-secondary)] text-sm">
                    {d.delayMin}
                  </td>
                </tr>
              ))}
              {dailyAggregatedRows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-10 text-center text-[var(--text-muted)] text-sm"
                  >
                    No daily consolidated data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

interface ReportsArchivedViewTabProps {
  archivedData: ArchivedReportData;
  fromDateStr: string;
  toDateStr: string;
  currentMonthPrefix: string;
}

export function ReportsArchivedViewTab({
  archivedData,
  fromDateStr,
  toDateStr,
  currentMonthPrefix,
}: ReportsArchivedViewTabProps) {
  return (
    <div className="space-y-6">
      {/* Date Range Filter Card */}
      <GlassCard className="p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h3 className="font-semibold text-[var(--text-heading)] text-base">
              Archived &amp; Historical Period Query
            </h3>
            <p className="text-[var(--text-muted)] text-xs">
              Select a historical date range to inspect archived shift logs and monthly production
              rollups
            </p>
          </div>
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-[var(--text-muted)] text-xs">From Date</label>
              <Input type="date" name="from" defaultValue={fromDateStr} className="px-3 py-1.5" />
            </div>
            <div>
              <label className="mb-1 block text-[var(--text-muted)] text-xs">To Date</label>
              <Input type="date" name="to" defaultValue={toDateStr} className="px-3 py-1.5" />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent-blue)] px-4 py-2 font-semibold text-[var(--bg-secondary)] text-xs transition-colors hover:bg-[var(--accent-blue)]/90"
            >
              Load Archive Range
            </button>
          </form>
        </div>
      </GlassCard>

      {/* Monthly Archive Rollup Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {archivedData.monthlyRollups.map((m) => (
          <GlassCard key={m.month} className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="font-bold font-mono text-[var(--text-heading)] text-sm">
                Period: {m.month}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 font-medium text-[11px] ${
                  m.month === currentMonthPrefix
                    ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
                    : 'bg-accent-green/10 text-accent-green'
                }`}
              >
                {m.month === currentMonthPrefix ? 'Current Period' : 'Archived Period'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-[var(--bg-secondary)] p-2.5">
                <p className="text-[var(--text-muted)]">Total Volume</p>
                <p className="mt-0.5 font-bold font-mono text-accent-green text-base">
                  {Number(m.totalBcm.toFixed(1)).toLocaleString()} BCM
                </p>
              </div>
              <div className="rounded-lg bg-[var(--bg-secondary)] p-2.5">
                <p className="text-[var(--text-muted)]">Haul Loads</p>
                <p className="mt-0.5 font-bold font-mono text-[var(--accent-blue)] text-base">
                  {m.loads.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-[var(--bg-secondary)] p-2.5">
                <p className="text-[var(--text-muted)]">Dozer Roll-over</p>
                <p className="mt-0.5 font-mono font-semibold text-[var(--text-heading)] text-sm">
                  {Number(m.dozerRolloverBcm.toFixed(1)).toLocaleString()} BCM
                </p>
              </div>
              <div className="rounded-lg bg-[var(--bg-secondary)] p-2.5">
                <p className="text-[var(--text-muted)]">Operating Hours</p>
                <p className="mt-0.5 font-mono font-semibold text-[var(--text-heading)] text-sm">
                  {m.hours.toFixed(1)}h ({m.shiftCount} shifts)
                </p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Full Historical / Archived Shift Register */}
      <GlassCard className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-[var(--border-default)] border-b px-6 py-4">
          <div>
            <h3 className="font-semibold text-[var(--text-heading)] text-base">
              Archived Shift &amp; Production Register ({fromDateStr} — {toDateStr})
            </h3>
            <p className="text-[var(--text-muted)] text-xs">
              Complete immutable historical log for executive auditing and compliance export
            </p>
          </div>
          <span className="font-mono text-[var(--text-muted)] text-xs">
            {archivedData.historicalRows.length} archived record
            {archivedData.historicalRows.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/60">
                <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Date
                </th>
                <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Shift
                </th>
                <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Site
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Hours
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Loads
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Haul BCM
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Dozer Roll-over BCM
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Total BCM
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Delay (min)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {archivedData.historicalRows.map((row) => (
                <tr
                  key={`arch-${row.id}`}
                  className="transition-colors hover:bg-[var(--bg-tertiary)]/60"
                >
                  <td className="px-5 py-3 font-mono text-[var(--text-heading)] text-sm">
                    {row.date}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 font-medium text-[var(--text-secondary)] text-xs uppercase">
                      {row.shift}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[var(--text-secondary)] text-sm">
                    {row.site || 'All Sites'}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[var(--text-heading)] text-sm">
                    {row.hours.toFixed(1)}h
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[var(--accent-blue)] text-sm">
                    {row.loads.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[var(--text-secondary)] text-sm">
                    {Number(row.haulBcm.toFixed(1)).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[var(--accent-blue)] text-sm">
                    {Number(row.dozerRolloverBcm.toFixed(1)).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-accent-green text-sm">
                    {Number(row.totalBcm.toFixed(1)).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[var(--text-secondary)] text-sm">
                    {row.delayMin}
                  </td>
                </tr>
              ))}
              {archivedData.historicalRows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-10 text-center text-[var(--text-muted)] text-sm"
                  >
                    No archived records found for this date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
