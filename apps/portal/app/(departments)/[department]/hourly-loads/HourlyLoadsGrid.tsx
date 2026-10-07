'use client';

import { useSupabaseRealtime } from '@repo/shared/hooks';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { AnimatedDialog } from '@repo/ui';
import { GlassCard } from '@repo/ui/GlassCard';
import { SecondaryButton } from '@repo/ui/SecondaryButton';
import { exportToExcel } from '@repo/utils/client';
import { Download, Lock, Plus } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { DataGrid } from '@/components/dynamic/LazyHeavyComponents';
import { logError } from '@/lib/errors/error-logger';
import { trackClientMetric } from '@/lib/observability/client-telemetry';
import {
  saveHourlyLoad,
  splitMachineHourlyLoad,
  updateExcavatorSite,
  updateHourlyLoadExcavator,
} from './actions';

import {
  buildHourlyLoadsGroupedMap,
  HOUR_PROP,
  HOURS_12,
  type HourlyLoad,
  type HourlyMaterial,
  type HourlyShift,
  isHourEditable,
  loadKey,
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

interface HourlyLoadsGridProps {
  departmentId: string;
  machines: Machine[];
  excavators: Excavator[];
  hourlyLoads: HourlyLoad[];
  sites: { id: string; name: string; site_code: string }[];
  /** Operational date (Africa/Johannesburg) from the server — never derive on the client. */
  today: string;
  /** Shift active at first render, resolved on the server to avoid UTC drift. */
  initialShift?: HourlyShift;
}

const DAY_HOUR_LABELS = ['06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17'];
const NIGHT_HOUR_LABELS = ['18', '19', '20', '21', '22', '23', '00', '01', '02', '03', '04', '05'];

function HourlyLoadsGrid({
  departmentId,
  machines,
  excavators,
  hourlyLoads,
  sites,
  today,
  initialShift,
}: HourlyLoadsGridProps) {
  const supabase = createBrowserSupabaseClient();

  // AGENT-TRACE: The grid owns its load/site state so edits apply optimistically.
  // No router.refresh() anywhere — each change updates local state instantly and
  // persists in the background, so the page never reloads between values.
  const [loadsState, setLoadsState] = useState<HourlyLoad[]>(hourlyLoads);
  const [excavatorSites, setExcavatorSites] = useState<Record<string, string>>(() =>
    Object.fromEntries(excavators.map((e) => [e.id, e.site_id ?? '']))
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

  // Build RevoGrid source rows (including mid-shift splits)
  const source = useMemo(() => {
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
  }, [machines, groupedLoadsByMachine, selectedShift, hourLabels, hasBinFactors]);

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
          return prev.map((l) => (l.id === loadId ? { ...l, ...res.load, id: res.load.id } : l));
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

      await commitLoadChange(
        row.loadId,
        row.machineId,
        selectedShift,
        'excavator_id',
        currentExcavatorId,
        newExcavatorId,
        { excavator_id: newExcavatorId },
        'hourly_loads_excavator_assign',
        {
          field: 'excavator_id',
          previous_value: currentExcavatorId,
          new_value: newExcavatorId,
          operation: 'assign_excavator',
        }
      );
    },
    [source, selectedShift, commitLoadChange]
  );

  // Handle excavator site assignment change
  const handleExcavatorSiteChange = useCallback(
    async (excavatorId: string, newSiteId: string | null) => {
      const prevSiteId = excavatorSites[excavatorId] ?? '';
      if ((newSiteId || '') === prevSiteId) return;

      setExcavatorSites((prev) => ({ ...prev, [excavatorId]: newSiteId || '' }));
      try {
        await updateExcavatorSite(excavatorId, newSiteId || null);
      } catch (err) {
        logError(err, { context: 'update_excavator_site' });
        setExcavatorSites((prev) => ({ ...prev, [excavatorId]: prevSiteId }));
        toast.error('Failed to update excavator site.');
      }
    },
    [excavatorSites]
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

  // Build RevoGrid columns
  const columns = useMemo(() => {
    const width = containerWidth || 1150;

    let machineColSize = 140;
    let excavatorColSize = 140;
    let materialColSize = 100;
    let hourColSize = 88;
    let totalColSize = 70;
    let binFactorColSize = 80;
    let totalMaterialColSize = 100;

    if (hasBinFactors) {
      machineColSize = Math.max(160, Math.floor(width * 0.12));
      excavatorColSize = Math.max(130, Math.floor(width * 0.1));
      materialColSize = Math.max(90, Math.floor(width * 0.08));
      hourColSize = Math.max(88, Math.floor(width * 0.045));
      totalColSize = Math.max(76, Math.floor(width * 0.055));
      binFactorColSize = Math.max(76, Math.floor(width * 0.055));
      totalMaterialColSize = Math.max(95, Math.floor(width * 0.075));
    } else {
      machineColSize = Math.max(160, Math.floor(width * 0.14));
      excavatorColSize = Math.max(130, Math.floor(width * 0.12));
      materialColSize = Math.max(90, Math.floor(width * 0.08));
      hourColSize = Math.max(88, Math.floor(width * 0.055));
      totalColSize = Math.max(76, Math.floor(width * 0.045));
    }

    const cols = [
      {
        prop: 'machineName',
        name: 'Machine',
        size: machineColSize,
        pin: 'colPinStart' as const,
        cellTemplate: (h: any, { model }: { model: any }) => {
          const isLocked = Boolean(model?.isLocked);
          const isSplit = Boolean(model?.isSplit);
          return h('div', { class: 'flex items-center gap-1.5 h-full w-full px-2 text-xs' }, [
            h(
              'span',
              {
                class: `font-medium truncate ${
                  isLocked
                    ? 'text-[var(--text-muted)] line-through decoration-black/20'
                    : 'text-[var(--text-heading)]'
                }`,
              },
              model?.machineName ?? ''
            ),
            isLocked
              ? h(
                  'span',
                  {
                    class:
                      'inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[10px] font-semibold bg-black/[0.06] text-[var(--text-muted)]',
                    title: 'Previous segment locked',
                  },
                  [
                    h(
                      'svg',
                      {
                        xmlns: 'http://www.w3.org/2000/svg',
                        width: '9',
                        height: '9',
                        viewBox: '0 0 24 24',
                        fill: 'none',
                        stroke: 'currentColor',
                        'stroke-width': '2.5',
                        'stroke-linecap': 'round',
                        'stroke-linejoin': 'round',
                      },
                      [
                        h('rect', { width: '18', height: '11', x: '3', y: '11', rx: '2', ry: '2' }),
                        h('path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }),
                      ]
                    ),
                    'Locked',
                  ]
                )
              : isSplit
                ? h(
                    'span',
                    {
                      class:
                        'px-1 py-0.2 rounded text-[10px] font-semibold bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]',
                    },
                    'Split'
                  )
                : null,
          ]);
        },
      },
      {
        prop: 'excavatorId',
        name: 'Excavator Assigned',
        size: excavatorColSize,
        pin: 'colPinStart' as const,
        sortable: false,
        readonly: true,
        cellTemplate: (h: any, { rowIndex, model }: { rowIndex: number; model: any }) => {
          const currentExcavatorId = model?.excavatorId || '';
          const isLocked = Boolean(model?.isLocked);
          return h('div', { class: 'flex items-center justify-center h-full w-full px-1' }, [
            h(
              'select',
              {
                class: `w-full bg-transparent border-0 text-xs font-semibold ${
                  isLocked
                    ? 'text-[var(--text-muted)] cursor-not-allowed opacity-60'
                    : 'text-arch-text-secondary cursor-pointer hover:bg-[var(--overlay-subtle)]'
                } focus:ring-0 focus:outline-none py-1 px-1 rounded transition-all`,
                'data-row': String(rowIndex),
                'data-action': 'select-excavator',
                disabled: isLocked ? true : undefined,
              },
              [
                h(
                  'option',
                  {
                    value: '',
                    selected: !currentExcavatorId ? 'selected' : undefined,
                  },
                  'Select Excavator'
                ),
                ...excavators.map((e) =>
                  h(
                    'option',
                    {
                      value: e.id,
                      selected: e.id === currentExcavatorId ? 'selected' : undefined,
                    },
                    e.name
                  )
                ),
              ]
            ),
          ]);
        },
      },
      {
        prop: 'materialType',
        name: 'Material',
        size: materialColSize,
        pin: 'colPinStart' as const,
        sortable: false,
        readonly: true,
        cellTemplate: (h: any, { rowIndex, model }: { rowIndex: number; model: any }) => {
          const value = model?.materialType ?? 'Waste';
          const isCoal = value === 'Coal';
          const isLocked = Boolean(model?.isLocked);
          return h('div', { class: 'flex items-center justify-center h-full w-full px-1' }, [
            h(
              'button',
              {
                class: `px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wider transition-all duration-150 ${
                  isLocked
                    ? 'opacity-60 cursor-not-allowed bg-arch-surface-primary text-arch-text-tertiary border-arch-border-subtle'
                    : isCoal
                      ? 'cursor-pointer bg-arch-text-primary text-white border-arch-text-primary hover:bg-arch-text-secondary'
                      : 'cursor-pointer bg-arch-surface-primary text-arch-text-tertiary border-arch-border-subtle hover:bg-arch-surface-tertiary'
                }`,
                'data-row': String(rowIndex),
                'data-action': 'toggle-material',
                disabled: isLocked ? true : undefined,
                title: isLocked ? 'Segment locked' : 'Click to toggle between Waste and Coal',
              },
              value
            ),
          ]);
        },
      },
      ...HOURS_12.map((_, index) => {
        const hourProp = HOUR_PROP(index);
        const hourNum = index + 1;
        return {
          prop: hourProp,
          name: `${hourLabels[index]}:00`,
          size: hourColSize,
          sortable: false,
          readonly: false,
          cellTemplate: (h: any, { rowIndex, model }: { rowIndex: number; model: any }) => {
            const value = model?.[hourProp] ?? 0;
            const startHour = model?.startHour ?? 1;
            const endHour = model?.endHour ?? 12;
            const isEditable = !model?.isLocked && hourNum >= startHour && hourNum <= endHour;

            if (!isEditable) {
              return h(
                'div',
                {
                  class:
                    'flex items-center justify-between px-1 gap-1 h-full bg-black/[0.02] select-none text-[var(--text-muted)]',
                  title: model?.isLocked
                    ? 'Segment locked'
                    : `Active hours: ${hourLabels[startHour - 1]}:00 - ${hourLabels[endHour - 1]}:59`,
                },
                [
                  h(
                    'span',
                    { class: 'text-xs font-mono tabular-nums px-1 opacity-70' },
                    value > 0 ? value : '-'
                  ),
                  h(
                    'svg',
                    {
                      xmlns: 'http://www.w3.org/2000/svg',
                      width: '10',
                      height: '10',
                      viewBox: '0 0 24 24',
                      fill: 'none',
                      stroke: 'currentColor',
                      'stroke-width': '2.5',
                      'stroke-linecap': 'round',
                      'stroke-linejoin': 'round',
                      class: 'opacity-40 mr-1',
                    },
                    [
                      h('rect', { width: '18', height: '11', x: '3', y: '11', rx: '2', ry: '2' }),
                      h('path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }),
                    ]
                  ),
                ]
              );
            }

            const isMax = value >= 100;
            const isMin = value <= 0;
            return h(
              'div',
              {
                class:
                  'flex items-center justify-between px-1 gap-1 h-full outline-none focus-within:ring-1 focus-within:ring-[var(--accent-blue)] focus:ring-1 focus:ring-[var(--accent-blue)] rounded-sm',
                tabIndex: 0,
                'data-row': String(rowIndex),
                'data-hour': hourProp,
                'data-cell-type': 'hour-load',
                role: 'gridcell',
                'aria-label': `${hourLabels[index]}:00 loads: ${value}. Use Arrow Up or Arrow Down to adjust`,
              },
              [
                h(
                  'span',
                  { class: 'text-sm font-medium font-mono tabular-nums px-1 cursor-text select-none' },
                  value
                ),
                h('div', { class: 'flex items-center gap-0.5' }, [
                  h(
                    'button',
                    {
                      type: 'button',
                      class:
                        'hour-btn-up relative flex items-center justify-center min-w-[32px] min-h-[32px] w-8 h-8 p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[var(--accent-blue)] text-[var(--text-muted)] transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)] touch-manipulation after:absolute after:-inset-1',
                      'data-row': String(rowIndex),
                      'data-hour': hourProp,
                      'data-action': 'up',
                      'aria-label': `Increase loads for hour ${hourLabels[index]}:00 (currently ${value})`,
                      title: `Increase loads for hour ${hourLabels[index]}:00`,
                      disabled: isMax,
                      style: isMax ? { opacity: '0.3', cursor: 'not-allowed' } : undefined,
                    },
                    h(
                      'svg',
                      {
                        xmlns: 'http://www.w3.org/2000/svg',
                        width: '14',
                        height: '14',
                        viewBox: '0 0 24 24',
                        fill: 'none',
                        stroke: 'currentColor',
                        'stroke-width': '2.5',
                        'stroke-linecap': 'round',
                        'stroke-linejoin': 'round',
                        'aria-hidden': 'true',
                      },
                      h('path', { d: 'm18 15-6-6-6 6' })
                    )
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      class:
                        'hour-btn-down relative flex items-center justify-center min-w-[32px] min-h-[32px] w-8 h-8 p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[var(--accent-blue)] text-[var(--text-muted)] transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)] touch-manipulation after:absolute after:-inset-1',
                      'data-row': String(rowIndex),
                      'data-hour': hourProp,
                      'data-action': 'down',
                      'aria-label': `Decrease loads for hour ${hourLabels[index]}:00 (currently ${value})`,
                      title: `Decrease loads for hour ${hourLabels[index]}:00`,
                      disabled: isMin,
                      style: isMin ? { opacity: '0.3', cursor: 'not-allowed' } : undefined,
                    },
                    h(
                      'svg',
                      {
                        xmlns: 'http://www.w3.org/2000/svg',
                        width: '14',
                        height: '14',
                        viewBox: '0 0 24 24',
                        fill: 'none',
                        stroke: 'currentColor',
                        'stroke-width': '2.5',
                        'stroke-linecap': 'round',
                        'stroke-linejoin': 'round',
                        'aria-hidden': 'true',
                      },
                      h('path', { d: 'm6 9 6 6 6-6' })
                    )
                  ),
                ]),
              ]
            );
          },
        };
      }),
      {
        prop: 'total',
        name: 'Total',
        size: totalColSize,
        readonly: true,
        cellTemplate: (h: any, { model }: { model: any }) => {
          return h(
            'div',
            {
              class:
                'flex items-center h-full w-full px-2 text-sm font-mono tabular-nums font-semibold',
            },
            model?.total ?? 0
          );
        },
      },
    ];

    if (hasBinFactors) {
      cols.push({
        prop: 'binFactor',
        name: 'Bin Factor',
        size: binFactorColSize,
        readonly: true,
        cellTemplate: (h: any, { model }: { model: any }) => {
          return h(
            'div',
            {
              class:
                'flex items-center h-full w-full px-2 text-sm font-mono tabular-nums text-[var(--text-muted)]',
            },
            model?.binFactor ?? '-'
          );
        },
      });
      cols.push({
        prop: 'totalMaterial',
        name: 'Total Material (t)',
        size: totalMaterialColSize,
        readonly: true,
        cellTemplate: (h: any, { model }: { model: any }) => {
          return h(
            'div',
            {
              class:
                'flex items-center h-full w-full px-2 text-sm font-mono tabular-nums font-medium',
            },
            model?.totalMaterial ?? '-'
          );
        },
      });
    }

    return cols;
  }, [hourLabels, hasBinFactors, containerWidth, excavators]);

  const handleAfterEdit = useCallback(
    async (e: any) => {
      const detail = e?.detail ?? e;
      const prop: string = detail?.prop;
      const rowIndex: number = detail?.rowIndex ?? detail?.row?.index;
      const val = detail?.val;

      if (typeof rowIndex !== 'number' || !prop?.startsWith('hour_') || val === undefined) return;

      const row = source[rowIndex];
      if (!row) return;

      const hourIndex = parseInt(prop.split('_')[1] ?? '0', 10) - 1;
      const hourNum = hourIndex + 1;

      if (!isHourEditable(row, hourNum)) {
        toast.warning('This hour is locked for this machine segment.');
        applyLoadState(row.loadId, row.machineId, selectedShift, {
          [prop]: row[hourPropName(hourIndex)],
        });
        return;
      }

      const currentValue = (row[prop] as number) || 0;
      const value = parseInt(String(val), 10) || 0;

      if (value < 0 || value > 100) {
        toast.warning('Please enter a value between 0 and 100');
        applyLoadState(row.loadId, row.machineId, selectedShift, { [prop]: currentValue });
        return;
      }

      if (value === currentValue) return;

      await commitLoadChange(
        row.loadId,
        row.machineId,
        selectedShift,
        prop,
        currentValue,
        value,
        { [prop]: value },
        'hourly_loads_direct_edit',
        { hour_prop: prop, value, operation: 'direct_edit' }
      );
    },
    [source, selectedShift, applyLoadState, commitLoadChange]
  );

  const handleExport = async () => {
    const exportData = source.map((row) => {
      const assignedExcavatorId = row.excavatorId;
      const excavatorName =
        (assignedExcavatorId && excavators.find((e) => e.id === assignedExcavatorId)?.name) ||
        'None';
      const data: any = {
        Machine: row.machineName,
        'Excavator Assigned': excavatorName,
        Type: row.machineType,
        Material: row.materialType,
        Status: row.isLocked ? 'Locked' : 'Active',
      };
      HOURS_12.forEach((_, index) => {
        const label = `${hourLabels[index]}:00`;
        data[label] = row[HOUR_PROP(index)] ?? 0;
      });
      data.Total = row.total ?? 0;
      if (hasBinFactors) {
        data['Bin Factor'] = row.binFactor;
        data['Total Material (t)'] = row.totalMaterial;
      }
      return data;
    });

    await exportToExcel(exportData, `hourly-loads-${selectedShift}-${today}`, 'Hourly Loads');
  };

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
      {/* Shift Selector & Actions */}
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

        <div className="flex gap-2">
          <SecondaryButton size="sm" variant="rounded-lg" onClick={handleExport} disabled={saving}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </SecondaryButton>
        </div>
      </div>

      {/* Excavator Site Assignment Panel */}
      <GlassCard className="p-4 bg-[var(--vibrancy-surface)] border border-black/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-heading)]">
              Excavator Location / Site Mapping
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Assign each Excavator to a Site. Hauling trucks assigned to the Excavator
              automatically inherit this location.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {excavators.map((excavator) => (
            <div
              key={excavator.id}
              className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)]"
            >
              <div className="flex flex-col pr-2">
                <span className="text-xs font-semibold text-[var(--text-heading)]">
                  {excavator.name}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">Excavator</span>
              </div>
              <select
                value={excavatorSites[excavator.id] || ''}
                onChange={(e) => handleExcavatorSiteChange(excavator.id, e.target.value || null)}
                className="bg-transparent border border-[var(--border-default)] rounded px-2 py-1 text-xs font-medium text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
              >
                <option value="">No Site</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {excavators.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] col-span-full">
              No active excavators found. Please add excavators in Machine DB.
            </p>
          )}
        </div>
      </GlassCard>

      {/* Main Loads Data Grid */}
      <div
        ref={containerRef}
        onClick={handleGridClick}
        onChange={handleGridChange}
        onKeyDown={handleGridKeyDown}
        className="revo-grid-visible"
      >
        <DataGrid
          key={`grid-${containerWidth}-${columns.length}-${source.length}`}
          columns={columns}
          source={source}
          height="500px"
          resize={false}
          filter={false}
          sorting={false}
          onAfterEdit={handleAfterEdit}
          stretch="all"
        />
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
