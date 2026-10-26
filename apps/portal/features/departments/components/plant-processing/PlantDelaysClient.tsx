'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  FileSpreadsheet,
  Plus,
  PlusCircle,
  RotateCcw,
} from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useEffect, useMemo, useState, useTransition } from 'react';
import { logPlantDelayAction, quickAddPlantEquipmentAction } from './actions';
import {
  PlantDelaysAnalyticsSection,
  PlantDelaysKpiRow,
  type PlantDelaysMetrics,
} from './PlantDelaysAnalyticsSection';
import {
  loadStoredPlantDelayOptions,
  loadStoredPlantDelays,
  saveStoredPlantDelayOptions,
  saveStoredPlantDelays,
} from './storage';
import {
  PLANT_CIRCUIT_OPTIONS,
  PLANT_DELAY_CATEGORIES,
  PLANT_IMPACT_OPTIONS,
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
  if (!startTime.trim() || !endTime.trim()) return 0;
  const [sh, sm] = startTime.split(':').map((n) => Number(n) || 0);
  const [eh, em] = endTime.split(':').map((n) => Number(n) || 0);
  const startTotal = (sh ?? 0) * 60 + (sm ?? 0);
  const endTotal = (eh ?? 0) * 60 + (em ?? 0);
  const diff = endTotal >= startTotal ? endTotal - startTotal : 24 * 60 - startTotal + endTotal;
  return Math.max(1, diff);
}

