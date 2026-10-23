'use client';

import { useSupabaseRealtime } from '@repo/shared/hooks';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { AnimatedDialog } from '@repo/ui';
import { GlassCard } from '@repo/ui/GlassCard';
import { Logo } from '@repo/ui/Logo';
import { SecondaryButton } from '@repo/ui/SecondaryButton';
import { Activity, Lock, Minus, Plus, Search, TrendingUp, Truck, X } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { logError } from '@/lib/errors/error-logger';
import { trackClientMetric } from '@/lib/observability/client-telemetry';
import { saveHourlyLoad, splitMachineHourlyLoad, updateHourlyLoadExcavator } from './actions';

import {
  buildHourlyLoadsGroupedMap,
  HOUR_PROP,
  HOURS_12,
  type HourlyLoad,
  type HourlyMaterial,
  type HourlyShift,
  isHourEditable,
  loadKey,
  parseExcavatorMaterial,
  sumHourlyTotal,
} from './loads-utils';

interface Machine {
  id: string;
  name: string;
  machine_type: string;
  bin_factor?: number | null;
  site_id?: string | null;
}

interface Excavator {
  id: string;
  name: string;
  machine_type: string;
  site_id?: string | null;
  sites?: { name: string } | { name: string }[] | null;
}

interface MineBlockOption {
  id: string;
  name: string;
  code: string;
  site_id: string | null;
}

interface ExcavatorActivitySummary {
  id: string;
  machine_id: string;
  site_id: string | null;
  block_mined_id: string | null;
  material_type: string | null;
  shift_type: string;
}

interface HourlyLoadsGridProps {
  departmentId: string;
  machines: Machine[];
  excavators: Excavator[];
  hourlyLoads: HourlyLoad[];
  sites: { id: string; name: string; site_code: string }[];
  mineBlocks?: MineBlockOption[];
  excavatorActivities?: ExcavatorActivitySummary[];
  mineralRegistry?: {
    waste: string[];
    coal: string[];
  };
  /** Operational date (Africa/Johannesburg) from the server — never derive on the client. */
  today: string;
  /** Shift active at first render, resolved on the server to avoid UTC drift. */
  initialShift?: HourlyShift;
}

const DAY_HOUR_LABELS = ['06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17'];
const NIGHT_HOUR_LABELS = ['18', '19', '20', '21', '22', '23', '00', '01', '02', '03', '04', '05'];

interface HourCellProps {
  value: number;
  rowIndex: number;
  hourProp: string;
  hourLabel?: string;
  editable: boolean;
  isLocked: boolean;
  startHour?: number;
  endHour?: number;
  onStep: (rowIndex: number, hourProp: string, delta: number) => void;
  onDirectEdit: (rowIndex: number, hourProp: string, value: number) => void;
}

const HourCell = memo(function HourCell({
  value,
  rowIndex,
  hourProp,
  hourLabel,
  editable,
  isLocked,
  startHour,
  endHour,
  onStep,
  onDirectEdit,
}: HourCellProps) {
  const [localVal, setLocalVal] = useState<string>(String(value));

  useEffect(() => {
    setLocalVal(String(value));
  }, [value]);

  if (!editable) {
    return (
      <td
        className="py-2 px-1 text-center bg-black/[0.02]"
        title={
          isLocked ? 'Segment locked' : `Active hours: ${startHour ?? 1}:00 - ${endHour ?? 12}:59`
        }
      >
        <div className="flex items-center justify-center gap-1 text-[var(--text-muted)] opacity-60">
          <span className="font-mono text-xs">{value > 0 ? value : '-'}</span>
          <Lock className="w-2.5 h-2.5 opacity-50" />
        </div>
      </td>
    );
  }

  const commitValue = () => {
    const parsed = parseInt(localVal, 10);
    const valid = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed));
    setLocalVal(String(valid));
    if (valid !== value) {
      onDirectEdit(rowIndex, hourProp, valid);
    }
  };

  return (
    <td className="py-1.5 px-1 text-center">
      <div
        className="inline-flex items-center justify-center gap-0.5 rounded border border-[var(--border-default)]/60 bg-[var(--bg-secondary)]/50 p-0.5 focus-within:border-[var(--accent-blue)] focus-within:ring-1 focus-within:ring-[var(--accent-blue)]"
        data-row={String(rowIndex)}
        data-hour={hourProp}
      >
        <button
          type="button"
          data-row={String(rowIndex)}
          data-hour={hourProp}
          data-action="down"
          onClick={(e) => {
            e.stopPropagation();
            onStep(rowIndex, hourProp, -1);
          }}
          disabled={value <= 0}
          aria-label={`Decrease ${hourLabel}:00 loads`}
          title={`Decrease ${hourLabel}:00 loads`}
          className="h-6 w-5 inline-flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text-heading)] disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="w-3 h-3" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={commitValue}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitValue();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              onStep(rowIndex, hourProp, 1);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              onStep(rowIndex, hourProp, -1);
            }
          }}
          className="w-7 text-center font-mono text-xs font-semibold py-0.5 bg-transparent text-[var(--text-heading)] focus:outline-none"
        />
        <button
          type="button"
          data-row={String(rowIndex)}
          data-hour={hourProp}
          data-action="up"
          onClick={(e) => {
            e.stopPropagation();
            onStep(rowIndex, hourProp, 1);
          }}
          disabled={value >= 100}
          aria-label={`Increase ${hourLabel}:00 loads`}
          title={`Increase ${hourLabel}:00 loads`}
          className="h-6 w-5 inline-flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text-heading)] disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </td>
  );
});

