'use client';

import { useOfflineQueue, usePitConnectivity, useSupabaseRealtime } from '@repo/shared/hooks';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  HardHat,
  LifeBuoy,
  Printer,
  Radio,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTypewriterPlaceholder } from '@/hooks/useTypewriterPlaceholder';
import {
  type MusterPersonnelRecord,
  type MusterSummary,
  markPersonnelMusterStatus,
} from '../actions';

const MUSTER_SEARCH_PLACEHOLDER = 'Search name, contractor, zone...';

const MUSTER_COUNTER_3D_BASE =
  'gold-steel-border gold-steel-border-slim transform-gpu rounded-xl border border-accent-gold/75 border-b-4 p-4 shadow-xl ring-1 ring-inset ring-white/90 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl';

const MUSTER_COUNTER_CARD_THEMES = {
  total: `${MUSTER_COUNTER_3D_BASE} border-b-sky-500/80 bg-gradient-to-br from-sky-100 via-blue-50 to-white`,
  accounted: `${MUSTER_COUNTER_3D_BASE} border-b-emerald-500/80 bg-gradient-to-br from-emerald-200 via-emerald-50 to-white`,
  unaccounted: `${MUSTER_COUNTER_3D_BASE} border-b-amber-500/85 bg-gradient-to-br from-amber-200 via-orange-50 to-white`,
  evacuated: `${MUSTER_COUNTER_3D_BASE} border-b-indigo-500/80 bg-gradient-to-br from-indigo-200 via-sky-50 to-white`,
} as const;

const MUSTER_STATION_CARD_BASE =
  'gold-steel-border gold-steel-border-slim cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition-all hover:border-accent-gold';

interface MusterRollCallViewProps {
  initialSummary: MusterSummary;
}