export function PlantDelaysClient({ initialDate, initialDelays }: PlantDelaysClientProps) {
  const [delays, setDelays] = useState<PlantDelayEntry[]>(initialDelays);
  const [circuitOptions, setCircuitOptions] = useState<string[]>([...PLANT_CIRCUIT_OPTIONS]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([...PLANT_DELAY_CATEGORIES]);
  const [impactOptions, setImpactOptions] = useState<string[]>([...PLANT_IMPACT_OPTIONS]);

  const [selectedDelayId, setSelectedDelayId] = useState<string | null>(null);
  const [date, setDate] = useState<string>(initialDate);
  const [shift, setShift] = useState<PlantShiftType>('day');
  const [circuit, setCircuit] = useState<string>(PLANT_CIRCUIT_OPTIONS[0]);
  const [category, setCategory] = useState<PlantDelayCategory>('Mechanical');
  const [impactType, setImpactType] = useState<PlantImpactType>('Reduced Throughput');
  const [startTime, setStartTime] = useState<string>('10:15');
  const [endTime, setEndTime] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [correctiveAction, setCorrectiveAction] = useState<string>('');

  // Quick-add ("+") inline input states for Equipment, Delay Category, and Operational Impact
  const [showAddEquipment, setShowAddEquipment] = useState<boolean>(false);
  const [newEquipmentName, setNewEquipmentName] = useState<string>('');
  const [showAddCategory, setShowAddCategory] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [showAddImpact, setShowAddImpact] = useState<boolean>(false);
  const [newImpactName, setNewImpactName] = useState<string>('');

  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const stored = loadStoredPlantDelays(initialDelays);
    setDelays(stored);
    const storedOpts = loadStoredPlantDelayOptions({
      circuits: [...PLANT_CIRCUIT_OPTIONS],
      categories: [...PLANT_DELAY_CATEGORIES],
      impacts: [...PLANT_IMPACT_OPTIONS],
    });
    setCircuitOptions(storedOpts.circuits);
    setCategoryOptions(storedOpts.categories);
    setImpactOptions(storedOpts.impacts);
  }, [initialDelays]);

  const calculatedDurationMins = useMemo(
    () => computeMinutesBetween(startTime, endTime),
    [startTime, endTime]
  );

  const metrics: PlantDelaysMetrics = useMemo(() => {
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

  const handleQuickAddEquipment = () => {
    const trimmed = newEquipmentName.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await quickAddPlantEquipmentAction({ name: trimmed });
      const nextCircuits = Array.from(new Set([...circuitOptions, trimmed]));
      setCircuitOptions(nextCircuits);
      saveStoredPlantDelayOptions({
        circuits: nextCircuits,
        categories: categoryOptions,
        impacts: impactOptions,
      });
      setCircuit(trimmed);
      setNewEquipmentName('');
      setShowAddEquipment(false);
      setFeedbackBanner(res.message);
    });
  };

  const handleQuickAddCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    const nextCategories = Array.from(new Set([...categoryOptions, trimmed]));
    setCategoryOptions(nextCategories);
    saveStoredPlantDelayOptions({
      circuits: circuitOptions,
      categories: nextCategories,
      impacts: impactOptions,
    });
    setCategory(trimmed);
    setNewCategoryName('');
    setShowAddCategory(false);
    setFeedbackBanner(`Added "${trimmed}" to Delay Categories.`);
  };

  const handleQuickAddImpact = () => {
    const trimmed = newImpactName.trim();
    if (!trimmed) return;
    const nextImpacts = Array.from(new Set([...impactOptions, trimmed]));
    setImpactOptions(nextImpacts);
    saveStoredPlantDelayOptions({
      circuits: circuitOptions,
      categories: categoryOptions,
      impacts: nextImpacts,
    });
    setImpactType(trimmed);
    setNewImpactName('');
    setShowAddImpact(false);
    setFeedbackBanner(`Added "${trimmed}" to Operational Impacts.`);
  };

  const handleSelectDelayForUpdate = (entry: PlantDelayEntry) => {
    setSelectedDelayId(entry.id);
    setDate(entry.date);
    setShift(entry.shift);
    if (!circuitOptions.includes(entry.circuit)) {
      setCircuitOptions((prev) => Array.from(new Set([...prev, entry.circuit])));
    }
    if (!categoryOptions.includes(entry.category)) {
      setCategoryOptions((prev) => Array.from(new Set([...prev, entry.category])));
    }
    if (!impactOptions.includes(entry.impactType)) {
      setImpactOptions((prev) => Array.from(new Set([...prev, entry.impactType])));
    }
    setCircuit(entry.circuit);
    setCategory(entry.category);
    setImpactType(entry.impactType);
    setStartTime(entry.startTime);
    setEndTime(entry.endTime || '');
    setReason(entry.reason);
    setCorrectiveAction(entry.correctiveAction);
    setFeedbackBanner(
      `Loaded delay log for "${entry.circuit}" (Booked in at ${entry.startTime}). Enter End Time to close out or update details.`
    );
  };

  const handleClearSelection = () => {
    setSelectedDelayId(null);
    setEndTime('');
    setReason('');
    setCorrectiveAction('');
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!reason.trim()) return;

    startTransition(async () => {
      const res = await logPlantDelayAction({
        ...(selectedDelayId ? { id: selectedDelayId } : {}),
        date,
        shift,
        circuit,
        category,
        impactType,
        startTime,
        endTime: endTime.trim(),
        durationMinutes: calculatedDurationMins,
        reason,
        correctiveAction,
      });

      const updated = selectedDelayId
        ? delays.map((d) => (d.id === selectedDelayId ? res.entry : d))
        : [res.entry, ...delays];
      setDelays(updated);
      saveStoredPlantDelays(updated);
      setSelectedDelayId(null);
      setEndTime('');
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
      ...delays.map((d) =>
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
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 font-semibold text-[11px] text-amber-800 uppercase tracking-wider">
            <AlertTriangle className="h-3.5 w-3.5" />
            Plant &amp; Processing Downtime &amp; Delay Log
          </div>
          <h1 className="font-bold text-[var(--text-heading)] text-xl tracking-tight sm:text-2xl">
            Plant &amp; Processing Delays
          </h1>
          <p className="text-[var(--text-secondary)] text-xs sm:text-sm">
            Log and categorize wash plant stoppages, crusher chute blockages, dense media
            excursions, and circuit maintenance delays.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/plant-processing/hourly-sheet"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 font-medium text-[var(--text-heading)] text-xs transition-colors hover:bg-black/[0.03]"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-amber-600" />
            Hourly Input Sheet
          </Link>
          <button
            type="button"
            onClick={handleExportDelaysCsv}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 font-medium text-[var(--text-heading)] text-xs transition-colors hover:bg-black/[0.03]"
          >
            <Download className="h-3.5 w-3.5" />
            Export Delays CSV
          </button>
        </div>
      </div>

      {feedbackBanner && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 font-medium text-emerald-900 text-xs"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{feedbackBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="cursor-pointer text-[11px] underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <PlantDelaysKpiRow metrics={metrics} />

      {/* Main Split: Log Form (Left) + Delays Register Table (Right) */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* Log New Plant Delay Form */}
        <form
          onSubmit={handleSubmit}
          aria-label="Log Plant and Processing Delay"
          className="space-y-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5 shadow-sm xl:col-span-4"
        >
          <div className="flex items-center justify-between border-[var(--border-default)] border-b pb-3">
            <div className="flex items-center gap-2">
              {selectedDelayId ? (
                <Edit3 className="h-4 w-4 text-amber-600" />
              ) : (
                <PlusCircle className="h-4 w-4 text-[var(--accent-blue)]" />
              )}
              <h2 className="font-bold text-[var(--text-heading)] text-sm uppercase tracking-wider">
                {selectedDelayId ? 'Update Delay / Log End Time' : 'Log New Plant Delay'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {selectedDelayId && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  data-testid="cancel-edit-delay-btn"
                  className="inline-flex cursor-pointer items-center gap-1 rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-0.5 font-medium text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-heading)]"
                >
                  <RotateCcw className="h-3 w-3" />
                  New Log
                </button>
              )}
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 font-mono font-semibold text-amber-800 text-xs">
                <Clock className="h-3 w-3" />
                {endTime.trim() ? `${calculatedDurationMins} min` : 'Booked In (Open)'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-xs">
              <span className="font-medium text-[var(--text-secondary)]">Operational Date</span>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-[var(--text-heading)] text-xs"
              />
            </label>

            <label className="block space-y-1 text-xs">
              <span className="font-medium text-[var(--text-secondary)]">Shift</span>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as PlantShiftType)}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-xs"
              >
                <option value="day">Day Shift (06:00–18:00)</option>
                <option value="night">Night Shift (18:00–06:00)</option>
              </select>
            </label>
          </div>

          {/* 1. Plant Circuit / Equipment Section with "+" Quick Add to Database */}
          <div className="space-y-1.5 text-xs">
            <label
              htmlFor="plant-circuit-select"
              className="block font-medium text-[var(--text-secondary)]"
            >
              Plant Circuit / Equipment Section
            </label>
            <div className="flex items-center gap-2">
              <select
                id="plant-circuit-select"
                aria-label="Plant Circuit / Equipment Section"
                value={circuit}
                onChange={(e) => setCircuit(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-xs"
              >
                {circuitOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowAddEquipment((prev) => !prev)}
                aria-label="Quick add Equipment"
                data-testid="quick-add-equipment-btn"
                title="Quick add Equipment (Adds to database)"
                className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] font-bold text-[var(--text-heading)] text-sm transition-colors hover:bg-black/[0.04]"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {showAddEquipment && (
              <div data-testid="quick-add-equipment-panel" className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  aria-label="New Equipment Name"
                  value={newEquipmentName}
                  onChange={(e) => setNewEquipmentName(e.target.value)}
                  placeholder="Quick add equipment (e.g. Tertiary Crusher CR-103)..."
                  className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[var(--text-heading)] text-xs"
                />
                <button
                  type="button"
                  onClick={handleQuickAddEquipment}
                  data-testid="confirm-add-equipment-btn"
                  className="cursor-pointer rounded-lg bg-[var(--accent-blue)] px-3 py-1.5 font-semibold text-white text-xs hover:opacity-95"
                >
                  Add to DB
                </button>
              </div>
            )}
          </div>

          {/* 2. Delay Category & 3. Operational Impact with "+" Quick Add */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 text-xs">
              <label
                htmlFor="delay-category-select"
                className="block font-medium text-[var(--text-secondary)]"
              >
                Delay Category
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  id="delay-category-select"
                  aria-label="Delay Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PlantDelayCategory)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-xs"
                >
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddCategory((prev) => !prev)}
                  aria-label="Quick add Delays"
                  data-testid="quick-add-category-btn"
                  title="Quick add Delay Category"
                  className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] font-bold text-[var(--text-heading)] text-sm transition-colors hover:bg-black/[0.04]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {showAddCategory && (
                <div
                  data-testid="quick-add-category-panel"
                  className="flex items-center gap-1.5 pt-1"
                >
                  <input
                    type="text"
                    aria-label="New Delay Category"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Add delay category..."
                    className="min-w-0 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1.5 text-[var(--text-heading)] text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleQuickAddCategory}
                    data-testid="confirm-add-category-btn"
                    className="cursor-pointer rounded-lg bg-[var(--accent-blue)] px-2.5 py-1.5 font-semibold text-white text-xs hover:opacity-95"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1.5 text-xs">
              <label
                htmlFor="operational-impact-select"
                className="block font-medium text-[var(--text-secondary)]"
              >
                Operational Impact
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  id="operational-impact-select"
                  aria-label="Operational Impact"
                  value={impactType}
                  onChange={(e) => setImpactType(e.target.value as PlantImpactType)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-xs"
                >
                  {impactOptions.map((impact) => (
                    <option key={impact} value={impact}>
                      {impact}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddImpact((prev) => !prev)}
                  aria-label="Quick add Operational Impact"
                  data-testid="quick-add-impact-btn"
                  title="Quick add Operational Impact"
                  className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] font-bold text-[var(--text-heading)] text-sm transition-colors hover:bg-black/[0.04]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {showAddImpact && (
                <div
                  data-testid="quick-add-impact-panel"
                  className="flex items-center gap-1.5 pt-1"
                >
                  <input
                    type="text"
                    aria-label="New Operational Impact"
                    value={newImpactName}
                    onChange={(e) => setNewImpactName(e.target.value)}
                    placeholder="Add operational impact..."
                    className="min-w-0 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1.5 text-[var(--text-heading)] text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleQuickAddImpact}
                    data-testid="confirm-add-impact-btn"
                    className="cursor-pointer rounded-lg bg-[var(--accent-blue)] px-2.5 py-1.5 font-semibold text-white text-xs hover:opacity-95"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 4. Booked In Time (Time Occurred) & 5. Optional End Time */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-xs">
              <span className="font-medium text-[var(--text-secondary)]">
                Booked In Time (Time Occurred)
              </span>
              <input
                type="time"
                required
                aria-label="Booked In Time (Time Occurred)"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-[var(--text-heading)] text-xs"
              />
            </label>

            <label className="block space-y-1 text-xs">
              <span className="font-medium text-[var(--text-secondary)]">
                End Time{' '}
                <span className="font-normal text-[10px] text-[var(--text-muted)]">
                  (Optional at Book-In)
                </span>
              </span>
              <input
                type="time"
                aria-label="End Time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-[var(--text-heading)] text-xs"
              />
            </label>
          </div>
          <p className="-mt-2 text-[11px] text-[var(--text-muted)]">
            Delays can be booked in at Time Occurred without an End Time. Select any log from the
            database list on the right to pull its details here and log the End Time once resolved.
          </p>

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
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-xs"
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
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-xs"
            />
          </label>

          <button
            type="submit"
            disabled={isPending}
            data-testid="submit-plant-delay-btn"
            className="w-full cursor-pointer rounded-xl bg-[var(--accent-blue)] px-4 py-2.5 font-semibold text-white text-xs shadow-sm transition-all hover:opacity-95 disabled:opacity-60"
          >
            {isPending
              ? 'Saving Plant Delay...'
              : selectedDelayId
                ? endTime.trim()
                  ? 'Update Delay & Log End Time'
                  : 'Update Selected Delay Log'
                : endTime.trim()
                  ? 'Record Plant & Processing Delay'
                  : 'Book In Active Delay (No End Time)'}
          </button>
        </form>

        {/* Logged Delays Register Table */}
        <PlantDelaysAnalyticsSection
          delays={delays}
          categoryOptions={categoryOptions}
          selectedDelayId={selectedDelayId}
          onSelectDelay={handleSelectDelayForUpdate}
        />
      </div>
    </div>
  );
}
