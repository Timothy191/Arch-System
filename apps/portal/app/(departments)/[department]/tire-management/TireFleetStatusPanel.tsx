'use client';

/* cspell:ignore Tyre */

import {
  EngineeringMountedWheelIcon,
  EngineeringPressureAlertIcon,
  EngineeringSpareStockIcon,
  EngineeringTireTreadIcon,
} from '@repo/ui/engineering-icons';
import { GoldenPanel } from '@repo/ui/GoldenPanel';
import { cn } from '@repo/ui/lib/utils';
import {
  type ProfessionalDropdownItem,
  ProfessionalDropdownMenu,
} from '@repo/ui/ProfessionalDropdownMenu';
import { AlertTriangle, Filter, Gauge, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { TiresInRepairTable } from './TiresInRepairTable';
import { CRITICAL_TREAD_DEPTH_MM, type TireMachineOption, type TireRecord } from './tire-constants';

interface TireFleetStatusPanelProps {
  readonly tires: readonly TireRecord[];
  readonly machines?: readonly TireMachineOption[];
}

type FleetViewTab = 'fleet-status' | 'tires-in-repair';
type FleetStatusFilter = 'all' | 'installed' | 'inventory' | 'scrapped' | 'critical';
type RowDensity = 'comfortable' | 'compact';

const SEARCH_INPUT_CLASS =
  'gold-steel-border gold-steel-border-slim rounded-lg py-1.5 pr-3 pl-8 text-[var(--text-heading)] text-xs focus:outline-none';
const TH_CLASS =
  'px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider';
const VIEW_TAB_BASE = 'rounded-md px-3 py-1 font-semibold text-xs transition-colors';
const VIEW_TAB_ACTIVE =
  'gold-steel-border gold-steel-border-slim bg-[var(--accent-gold)]/15 text-[var(--text-heading)] shadow-2xs';
const VIEW_TAB_IDLE = 'text-[var(--text-muted)] hover:text-[var(--text-heading)]';
const STATUS_FILTER_LABELS: Readonly<Record<FleetStatusFilter, string>> = {
  all: 'All Fleet Tires',
  installed: 'Installed Active',
  inventory: 'Inventory Spares',
  scrapped: 'Scrapped / Retired',
  critical: 'Critical Wear (<15mm)',
};

export function TireFleetStatusPanel({ tires, machines }: TireFleetStatusPanelProps) {
  const [activeView, setActiveView] = useState<FleetViewTab>('fleet-status');
  const [statusFilter, setStatusFilter] = useState<FleetStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [density, setDensity] = useState<RowDensity>('comfortable');

  const isCriticalTire = (tire: TireRecord): boolean => {
    const tread = tire.latestInspection ? Number(tire.latestInspection.tread_depth_mm) : null;
    return (
      tire.latestInspection?.condition_status === 'critical' ||
      (tread !== null && tread < CRITICAL_TREAD_DEPTH_MM)
    );
  };

  const filteredTires = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tires.filter((tire) => {
      if (statusFilter === 'critical' && !isCriticalTire(tire)) return false;
      if (statusFilter !== 'all' && statusFilter !== 'critical' && tire.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const hay =
        `${tire.serial_number} ${tire.brand} ${tire.size} ${tire.machineName} ${tire.position} ${tire.status}`.toLowerCase();
      return hay.includes(q);
    });
  }, [tires, statusFilter, searchQuery]);

  const filterMenuItems: readonly ProfessionalDropdownItem[] = [
    {
      id: 'fleet-all',
      label: 'All Fleet Tires',
      badge: tires.length,
      icon: <EngineeringTireTreadIcon className="h-3.5 w-3.5" />,
      selected: statusFilter === 'all',
      onSelect: () => setStatusFilter('all'),
    },
    {
      id: 'fleet-installed',
      label: 'Installed Active',
      icon: <EngineeringMountedWheelIcon className="h-3.5 w-3.5" />,
      selected: statusFilter === 'installed',
      onSelect: () => setStatusFilter('installed'),
    },
    {
      id: 'fleet-inventory',
      label: 'Inventory Spares',
      icon: <EngineeringSpareStockIcon className="h-3.5 w-3.5" />,
      selected: statusFilter === 'inventory',
      onSelect: () => setStatusFilter('inventory'),
    },
    {
      id: 'fleet-critical',
      label: 'Critical Wear Alerts',
      icon: <EngineeringPressureAlertIcon className="h-3.5 w-3.5" />,
      selected: statusFilter === 'critical',
      dividerBefore: true,
      onSelect: () => setStatusFilter('critical'),
    },
    {
      id: 'fleet-display-sub',
      label: 'Row Density & View',
      icon: <SlidersHorizontal className="h-3.5 w-3.5" />,
      dividerBefore: true,
      subItems: [
        {
          id: 'density-comfortable',
          label: 'Comfortable Spacing',
          selected: density === 'comfortable',
          onSelect: () => setDensity('comfortable'),
        },
        {
          id: 'density-compact',
          label: 'Compact Workshop View',
          selected: density === 'compact',
          onSelect: () => setDensity('compact'),
        },
      ],
    },
  ];

  const cellPadClass = density === 'compact' ? 'px-4 py-2' : 'px-5 py-3.5';

  return (
    <GoldenPanel
      showLogo
      title={activeView === 'fleet-status' ? 'Tire Fleet Status' : 'Tires in Repair'}
      headingLevel="h3"
      subtitle="Live wheel-position telemetry, tread wear thresholds, and repair disposition"
      statusBadge={
        <span className="rounded-full border border-[var(--accent-gold-border)] bg-[var(--accent-gold-subtle)] px-2.5 py-0.5 font-mono font-semibold text-[11px] text-[var(--text-heading)]">
          {filteredTires.length} / {tires.length} Units
        </span>
      }
      collapsible
      noBodyPadding
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Tyre fleet table views"
            className="inline-flex rounded-lg border border-[var(--border-default)] bg-white p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'fleet-status'}
              onClick={() => setActiveView('fleet-status')}
              className={cn(
                VIEW_TAB_BASE,
                activeView === 'fleet-status' ? VIEW_TAB_ACTIVE : VIEW_TAB_IDLE
              )}
            >
              Tyre Fleet Status
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'tires-in-repair'}
              onClick={() => setActiveView('tires-in-repair')}
              className={cn(
                VIEW_TAB_BASE,
                activeView === 'tires-in-repair' ? VIEW_TAB_ACTIVE : VIEW_TAB_IDLE
              )}
            >
              Tires in Repair
            </button>
          </div>

          {activeView === 'fleet-status' && (
            <ProfessionalDropdownMenu
              testId="fleet-status-filter-dropdown"
              ariaLabel="Filter tire fleet status"
              triggerLabel={STATUS_FILTER_LABELS[statusFilter]}
              triggerIcon={<Filter className="h-3.5 w-3.5" />}
              items={filterMenuItems}
            />
          )}

          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search fleet tires"
              placeholder="Filter serial, brand, machine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={SEARCH_INPUT_CLASS}
            />
          </div>
        </div>
      }
    >
      {activeView === 'tires-in-repair' ? (
        <TiresInRepairTable
          tires={tires}
          machines={machines}
          searchQuery={searchQuery}
          density={density}
        />
      ) : filteredTires.length === 0 ? (
        <div className="space-y-3 py-10 text-center">
          <EngineeringTireTreadIcon className="mx-auto h-10 w-10 text-accent-gold opacity-80" />
          <p className="font-medium text-[var(--text-heading)] text-sm">
            {tires.length === 0 ? 'No Tires Registered' : 'No Matching Fleet Tires'}
          </p>
          <p className="mx-auto max-w-sm text-[var(--text-muted)] text-xs">
            {tires.length === 0
              ? 'Use Log Tyre Activity above to mount replacement tyres or register fleet spares.'
              : 'Adjust the status dropdown or search filter above to view registered tyres.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table
            className="w-full text-left text-sm"
            aria-label="Tire fleet inventory and telemetry table"
          >
            <thead>
              <tr className="border-[var(--border-default)] border-b bg-black/[0.02]">
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
                  Status
                </th>
                <th scope="col" className={TH_CLASS}>
                  Tread Depth
                </th>
                <th scope="col" className={TH_CLASS}>
                  Pressure
                </th>
                <th scope="col" className={cn(TH_CLASS, 'text-right')}>
                  Hours Operated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {filteredTires.map((tire) => {
                const tread = tire.latestInspection
                  ? Number(tire.latestInspection.tread_depth_mm)
                  : null;
                const psi = tire.latestInspection
                  ? Number(tire.latestInspection.pressure_psi)
                  : null;
                const isCritical = isCriticalTire(tire);

                return (
                  <tr key={tire.id} className="transition-colors hover:bg-white/60">
                    <td
                      className={cn(
                        cellPadClass,
                        'font-mono font-semibold text-[var(--text-heading)] text-xs'
                      )}
                    >
                      {tire.serial_number}
                    </td>
                    <td className={cn(cellPadClass, 'text-[var(--text-secondary)] text-xs')}>
                      <span className="font-medium text-[var(--text-heading)]">{tire.brand}</span>
                      <span className="block text-[11px] text-[var(--text-muted)]">
                        {tire.size}
                      </span>
                    </td>
                    <td className={cn(cellPadClass, 'text-xs')}>
                      <span className="font-medium text-[var(--text-heading)]">
                        {tire.machineName}
                      </span>
                      <span className="block text-[11px] text-[var(--text-muted)]">
                        {tire.position}
                      </span>
                    </td>
                    <td className={cn(cellPadClass, 'text-xs')}>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 font-medium text-[11px]',
                          tire.status === 'installed'
                            ? 'bg-emerald-500/12 text-emerald-800'
                            : tire.status === 'inventory'
                              ? 'bg-sky-500/12 text-sky-800'
                              : 'bg-zinc-500/12 text-zinc-700'
                        )}
                      >
                        {tire.status}
                      </span>
                    </td>
                    <td className={cn(cellPadClass, 'text-xs')}>
                      {tread !== null ? (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 font-medium',
                            isCritical
                              ? 'font-semibold text-amber-700'
                              : 'text-[var(--text-heading)]'
                          )}
                        >
                          {tread} mm
                          {isCritical && (
                            <AlertTriangle
                              className="h-3.5 w-3.5 shrink-0 text-amber-700"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className={cn(cellPadClass, 'text-xs')}>
                      {psi !== null ? (
                        <span className="inline-flex items-center gap-1 text-[var(--text-heading)]">
                          <Gauge className="h-3 w-3 text-[var(--text-muted)]" aria-hidden="true" />
                          {psi} PSI
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td
                      className={cn(
                        cellPadClass,
                        'text-right font-mono text-[var(--text-secondary)] text-xs'
                      )}
                    >
                      {tire.installed_hours?.toLocaleString('en-US') || 0} hrs
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </GoldenPanel>
  );
}