export function MusterRollCallView({ initialSummary }: MusterRollCallViewProps) {
  const router = useRouter();
  const [summary] = useState<MusterSummary>(initialSummary);
  const [records, setRecords] = useState<MusterPersonnelRecord[]>(initialSummary.records);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const animatedPlaceholder = useTypewriterPlaceholder(
    MUSTER_SEARCH_PLACEHOLDER,
    isSearchFocused || searchQuery.length > 0
  );
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unaccounted' | 'accounted'>('all');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const { isOnline } = usePitConnectivity();
  const { enqueue, queue, isSyncing } = useOfflineQueue();

  useEffect(() => {
    setRecords(initialSummary.records);
  }, [initialSummary.records]);

  useEffect(() => {
    if (isOnline && queue.length > 0 && !isSyncing) {
      void useOfflineQueue
        .getState()
        .sync()
        .then(() => {
          router.refresh();
        });
    }
  }, [isOnline, queue.length, isSyncing, router]);

  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  useSupabaseRealtime({
    supabaseClient: supabase,
    table: 'muster_events',
    event: '*',
    enabled: Boolean(supabase),
    onChange: () => {
      router.refresh();
    },
  });

  // Bolt Optimization: Aggregate status counts and per-station counts in a single pass O(R) loop.
  // Replaces multiple O(R) .filter calls and O(S * R) station count lookups inside render loops.
  const { accounted, unaccounted, evacuated, stationCounts } = useMemo(() => {
    let accountedCount = 0;
    let unaccountedCount = 0;
    let evacuatedCount = 0;
    const stationMap = new Map<string, number>();

    for (let i = 0; i < records.length; i++) {
      const r = records[i]!;
      if (r.status === 'accounted') {
        accountedCount++;
        if (r.station) {
          stationMap.set(r.station, (stationMap.get(r.station) || 0) + 1);
        }
      } else if (r.status === 'unaccounted') {
        unaccountedCount++;
      } else if (r.status === 'evacuated') {
        evacuatedCount++;
      }
    }

    return {
      accounted: accountedCount,
      unaccounted: unaccountedCount,
      evacuated: evacuatedCount,
      stationCounts: stationMap,
    };
  }, [records]);

  const totalSouls = records.length;

  const handleToggleStatus = async (record: MusterPersonnelRecord) => {
    const nextStatus: MusterPersonnelRecord['status'] =
      record.status === 'accounted' ? 'unaccounted' : 'accounted';
    const nowTime = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });

    const defaultStation = summary.musterStations[0]?.name ?? 'Production & Logistics Department';
    const targetStation = record.station || defaultStation;

    // Optimistic update
    setRecords((prev) =>
      prev.map((r) =>
        r.id === record.id
          ? {
              ...r,
              status: nextStatus,
              checkedOffAt: nextStatus === 'accounted' ? nowTime : null,
              station: nextStatus === 'accounted' ? targetStation : null,
            }
          : r
      )
    );

    const musterPayload = {
      entityId: record.id,
      entityType: record.entityType,
      entityName: record.name,
      status: nextStatus === 'accounted' ? ('accounted' as const) : ('unaccounted' as const),
      station: nextStatus === 'accounted' ? targetStation : undefined,
    };

    try {
      setIsUpdating(record.id);

      if (isOnline) {
        // Online: call server action directly
        await markPersonnelMusterStatus(musterPayload);
        toast.success(
          `${record.name} marked as ${nextStatus === 'accounted' ? 'ACCOUNTED (SAFE)' : 'UNACCOUNTED'}`
        );
      } else {
        // Offline: persist to IndexedDB via offline queue for replay on reconnect
        await enqueue({
          url: '/api/access-control/muster',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personnel_id: record.entityType === 'personnel' ? musterPayload.entityId : undefined,
            entityId: musterPayload.entityId,
            entityType: record.entityType,
            status: musterPayload.status,
            station: musterPayload.station,
            muster_point: musterPayload.station,
            full_name: record.name,
            entityName: record.name,
            name: record.name,
            badge_code: record.id,
            recordedAt: new Date().toISOString(),
          }),
          description: `Muster ${nextStatus}: ${record.name}`,
        });
        toast.info(
          `${record.name} marked as ${nextStatus === 'accounted' ? 'ACCOUNTED (SAFE)' : 'UNACCOUNTED'} — saved offline, will sync when connection returns`
        );
      }
    } catch {
      // Revert full record (status, station, checkedOffAt) on failure
      setRecords((prev) => prev.map((r) => (r.id === record.id ? record : r)));
      toast.error('Failed to update muster status');
    } finally {
      setIsUpdating(null);
    }
  };

  const escapeCsvCell = (raw: string): string => {
    const formulaNeutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${formulaNeutralized.replace(/"/g, '""')}"`;
  };

  const handleExportCSV = () => {
    const headers = [
      'Name',
      'Entity Type',
      'Company',
      'Role',
      'Assigned Zone',
      'Status',
      'Muster Point',
      'Checked Time',
      'Induction Valid',
    ];
    const rows = records.map((r) => [
      escapeCsvCell(r.name),
      escapeCsvCell(r.entityType),
      escapeCsvCell(r.company),
      escapeCsvCell(r.roleOrPurpose),
      escapeCsvCell(r.assignedZone),
      escapeCsvCell(r.status.toUpperCase()),
      escapeCsvCell(r.station || 'N/A'),
      escapeCsvCell(r.checkedOffAt || 'N/A'),
      escapeCsvCell(r.inductionValid ? 'YES' : 'NO'),
    ]);
    const csvText = [headers.map(escapeCsvCell).join(','), ...rows.map((e) => e.join(','))].join(
      '\n'
    );
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', objectUrl);
    link.setAttribute(
      'download',
      `emergency_muster_roll_call_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
    toast.success('Emergency roll call exported for safety marshals.');
  };

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.assignedZone.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStation =
        selectedStation === 'all' ||
        (selectedStation === 'unassigned' && !r.station) ||
        r.station?.toLowerCase().includes(selectedStation.toLowerCase());
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchesSearch && matchesStation && matchesStatus;
    });
  }, [records, searchQuery, selectedStation, statusFilter]);

  return (
    <div className="space-y-6">
      {(!isOnline || queue.length > 0) && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-amber-600">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 animate-pulse" />
            <span className="font-semibold text-sm">
              {!isOnline ? 'OFFLINE MODE (SAT/WIFI DOWN)' : 'SYNCING QUEUE'}
            </span>
            <span className="ml-2 border-amber-500/20 border-l pl-2 text-sm opacity-80">
              {queue.length} tap(s) buffered to local storage.
              {!isOnline
                ? ' Do not close this tablet. Will auto-sync when network returns.'
                : isSyncing
                  ? ' Synchronizing to command center...'
                  : ''}
            </span>
          </div>
          {isOnline && !isSyncing && queue.length > 0 && (
            <RefreshCw className="h-4 w-4 animate-spin opacity-50" />
          )}
        </div>
      )}

      {/* Top Emergency Command HUD */}
      <GlassCard
        variant="default"
        className={`border-l-4 p-6 ${
          unaccounted > 0 ? 'border-l-amber-500' : 'border-l-emerald-500'
        }`}
      >
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                unaccounted > 0
                  ? 'border-amber-500/20 bg-amber-500/10 text-amber-600'
                  : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
              }`}
            >
              <LifeBuoy className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-black/[0.04] px-2 py-0.5 font-bold font-mono text-[var(--text-heading)] text-xs uppercase tracking-wider">
                  DMRE SECTION 54/55
                </span>
                {unaccounted > 0 && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-bold text-amber-700 text-xs">
                    ACTIVE RECONCILIATION • {unaccounted} UNACCOUNTED
                  </span>
                )}
              </div>
              <h2 className="mt-1 font-black text-2xl text-[var(--text-heading)] tracking-tight">
                On-Site Command HUD
              </h2>
              <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                Brakfontein Pit Alpha • Automated head-count sync via gate turnstiles and safety
                marshals
              </p>
            </div>
          </div>

          <div className="flex w-full items-center justify-end gap-2.5 lg:w-auto">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 rounded-lg border border-black/[0.1] bg-white px-3.5 py-2 font-bold text-[var(--text-heading)] text-xs shadow-xs transition-all hover:border-[var(--accent-blue)] active:scale-95"
            >
              <Download className="h-4 w-4 text-emerald-600" />
              <span>Export Rescue Manifest (CSV)</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg bg-black/[0.04] px-3.5 py-2 font-bold text-[var(--text-heading)] text-xs transition-all hover:bg-black/[0.08] active:scale-95"
            >
              <Printer className="h-4 w-4" />
              <span>Print Roster</span>
            </button>
          </div>
        </div>

        {/* Live Counters Bento Grid */}
        <div
          data-testid="muster-counters-grid"
          className="mt-6 grid grid-cols-2 gap-3.5 border-black/[0.06] border-t pt-5 sm:grid-cols-4"
        >
          <div data-testid="muster-counter-total" className={MUSTER_COUNTER_CARD_THEMES.total}>
            <span className="font-bold font-mono text-[11px] text-sky-900 uppercase tracking-wider">
              Total Souls on Site
            </span>
            <div className="mt-1 font-black font-mono text-3xl text-sky-800 tabular-nums">
              {totalSouls}
            </div>
            <span className="font-semibold text-[11px] text-sky-700">Active Swiped Badges</span>
          </div>

          <div
            data-testid="muster-counter-accounted"
            className={MUSTER_COUNTER_CARD_THEMES.accounted}
          >
            <span className="font-bold font-mono text-[11px] text-emerald-900 uppercase tracking-wider">
              Accounted (Safe)
            </span>
            <div className="mt-1 font-black font-mono text-3xl text-emerald-700 tabular-nums">
              {accounted}
            </div>
            <span className="font-semibold text-[11px] text-emerald-800">
              {Math.round((accounted / (totalSouls || 1)) * 100)}% Verified at Stations
            </span>
          </div>

          <div
            data-testid="muster-counter-unaccounted"
            className={MUSTER_COUNTER_CARD_THEMES.unaccounted}
          >
            <span className="font-bold font-mono text-[11px] text-amber-900 uppercase tracking-wider">
              Unaccounted
            </span>
            <div className="mt-1 font-black font-mono text-3xl text-amber-700 tabular-nums">
              {unaccounted}
            </div>
            <span className="font-semibold text-[11px] text-amber-800">Search Team Focus</span>
          </div>

          <div
            data-testid="muster-counter-evacuated"
            className={MUSTER_COUNTER_CARD_THEMES.evacuated}
          >
            <span className="font-bold font-mono text-[11px] text-indigo-900 uppercase tracking-wider">
              Evacuated Off-Site
            </span>
            <div className="mt-1 font-black font-mono text-3xl text-indigo-700 tabular-nums">
              {evacuated}
            </div>
            <span className="font-semibold text-[11px] text-indigo-800">
              Main Gate Exit Scanned
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Muster Point Stations Overview */}
      <div data-testid="muster-stations-grid" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {summary.musterStations.map((station) => {
          const stationCount = stationCounts.get(station.name) || 0;
          return (
            <button
              type="button"
              key={station.id}
              onClick={() => setSelectedStation(station.name)}
              className={`${MUSTER_STATION_CARD_BASE} text-left ${
                selectedStation === station.name
                  ? 'border-accent-gold ring-2 ring-accent-gold/30'
                  : 'border-accent-gold/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold font-mono text-[var(--accent-blue)] text-xs">
                  {station.id}
                </span>
                <span className="rounded bg-black/[0.04] px-2 py-0.5 font-bold font-mono text-[var(--text-heading)] text-xs">
                  {stationCount} Verified
                </span>
              </div>
              <h4 className="mt-2 font-bold text-[var(--text-heading)] text-sm">{station.name}</h4>
              <p className="mt-0.5 text-[var(--text-muted)] text-xs">{station.location}</p>
              <p className="mt-2 font-mono text-[11px] text-[var(--text-secondary)]">
                Target: {station.targetZone}
              </p>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <GlassCard variant="default" className="p-4">
        <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
          <div className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-accent-gold" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder={animatedPlaceholder || MUSTER_SEARCH_PLACEHOLDER}
              aria-label="Search muster personnel, contractor, or pit zone"
              className="gold-steel-border gold-steel-border-slim w-full rounded-lg border border-accent-gold/65 bg-white py-2 pr-4 pl-9 text-[var(--text-heading)] text-xs caret-accent-gold shadow-2xs focus:border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/25"
            />
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
            {/* Status Filter */}
            <div className="flex items-center rounded-lg bg-black/[0.04] p-1 font-medium text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`rounded-md px-3 py-1 transition-all ${
                  statusFilter === 'all'
                    ? 'bg-white font-bold text-[var(--text-heading)] shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                All ({records.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('unaccounted')}
                className={`rounded-md px-3 py-1 transition-all ${
                  statusFilter === 'unaccounted'
                    ? 'bg-amber-500 font-bold text-white shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                Unaccounted ({unaccounted})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('accounted')}
                className={`rounded-md px-3 py-1 transition-all ${
                  statusFilter === 'accounted'
                    ? 'bg-emerald-600 font-bold text-white shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                Accounted ({accounted})
              </button>
            </div>

            {selectedStation !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedStation('all')}
                className="ml-2 font-semibold text-[var(--accent-blue)] text-xs underline"
              >
                Clear Station Filter
              </button>
            )}
          </div>
        </div>

        {/* Live Roll Call Table */}
        <div
          data-testid="muster-roll-call-table-container"
          className="gold-steel-border gold-steel-border-slim mt-4 overflow-x-auto rounded-xl border border-accent-gold/60 bg-white shadow-sm"
        >
          <table className="w-full border-collapse bg-white text-left text-xs">
            <thead className="border-black/[0.08] border-b bg-slate-50 font-mono text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Entity / Personnel
                </th>
                <th scope="col" className="px-4 py-3">
                  Organization & Role
                </th>
                <th scope="col" className="px-4 py-3">
                  Assigned Pit Zone
                </th>
                <th scope="col" className="px-4 py-3">
                  Last Gate Swipe
                </th>
                <th scope="col" className="px-4 py-3">
                  Compliance
                </th>
                <th scope="col" className="px-4 py-3">
                  On-Site Station
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Reconciliation Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06] bg-white">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--text-muted)]">
                    No personnel match the specified filters.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const isAccounted = r.status === 'accounted';
                  const isProcessing = isUpdating === r.id;

                  return (
                    <tr
                      key={r.id}
                      className={`transition-colors hover:bg-black/[0.02] ${
                        !isAccounted ? 'bg-amber-500/[0.03]' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {r.entityType === 'personnel' ? (
                            <HardHat className="h-4 w-4 shrink-0 text-blue-600" />
                          ) : (
                            <Users className="h-4 w-4 shrink-0 text-teal-600" />
                          )}
                          <div>
                            <span className="block font-bold text-[var(--text-heading)]">
                              {r.name}
                            </span>
                            <span className="font-mono text-[10px] text-[var(--text-muted)]">
                              ID: {r.id.substring(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="block font-medium text-[var(--text-heading)]">
                          {r.company}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {r.roleOrPurpose}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-mono text-[11px] text-[var(--text-secondary)]">
                        {r.assignedZone}
                      </td>

                      <td className="px-4 py-3">
                        <span className="block font-medium text-[var(--text-heading)]">
                          {r.lastSeenGate}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">
                          {r.lastSeenTime}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-bold text-[10px] ${
                              r.inductionValid
                                ? 'bg-emerald-500/10 text-emerald-700'
                                : 'bg-red-500/10 text-red-700'
                            }`}
                          >
                            {r.inductionValid ? 'Induction OK' : 'Induction Expired'}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {r.station ? (
                          <div className="font-medium text-[var(--text-heading)]">
                            <span className="text-xs">{r.station}</span>
                            {r.checkedOffAt && (
                              <span className="block font-mono text-[10px] text-[var(--text-muted)]">
                                Verified: {r.checkedOffAt}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="font-bold font-mono text-[11px] text-amber-600">
                            Pending Check-off
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleToggleStatus(r)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold text-xs transition-all active:scale-95 ${
                            isAccounted
                              ? 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20'
                              : 'bg-amber-500 text-white shadow-xs hover:bg-amber-600'
                          }`}
                        >
                          {isProcessing ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : isAccounted ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-white" />
                          )}
                          <span>{isAccounted ? 'Safe (Accounted)' : 'Mark as Safe'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
