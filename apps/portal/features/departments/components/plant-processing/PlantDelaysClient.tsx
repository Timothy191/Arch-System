'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  PlusCircle,
} from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useEffect, useMemo, useState, useTransition } from 'react';
import { logPlantDelayAction } from './actions';
import { loadStoredPlantDelays, saveStoredPlantDelays } from './storage';
import {
  PLANT_CIRCUIT_OPTIONS,
  PLANT_DELAY_CATEGORIES,
  type PlantDelayCategory,
  type PlantDelayEntry,
  type PlantImpactType,
  type PlantShiftType,
} from './types';

interface PlantDelaysClientProps {
  initialDate: string;
  initialDelays: PlantDelayEntry[];
}

function computeMinutesBetween(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map((n) => Number(n) || 0);
  const [eh, em] = endTime.split(':').map((n) => Number(n) || 0);
  const startTotal = (sh ?? 0) * 60 + (sm ?? 0);
  const endTotal = (eh ?? 0) * 60 + (em ?? 0);
  const diff = endTotal >= startTotal ? endTotal - startTotal : 24 * 60 - startTotal + endTotal;
  return Math.max(1, diff);
}

export function PlantDelaysClient({ initialDate, initialDelays }: PlantDelaysClientProps) {
  const [delays, setDelays] = useState<PlantDelayEntry[]>(initialDelays);
  const [date, setDate] = useState<string>(initialDate);
  const [shift, setShift] = useState<PlantShiftType>('day');
  const [circuit, setCircuit] = useState<string>(PLANT_CIRCUIT_OPTIONS[0]);
  const [category, setCategory] = useState<PlantDelayCategory>('Mechanical');
  const [impactType, setImpactType] = useState<PlantImpactType>('Reduced Throughput');
  const [startTime, setStartTime] = useState<string>('10:15');
  const [endTime, setEndTime] = useState<string>('10:35');
  const [reason, setReason] = useState<string>('');
  const [correctiveAction, setCorrectiveAction] = useState<string>('');

  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const stored = loadStoredPlantDelays(initialDelays);
    setDelays(stored);
  }, [initialDelays]);

  const calculatedDurationMins = useMemo(
    () => computeMinutesBetween(startTime, endTime),
    [startTime, endTime]
  );

  const filteredDelays = useMemo(() => {
    return delays.filter((item) => {
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        return (
          item.circuit.toLowerCase().includes(q) ||
          item.reason.toLowerCase().includes(q) ||
          item.correctiveAction.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [delays, categoryFilter, searchQuery]);

  const metrics = useMemo(() => {
    const totalEvents = delays.length;
    const totalMinutes = delays.reduce((sum, d) => sum + (Number(d.durationMinutes) || 0), 0);
    const totalHours = Number((totalMinutes / 60).toFixed(1));
    const scheduledShiftMins = Math.max(720, totalEvents * 240);
    const availabilityPct = Number(
      Math.max(
        0,
        Math.min(100, ((scheduledShiftMins - totalMinutes) / scheduledShiftMins) * 100)
      ).toFixed(1)
    );

    const byCircuit = new Map<string, number>();
    for (const d of delays) {
      byCircuit.set(d.circuit, (byCircuit.get(d.circuit) ?? 0) + d.durationMinutes);
    }
    let topCircuit = 'None';
    let topMins = 0;
    for (const [c, m] of byCircuit.entries()) {
      if (m > topMins) {
        topMins = m;
        topCircuit = c.split(' (')[0] ?? c;
      }
    }

    return {
      totalEvents,
      totalMinutes,
      totalHours,
      availabilityPct,
      topCircuit,
      topMins,
    };
  }, [delays]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!reason.trim()) return;

    startTransition(async () => {
      const res = await logPlantDelayAction({
        date,
        shift,
        circuit,
        category,
        impactType,
        startTime,
        endTime,
        durationMinutes: calculatedDurationMins,
        reason,
        correctiveAction,
      });

      const updated = [res.entry, ...delays];
      setDelays(updated);
      saveStoredPlantDelays(updated);
      setReason('');
      setCorrectiveAction('');
      setFeedbackBanner(res.message);
    });
  };

  const handleExportDelaysCsv = () => {
    const headers = [
      'Date',
      'Shift',
      'Plant Circuit',
      'Category',
      'Impact',
      'Start',
      'End',
      'Duration (min)',
      'Root Cause',
      'Corrective Action',
      'Logged By',
      'Status',
    ];
    const lines = [
      headers.join(','),
      ...filteredDelays.map((d) =>
        [
          d.date,
          d.shift,
          `"${d.circuit}"`,
          `"${d.category}"`,
          `"${d.impactType}"`,
          d.startTime,
          d.endTime,
          d.durationMinutes,
          `"${d.reason.replaceAll('"', '""')}"`,
          `"${d.correctiveAction.replaceAll('"', '""')}"`,
          `"${d.loggedBy}"`,
          d.status,
        ].join(',')
      ),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `plant-processing-delays-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-5 shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-800 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            Plant &amp; Processing Downtime &amp; Delay Log
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-heading)] tracking-tight">
            Plant &amp; Processing Delays
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Log and categorize wash plant stoppages, crusher chute blockages, dense media
            excursions, and circuit maintenance delays.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/plant-processing"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-heading)] hover:bg-black/[0.03] transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
            Hourly Input Sheet
          </Link>
          <Link
            href="/plant-processing/history"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-heading)] hover:bg-black/[0.03] transition-colors"
          >
            <Database className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
            History Database
          </Link>
          <button
            type="button"
            onClick={handleExportDelaysCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-heading)] hover:bg-black/[0.03] transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Delays CSV
          </button>
        </div>
      </div>

      {feedbackBanner && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-900 text-xs font-medium"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-[11px] underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Logged Delay Events
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-[var(--text-heading)]">
            {metrics.totalEvents}
          </div>
          <div className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Across Day &amp; Night wash plant shifts
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Cumulative Downtime
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-amber-700">
            {metrics.totalMinutes} <span className="text-sm font-normal">mins</span>
          </div>
          <div className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {metrics.totalHours} hours total lost run time
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Plant Circuit Availability
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-emerald-700">
            {metrics.availabilityPct}%
          </div>
          <div className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Target availability ≥ 92.0%
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Primary Bottleneck Circuit
          </div>
          <div className="mt-1 text-base font-bold text-[var(--text-heading)] truncate">
            {metrics.topCircuit}
          </div>
          <div className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {metrics.topMins} mins total delay impact
          </div>
        </div>
      </div>

      {/* Main Split: Log Form (Left) + Delays Register Table (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Log New Plant Delay Form */}
        <form
          onSubmit={handleSubmit}
          aria-label="Log Plant and Processing Delay"
          className="xl:col-span-4 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-5 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
            <div className="flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-[var(--accent-blue)]" />
              <h2 className="text-sm font-bold text-[var(--text-heading)] uppercase tracking-wider">
                Log New Plant Delay
              </h2>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 font-mono text-xs font-semibold">
              <Clock className="w-3 h-3" />
              {calculatedDurationMins} min
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-xs">
              <span className="font-medium text-[var(--text-secondary)]">Operational Date</span>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-heading)] font-mono text-xs"
              />
            </label>

            <label className="block space-y-1 text-xs">
              <span className="font-medium text-[var(--text-secondary)]">Shift</span>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as PlantShiftType)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-heading)] text-xs"
              >
                <option value="day">Day Shift (06:00–18:00)</option>
                <option value="night">Night Shift (18:00–06:00)</option>
              </select>
            </label>
          </div>

          <label className="block space-y-1 text-xs">
            <span className="font-medium text-[var(--text-secondary)]">
              Plant Circuit / Equipment Section
            </span>
            <select
              value={circuit}
              onChange={(e) => setCircuit(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-heading)] text-xs"
            >
              {PLANT_CIRCUIT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-xs">
              <span className="font-medium text-[var(--text-secondary)]">Delay Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PlantDelayCategory)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-heading)] text-xs"
              >
                {PLANT_DELAY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1 text-xs">
              <span className="font-medium text-[var(--text-secondary)]">Operational Impact</span>
              <select
                value={impactType}
                onChange={(e) => setImpactType(e.target.value as PlantImpactType)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-heading)] text-xs"
              >
                <option value="Full Plant Stoppage">Full Plant Stoppage</option>
                <option value="Reduced Throughput">Reduced Throughput</option>
                <option value="Single Circuit Bypass">Single Circuit Bypass</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-xs">
              <span className="font-medium text-[var(--text-secondary)]">Start Time</span>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-heading)] font-mono text-xs"
              />
            </label>

            <label className="block space-y-1 text-xs">
              <span className="font-medium text-[var(--text-secondary)]">End Time</span>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-heading)] font-mono text-xs"
              />
            </label>
          </div>

          <label className="block space-y-1 text-xs">
            <span className="font-medium text-[var(--text-secondary)]">
              Delay Cause / Description *
            </span>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Oversize ROM rock bridged primary jaw crusher feed chute..."
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-heading)] text-xs"
            />
          </label>

          <label className="block space-y-1 text-xs">
            <span className="font-medium text-[var(--text-secondary)]">
              Corrective Action Taken
            </span>
            <textarea
              rows={2}
              value={correctiveAction}
              onChange={(e) => setCorrectiveAction(e.target.value)}
              placeholder="e.g., Isolated feeder AF-100, cleared bridge with rock breaker, resumed at 450 t/hr..."
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-heading)] text-xs"
            />
          </label>

          <button
            type="submit"
            disabled={isPending}
            data-testid="submit-plant-delay-btn"
            className="w-full py-2.5 px-4 rounded-xl bg-[var(--accent-blue)] text-white text-xs font-semibold hover:opacity-95 disabled:opacity-60 transition-all shadow-sm cursor-pointer"
          >
            {isPending ? 'Recording Plant Delay...' : 'Record Plant & Processing Delay'}
          </button>
        </form>

        {/* Logged Delays Register Table */}
        <div className="xl:col-span-8 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl overflow-hidden shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border-default)]">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-heading)] uppercase tracking-wider">
                Plant &amp; Processing Delay Register ({filteredDelays.length})
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Chronological log of all plant circuit stoppages and throughput reductions
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs">
                <Filter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <select
                  aria-label="Filter by delay category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-xs text-[var(--text-heading)]"
                >
                  <option value="ALL">All Categories</option>
                  {PLANT_DELAY_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <input
                type="search"
                aria-label="Search plant delays"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search circuit or cause..."
                className="px-3 py-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-xs text-[var(--text-heading)]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-black/[0.025] border-b border-[var(--border-default)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  <th className="py-3 px-4">Date / Shift</th>
                  <th className="py-3 px-4">Circuit &amp; Category</th>
                  <th className="py-3 px-4">Window</th>
                  <th className="py-3 px-4 text-right">Duration</th>
                  <th className="py-3 px-4">Root Cause &amp; Corrective Action</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {filteredDelays.map((d) => (
                  <tr key={d.id} className="hover:bg-black/[0.015] transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap font-mono">
                      <div className="font-semibold text-[var(--text-heading)]">{d.date}</div>
                      <div className="text-[11px] uppercase text-[var(--text-muted)]">
                        {d.shift} shift
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[var(--text-heading)]">{d.circuit}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-800 border border-amber-500/30">
                          {d.category}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">{d.impactType}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[var(--text-secondary)]">
                      {d.startTime} – {d.endTime}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-amber-700">
                      {d.durationMinutes} min
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <div className="font-medium text-[var(--text-heading)]">{d.reason}</div>
                      <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                        <span className="font-semibold">Action:</span> {d.correctiveAction}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          d.status === 'Resolved'
                            ? 'bg-emerald-500/15 text-emerald-800 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-800 border border-amber-500/30'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