function HourlyLoadsGrid({
  departmentId,
  machines,
  excavators,
  hourlyLoads,
  sites,
  mineBlocks = [],
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
  const [saving, setSaving] = useState(false);

  // Track container width for responsive column sizing
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width - 2);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const groupedLoadsByMachine = useMemo(() => buildHourlyLoadsGroupedMap(loadsState), [loadsState]);

  const hourLabels = selectedShift === 'day' ? DAY_HOUR_LABELS : NIGHT_HOUR_LABELS;

  // Check if any machine in this department has a bin_factor set
  const hasBinFactors = machines.some((m) => m.bin_factor != null && m.bin_factor > 0);

  const [asyncSource, setAsyncSource] = useState<Record<string, any>[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const workerVersionRef = useRef<number>(0);
  const latestReceivedVersionRef = useRef<number>(0);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./aggregation.worker.ts', import.meta.url));
    workerRef.current.onmessage = (e) => {
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

  // Build RevoGrid source rows (including mid-shift splits)
  const syncSource = useMemo(() => {
    if (isLargeDataset) return [];
    const rows: Record<string, any>[] = [];

    machines.forEach((machine) => {
      const machineLoads = (
        groupedLoadsByMachine.get(loadKey(machine.id, selectedShift)) || []
      ).slice();
      const binFactor = machine.bin_factor ?? 0;

      if (machineLoads.length === 0) {
        const virtualLoadId = `local-${machine.id}-${selectedShift}`;
        const row: Record<string, any> = {
          rowKey: `${machine.id}:${selectedShift}:default`,
          loadId: virtualLoadId,
          machineId: machine.id,
          machineName: machine.name,
          baseMachineName: machine.name,
          excavatorId: '',
          machineType: machine.machine_type,
          materialType: 'Waste',
          startHour: 1,
          endHour: 12,
          isLocked: false,
          isSplit: false,
          total: 0,
        };
        HOURS_12.forEach((_, index) => {
          row[HOUR_PROP(index)] = 0;
        });
        if (hasBinFactors) {
          row.binFactor = binFactor > 0 ? binFactor : '-';
          row.totalMaterial = '-';
        }
        rows.push(row);
      } else {
        machineLoads.sort((a, b) => (a.start_hour ?? 1) - (b.start_hour ?? 1));
        machineLoads.forEach((load) => {
          const startHour = load.start_hour ?? 1;
          const endHour = load.end_hour ?? 12;
          const isLocked = Boolean(load.is_locked);
          const isSplit = machineLoads.length > 1;
          const startLabel = hourLabels[startHour - 1] ?? '06';
          const endLabel = hourLabels[endHour - 1] ?? '17';
          const segmentLabel = isSplit
            ? `${machine.name} (${startLabel}:00 - ${endLabel}:59)`
            : machine.name;

          const totalLoads = load.total_loads ?? sumHourlyTotal(load);
          const row: Record<string, any> = {
            rowKey: load.id,
            loadId: load.id,
            machineId: machine.id,
            machineName: segmentLabel,
            baseMachineName: machine.name,
            excavatorId: load.excavator_id || '',
            machineType: machine.machine_type,
            materialType: load.material_type || 'Waste',
            startHour,
            endHour,
            isLocked,
            isSplit,
            total: totalLoads,
          };
          HOURS_12.forEach((_, index) => {
            row[HOUR_PROP(index)] = (load[HOUR_PROP(index) as keyof HourlyLoad] as number) || 0;
          });
          if (hasBinFactors) {
            row.binFactor = binFactor > 0 ? binFactor : '-';
            row.totalMaterial =
              binFactor > 0 && totalLoads > 0 ? Math.round(totalLoads * binFactor * 10) / 10 : '-';
          }
          rows.push(row);
        });
      }
    });

    return rows;
  }, [isLargeDataset, machines, groupedLoadsByMachine, selectedShift, hourLabels, hasBinFactors]);

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
      setAsyncSource((prev) => {
        if (!prev || prev.length === 0) return prev;
        let changed = false;
        const next = prev.map((row) => {
          if (row.loadId === loadId) {
            changed = true;
            const updatedRow: Record<string, any> = { ...row, ...patch };
            let newTotal = 0;
            HOURS_12.forEach((_, idx) => {
              const val = updatedRow[HOUR_PROP(idx)];
              newTotal += typeof val === 'number' ? val : 0;
            });
            updatedRow.total = newTotal;
            if (updatedRow.binFactor && updatedRow.binFactor !== '-') {
              updatedRow.totalMaterial = Math.round(newTotal * updatedRow.binFactor * 10) / 10;
            }
            if (patch.excavator_id !== undefined) {
              updatedRow.excavatorId = patch.excavator_id || '';
            }
            if (patch.material_type !== undefined) {
              updatedRow.materialType = patch.material_type;
            }
            return updatedRow;
          }
          return row;
        });
        return changed ? next : prev;
      });
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
      const cleanPatch: Record<string, any> = {};
      HOURS_12.forEach((_, idx) => {
        const prop = HOUR_PROP(idx) as keyof HourlyLoad;
        if (patch[prop] !== undefined && typeof patch[prop] === 'number') {
          cleanPatch[prop] = patch[prop];
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
          // 1. Lock previous loads for this machine
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
          // 2. Add new load segment
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
          [hourProp]: row[hourPropName(hourIndex)],
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
  } = useMemo(() => {
    let cumulative = 0;
    const series = HOURS_12.map((_, index) => {
      const prop = HOUR_PROP(index);
      let waste = 0;
      let coal = 0;
      source.forEach((row) => {
        const val = typeof row[prop] === 'number' ? row[prop] : 0;
        if (row.materialType === 'Coal') {
          coal += val;
        } else {
          waste += val;
        }
      });
      const total = waste + coal;
      cumulative += total;
      return {
        hourLabel: `${hourLabels[index] ?? '00'}:00`,
        shortLabel: hourLabels[index] ?? '00',
        wasteLoads: waste,
        coalLoads: coal,
        totalLoads: total,
        cumulativeLoads: cumulative,
      };
    });

    const totals = series.map((s) => s.totalLoads);

    const grandLoads = source.reduce(
      (acc, row) => acc + (typeof row.total === 'number' ? row.total : 0),
      0
    );

    const grandMaterial = source.reduce((acc, row) => {
      const val = typeof row.totalMaterial === 'number' ? row.totalMaterial : 0;
      return acc + val;
    }, 0);

    const activeMachineIds = new Set<string>();
    let wasteLoadsSum = 0;
    let coalLoadsSum = 0;

    source.forEach((row) => {
      const rowTotal = typeof row.total === 'number' ? row.total : 0;
      if (rowTotal > 0 || row.excavatorId) {
        activeMachineIds.add(String(row.machineId));
      }
      if (row.materialType === 'Coal') {
        coalLoadsSum += rowTotal;
      } else {
        wasteLoadsSum += rowTotal;
      }
    });

    const peak = series.reduce(
      (best, curr) => (curr.totalLoads > best.totalLoads ? curr : best),
      series[0] ?? {
        hourLabel: `${hourLabels[0] ?? '06'}:00`,
        shortLabel: hourLabels[0] ?? '06',
        wasteLoads: 0,
        coalLoads: 0,
        totalLoads: 0,
        cumulativeLoads: 0,
      }
    );

    const maxLoads = Math.max(1, ...series.map((s) => s.totalLoads));

    return {
      hourTotals: totals,
      grandTotalLoads: grandLoads,
      grandTotalMaterial: Math.round(grandMaterial * 10) / 10,
      hourlySeries: series,
      activeMachinesCount: activeMachineIds.size,
      avgLoadsPerMachine:
        machines.length > 0 ? Math.round((grandLoads / machines.length) * 10) / 10 : 0,
      wasteTotalLoads: wasteLoadsSum,
      coalTotalLoads: coalLoadsSum,
      peakHour: peak,
      maxHourLoads: maxLoads,
    };
  }, [source, hourLabels, machines.length]);

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
        <p className="text-[var(--text-muted)] text-sm text-center py-8">
          No machines available. Add machines in the Machine DB tab first.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Live KPI Telemetry & Dynamic Shift Timeline Graph */}
      <GlassCard className="p-4 sm:p-5 bg-[var(--vibrancy-surface)] border border-black/[0.06] space-y-4">
        {/* Redesigned Live KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {/* KPI 1: Total Loads Captured */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] shadow-xs">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
                Total Shift Loads
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono tabular-nums text-[var(--text-heading)]">
                  {grandTotalLoads}
                </span>
                <span className="text-[11px] font-medium text-[var(--accent-blue)]">
                  {selectedShift === 'day' ? 'Day Shift' : 'Night Shift'}
                </span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)] block">
                {grandTotalMaterial > 0
                  ? `${grandTotalMaterial.toLocaleString()} t total material`
                  : 'Real-time shift tally'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20 flex items-center justify-center text-[var(--accent-blue)] shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          {/* KPI 2: Machines Active */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] shadow-xs">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
                Machines Active
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold font-mono tabular-nums text-[var(--text-heading)]">
                  {activeMachinesCount}
                </span>
                <span className="text-xs font-medium text-[var(--text-muted)]">
                  / {machines.length} fleet
                </span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)] block">
                {machines.length > 0
                  ? `${Math.round((activeMachinesCount / machines.length) * 100)}% fleet utilization`
                  : 'No fleet configured'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-green)]/10 border border-[var(--accent-green)]/20 flex items-center justify-center text-[var(--accent-green)] shrink-0">
              <Truck className="w-5 h-5" />
            </div>
          </div>

          {/* KPI 3: Avg Loads / Machine */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] shadow-xs">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
                Avg Loads / Machine
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono tabular-nums text-[var(--text-heading)]">
                  {avgLoadsPerMachine}
                </span>
                <span className="text-[11px] font-medium text-[var(--text-muted)]">loads/unit</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)] block">
                Peak:{' '}
                {peakHour.totalLoads > 0
                  ? `${peakHour.hourLabel} (${peakHour.totalLoads})`
                  : 'No loads yet'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-amber)]/15 border border-[var(--accent-amber)]/30 flex items-center justify-center text-[var(--accent-amber)] shrink-0">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          {/* KPI 4: Waste vs Coal Split */}
          <div className="flex flex-col justify-between p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Material Split
              </span>
              <span className="text-[11px] font-mono font-semibold text-[var(--text-heading)]">
                W: {wasteTotalLoads} · C: {coalTotalLoads}
              </span>
            </div>
            <div className="my-2 h-2 w-full rounded-full bg-black/[0.06] overflow-hidden flex">
              <div
                className="h-full bg-[var(--accent-blue)] transition-all duration-300"
                style={{
                  width: `${
                    grandTotalLoads > 0 ? Math.round((wasteTotalLoads / grandTotalLoads) * 100) : 50
                  }%`,
                }}
                title={`Waste: ${wasteTotalLoads} loads`}
              />
              <div
                className="h-full bg-neutral-800 transition-all duration-300"
                style={{
                  width: `${
                    grandTotalLoads > 0
                      ? 100 - Math.round((wasteTotalLoads / grandTotalLoads) * 100)
                      : 50
                  }%`,
                }}
                title={`Coal: ${coalTotalLoads} loads`}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--accent-blue)]" />
                Waste (
                {grandTotalLoads > 0 ? Math.round((wasteTotalLoads / grandTotalLoads) * 100) : 0}%)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-neutral-800" />
                Coal (
                {grandTotalLoads > 0 ? Math.round((coalTotalLoads / grandTotalLoads) * 100) : 0}%)
              </span>
            </div>
          </div>
        </div>

        {/* Live Hourly Timeline Graph */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)]/80 border border-[var(--border-default)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Logo variant="gold" className="w-4 h-4 shrink-0" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-heading)]">
                  Live Hourly Production Timeline (
                  {selectedShift === 'day' ? '06:00 – 17:00' : '18:00 – 05:00'})
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Updates dynamically as hourly machine loads are captured across the shift
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-medium text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[var(--accent-blue)]" />
                Waste Loads
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-neutral-800" />
                Coal Loads
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[var(--text-heading)]">
                Cumulative: <strong>{grandTotalLoads}</strong>
              </span>
            </div>
          </div>

          {/* 12-Hour Interactive Bar + Cumulative Progress Timeline */}
          <div className="grid grid-cols-12 gap-1.5 sm:gap-2 pt-2 items-end h-28">
            {hourlySeries.map((slot) => {
              const heightPct =
                slot.totalLoads > 0
                  ? Math.max(12, Math.round((slot.totalLoads / maxHourLoads) * 100))
                  : 4;
              const wastePct =
                slot.totalLoads > 0 ? Math.round((slot.wasteLoads / slot.totalLoads) * 100) : 100;
              const coalPct = 100 - wastePct;

              return (
                <div
                  key={slot.hourLabel}
                  className="flex flex-col items-center h-full justify-end group"
                  title={`${slot.hourLabel} — Total: ${slot.totalLoads} (Waste: ${slot.wasteLoads}, Coal: ${slot.coalLoads}) · Cumulative: ${slot.cumulativeLoads}`}
                >
                  <span
                    className={`text-[10px] font-mono font-bold tabular-nums mb-1 transition-colors ${
                      slot.totalLoads > 0
                        ? 'text-[var(--text-heading)]'
                        : 'text-[var(--text-muted)] opacity-50'
                    }`}
                  >
                    {slot.totalLoads}
                  </span>
                  <div className="w-full max-w-[38px] bg-black/[0.04] rounded-t-md h-16 flex flex-col justify-end overflow-hidden border border-black/[0.05]">
                    {slot.totalLoads > 0 ? (
                      <div
                        className="w-full flex flex-col justify-end transition-all duration-300 rounded-t-sm overflow-hidden"
                        style={{ height: `${heightPct}%` }}
                      >
                        {slot.coalLoads > 0 && (
                          <div
                            className="w-full bg-neutral-800 transition-all duration-300"
                            style={{ height: `${coalPct}%` }}
                          />
                        )}
                        {slot.wasteLoads > 0 && (
                          <div
                            className="w-full bg-[var(--accent-blue)] transition-all duration-300"
                            style={{ height: `${wastePct}%` }}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-1 bg-black/[0.08]" />
                    )}
                  </div>
                  <span className="mt-1.5 text-[10px] font-mono font-medium text-[var(--text-muted)] group-hover:text-[var(--text-heading)]">
                    {slot.shortLabel}:00
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </GlassCard>

      {/* Shift Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-[var(--text-muted)] text-sm">Shift:</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedShift('day')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedShift === 'day'
                  ? 'bg-arch-accent-blue text-arch-surface-secondary'
                  : 'bg-arch-surface-secondary border border-arch-border-primary text-arch-text-tertiary hover:text-arch-text-primary'
              }`}
            >
              Day (06:00 - 17:59)
            </button>
            <button
              type="button"
              onClick={() => setSelectedShift('night')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedShift === 'night'
                  ? 'bg-arch-accent-blue text-arch-surface-secondary'
                  : 'bg-arch-surface-secondary border border-arch-border-primary text-arch-text-tertiary hover:text-arch-text-primary'
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
        <GlassCard className="p-0 overflow-hidden border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-sm">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/60 text-xs font-semibold text-[var(--text-muted)]">
                  <th
                    scope="col"
                    className="py-2.5 px-3 text-left min-w-[180px] sticky left-0 z-20 bg-[var(--bg-secondary)] shadow-[1px_0_0_0_var(--border-default)] align-top"
                  >
                    <div className="space-y-1.5">
                      <span className="block text-xs font-bold text-[var(--text-heading)]">
                        Machine
                      </span>
                      <div className="relative">
                        <Search className="w-3 h-3 text-[var(--text-muted)] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={machineSearch}
                          onChange={(e) => setMachineSearch(e.target.value)}
                          placeholder="Search machine..."
                          aria-label="Search machine"
                          className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-md pl-6 pr-6 py-1 text-[11px] font-normal text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                        />
                        {machineSearch && (
                          <button
                            type="button"
                            onClick={() => setMachineSearch('')}
                            aria-label="Clear machine search"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-heading)]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-left min-w-[165px] align-top">
                    <div className="space-y-1.5">
                      <span className="block text-xs font-bold text-[var(--text-heading)]">
                        Excavator Assigned
                      </span>
                      <select
                        value={excavatorFilter}
                        onChange={(e) => setExcavatorFilter(e.target.value)}
                        aria-label="Filter by assigned excavator"
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-md px-2 py-1 text-[11px] font-normal text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
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
                      className="py-3 px-1 text-center min-w-[80px]"
                    >
                      {hourLabels[index]}:00
                    </th>
                  ))}
                  <th scope="col" className="py-3 px-3 text-right min-w-[70px]">
                    Total
                  </th>
                  {hasBinFactors && (
                    <>
                      <th scope="col" className="py-3 px-2 text-right min-w-[70px]">
                        Bin Factor
                      </th>
                      <th scope="col" className="py-3 px-3 text-right min-w-[100px]">
                        Total Material (t)
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]/60 text-xs text-[var(--text-heading)]">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2 + 12 + 1 + (hasBinFactors ? 2 : 0)}
                      className="py-10 text-center text-sm text-[var(--text-muted)]"
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
                        <td className="py-2.5 px-3 font-medium sticky left-0 z-10 bg-[var(--bg-primary)] shadow-[1px_0_0_0_var(--border-default)]">
                          <div className="flex items-center gap-1.5 min-w-[140px] max-w-[180px]">
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
                                className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-semibold bg-black/[0.06] text-[var(--text-muted)] shrink-0"
                                title="Previous segment locked"
                              >
                                <Lock className="w-2.5 h-2.5" />
                                Locked
                              </span>
                            ) : isSplit ? (
                              <span className="px-1 py-0.5 rounded text-[10px] font-semibold bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] shrink-0">
                                Split
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Excavator Assigned Column */}
                        <td className="py-2.5 px-3 min-w-[150px]">
                          <select
                            data-row={String(originalRowIndex)}
                            data-action="select-excavator"
                            value={row.excavatorId || ''}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleExcavatorAssignment(originalRowIndex, e.target.value || null);
                            }}
                            disabled={isLocked}
                            className={`w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-md px-2 py-1 text-xs font-medium ${
                              isLocked
                                ? 'text-[var(--text-muted)] cursor-not-allowed opacity-60'
                                : 'text-[var(--text-heading)] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]'
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
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-xs text-[var(--text-heading)] tabular-nums min-w-[70px]">
                          {row.total ?? 0}
                        </td>

                        {/* Bin Factor & Total Material Columns */}
                        {hasBinFactors && (
                          <>
                            <td className="py-2.5 px-2 text-right font-mono text-xs text-[var(--text-muted)] tabular-nums min-w-[70px]">
                              {row.binFactor ?? '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-xs text-[var(--text-heading)] tabular-nums min-w-[100px]">
                              {row.totalMaterial ?? '-'}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="border-t-2 border-[var(--border-default)] bg-[var(--bg-secondary)]/80 text-xs font-semibold text-[var(--text-heading)]">
                <tr>
                  <td className="py-3 px-3 text-left sticky left-0 z-10 bg-[var(--bg-secondary)] shadow-[1px_0_0_0_var(--border-default)] font-bold">
                    Total Loads
                  </td>
                  <td className="py-3 px-3 text-left text-[var(--text-muted)]">—</td>
                  {HOURS_12.map((_, index) => (
                    <td
                      key={`footer-hour-${HOUR_PROP(index)}`}
                      className="py-3 px-1 text-center font-mono font-bold text-xs tabular-nums text-[var(--text-heading)]"
                    >
                      {hourTotals[index] ?? 0}
                    </td>
                  ))}
                  <td className="py-3 px-3 text-right font-mono font-bold text-xs text-[var(--accent-blue)] tabular-nums">
                    {grandTotalLoads}
                  </td>
                  {hasBinFactors && (
                    <>
                      <td className="py-3 px-2 text-right text-[var(--text-muted)] font-mono text-xs">
                        —
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-xs text-[var(--accent-blue)] tabular-nums">
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

      {/* Bottom Action Area: Split Shift / Machine Lineup Change */}
      <GlassCard className="p-4 bg-[var(--vibrancy-surface)] border border-black/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-heading)]">
              Mid-Shift Machine Lineup & Excavator Reassignment
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] max-w-2xl">
            Need to swap an excavator, change materials, or reassign a haul truck mid-day? Click
            below to add a split segment. The previous hours will automatically lock to ensure no
            duplicate work or double-counting occurs.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsSplitModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Machine Split / Excavator Swap</span>
        </button>
      </GlassCard>

      {/* Mid-Shift Split Modal Dialog */}
      <AnimatedDialog
        open={isSplitModalOpen}
        onClose={() => !isSubmittingSplit && setIsSplitModalOpen(false)}
        title="Add Mid-Shift Machine Split"
        description="Reassign a haul truck mid-shift to a different excavator or material. Previous hours will be locked against editing."
        className="max-w-md"
      >
        <div className="space-y-4 mt-2">
          {/* Machine Selection */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1">
              Select Haul Truck
            </label>
            <select
              value={splitMachineId}
              onChange={(e) => setSplitMachineId(e.target.value)}
              disabled={isSubmittingSplit}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
            >
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.machine_type})
                </option>
              ))}
            </select>
          </div>

          {/* Excavator Selection */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1">
              Assigned Excavator
            </label>
            <select
              value={splitExcavatorId}
              onChange={(e) => setSplitExcavatorId(e.target.value)}
              disabled={isSubmittingSplit}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
            >
              <option value="">No Excavator Assigned</option>
              {excavators.map((e) => {
                const site = sites.find((s) => s.id === excavatorSites[e.id]);
                return (
                  <option key={e.id} value={e.id}>
                    {e.name} {site ? `(${site.name})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Material Selection */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1">
              Material Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSplitMaterial('Waste')}
                className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-all ${
                  splitMaterial === 'Waste'
                    ? 'bg-arch-surface-primary text-arch-text-primary border-arch-border-primary font-semibold shadow-xs'
                    : 'bg-transparent text-[var(--text-muted)] border-[var(--border-default)]'
                }`}
              >
                Waste
              </button>
              <button
                type="button"
                onClick={() => setSplitMaterial('Coal')}
                className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-all ${
                  splitMaterial === 'Coal'
                    ? 'bg-arch-text-primary text-white border-arch-text-primary font-semibold shadow-xs'
                    : 'bg-transparent text-[var(--text-muted)] border-[var(--border-default)]'
                }`}
              >
                Coal
              </button>
            </div>
          </div>

          {/* Switch-over Start Hour */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1">
              Effective Starting Hour
            </label>
            <select
              value={splitStartHour}
              onChange={(e) => setSplitStartHour(parseInt(e.target.value, 10))}
              disabled={isSubmittingSplit}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
            >
              {HOURS_12.slice(1).map((hourNum) => (
                <option key={hourNum} value={hourNum}>
                  Hour {hourNum} ({hourLabels[hourNum - 1]}:00 - {hourLabels[hourNum - 1]}:59)
                </option>
              ))}
            </select>
          </div>

          {/* Information & Locking Preview */}
          <div className="p-3 rounded-lg bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20 text-xs text-[var(--text-heading)] space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-[var(--accent-blue)]">
              <Lock className="w-3.5 h-3.5" />
              <span>Locking & Double-Counting Safeguard</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              • Previous log will lock for Hours 1 to {splitStartHour - 1} ({hourLabels[0]}:00 to{' '}
              {hourLabels[splitStartHour - 2]}:59).
              <br />• New log will only accept loads from Hour {splitStartHour} (
              {hourLabels[splitStartHour - 1]}:00) onwards.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton
              size="sm"
              variant="rounded-lg"
              onClick={() => setIsSplitModalOpen(false)}
              disabled={isSubmittingSplit}
            >
              Cancel
            </SecondaryButton>
            <button
              type="button"
              onClick={handleCreateSplit}
              disabled={isSubmittingSplit}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {isSubmittingSplit ? 'Adding Split...' : 'Confirm & Add Split'}
            </button>
          </div>
        </div>
      </AnimatedDialog>
    </div>
  );
}

function hourPropName(hourIndex: number): string {
  return HOUR_PROP(hourIndex);
}

// AGENT-TRACE: Memoize HourlyLoadsGrid — the heaviest client component in the
// portal. Props (departmentId, machines, loads, etc.) are stable across renders;
// memo prevents re-rendering the entire RevoGrid + cell edit machinery.
const MemoizedHourlyLoadsGrid = memo(HourlyLoadsGrid);

export { MemoizedHourlyLoadsGrid as HourlyLoadsGrid };
