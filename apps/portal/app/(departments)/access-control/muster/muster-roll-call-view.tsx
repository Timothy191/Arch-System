'use client';

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

  // Compute live counts
  const totalSouls = records.length;
  const accounted = records.filter((r) => r.status === 'accounted').length;
  const unaccounted = records.filter((r) => r.status === 'unaccounted').length;
  const evacuated = records.filter((r) => r.status === 'evacuated').length;

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
      {/* Top Emergency Command HUD */}
      <GlassCard
        variant="window"
        className={`p-6 border-l-4 ${
          unaccounted > 0 ? 'border-l-amber-500' : 'border-l-emerald-500'
        }`}
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                unaccounted > 0
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              }`}
            >
              <LifeBuoy className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold uppercase tracking-wider bg-black/[0.04] text-[var(--text-heading)] px-2 py-0.5 rounded">
                  DMRE SECTION 54/55 MUSTER PROTOCOL
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
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
              <h2 className="text-2xl font-black text-[var(--text-heading)] mt-1 tracking-tight">
                Emergency Evacuation & Blast Clearance Station
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Brakfontein Pit Alpha • Automated head-count sync via gate turnstiles and safety
                marshals
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 bg-white border border-black/[0.1] hover:border-[var(--accent-blue)] text-[var(--text-heading)] px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Export Rescue Manifest (CSV)</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-black/[0.04] hover:bg-black/[0.08] text-[var(--text-heading)] px-3.5 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print Roster</span>
            </button>
          </div>
        </div>

        {/* Live Counters Bento Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-black/[0.06]">
          <div className="bg-white/60 p-3.5 rounded-xl border border-black/[0.06]">
            <span className="text-[11px] font-mono font-semibold uppercase text-[var(--text-muted)]">
              Total Souls on Site
            </span>
            <div className="text-2xl font-black font-mono text-[var(--text-heading)] mt-1">
              {totalSouls}
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">Active Swiped Badges</span>
          </div>

          <div className="bg-emerald-500/5 p-3.5 rounded-xl border border-emerald-500/20">
            <span className="text-[11px] font-mono font-semibold uppercase text-emerald-700">
              Accounted (Safe)
            </span>
            <div className="text-2xl font-black font-mono text-emerald-600 mt-1">{accounted}</div>
            <span className="text-[10px] text-emerald-700/80">
              {Math.round((accounted / (totalSouls || 1)) * 100)}% Verified at Stations
            </span>
          </div>

          <div className="bg-amber-500/5 p-3.5 rounded-xl border border-amber-500/20">
            <span className="text-[11px] font-mono font-semibold uppercase text-amber-700">
              Unaccounted
            </span>
            <div className="text-2xl font-black font-mono text-amber-600 mt-1">{unaccounted}</div>
            <span className="text-[10px] text-amber-700/80">Search Team Focus</span>
          </div>

          <div className="bg-blue-500/5 p-3.5 rounded-xl border border-blue-500/20">
            <span className="text-[11px] font-mono font-semibold uppercase text-blue-700">
              Evacuated Off-Site
            </span>
            <div className="text-2xl font-black font-mono text-blue-600 mt-1">{evacuated}</div>
            <span className="text-[10px] text-blue-700/80">Main Gate Exit Scanned</span>
          </div>
        </div>
      </GlassCard>

      {/* Muster Point Stations Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summary.musterStations.map((station) => {
          const stationCount = records.filter(
            (r) => r.status === 'accounted' && r.station === station.name
          ).length;
          return (
            <div
              key={station.id}
              onClick={() => setSelectedStation(station.name)}
              className={`cursor-pointer p-4 rounded-xl border transition-all ${
                selectedStation === station.name
                  ? 'bg-blue-50/50 border-[var(--accent-blue)] ring-2 ring-[var(--accent-blue)]/20'
                  : 'bg-white/60 border-black/[0.08] hover:border-[var(--accent-blue)]/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[var(--accent-blue)]">
                  {station.id}
                </span>
                <span className="text-xs font-mono font-bold bg-black/[0.04] px-2 py-0.5 rounded text-[var(--text-heading)]">
                  {stationCount} Verified
                </span>
              </div>
              <h4 className="text-sm font-bold text-[var(--text-heading)] mt-2">{station.name}</h4>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{station.location}</p>
              <p className="text-[11px] font-mono text-[var(--text-secondary)] mt-2">
                Target: {station.targetZone}
              </p>
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <GlassCard variant="window" className="p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, contractor, zone..."
              className="w-full pl-9 pr-4 py-2 bg-white/80 border border-black/[0.1] rounded-lg text-xs text-[var(--text-heading)] focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            {/* Status Filter */}
            <div className="flex items-center bg-black/[0.04] p-1 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-md transition-all ${
                  statusFilter === 'all'
                    ? 'bg-white text-[var(--text-heading)] font-bold shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                All ({records.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('unaccounted')}
                className={`px-3 py-1 rounded-md transition-all ${
                  statusFilter === 'unaccounted'
                    ? 'bg-amber-500 text-white font-bold shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                Unaccounted ({unaccounted})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('accounted')}
                className={`px-3 py-1 rounded-md transition-all ${
                  statusFilter === 'accounted'
                    ? 'bg-emerald-600 text-white font-bold shadow-2xs'
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
                className="text-xs text-[var(--accent-blue)] font-semibold underline ml-2"
              >
                Clear Station Filter
              </button>
            )}
          </div>
        </div>

        {/* Live Roll Call Table */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-black/[0.08]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-black/[0.03] border-b border-black/[0.08] text-[var(--text-muted)] font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Entity / Personnel</th>
                <th className="py-3 px-4">Organization & Role</th>
                <th className="py-3 px-4">Assigned Pit Zone</th>
                <th className="py-3 px-4">Last Gate Swipe</th>
                <th className="py-3 px-4">Compliance</th>
                <th className="py-3 px-4">Muster Station</th>
                <th className="py-3 px-4 text-right">Reconciliation Action</th>
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
                      className={`hover:bg-black/[0.02] transition-colors ${
                        !isAccounted ? 'bg-amber-500/[0.03]' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {r.entityType === 'personnel' ? (
                            <HardHat className="w-4 h-4 text-blue-600 shrink-0" />
                          ) : (
                            <Users className="w-4 h-4 text-teal-600 shrink-0" />
                          )}
                          <div>
                            <span className="font-bold text-[var(--text-heading)] block">
                              {r.name}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] font-mono">
                              ID: {r.id.substring(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-medium text-[var(--text-heading)] block">
                          {r.company}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {r.roleOrPurpose}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-[var(--text-secondary)]">
                        {r.assignedZone}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-medium text-[var(--text-heading)] block">
                          {r.lastSeenGate}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          {r.lastSeenTime}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                              r.inductionValid
                                ? 'bg-emerald-500/10 text-emerald-700'
                                : 'bg-red-500/10 text-red-700'
                            }`}
                          >
                            {r.inductionValid ? 'Induction OK' : 'Induction Expired'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {r.station ? (
                          <div className="font-medium text-[var(--text-heading)]">
                            <span className="text-xs">{r.station}</span>
                            {r.checkedOffAt && (
                              <span className="block text-[10px] text-[var(--text-muted)] font-mono">
                                Verified: {r.checkedOffAt}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-600 font-bold font-mono">
                            Pending Check-off
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleToggleStatus(r)}
                          className={`inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                            isAccounted
                              ? 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20'
                              : 'bg-amber-500 text-white hover:bg-amber-600 shadow-xs'
                          }`}
                        >
                          {isProcessing ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : isAccounted ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-white" />
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
