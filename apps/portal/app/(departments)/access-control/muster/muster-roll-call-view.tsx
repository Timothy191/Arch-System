'use client';

import { useOfflineQueue, usePitConnectivity } from '@repo/shared/hooks';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  Filter,
  HardHat,
  LifeBuoy,
  Printer,
  Radio,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  type MusterPersonnelRecord,
  type MusterSummary,
  markPersonnelMusterStatus,
} from '../actions';

interface MusterRollCallViewProps {
  initialSummary: MusterSummary;
}

export function MusterRollCallView({ initialSummary }: MusterRollCallViewProps) {
  const [summary] = useState<MusterSummary>(initialSummary);
  const [records, setRecords] = useState<MusterPersonnelRecord[]>(initialSummary.records);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unaccounted' | 'accounted'>('all');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const { isOnline } = usePitConnectivity();
  const { enqueue, queue, isSyncing } = useOfflineQueue();

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

    // Optimistic update
    setRecords((prev) =>
      prev.map((r) =>
        r.id === record.id
          ? {
              ...r,
              status: nextStatus,
              checkedOffAt: nextStatus === 'accounted' ? nowTime : null,
              station: nextStatus === 'accounted' ? r.station || 'Muster Point Alpha' : null,
            }
          : r
      )
    );

    try {
      setIsUpdating(record.id);
      await markPersonnelMusterStatus({
        entityId: record.id,
        status: nextStatus === 'accounted' ? 'accounted' : 'unaccounted',
        station: nextStatus === 'accounted' ? record.station || 'Muster Point Alpha' : undefined,
      });
      toast.success(
        `${record.name} marked as ${nextStatus === 'accounted' ? 'ACCOUNTED (SAFE)' : 'UNACCOUNTED'}`
      );
    } catch {
      // Revert on failure
      setRecords((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, status: record.status } : r))
      );
      toast.error('Failed to update muster status');
    } finally {
      setIsUpdating(null);
    }
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
      `"${r.name}"`,
      r.entityType,
      `"${r.company}"`,
      `"${r.roleOrPurpose}"`,
      `"${r.assignedZone}"`,
      r.status.toUpperCase(),
      r.station || 'N/A',
      r.checkedOffAt || 'N/A',
      r.inductionValid ? 'YES' : 'NO',
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `emergency_muster_roll_call_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        variant="window"
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
                  DMRE SECTION 54/55 MUSTER PROTOCOL
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-bold text-xs ${
                    unaccounted > 0
                      ? 'bg-amber-500/10 text-amber-700'
                      : 'bg-emerald-500/10 text-emerald-700'
                  }`}
                >
                  {unaccounted > 0
                    ? `ACTIVE RECONCILIATION • ${unaccounted} UNACCOUNTED`
                    : 'ALL SOULS ACCOUNTED • PIT SECURED'}
                </span>
              </div>
              <h2 className="mt-1 font-black text-2xl text-[var(--text-heading)] tracking-tight">
                Emergency Evacuation & Blast Clearance Station
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
        <div className="mt-6 grid grid-cols-2 gap-3 border-black/[0.06] border-t pt-5 sm:grid-cols-4">
          <div className="rounded-xl border border-black/[0.06] bg-white/60 p-3.5">
            <span className="font-mono font-semibold text-[11px] text-[var(--text-muted)] uppercase">
              Total Souls on Site
            </span>
            <div className="mt-1 font-black font-mono text-2xl text-[var(--text-heading)]">
              {totalSouls}
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">Active Swiped Badges</span>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
            <span className="font-mono font-semibold text-[11px] text-emerald-700 uppercase">
              Accounted (Safe)
            </span>
            <div className="mt-1 font-black font-mono text-2xl text-emerald-600">{accounted}</div>
            <span className="text-[10px] text-emerald-700/80">
              {Math.round((accounted / (totalSouls || 1)) * 100)}% Verified at Stations
            </span>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
            <span className="font-mono font-semibold text-[11px] text-amber-700 uppercase">
              Unaccounted
            </span>
            <div className="mt-1 font-black font-mono text-2xl text-amber-600">{unaccounted}</div>
            <span className="text-[10px] text-amber-700/80">Search Team Focus</span>
          </div>

          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5">
            <span className="font-mono font-semibold text-[11px] text-blue-700 uppercase">
              Evacuated Off-Site
            </span>
            <div className="mt-1 font-black font-mono text-2xl text-blue-600">{evacuated}</div>
            <span className="text-[10px] text-blue-700/80">Main Gate Exit Scanned</span>
          </div>
        </div>
      </GlassCard>

      {/* Muster Point Stations Overview */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {summary.musterStations.map((station) => {
          const stationCount = stationCounts.get(station.name) || 0;
          return (
            <div
              key={station.id}
              onClick={() => setSelectedStation(station.name)}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                selectedStation === station.name
                  ? 'border-[var(--accent-blue)] bg-blue-50/50 ring-2 ring-[var(--accent-blue)]/20'
                  : 'border-black/[0.08] bg-white/60 hover:border-[var(--accent-blue)]/40'
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
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <GlassCard variant="window" className="p-4">
        <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
          <div className="relative w-full md:w-80">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, contractor, zone..."
              className="w-full rounded-lg border border-black/[0.1] bg-white/80 py-2 pr-4 pl-9 text-[var(--text-heading)] text-xs focus:border-[var(--accent-blue)] focus:outline-none"
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
        <div className="mt-4 overflow-x-auto rounded-xl border border-black/[0.08]">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-black/[0.08] border-b bg-black/[0.03] font-mono text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
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
                  Muster Station
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Reconciliation Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06] bg-white/50">
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
