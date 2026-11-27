'use client';

/* cspell:ignore Tyre */

import { GoldenPanel } from '@repo/ui/GoldenPanel';
import { cn } from '@repo/ui/lib/utils';
import { ArrowUpDown, Download, RotateCcw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { escapeEngineeringReportCsvCell } from '../../engineering/reports/engineering-reports-model';

export interface EngineeringHistoryBreakdownRow {
  readonly id: string;
  readonly fleetId: string;
  readonly machineName: string;
  readonly machineType: string;
  readonly siteCode: string;
  readonly shiftType: string;
  readonly dateIn: string;
  readonly timeIn: string;
  readonly dateOut: string;
  readonly durationHours: number;
  readonly reason: string;
  readonly repairNotes: string;
  readonly status: string;
}

export interface EngineeringHistoryTireRow {
  readonly id: string;
  readonly inspectionDate: string;
  readonly activityType: string;
  readonly serialNumber: string;
  readonly brand: string;
  readonly size: string;
  readonly machineName: string;
  readonly position: string;
  readonly currentSmu: number | null;
  readonly treadDepthMm: number;
  readonly pressurePsi: number;
  readonly conditionStatus: string;
  readonly notes: string;
}

interface EngineeringHistoryClientProps {
  readonly initialFrom: string;
  readonly initialTo: string;
  readonly breakdowns: readonly EngineeringHistoryBreakdownRow[];
  readonly tireActivities: readonly EngineeringHistoryTireRow[];
}

type HistoryViewMode = 'breakdowns' | 'tyres';
type BreakdownSortKey = 'dateIn' | 'machineName' | 'shiftType' | 'durationHours' | 'status';
type TireSortKey =
  | 'inspectionDate'
  | 'activityType'
  | 'serialNumber'
  | 'machineName'
  | 'treadDepthMm';

const CONTROL_CLASS =
  'rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 text-xs text-[var(--text-heading)] focus:border-[var(--accent-gold)] focus:outline-none';
const LABEL_CLASS =
  'mb-1 block font-semibold text-[var(--text-muted)] text-[10px] uppercase tracking-wider';
const TAB_BTN_BASE = 'rounded-md px-3.5 py-1.5 font-semibold text-xs transition-colors';
const TAB_BTN_ACTIVE =
  'gold-steel-border gold-steel-border-slim bg-[var(--accent-gold)]/15 text-[var(--text-heading)] shadow-2xs';
const TAB_BTN_IDLE = 'text-[var(--text-muted)] hover:text-[var(--text-heading)]';
const EXPORT_BTN_CLASS =
  'gold-steel-border gold-steel-border-slim inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 font-semibold text-xs text-[var(--text-heading)] transition-colors hover:border-[var(--accent-gold)]/60';
const TH_CLASS =
  'px-4 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider whitespace-nowrap';
const SORT_BTN_CLASS =
  'inline-flex items-center gap-1 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider hover:text-[var(--text-heading)]';

function downloadBlob(content: string, mimeType: string, filename: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function EngineeringHistoryClient({
  initialFrom,
  initialTo,
  breakdowns,
  tireActivities,
}: EngineeringHistoryClientProps) {
  const [activeView, setActiveView] = useState<HistoryViewMode>('breakdowns');
  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [searchQuery, setSearchQuery] = useState('');

  // Breakdowns-specific filters
  const [bdStatus, setBdStatus] = useState('all');
  const [bdShift, setBdShift] = useState('all');
  const [bdMachineType, setBdMachineType] = useState('all');
  const [bdSite, setBdSite] = useState('all');
  const [bdSortKey, setBdSortKey] = useState<BreakdownSortKey>('dateIn');
  const [bdSortDir, setBdSortDir] = useState<'asc' | 'desc'>('desc');

  // Tyre-specific filters
  const [tireActivityType, setTireActivityType] = useState('all');
  const [tireCondition, setTireCondition] = useState('all');
  const [tireBrand, setTireBrand] = useState('all');
  const [tirePosition, setTirePosition] = useState('all');
  const [tireSortKey, setTireSortKey] = useState<TireSortKey>('inspectionDate');
  const [tireSortDir, setTireSortDir] = useState<'asc' | 'desc'>('desc');

  const machineTypes = useMemo(
    () => Array.from(new Set(breakdowns.map((b) => b.machineType).filter(Boolean))).sort(),
    [breakdowns]
  );
  const sites = useMemo(
    () => Array.from(new Set(breakdowns.map((b) => b.siteCode).filter(Boolean))).sort(),
    [breakdowns]
  );
  const tireBrands = useMemo(
    () => Array.from(new Set(tireActivities.map((t) => t.brand).filter(Boolean))).sort(),
    [tireActivities]
  );
  const tirePositions = useMemo(
    () => Array.from(new Set(tireActivities.map((t) => t.position).filter(Boolean))).sort(),
    [tireActivities]
  );

  const filteredBreakdowns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const rows = breakdowns.filter((row) => {
      if (fromDate && row.dateIn < fromDate) return false;
      if (toDate && row.dateIn > toDate) return false;
      if (bdStatus !== 'all' && row.status !== bdStatus) return false;
      if (bdShift !== 'all' && row.shiftType !== bdShift) return false;
      if (bdMachineType !== 'all' && row.machineType !== bdMachineType) return false;
      if (bdSite !== 'all' && row.siteCode !== bdSite) return false;
      if (!q) return true;
      const hay =
        `${row.fleetId} ${row.machineName} ${row.machineType} ${row.siteCode} ${row.shiftType} ${row.reason} ${row.repairNotes} ${row.status}`.toLowerCase();
      return hay.includes(q);
    });

    return [...rows].sort((a, b) => {
      const cmp =
        bdSortKey === 'durationHours'
          ? a.durationHours - b.durationHours
          : String(a[bdSortKey]).localeCompare(String(b[bdSortKey]));
      return bdSortDir === 'asc' ? cmp : -cmp;
    });
  }, [
    bdMachineType,
    bdShift,
    bdSite,
    bdSortDir,
    bdSortKey,
    bdStatus,
    breakdowns,
    fromDate,
    searchQuery,
    toDate,
  ]);

  const filteredTires = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const rows = tireActivities.filter((row) => {
      if (fromDate && row.inspectionDate < fromDate) return false;
      if (toDate && row.inspectionDate > toDate) return false;
      if (tireActivityType !== 'all' && row.activityType !== tireActivityType) return false;
      if (tireCondition !== 'all' && row.conditionStatus !== tireCondition) return false;
      if (tireBrand !== 'all' && row.brand !== tireBrand) return false;
      if (tirePosition !== 'all' && row.position !== tirePosition) return false;
      if (!q) return true;
      const hay =
        `${row.serialNumber} ${row.brand} ${row.size} ${row.machineName} ${row.position} ${row.activityType} ${row.conditionStatus} ${row.notes}`.toLowerCase();
      return hay.includes(q);
    });

    return [...rows].sort((a, b) => {
      const cmp =
        tireSortKey === 'treadDepthMm'
          ? a.treadDepthMm - b.treadDepthMm
          : String(a[tireSortKey]).localeCompare(String(b[tireSortKey]));
      return tireSortDir === 'asc' ? cmp : -cmp;
    });
  }, [
    fromDate,
    searchQuery,
    tireActivities,
    tireActivityType,
    tireBrand,
    tireCondition,
    tirePosition,
    tireSortDir,
    tireSortKey,
    toDate,
  ]);

  const handleResetFilters = () => {
    setFromDate(initialFrom);
    setToDate(initialTo);
    setSearchQuery('');
    setBdStatus('all');
    setBdShift('all');
    setBdMachineType('all');
    setBdSite('all');
    setTireActivityType('all');
    setTireCondition('all');
    setTireBrand('all');
    setTirePosition('all');
  };

  const handleExportCsv = () => {
    if (activeView === 'breakdowns') {
      const headers = [
        'Date In',
        'Time In',
        'Fleet ID',
        'Machine',
        'Type',
        'Site',
        'Shift',
        'Fault Reason',
        'Repair Notes',
        'Duration (hrs)',
        'Status',
      ];
      const rows = filteredBreakdowns.map((r) => [
        r.dateIn,
        r.timeIn,
        r.fleetId,
        r.machineName,
        r.machineType,
        r.siteCode,
        r.shiftType,
        r.reason,
        r.repairNotes,
        r.durationHours.toFixed(1),
        r.status,
      ]);
      const csv = [headers, ...rows]
        .map((row) => row.map((cell) => escapeEngineeringReportCsvCell(String(cell))).join(','))
        .join('\n');
      downloadBlob(
        csv,
        'text/csv;charset=utf-8;',
        `engineering-breakdowns-history-${fromDate}-to-${toDate}.csv`
      );
      return;
    }

    const headers = [
      'Date',
      'Activity',
      'Serial Number',
      'Brand',
      'Size',
      'Machine',
      'Position',
      'SMU Hours',
      'Tread (mm)',
      'Pressure (PSI)',
      'Condition',
      'Notes',
    ];
    const rows = filteredTires.map((r) => [
      r.inspectionDate,
      r.activityType,
      r.serialNumber,
      r.brand,
      r.size,
      r.machineName,
      r.position,
      r.currentSmu ?? '',
      r.treadDepthMm,
      r.pressurePsi,
      r.conditionStatus,
      r.notes,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => escapeEngineeringReportCsvCell(String(cell))).join(','))
      .join('\n');
    downloadBlob(
      csv,
      'text/csv;charset=utf-8;',
      `engineering-tyre-history-${fromDate}-to-${toDate}.csv`
    );
  };

  const handleExportJson = () => {
    const payload = activeView === 'breakdowns' ? filteredBreakdowns : filteredTires;
    downloadBlob(
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8;',
      `engineering-${activeView}-history-${fromDate}-to-${toDate}.json`
    );
  };

  return (
    <div className="space-y-6">
      {/* Setup & Filter Control Panel */}
      <GoldenPanel
        showLogo
        variant="elevated"
        headingLevel="h2"
        title="Engineering History"
        subtitle="Switch between Breakdowns and Tyre Management audit ledgers with multi-field filtering and export"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="tablist"
              aria-label="Engineering history view"
              className="inline-flex rounded-lg border border-[var(--border-default)] bg-white p-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'breakdowns'}
                onClick={() => setActiveView('breakdowns')}
                className={cn(
                  TAB_BTN_BASE,
                  activeView === 'breakdowns' ? TAB_BTN_ACTIVE : TAB_BTN_IDLE
                )}
              >
                Breakdowns ({filteredBreakdowns.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'tyres'}
                onClick={() => setActiveView('tyres')}
                className={cn(TAB_BTN_BASE, activeView === 'tyres' ? TAB_BTN_ACTIVE : TAB_BTN_IDLE)}
              >
                Tyre Management ({filteredTires.length})
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className={EXPORT_BTN_CLASS}
              data-testid="history-export-csv-btn"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className={EXPORT_BTN_CLASS}
              data-testid="history-export-json-btn"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export JSON</span>
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <div>
            <label htmlFor="history-from-date" className={LABEL_CLASS}>
              From
            </label>
            <input
              id="history-from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={cn(CONTROL_CLASS, 'w-full')}
            />
          </div>
          <div>
            <label htmlFor="history-to-date" className={LABEL_CLASS}>
              To
            </label>
            <input
              id="history-to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={cn(CONTROL_CLASS, 'w-full')}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="history-search" className={LABEL_CLASS}>
              Search All Fields
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]"
                aria-hidden="true"
              />
              <input
                id="history-search"
                type="search"
                placeholder={
                  activeView === 'breakdowns'
                    ? 'Search machine, fault, notes...'
                    : 'Search serial, brand, machine, notes...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(CONTROL_CLASS, 'w-full pl-8')}
              />
            </div>
          </div>

          {activeView === 'breakdowns' ? (
            <>
              <div>
                <label htmlFor="history-bd-status" className={LABEL_CLASS}>
                  Status
                </label>
                <select
                  id="history-bd-status"
                  value={bdStatus}
                  onChange={(e) => setBdStatus(e.target.value)}
                  className={cn(CONTROL_CLASS, 'w-full')}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="completed">Resolved</option>
                </select>
              </div>
              <div>
                <label htmlFor="history-bd-shift" className={LABEL_CLASS}>
                  Shift
                </label>
                <select
                  id="history-bd-shift"
                  value={bdShift}
                  onChange={(e) => setBdShift(e.target.value)}
                  className={cn(CONTROL_CLASS, 'w-full')}
                >
                  <option value="all">All Shifts</option>
                  <option value="day">Day Shift</option>
                  <option value="night">Night Shift</option>
                </select>
              </div>
              <div>
                <label htmlFor="history-bd-type" className={LABEL_CLASS}>
                  Machine Type
                </label>
                <select
                  id="history-bd-type"
                  value={bdMachineType}
                  onChange={(e) => setBdMachineType(e.target.value)}
                  className={cn(CONTROL_CLASS, 'w-full')}
                >
                  <option value="all">All Types</option>
                  {machineTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="history-bd-site" className={LABEL_CLASS}>
                  Site
                </label>
                <select
                  id="history-bd-site"
                  value={bdSite}
                  onChange={(e) => setBdSite(e.target.value)}
                  className={cn(CONTROL_CLASS, 'w-full')}
                >
                  <option value="all">All Sites</option>
                  {sites.map((site) => (
                    <option key={site} value={site}>
                      {site}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="history-tire-activity" className={LABEL_CLASS}>
                  Activity Type
                </label>
                <select
                  id="history-tire-activity"
                  value={tireActivityType}
                  onChange={(e) => setTireActivityType(e.target.value)}
                  className={cn(CONTROL_CLASS, 'w-full')}
                >
                  <option value="all">All Activities</option>
                  <option value="removal">Removal</option>
                  <option value="replacement">Replacement</option>
                  <option value="installation">Installation</option>
                  <option value="inspection">Inspection</option>
                </select>
              </div>
              <div>
                <label htmlFor="history-tire-condition" className={LABEL_CLASS}>
                  Condition
                </label>
                <select
                  id="history-tire-condition"
                  value={tireCondition}
                  onChange={(e) => setTireCondition(e.target.value)}
                  className={cn(CONTROL_CLASS, 'w-full')}
                >
                  <option value="all">All Conditions</option>
                  <option value="good">Good</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label htmlFor="history-tire-brand" className={LABEL_CLASS}>
                  Brand
                </label>
                <select
                  id="history-tire-brand"
                  value={tireBrand}
                  onChange={(e) => setTireBrand(e.target.value)}
                  className={cn(CONTROL_CLASS, 'w-full')}
                >
                  <option value="all">All Brands</option>
                  {tireBrands.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="history-tire-position" className={LABEL_CLASS}>
                  Position
                </label>
                <select
                  id="history-tire-position"
                  value={tirePosition}
                  onChange={(e) => setTirePosition(e.target.value)}
                  className={cn(CONTROL_CLASS, 'w-full')}
                >
                  <option value="all">All Positions</option>
                  {tirePositions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 font-medium text-[var(--text-secondary)] text-xs hover:text-[var(--text-heading)]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </GoldenPanel>

      {/* Dynamic Synchronized Table */}
      <GoldenPanel
        showLogo
        headingLevel="h3"
        title={
          activeView === 'breakdowns'
            ? 'Breakdowns Historical Ledger'
            : 'Tyre Management Historical Ledger'
        }
        subtitle={
          activeView === 'breakdowns'
            ? `Showing ${filteredBreakdowns.length} breakdown records`
            : `Showing ${filteredTires.length} tyre activity records`
        }
        noBodyPadding
      >
        <div className="overflow-x-auto" data-testid="engineering-history-table-container">
          {activeView === 'breakdowns' ? (
            <table className="w-full text-left text-xs" aria-label="Breakdowns history table">
              <thead>
                <tr className="border-[var(--border-default)] border-b bg-black/[0.02]">
                  <th
                    scope="col"
                    className={TH_CLASS}
                    aria-sort={
                      bdSortKey === 'dateIn'
                        ? bdSortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setBdSortDir((d) =>
                          bdSortKey === 'dateIn' && d === 'asc' ? 'desc' : 'asc'
                        );
                        setBdSortKey('dateIn');
                      }}
                      className={SORT_BTN_CLASS}
                    >
                      <span>Date In</span>
                      <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Machine
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Type
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Site
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Shift
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Fault Reason
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Repair Notes
                  </th>
                  <th scope="col" className={cn(TH_CLASS, 'text-right')}>
                    Duration
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {filteredBreakdowns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-[var(--text-muted)]">
                      No breakdown records match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredBreakdowns.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-white/60">
                      <td className="px-4 py-3 font-mono text-[var(--text-heading)]">
                        {row.dateIn} {row.timeIn}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[var(--text-heading)]">
                        {row.machineName}
                        <span className="block font-mono font-normal text-[11px] text-[var(--text-muted)]">
                          {row.fleetId}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{row.machineType}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{row.siteCode}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] capitalize">
                        {row.shiftType}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-[var(--text-secondary)]">
                        {row.reason}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-[var(--text-muted)]">
                        {row.repairNotes || '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--text-heading)]">
                        {row.durationHours.toFixed(1)} h
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 font-medium text-[11px]',
                            row.status === 'active'
                              ? 'bg-red-500/10 text-red-700'
                              : 'bg-emerald-500/10 text-emerald-700'
                          )}
                        >
                          {row.status === 'active' ? 'Active' : 'Resolved'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs" aria-label="Tyre management history table">
              <thead>
                <tr className="border-[var(--border-default)] border-b bg-black/[0.02]">
                  <th
                    scope="col"
                    className={TH_CLASS}
                    aria-sort={
                      tireSortKey === 'inspectionDate'
                        ? tireSortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setTireSortDir((d) =>
                          tireSortKey === 'inspectionDate' && d === 'asc' ? 'desc' : 'asc'
                        );
                        setTireSortKey('inspectionDate');
                      }}
                      className={SORT_BTN_CLASS}
                    >
                      <span>Date</span>
                      <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Activity
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Serial Number
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Brand / Size
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Machine / Position
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    SMU Hours
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Tread / PSI
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Condition
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {filteredTires.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-[var(--text-muted)]">
                      No tyre activity records match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredTires.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-white/60">
                      <td className="px-4 py-3 font-mono text-[var(--text-heading)]">
                        {row.inspectionDate}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[var(--text-heading)] uppercase">
                        {row.activityType}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-[var(--text-heading)]">
                        {row.serialNumber}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        <span className="font-medium text-[var(--text-heading)]">{row.brand}</span>
                        <span className="block text-[11px] text-[var(--text-muted)]">
                          {row.size}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        <span className="font-medium text-[var(--text-heading)]">
                          {row.machineName}
                        </span>
                        <span className="block text-[11px] text-[var(--text-muted)]">
                          {row.position}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">
                        {row.currentSmu != null
                          ? `${row.currentSmu.toLocaleString('en-US')} h`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-[var(--text-heading)]">
                        {row.treadDepthMm} mm · {row.pressurePsi} PSI
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 font-medium text-[11px] uppercase',
                            row.conditionStatus === 'critical'
                              ? 'bg-red-500/10 text-red-700'
                              : row.conditionStatus === 'warning'
                                ? 'bg-amber-500/10 text-amber-700'
                                : 'bg-emerald-500/10 text-emerald-700'
                          )}
                        >
                          {row.conditionStatus}
                        </span>
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-[var(--text-muted)]">
                        {row.notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </GoldenPanel>
    </div>
  );
}
