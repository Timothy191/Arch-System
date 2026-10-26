'use client';

import { useSupabaseRealtime } from '@repo/shared/hooks';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import { Lock, Search, X } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { logError } from '@/lib/errors/error-logger';
import { trackClientMetric } from '@/lib/observability/client-telemetry';
import { saveHourlyLoad, splitMachineHourlyLoad } from './actions';
import {
  HourCell,
  HourlyLoadsSplitSection,
  HourlyLoadsTelemetryHeader,
  hourPropName,
} from './HourlyLoadsSummaryPanels';
import {
  applyOptimisticAsyncSourcePatch,
  buildSyncSourceRows,
  computeHourlyLoadsTelemetry,
  DAY_HOUR_LABELS,
  type ExcavatorActivitySummary,
  type HourlyLoadGridRow,
  type HourlyLoadsGridProps,
  NIGHT_HOUR_LABELS,
} from './hourly-loads-utils';
import {
  buildHourlyLoadsGroupedMap,
  HOUR_PROP,
  HOURS_12,
  type HourlyLoad,
  type HourlyMaterial,
  type HourlyShift,
  isHourEditable,
  parseExcavatorMaterial,
  sumHourlyTotal,
} from './loads-utils';

function HourlyLoadsGrid({
  departmentId,
  machines,
  excavators,
  hourlyLoads,
  sites,
  mineBlocks: _mineBlocks = [],
  excavatorActivities = [],
  mineralRegistry,
  today,
  initialShift,
}: HourlyLoadsGridProps) {
  const supabase = createBrowserSupabaseClient();

  // AGENT-TRACE: The grid owns its load/site state so edits apply optimistically.
  // No router.refresh() anywhere — each change updates local state instantly and
  // persists in the background, so the page never reloads between values.
  const [loadsState, setLoadsState] = useState<HourlyLoad[]>(hourlyLoads);
  const [excavatorSites, setExcavatorSites] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      excavators.map((e) => {
        const act = excavatorActivities.find((a) => a.machine_id === e.id);
        return [e.id, e.site_id ?? act?.site_id ?? ''];
      })
    )
  );
  const [excavatorMaterials, setExcavatorMaterials] = useState<Record<string, HourlyMaterial>>(() =>
    Object.fromEntries(
      excavators.map((e) => {
        const act = excavatorActivities.find((a) => a.machine_id === e.id);
        const load = hourlyLoads.find((l) => l.excavator_id === e.id && !l.is_locked);
        const mat = act?.material_type || load?.material_type;
        return [e.id, parseExcavatorMaterial(mat, mineralRegistry).category];
      })
    )
  );

  // Split Modal State
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitMachineId, setSplitMachineId] = useState<string>(machines[0]?.id ?? '');
  const [splitExcavatorId, setSplitExcavatorId] = useState<string>(excavators[0]?.id ?? '');
  const [splitMaterial, setSplitMaterial] = useState<HourlyMaterial>('Waste');
  const [splitStartHour, setSplitStartHour] = useState<number>(2);
  const [isSubmittingSplit, setIsSubmittingSplit] = useState(false);

  // AGENT-TRACE: Real-time synchronization of hourly_loads CDC events across operators
  useSupabaseRealtime<HourlyLoad>({
    supabaseClient: supabase,
    table: 'hourly_loads',
    filter: `department_id=eq.${departmentId}`,
    onChange: (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        setLoadsState((prev) => {
          const index = prev.findIndex((item) => item.id === payload.new.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = { ...next[index], ...payload.new };
            return next;
          }
          return [...prev, payload.new];
        });
      } else if (payload.eventType === 'DELETE' && payload.old.id) {
        setLoadsState((prev) => prev.filter((item) => item.id !== payload.old.id));
      }
    },
  });

  useSupabaseRealtime<ExcavatorActivitySummary>({
    supabaseClient: supabase,
    table: 'excavator_activity',
    filter: `department_id=eq.${departmentId}`,
    onChange: (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const machineId = payload.new.machine_id;
        if (!machineId) return;
        if (payload.new.site_id !== undefined) {
          setExcavatorSites((prev) => ({
            ...prev,
            [machineId]: payload.new.site_id ?? '',
          }));
        }
        if (payload.new.material_type !== undefined) {
          setExcavatorMaterials((prev) => ({
            ...prev,
            [machineId]: parseExcavatorMaterial(payload.new.material_type, mineralRegistry)
              .category,
          }));
        }
      }
    },
  });

  const [selectedShift, setSelectedShift] = useState<HourlyShift>(
    initialShift ?? (new Date().getHours() >= 6 && new Date().getHours() < 18 ? 'day' : 'night')
  );

  const containerRef = useRef<HTMLDivElement>(null);

  const groupedLoadsByMachine = useMemo(() => buildHourlyLoadsGroupedMap(loadsState), [loadsState]);

  const hourLabels = selectedShift === 'day' ? DAY_HOUR_LABELS : NIGHT_HOUR_LABELS;

  // Check if any machine in this department has a bin_factor set
  const hasBinFactors = machines.some((m) => m.bin_factor != null && m.bin_factor > 0);

  const [asyncSource, setAsyncSource] = useState<HourlyLoadGridRow[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const workerVersionRef = useRef<number>(0);
  const latestReceivedVersionRef = useRef<number>(0);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./aggregation.worker.ts', import.meta.url));
    workerRef.current.onmessage = (
      e: MessageEvent<{ rows: HourlyLoadGridRow[]; version: number }>
    ) => {
      const { rows, version } = e.data;
      if (version >= latestReceivedVersionRef.current) {
        latestReceivedVersionRef.current = version;
        setAsyncSource(rows);
      }
    };
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const isLargeDataset = machines.length > 50 || loadsState.length > 100;

  const syncSource = useMemo(
    () =>
      buildSyncSourceRows({
        isLargeDataset,
        machines,
        groupedLoadsByMachine,
        selectedShift,
        hourLabels,
        hasBinFactors,
      }),
    [isLargeDataset, machines, groupedLoadsByMachine, selectedShift, hourLabels, hasBinFactors]
  );

  useEffect(() => {
    if (isLargeDataset && workerRef.current) {
      const version = ++workerVersionRef.current;
      workerRef.current.postMessage({
        machines,
        loadsState,
        selectedShift,
        hourLabels,
        hasBinFactors,
        version,
      });
    }
  }, [isLargeDataset, machines, loadsState, selectedShift, hourLabels, hasBinFactors]);

  const source = isLargeDataset ? asyncSource : syncSource;

  /**
   * Applies a patch to a specific load record in local state.
   */
  const applyLoadState = useCallback(
    (loadId: string, machineId: string, shiftType: HourlyShift, patch: Partial<HourlyLoad>) => {
      setLoadsState((prev) => {
        const existing = prev.find((load) => load.id === loadId);
        if (existing) {
          return prev.map((load) => {
            if (load.id !== loadId) return load;
            const merged = { ...load, ...patch };
            return { ...merged, total_loads: sumHourlyTotal(merged) };
          });
        }

        // Virtual local row
        const row: HourlyLoad = {
          id: loadId,
          machine_id: machineId,
          shift_type: shiftType,
          start_hour: 1,
          end_hour: 12,
          is_locked: false,
          hour_01: 0,
          hour_02: 0,
          hour_03: 0,
          hour_04: 0,
          hour_05: 0,
          hour_06: 0,
          hour_07: 0,
          hour_08: 0,
          hour_09: 0,
          hour_10: 0,
          hour_11: 0,
          hour_12: 0,
          total_loads: 0,
          material_type: 'Waste',
          excavator_id: null,
          ...patch,
        };
        return [...prev, { ...row, total_loads: sumHourlyTotal(row) }];
      });

      // Optimistically update asyncSource so the UI doesn't stutter before worker responds
      setAsyncSource((prev) => applyOptimisticAsyncSourcePatch(prev, loadId, patch));
    },
    []
  );

  /**
   * Persists changes to the database.
   */
  const persistLoad = useCallback(
    async (
      loadId: string,
      machineId: string,
      shiftType: HourlyShift,
      patch: Partial<HourlyLoad>
    ) => {
      const cleanPatch: Record<string, number | string | null> = {};
      HOURS_12.forEach((_, idx) => {
        const prop = HOUR_PROP(idx) as keyof HourlyLoad;
        const val = patch[prop];
        if (val !== undefined && typeof val === 'number') {
          cleanPatch[prop] = val;
        }
      });
      if (patch.material_type !== undefined) {
        cleanPatch.material_type = patch.material_type;
      }
      if ('excavator_id' in patch) {
        cleanPatch.excavator_id = patch.excavator_id || null;
      }

      const res = await saveHourlyLoad({
        departmentId,
        machineId,
        loadDate: today,
        shiftType,
        loadId: loadId.startsWith('local-') ? null : loadId,
        patch: cleanPatch,
      });

      if (!res?.success) {
        throw new Error('Failed to save hourly load');
      }

      if (res.load?.id && loadId.startsWith('local-')) {
        setLoadsState((prev) => {
          const hasDbRow = prev.some((l) => l.id === res.load.id);
          if (hasDbRow) {
            return prev.filter((l) => l.id !== loadId);
          }
          return prev.map((l) => (l.id === loadId ? { ...res.load, ...l, id: res.load.id } : l));
        });
      }

      return res.load;
    },
    [departmentId, today]
  );

  /**
   * Rolls a field back to its previous value on failure.
   */
  const revertField = useCallback(
    (
      loadId: string,
      field: string,
      newValue: number | string | null,
      previousValue: number | string | null
    ) => {
      setLoadsState((prev) => {
        const existing = prev.find((load) => load.id === loadId);
        if (!existing || existing[field as keyof HourlyLoad] !== newValue) return prev;
        const reverted = {
          ...existing,
          [field]: previousValue,
        } as HourlyLoad;
        reverted.total_loads = sumHourlyTotal(reverted);
        return prev.map((load) => (load === existing ? reverted : load));
      });
    },
    []
  );

  /**
   * Shared optimistic write path: apply locally, persist in the background.
   */
  const commitLoadChange = useCallback(
    async (
      loadId: string,
      machineId: string,
      shiftType: HourlyShift,
      field: string,
      previousValue: number | string | null,
      newValue: number | string | null,
      patch: Partial<HourlyLoad>,
      operation: string,
      attrs: Record<string, string | number | null | undefined>
    ) => {
      applyLoadState(loadId, machineId, shiftType, patch);
      try {
        await trackClientMetric(operation, () => persistLoad(loadId, machineId, shiftType, patch), {
          department_id: departmentId,
          machine_id: machineId,
          load_id: loadId,
          ...attrs,
        });
      } catch (err) {
        logError(err, {
          context: `hourly_loads_${operation}`,
        });
        revertField(loadId, field, newValue, previousValue);
        toast.error('Failed to save. Please try again.');
      }
    },
    [applyLoadState, persistLoad, revertField, departmentId]
  );

  // Handle increment/decrement for a specific cell
  const handleCellChange = useCallback(
    async (rowIndex: number, hourProp: string, delta: number) => {
      const row = source[rowIndex];
      if (!row) return;

      const hourIndex = parseInt(hourProp.split('_')[1] ?? '0', 10) - 1;
      const hourNum = hourIndex + 1;

      if (!isHourEditable(row, hourNum)) {
        return;
      }

      const currentValue = (row[hourProp] as number) || 0;
      const newValue = Math.max(0, Math.min(100, currentValue + delta));
      if (newValue === currentValue) return;

      await commitLoadChange(
        row.loadId,
        row.machineId,
        selectedShift,
        hourProp,
        currentValue,
        newValue,
        { [hourProp]: newValue },
        'hourly_loads_update',
        {
          hour_prop: hourProp,
          previous_value: currentValue,
          new_value: newValue,
          operation: 'increment_decrement',
        }
      );
    },
    [source, selectedShift, commitLoadChange]
  );

  // Handle toggling material type for a row
  const handleMaterialToggle = useCallback(
    async (rowIndex: number) => {
      const row = source[rowIndex];
      if (!row || row.isLocked) return;

      const currentMaterial = row.materialType as HourlyMaterial;
      const newMaterial: HourlyMaterial = currentMaterial === 'Waste' ? 'Coal' : 'Waste';

      await commitLoadChange(
        row.loadId,
        row.machineId,
        selectedShift,
        'material_type',
        currentMaterial,
        newMaterial,
        { material_type: newMaterial },
        'hourly_loads_material_toggle',
        {
          field: 'material_type',
          previous_value: currentMaterial,
          new_value: newMaterial,
          operation: 'toggle_material',
        }
      );
    },
    [source, selectedShift, commitLoadChange]
  );

  // Handle excavator assignment change for a row
  const handleExcavatorAssignment = useCallback(
    async (rowIndex: number, newExcavatorId: string | null) => {
      const row = source[rowIndex];
      if (!row || row.isLocked) return;

      const currentExcavatorId = row.excavatorId || null;
      if (newExcavatorId === currentExcavatorId) return;

      const inheritedMaterial = newExcavatorId
        ? (excavatorMaterials[newExcavatorId] ?? 'Waste')
        : (row.materialType as HourlyMaterial) || 'Waste';

      await commitLoadChange(
        row.loadId,
        row.machineId,
        selectedShift,
        'excavator_id',
        currentExcavatorId,
        newExcavatorId,
        {
          excavator_id: newExcavatorId,
          material_type: inheritedMaterial,
        },
        'hourly_loads_excavator_assign',
        {
          field: 'excavator_id',
          previous_value: currentExcavatorId,
          new_value: newExcavatorId,
          operation: 'assign_excavator',
        }
      );
    },
    [source, selectedShift, excavatorMaterials, commitLoadChange]
  );

  // Handle split creation
  const handleCreateSplit = async () => {
    if (!splitMachineId) {
      toast.warning('Please select a haul truck to split.');
      return;
    }
    if (splitStartHour < 2 || splitStartHour > 12) {
      toast.warning('Split start hour must be between Hour 2 and Hour 12.');
      return;
    }

    setIsSubmittingSplit(true);
    try {
      const res = await splitMachineHourlyLoad({
        departmentId,
        machineId: splitMachineId,
        loadDate: today,
        shiftType: selectedShift,
        startHour: splitStartHour,
        excavatorId: splitExcavatorId || null,
        materialType: splitMaterial,
      });

      if (res.success && res.newLoad) {
        const prevEndHour = Math.max(1, splitStartHour - 1);
        setLoadsState((prev) => {
          const updated = prev.map((l) => {
            if (l.machine_id === splitMachineId && l.shift_type === selectedShift && !l.is_locked) {
              return {
                ...l,
                is_locked: true,
                end_hour: prevEndHour,
              };
            }
            return l;
          });
          return [...updated, res.newLoad as HourlyLoad];
        });
        setIsSplitModalOpen(false);
      }
    } catch (err) {
      logError(err, { context: 'create_hourly_load_split' });
      toast.error('Failed to add machine split. Please try again.');
    } finally {
      setIsSubmittingSplit(false);
    }
  };

  // Handle grid click for up/down buttons and material toggle
  const handleGridClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;

      const toggleBtn = target.closest('[data-action="toggle-material"]') as HTMLElement | null;
      if (toggleBtn) {
        const rowIndex = parseInt(toggleBtn.dataset.row || '0', 10);
        handleMaterialToggle(rowIndex);
        return;
      }

      const button = target.closest(
        '[data-action="up"], [data-action="down"]'
      ) as HTMLElement | null;
      if (!button) return;

      const rowIndex = parseInt(button.dataset.row || '0', 10);
      const hourProp = button.dataset.hour;
      const action = button.dataset.action;

      if (!hourProp || !action) return;

      const delta = action === 'up' ? 1 : -1;
      handleCellChange(rowIndex, hourProp, delta);
    },
    [handleCellChange, handleMaterialToggle]
  );

  // Handle excavator dropdown change
  const handleGridChange = useCallback(
    async (e: React.FormEvent) => {
      const target = e.target as HTMLSelectElement;
      if (target.dataset.action !== 'select-excavator') return;

      const rowIndex = parseInt(target.dataset.row || '0', 10);
      const newExcavatorId = target.value || null;

      await handleExcavatorAssignment(rowIndex, newExcavatorId);
    },
    [handleExcavatorAssignment]
  );

  // Handle keyboard arrow increment/decrement on focused cells
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return;

      const cellOrButton = (target.closest('[data-hour]') ||
        target.querySelector('[data-hour]')) as HTMLElement | null;
      if (!cellOrButton) return;

      const rowIndexStr = cellOrButton.dataset.row;
      const hourProp = cellOrButton.dataset.hour;
      if (!rowIndexStr || !hourProp) return;

      const rowIndex = parseInt(rowIndexStr, 10);
      const delta = e.key === 'ArrowUp' ? 1 : -1;
      e.preventDefault();
      handleCellChange(rowIndex, hourProp, delta);
    },
    [handleCellChange]
  );

  const handleDirectNumberEdit = useCallback(
    async (rowIndex: number, hourProp: string, value: number) => {
      const row = source[rowIndex];
      if (!row) return;

      const hourIndex = parseInt(hourProp.split('_')[1] ?? '0', 10) - 1;
      const hourNum = hourIndex + 1;

      if (!isHourEditable(row, hourNum)) {
        toast.warning('This hour is locked for this machine segment.');
        applyLoadState(row.loadId, row.machineId, selectedShift, {
          [hourProp]: Number(row[hourPropName(hourIndex)] || 0),
        });
        return;
      }

      const currentValue = (row[hourProp] as number) || 0;
      const clampedValue = Math.max(0, Math.min(100, Number.isNaN(value) ? 0 : value));

      if (clampedValue === currentValue) return;

      await commitLoadChange(
        row.loadId,
        row.machineId,
        selectedShift,
        hourProp,
        currentValue,
        clampedValue,
        { [hourProp]: clampedValue },
        'hourly_loads_direct_edit',
        { hour_prop: hourProp, value: clampedValue, operation: 'direct_edit' }
      );
    },
    [source, selectedShift, applyLoadState, commitLoadChange]
  );

  const [machineSearch, setMachineSearch] = useState('');
  const [excavatorFilter, setExcavatorFilter] = useState('');

  const {
    hourTotals,
    grandTotalLoads,
    grandTotalMaterial,
    hourlySeries,
    activeMachinesCount,
    avgLoadsPerMachine,
    wasteTotalLoads,
    coalTotalLoads,
    peakHour,
    maxHourLoads,
  } = useMemo(
    () => computeHourlyLoadsTelemetry(source, hourLabels, machines.length),
    [source, hourLabels, machines.length]
  );

  const filteredRows = useMemo(() => {
    const query = machineSearch.trim().toLowerCase();
    return source
      .map((row, originalRowIndex) => ({ row, originalRowIndex }))
      .filter(({ row }) => {
        const matchesMachine =
          !query ||
          String(row.machineName || '')
            .toLowerCase()
            .includes(query) ||
          String(row.machineType || '')
            .toLowerCase()
            .includes(query);
        const matchesExcavator =
          !excavatorFilter ||
          (excavatorFilter === '__unassigned__'
            ? !row.excavatorId
            : row.excavatorId === excavatorFilter);
        return matchesMachine && matchesExcavator;
      });
  }, [source, machineSearch, excavatorFilter]);

  if (machines.length === 0) {
    return (
      <GlassCard>
        <p className="py-8 text-center text-[var(--text-muted)] text-sm">
          No machines available. Add machines in the Machine DB tab first.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <HourlyLoadsTelemetryHeader
        selectedShift={selectedShift}
        grandTotalLoads={grandTotalLoads}
        grandTotalMaterial={grandTotalMaterial}
        activeMachinesCount={activeMachinesCount}
        machinesCount={machines.length}
        avgLoadsPerMachine={avgLoadsPerMachine}
        peakHour={peakHour}
        wasteTotalLoads={wasteTotalLoads}
        coalTotalLoads={coalTotalLoads}
        hourlySeries={hourlySeries}
        maxHourLoads={maxHourLoads}
      />

      {/* Shift Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-[var(--text-muted)] text-sm">Shift:</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedShift('day')}
              className={`rounded-lg px-4 py-2 font-medium text-sm transition-colors ${
                selectedShift === 'day'
                  ? 'bg-arch-accent-blue text-arch-surface-secondary'
                  : 'border border-arch-border-primary bg-arch-surface-secondary text-arch-text-tertiary hover:text-arch-text-primary'
              }`}
            >
              Day (06:00 - 17:59)
            </button>
            <button
              type="button"
              onClick={() => setSelectedShift('night')}
              className={`rounded-lg px-4 py-2 font-medium text-sm transition-colors ${
                selectedShift === 'night'
                  ? 'bg-arch-accent-blue text-arch-surface-secondary'
                  : 'border border-arch-border-primary bg-arch-surface-secondary text-arch-text-tertiary hover:text-arch-text-primary'
              }`}
            >
              Night (18:00 - 05:59)
            </button>
          </div>
        </div>
      </div>

      {/* Main Loads Data Grid */}
      <div
        ref={containerRef}
        onClick={handleGridClick}
        onChange={handleGridChange}
        onKeyDown={handleGridKeyDown}
        className="revo-grid-visible"
      >
        <GlassCard className="overflow-hidden border border-[var(--border-default)] bg-[var(--bg-primary)] p-0 shadow-sm">
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/60 font-semibold text-[var(--text-muted)] text-xs">
                  <th
                    scope="col"
                    className="sticky left-0 z-20 min-w-[180px] bg-[var(--bg-secondary)] px-3 py-2.5 text-left align-top shadow-[1px_0_0_0_var(--border-default)]"
                  >
                    <div className="space-y-1.5">
                      <span className="block font-bold text-[var(--text-heading)] text-xs">
                        Machine
                      </span>
                      <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2 text-[var(--text-muted)]" />
                        <input
                          type="text"
                          value={machineSearch}
                          onChange={(e) => setMachineSearch(e.target.value)}
                          placeholder="Search machine..."
                          aria-label="Search machine"
                          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] py-1 pr-6 pl-6 font-normal text-[11px] text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                        />
                        {machineSearch && (
                          <button
                            type="button"
                            onClick={() => setMachineSearch('')}
                            aria-label="Clear machine search"
                            className="absolute top-1/2 right-1.5 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-heading)]"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </th>
                  <th scope="col" className="min-w-[165px] px-3 py-2.5 text-left align-top">
                    <div className="space-y-1.5">
                      <span className="block font-bold text-[var(--text-heading)] text-xs">
                        Excavator Assigned
                      </span>
                      <select
                        value={excavatorFilter}
                        onChange={(e) => setExcavatorFilter(e.target.value)}
                        aria-label="Filter by assigned excavator"
                        className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 font-normal text-[11px] text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                      >
                        <option value="">All Excavators</option>
                        <option value="__unassigned__">Unassigned</option>
                        {excavators.map((exc) => (
                          <option key={exc.id} value={exc.id}>
                            {exc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>
                  {HOURS_12.map((_, index) => (
                    <th
                      key={HOUR_PROP(index)}
                      scope="col"
                      className="min-w-[80px] px-1 py-3 text-center"
                    >
                      {hourLabels[index]}:00
                    </th>
                  ))}
                  <th scope="col" className="min-w-[70px] px-3 py-3 text-right">
                    Total
                  </th>
                  {hasBinFactors && (
                    <>
                      <th scope="col" className="min-w-[70px] px-2 py-3 text-right">
                        Bin Factor
                      </th>
                      <th scope="col" className="min-w-[100px] px-3 py-3 text-right">
                        Total Material (t)
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]/60 text-[var(--text-heading)] text-xs">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2 + 12 + 1 + (hasBinFactors ? 2 : 0)}
                      className="py-10 text-center text-[var(--text-muted)] text-sm"
                    >
                      {source.length === 0
                        ? 'No machine load records found for this shift.'
                        : 'No machines match the current search or excavator filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map(({ row, originalRowIndex }) => {
                    const isLocked = Boolean(row.isLocked);
                    const isSplit = Boolean(row.isSplit);

                    return (
                      <tr
                        key={row.rowKey || `row-${originalRowIndex}`}
                        className={`transition-colors hover:bg-[var(--bg-secondary)]/40 ${
                          isLocked ? 'bg-black/[0.015]' : ''
                        }`}
                      >
                        {/* Machine Column (sticky left) */}
                        <td className="sticky left-0 z-10 bg-[var(--bg-primary)] px-3 py-2.5 font-medium shadow-[1px_0_0_0_var(--border-default)]">
                          <div className="flex min-w-[140px] max-w-[180px] items-center gap-1.5">
                            <span
                              className={`truncate font-semibold text-xs ${
                                isLocked
                                  ? 'text-[var(--text-muted)] line-through decoration-black/20'
                                  : 'text-[var(--text-heading)]'
                              }`}
                              title={row.machineName}
                            >
                              {row.machineName}
                            </span>
                            {isLocked ? (
                              <span
                                className="inline-flex shrink-0 items-center gap-0.5 rounded bg-black/[0.06] px-1 py-0.5 font-semibold text-[10px] text-[var(--text-muted)]"
                                title="Previous segment locked"
                              >
                                <Lock className="h-2.5 w-2.5" />
                                Locked
                              </span>
                            ) : isSplit ? (
                              <span className="shrink-0 rounded bg-[var(--accent-blue)]/15 px-1 py-0.5 font-semibold text-[10px] text-[var(--accent-blue)]">
                                Split
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Excavator Assigned Column */}
                        <td className="min-w-[150px] px-3 py-2.5">
                          <select
                            data-row={String(originalRowIndex)}
                            data-action="select-excavator"
                            value={row.excavatorId || ''}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleExcavatorAssignment(originalRowIndex, e.target.value || null);
                            }}
                            disabled={isLocked}
                            className={`w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-1 font-medium text-xs ${
                              isLocked
                                ? 'cursor-not-allowed text-[var(--text-muted)] opacity-60'
                                : 'cursor-pointer text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]'
                            } transition-colors`}
                          >
                            <option value="">Select Excavator</option>
                            {excavators.map((excavator) => (
                              <option key={excavator.id} value={excavator.id}>
                                {excavator.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* 12 Hour Columns */}
                        {HOURS_12.map((_, hourIdx) => {
                          const hourProp = HOUR_PROP(hourIdx);
                          const hourNum = hourIdx + 1;
                          const value = (row[hourProp] as number) || 0;
                          const editable = isHourEditable(row, hourNum);

                          return (
                            <HourCell
                              key={`${row.rowKey || originalRowIndex}-${hourProp}`}
                              value={value}
                              rowIndex={originalRowIndex}
                              hourProp={hourProp}
                              hourLabel={hourLabels[hourIdx] ?? ''}
                              editable={editable}
                              isLocked={isLocked}
                              startHour={row.startHour}
                              endHour={row.endHour}
                              onStep={handleCellChange}
                              onDirectEdit={handleDirectNumberEdit}
                            />
                          );
                        })}

                        {/* Total Column */}
                        <td className="min-w-[70px] px-3 py-2.5 text-right font-bold font-mono text-[var(--text-heading)] text-xs tabular-nums">
                          {row.total ?? 0}
                        </td>

                        {/* Bin Factor & Total Material Columns */}
                        {hasBinFactors && (
                          <>
                            <td className="min-w-[70px] px-2 py-2.5 text-right font-mono text-[var(--text-muted)] text-xs tabular-nums">
                              {row.binFactor ?? '-'}
                            </td>
                            <td className="min-w-[100px] px-3 py-2.5 text-right font-mono font-semibold text-[var(--text-heading)] text-xs tabular-nums">
                              {row.totalMaterial ?? '-'}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="border-[var(--border-default)] border-t-2 bg-[var(--bg-secondary)]/80 font-semibold text-[var(--text-heading)] text-xs">
                <tr>
                  <td className="sticky left-0 z-10 bg-[var(--bg-secondary)] px-3 py-3 text-left font-bold shadow-[1px_0_0_0_var(--border-default)]">
                    Total Loads
                  </td>
                  <td className="px-3 py-3 text-left text-[var(--text-muted)]">—</td>
                  {HOURS_12.map((_, index) => (
                    <td
                      key={`footer-hour-${HOUR_PROP(index)}`}
                      className="px-1 py-3 text-center font-bold font-mono text-[var(--text-heading)] text-xs tabular-nums"
                    >
                      {hourTotals[index] ?? 0}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right font-bold font-mono text-[var(--accent-blue)] text-xs tabular-nums">
                    {grandTotalLoads}
                  </td>
                  {hasBinFactors && (
                    <>
                      <td className="px-2 py-3 text-right font-mono text-[var(--text-muted)] text-xs">
                        —
                      </td>
                      <td className="px-3 py-3 text-right font-bold font-mono text-[var(--accent-blue)] text-xs tabular-nums">
                        {grandTotalMaterial > 0 ? `${grandTotalMaterial} t` : '-'}
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </GlassCard>
      </div>

      <HourlyLoadsSplitSection
        isSplitModalOpen={isSplitModalOpen}
        isSubmittingSplit={isSubmittingSplit}
        splitMachineId={splitMachineId}
        splitExcavatorId={splitExcavatorId}
        splitMaterial={splitMaterial}
        splitStartHour={splitStartHour}
        machines={machines}
        excavators={excavators}
        sites={sites}
        excavatorSites={excavatorSites}
        hourLabels={hourLabels}
        onOpenSplitModal={() => setIsSplitModalOpen(true)}
        onCloseSplitModal={() => !isSubmittingSplit && setIsSplitModalOpen(false)}
        onSplitMachineChange={setSplitMachineId}
        onSplitExcavatorChange={setSplitExcavatorId}
        onSplitMaterialChange={setSplitMaterial}
        onSplitStartHourChange={setSplitStartHour}
        onConfirmSplit={handleCreateSplit}
      />
    </div>
  );
}

// AGENT-TRACE: Memoize HourlyLoadsGrid — the heaviest client component in the
// portal. Props (departmentId, machines, loads, etc.) are stable across renders;
// memo prevents re-rendering the entire RevoGrid + cell edit machinery.
const MemoizedHourlyLoadsGrid = memo(HourlyLoadsGrid);

export { MemoizedHourlyLoadsGrid as HourlyLoadsGrid };
