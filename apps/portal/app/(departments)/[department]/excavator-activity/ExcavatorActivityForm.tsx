'use client';

import { useSupabaseRealtime } from '@repo/shared/hooks';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import { Logo } from '@repo/ui/Logo';
import { cn } from '@repo/ui/lib/utils';
import { getCurrentShift } from '@repo/utils/client';
import { LazyMotion, MotionConfig, m, useReducedMotion } from 'framer-motion';
import { Check, Plus, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Fragment,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { logError } from '@/lib/errors/error-logger';
import { quickAddMineBlock, updateExcavatorAssignmentConfig } from '../hourly-loads/actions';
import {
  EXCAVATOR_ACTIVITY_MATERIALS,
  type ExcavatorActivityMaterial,
  formatExcavatorMaterial,
  getMaterialSubCategories,
  type HourlyLoadSegmentSummary,
  type HourlyShift,
  isRegularMachineExcavatorActivity,
  isValidSubCategoryForMaterial,
  normalizeQuickBlockFormat,
  parseExcavatorMaterial,
} from '../hourly-loads/loads-utils';
import { saveExcavatorShiftTelemetry } from './actions';
import { ExcavatorLoadsTable } from './ExcavatorLoadsTable';
import {
  type ExcavatorOperatorOption,
  ExcavatorShiftTelemetryControls,
  type ExcavatorShiftTelemetryDraft,
} from './ExcavatorShiftTelemetryControls';
import {
  CARD_TOP_HIGHLIGHT_CLASS,
  EXCAVATOR_CARD_CLASS,
  FIELD_LABEL_CLASS,
  GOLD_FIELD_CLASS,
  MATERIAL_PILL_ACTIVE_STYLE,
  MATERIAL_PILL_ACTIVE_TEXT,
  MATERIAL_PILL_PILL_CLASS,
  MATERIAL_SEGMENT_BUTTON_CLASS,
  MATERIAL_SEGMENT_IDLE_TEXT,
  MATERIAL_SEGMENT_SHELL_CLASS,
  PILL_SPRING,
  REDUCED_MOTION_TRANSITION,
  SECTION_BOX_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_STAGGER_VARIANTS,
} from './excavator-activity-styles';
import {
  buildExcavatorLoadTable,
  buildExcavatorShiftTelemetryKey,
  buildInitialShiftTelemetryMap,
  type ExcavatorShiftSmrDefaults,
  sortExcavatorsForLog,
  validateStopSmrCap,
} from './excavator-shift-helpers';

/** Async-loaded domMax features (layout / layoutId animations) for the material selector. */
const loadMotionFeatures = () => import('framer-motion').then((mod) => mod.domMax);

interface ExcavatorMachine {
  id: string;
  name: string;
  machine_type: string;
  serial_number: string | null;
  site_id?: string | null;
  starting_smr?: number | null;
}

interface DumperMachine {
  id: string;
  name: string;
  machine_type: string;
  bin_factor: number | null;
  site_id: string | null;
}

interface Site {
  id: string;
  name: string;
  site_code: string;
}

interface MineBlock {
  id: string;
  name: string;
  code: string;
  site_id: string | null;
}

interface ExcavatorActivityConfig {
  id?: string;
  machine_id: string;
  shift_type: string;
  site_id?: string | null;
  block_mined_id?: string | null;
  material_type?: string | null;
  operator_id?: string | null;
  notes?: string | null;
  activity_date?: string;
}

interface SavedDumperAssignment {
  id: string;
  excavator_activity_id: string;
  dumper_machine_id: string;
  material_type: string;
  total_loads: number;
  total_bcm: number | null;
}

interface ExcavatorActivityFormProps {
  departmentId: string;
  excavators: ExcavatorMachine[];
  dumpers: DumperMachine[];
  operators?: ExcavatorOperatorOption[];
  sites?: Site[];
  mineBlocks: MineBlock[];
  todayDumperLoads: HourlyLoadSegmentSummary[];
  todayActivities?: ExcavatorActivityConfig[];
  todayAssignments?: SavedDumperAssignment[];
  initialShiftTelemetry?: Record<string, ExcavatorShiftSmrDefaults>;
  /** Logged delay hours per `${excavatorId}|${shift}` (machine_operations_with_delays). */
  shiftDelayHours?: Record<string, number>;
  mineralRegistry?: {
    waste: string[];
    coal: string[];
  };
  today?: string;
  initialShift?: HourlyShift;
}

const GOLDEN_SEPARATOR_CLASS =
  'h-px w-full bg-gradient-to-r from-accent-gold/80 via-accent-gold/25 to-transparent';

const REGULAR_DIVIDER_CLASS =
  'col-span-full flex items-center gap-2 pt-1 font-bold text-[11px] text-[var(--text-heading)] uppercase tracking-wider';

const QUICK_ADD_BTN_CLASS = cn(
  'gold-steel-border gold-steel-border-slim inline-flex h-[31px] w-[31px] shrink-0 cursor-pointer',
  'items-center justify-center rounded-lg border border-accent-gold/55 bg-[var(--bg-primary)]',
  'text-[var(--text-heading)] shadow-2xs transition-colors hover:bg-accent-gold/15'
);

function resolveNextSubCategory(
  newMaterial: ExcavatorActivityMaterial,
  context: {
    readonly prevSubCategory: string;
    readonly mineralRegistry: ExcavatorActivityFormProps['mineralRegistry'];
  }
): string {
  return isValidSubCategoryForMaterial(
    newMaterial,
    context.prevSubCategory,
    context.mineralRegistry
  )
    ? context.prevSubCategory
    : '';
}

interface ExcavatorMaterialTransitionInput {
  readonly excavatorId: string;
  readonly newMaterial: ExcavatorActivityMaterial;
  readonly excavatorMaterials: Record<string, ExcavatorActivityMaterial>;
  readonly excavatorMaterialSubCategories: Record<string, string>;
  readonly excavatorSites: Record<string, string>;
  readonly excavatorBlocks: Record<string, string>;
  readonly mineralRegistry: ExcavatorActivityFormProps['mineralRegistry'];
}

function buildExcavatorMaterialTransition(input: ExcavatorMaterialTransitionInput) {
  const prevMaterial = input.excavatorMaterials[input.excavatorId] ?? 'Waste';
  const prevSubCategory = input.excavatorMaterialSubCategories[input.excavatorId] ?? '';
  const nextSubCategory = resolveNextSubCategory(input.newMaterial, {
    prevSubCategory,
    mineralRegistry: input.mineralRegistry,
  });
  return {
    prevMaterial,
    prevSubCategory,
    nextSubCategory,
    currentSiteId: input.excavatorSites[input.excavatorId] || null,
    currentBlockId: input.excavatorBlocks[input.excavatorId] || null,
    nextFormattedMaterial: formatExcavatorMaterial(input.newMaterial, nextSubCategory || null),
    prevFormattedMaterial: formatExcavatorMaterial(prevMaterial, prevSubCategory || null),
  };
}

function notifyRegularMachineMaterial(
  excavators: readonly ExcavatorMachine[],
  target: { readonly excavatorId: string; readonly newMaterial: ExcavatorActivityMaterial }
): void {
  if (!isRegularMachineExcavatorActivity(target.newMaterial)) return;
  const machineName = excavators.find((e) => e.id === target.excavatorId)?.name ?? 'Excavator';
  toast.success(`${machineName} set to ${target.newMaterial} (logged as regular machine).`);
}

function adjustPendingMutationCount(
  counts: Record<string, number>,
  adjustment: { readonly excavatorId: string; readonly delta: 1 | -1 }
): void {
  const current = counts[adjustment.excavatorId] ?? 0;
  counts[adjustment.excavatorId] = Math.max(0, current + adjustment.delta);
}

function updateLoadsMaterial(
  prev: HourlyLoadSegmentSummary[],
  excavatorId: string,
  shift: HourlyShift,
  material: ExcavatorActivityMaterial
): HourlyLoadSegmentSummary[] {
  if (material !== 'Waste' && material !== 'Coal') return prev;
  return prev.map((load) =>
    load.excavator_id === excavatorId && load.shift_type === shift && !load.is_locked
      ? { ...load, material_type: material }
      : load
  );
}

export function ExcavatorActivityForm({
  departmentId,
  excavators,
  dumpers,
  operators = [],
  sites = [],
  mineBlocks,
  todayDumperLoads,
  todayActivities = [],
  todayAssignments = [],
  initialShiftTelemetry = {},
  shiftDelayHours = {},
  mineralRegistry,
  today,
  initialShift,
}: ExcavatorActivityFormProps) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [selectedShift, setSelectedShift] = useState<HourlyShift>(
    initialShift ?? getCurrentShift()
  );
  const [loadsState, setLoadsState] = useState<HourlyLoadSegmentSummary[]>(todayDumperLoads);
  const [activitiesState, setActivitiesState] =
    useState<ExcavatorActivityConfig[]>(todayActivities);
  const [localMineBlocks, setLocalMineBlocks] = useState<MineBlock[]>(mineBlocks);
  const [quickAddExcavatorId, setQuickAddExcavatorId] = useState<string | null>(null);
  const [quickBlockName, setQuickBlockName] = useState<string>('');
  const [quickBlockCode, setQuickBlockCode] = useState<string>('');
  const [isSavingQuickBlock, setIsSavingQuickBlock] = useState<boolean>(false);

  const pendingMutationCountRef = useRef<Record<string, number>>({});
  const loadsStateRef = useRef<HourlyLoadSegmentSummary[]>(todayDumperLoads);
  loadsStateRef.current = loadsState;

  useEffect(() => {
    setLoadsState(todayDumperLoads);
  }, [todayDumperLoads]);

  useEffect(() => {
    setLocalMineBlocks((prev) => {
      const merged = new Map<string, MineBlock>();
      for (const mb of mineBlocks) merged.set(mb.id, mb);
      for (const mb of prev) {
        if (!merged.has(mb.id)) merged.set(mb.id, mb);
      }
      return Array.from(merged.values());
    });
  }, [mineBlocks]);

  useEffect(() => {
    setActivitiesState((prev) => {
      const hasPending = Object.values(pendingMutationCountRef.current).some((count) => count > 0);
      if (!hasPending) return todayActivities;
      // Preserve optimistic activity overrides for excavators with in-flight mutations
      const merged = [...todayActivities];
      for (const [excId, count] of Object.entries(pendingMutationCountRef.current)) {
        if (count > 0) {
          const optimistic = prev.find((a) => a.machine_id === excId);
          if (optimistic) {
            const idx = merged.findIndex(
              (a) => a.machine_id === excId && a.shift_type === optimistic.shift_type
            );
            if (idx >= 0) {
              merged[idx] = optimistic;
            } else {
              merged.unshift(optimistic);
            }
          }
        }
      }
      return merged;
    });
  }, [todayActivities]);

  const resolveActivityForExcavator = useCallback(
    (
      excavatorId: string,
      activities: ExcavatorActivityConfig[],
      shift: HourlyShift
    ): ExcavatorActivityConfig | undefined =>
      activities.find((a) => a.machine_id === excavatorId && a.shift_type === shift) ??
      activities.find((a) => a.machine_id === excavatorId),
    []
  );

  const upsertOptimisticActivity = useCallback(
    (
      prev: ExcavatorActivityConfig[],
      excavatorId: string,
      shift: HourlyShift,
      patch: Partial<ExcavatorActivityConfig>
    ): ExcavatorActivityConfig[] => {
      const exactIdx = prev.findIndex(
        (a) => a.machine_id === excavatorId && a.shift_type === shift
      );
      if (exactIdx >= 0) {
        const next = [...prev];
        next[exactIdx] = { ...next[exactIdx]!, ...patch };
        return next;
      }
      const fallback = prev.find((a) => a.machine_id === excavatorId);
      return [
        {
          machine_id: excavatorId,
          shift_type: shift,
          site_id: fallback?.site_id ?? null,
          block_mined_id: fallback?.block_mined_id ?? null,
          material_type: fallback?.material_type ?? 'Waste',
          ...patch,
        },
        ...prev,
      ];
    },
    []
  );

  const [excavatorSites, setExcavatorSites] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      excavators.map((e) => {
        const act = resolveActivityForExcavator(
          e.id,
          todayActivities,
          initialShift ?? getCurrentShift()
        );
        return [e.id, act?.site_id ?? e.site_id ?? ''];
      })
    )
  );

  const [excavatorBlocks, setExcavatorBlocks] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      excavators.map((e) => {
        const act = resolveActivityForExcavator(
          e.id,
          todayActivities,
          initialShift ?? getCurrentShift()
        );
        if (act?.block_mined_id) {
          return [e.id, act.block_mined_id];
        }
        const siteId = act?.site_id ?? e.site_id ?? '';
        const siteSpecificBlocks = siteId
          ? localMineBlocks.filter((mb) => mb.site_id === siteId)
          : [];
        return [e.id, siteSpecificBlocks.length === 1 ? (siteSpecificBlocks[0]?.id ?? '') : ''];
      })
    )
  );

  const [excavatorMaterials, setExcavatorMaterials] = useState<
    Record<string, ExcavatorActivityMaterial>
  >(() =>
    Object.fromEntries(
      excavators.map((e) => {
        const currentShift = initialShift ?? getCurrentShift();
        const act = resolveActivityForExcavator(e.id, todayActivities, currentShift);
        const load =
          todayDumperLoads.find(
            (l) => l.excavator_id === e.id && l.shift_type === currentShift && !l.is_locked
          ) ?? todayDumperLoads.find((l) => l.excavator_id === e.id && !l.is_locked);
        const mat = act?.material_type || load?.material_type;
        return [e.id, parseExcavatorMaterial(mat, mineralRegistry).category];
      })
    )
  );

  const [excavatorMaterialSubCategories, setExcavatorMaterialSubCategories] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      excavators.map((e) => {
        const act = resolveActivityForExcavator(
          e.id,
          todayActivities,
          initialShift ?? getCurrentShift()
        );
        return [e.id, parseExcavatorMaterial(act?.material_type, mineralRegistry).subCategory];
      })
    )
  );

  // Sync excavator mapping state when selectedShift or activitiesState updates
  useEffect(() => {
    const currentLoads = loadsStateRef.current;
    setExcavatorSites((prev) =>
      Object.fromEntries(
        excavators.map((e) => {
          if ((pendingMutationCountRef.current[e.id] ?? 0) > 0 && prev[e.id] !== undefined) {
            return [e.id, prev[e.id]!];
          }
          const act = resolveActivityForExcavator(e.id, activitiesState, selectedShift);
          return [e.id, act?.site_id ?? e.site_id ?? ''];
        })
      )
    );
    setExcavatorBlocks((prev) =>
      Object.fromEntries(
        excavators.map((e) => {
          if ((pendingMutationCountRef.current[e.id] ?? 0) > 0 && prev[e.id] !== undefined) {
            return [e.id, prev[e.id]!];
          }
          const act = resolveActivityForExcavator(e.id, activitiesState, selectedShift);
          if (act?.block_mined_id) {
            return [e.id, act.block_mined_id];
          }
          const siteId = act?.site_id ?? e.site_id ?? '';
          const siteSpecificBlocks = siteId
            ? localMineBlocks.filter((mb) => mb.site_id === siteId)
            : [];
          return [e.id, siteSpecificBlocks.length === 1 ? (siteSpecificBlocks[0]?.id ?? '') : ''];
        })
      )
    );
    setExcavatorMaterials((prev) =>
      Object.fromEntries(
        excavators.map((e) => {
          if ((pendingMutationCountRef.current[e.id] ?? 0) > 0 && prev[e.id] !== undefined) {
            return [e.id, prev[e.id]!];
          }
          const act = resolveActivityForExcavator(e.id, activitiesState, selectedShift);
          const load =
            currentLoads.find(
              (l) => l.excavator_id === e.id && l.shift_type === selectedShift && !l.is_locked
            ) ?? currentLoads.find((l) => l.excavator_id === e.id && !l.is_locked);
          const mat = act?.material_type || load?.material_type;
          return [e.id, parseExcavatorMaterial(mat, mineralRegistry).category];
        })
      )
    );
    setExcavatorMaterialSubCategories((prev) =>
      Object.fromEntries(
        excavators.map((e) => {
          if ((pendingMutationCountRef.current[e.id] ?? 0) > 0 && prev[e.id] !== undefined) {
            return [e.id, prev[e.id]!];
          }
          const act = resolveActivityForExcavator(e.id, activitiesState, selectedShift);
          return [e.id, parseExcavatorMaterial(act?.material_type, mineralRegistry).subCategory];
        })
      )
    );
  }, [
    excavators,
    activitiesState,
    selectedShift,
    localMineBlocks,
    mineralRegistry,
    resolveActivityForExcavator,
  ]);

  useSupabaseRealtime<HourlyLoadSegmentSummary & { id?: string; load_date?: string }>({
    supabaseClient: supabase,
    table: 'hourly_loads',
    filter: `department_id=eq.${departmentId}`,
    onChange: (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        if (today && payload.new.load_date && payload.new.load_date !== today) {
          return;
        }
        setLoadsState((prev) => {
          if (payload.new.id) {
            const index = prev.findIndex((item) => item.id === payload.new.id);
            if (index >= 0) {
              const next = [...prev];
              next[index] = { ...next[index], ...payload.new };
              return next;
            }
          }
          return [...prev, payload.new];
        });
      } else if (payload.eventType === 'DELETE' && payload.old.id) {
        setLoadsState((prev) => prev.filter((item) => item.id !== payload.old.id));
      }
    },
  });

  useSupabaseRealtime<ExcavatorActivityConfig>({
    supabaseClient: supabase,
    table: 'excavator_activity',
    filter: `department_id=eq.${departmentId}`,
    onChange: (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        if (today && payload.new.activity_date && payload.new.activity_date !== today) {
          return;
        }
        setActivitiesState((prev) => {
          if (payload.new.id) {
            const index = prev.findIndex((item) => item.id === payload.new.id);
            if (index >= 0) {
              const next = [...prev];
              next[index] = { ...next[index], ...payload.new };
              return next;
            }
          }
          return [payload.new, ...prev];
        });
      } else if (payload.eventType === 'DELETE' && payload.old.id) {
        setActivitiesState((prev) => prev.filter((item) => item.id !== payload.old.id));
      }
    },
  });

  const effectiveToday = useMemo(
    () => today || new Date().toISOString().split('T')[0] || '',
    [today]
  );

  const fallbackTelemetryMap = useMemo(
    () =>
      buildInitialShiftTelemetryMap({
        excavators,
        machineOperations: [],
        todayActivities,
        today: effectiveToday,
      }),
    [excavators, todayActivities, effectiveToday]
  );

  const buildDraftFromTelemetry = useCallback(
    (excavatorId: string, shiftType: HourlyShift): ExcavatorShiftTelemetryDraft => {
      const key = buildExcavatorShiftTelemetryKey(excavatorId, shiftType);
      const source = initialShiftTelemetry[key] ?? fallbackTelemetryMap[key];
      return {
        startSmrInput: source?.startSmr != null ? String(source.startSmr) : '',
        stopSmrInput: source?.stopSmr != null ? String(source.stopSmr) : '',
        startSmrSource: source?.startSmrSource ?? 'none',
        operatorId: source?.operatorId ?? '',
        comment: source?.comment ?? '',
        isDirty: false,
        isSaving: false,
        lastSavedAt: null,
      };
    },
    [initialShiftTelemetry, fallbackTelemetryMap]
  );

  const [shiftDrafts, setShiftDrafts] = useState<Record<string, ExcavatorShiftTelemetryDraft>>(
    () => {
      const seeded: Record<string, ExcavatorShiftTelemetryDraft> = {};
      for (const exc of excavators) {
        for (const sh of ['day', 'night'] as const) {
          const key = buildExcavatorShiftTelemetryKey(exc.id, sh);
          seeded[key] = buildDraftFromTelemetry(exc.id, sh);
        }
      }
      return seeded;
    }
  );

  const handleUpdateTelemetryDraft = useCallback(
    (
      excavatorId: string,
      patch: Partial<
        Pick<
          ExcavatorShiftTelemetryDraft,
          'startSmrInput' | 'stopSmrInput' | 'operatorId' | 'comment'
        >
      >
    ) => {
      const key = buildExcavatorShiftTelemetryKey(excavatorId, selectedShift);
      setShiftDrafts((prev) => {
        const current = prev[key] ?? buildDraftFromTelemetry(excavatorId, selectedShift);
        return {
          ...prev,
          [key]: { ...current, ...patch, isDirty: true },
        };
      });
    },
    [selectedShift, buildDraftFromTelemetry]
  );

  const handleSaveShiftTelemetry = useCallback(
    async (excavator: ExcavatorMachine) => {
      const key = buildExcavatorShiftTelemetryKey(excavator.id, selectedShift);
      const draft = shiftDrafts[key] ?? buildDraftFromTelemetry(excavator.id, selectedShift);
      const parsedStart = draft.startSmrInput.trim() ? Number(draft.startSmrInput) : null;
      const parsedStop = draft.stopSmrInput.trim() ? Number(draft.stopSmrInput) : null;

      if (parsedStart !== null && parsedStop !== null && parsedStop < parsedStart) {
        toast.error('Stop SMR must be greater than or equal to Start SMR.');
        return;
      }
      const capError = validateStopSmrCap({
        startSmr: parsedStart,
        stopSmr: parsedStop,
        delayHours: shiftDelayHours[key] ?? 0,
      });
      if (capError) {
        toast.error(capError);
        return;
      }

      const selectedOp = operators.find((op) => op.id === draft.operatorId) ?? null;
      const currentSiteId = excavatorSites[excavator.id] || null;
      const currentBlockId = excavatorBlocks[excavator.id] || null;
      const currentMat = excavatorMaterials[excavator.id] ?? 'Waste';
      const currentSub = excavatorMaterialSubCategories[excavator.id] ?? null;

      setShiftDrafts((prev) => ({
        ...prev,
        [key]: { ...draft, isSaving: true },
      }));

      try {
        const res = await saveExcavatorShiftTelemetry({
          departmentId,
          excavatorId: excavator.id,
          loadDate: effectiveToday,
          shiftType: selectedShift,
          startSmr: parsedStart,
          stopSmr: parsedStop,
          operatorId: draft.operatorId || null,
          operatorName: selectedOp?.full_name ?? null,
          comment: draft.comment.trim() || null,
          siteId: currentSiteId,
          blockMinedId: currentBlockId,
          materialType: formatExcavatorMaterial(currentMat, currentSub),
        });

        setShiftDrafts((prev) => ({
          ...prev,
          [key]: {
            ...draft,
            startSmrInput: res.startSmr != null ? String(res.startSmr) : '',
            stopSmrInput: res.stopSmr != null ? String(res.stopSmr) : '',
            startSmrSource: res.startSmr != null ? 'current_shift' : draft.startSmrSource,
            operatorId: res.operatorId ?? '',
            comment: res.comment ?? '',
            isDirty: false,
            isSaving: false,
            lastSavedAt: new Date().toISOString(),
          },
        }));
        toast.success(`Saved shift SMR, operator, and comment for ${excavator.name}.`);
        startTransition(() => {
          router.refresh();
        });
      } catch (err) {
        logError(err, { context: 'save_excavator_shift_telemetry' });
        setShiftDrafts((prev) => ({
          ...prev,
          [key]: { ...draft, isSaving: false },
        }));
        toast.error(err instanceof Error ? err.message : 'Failed to save shift telemetry.');
      }
    },
    [
      selectedShift,
      shiftDrafts,
      shiftDelayHours,
      buildDraftFromTelemetry,
      operators,
      excavatorSites,
      excavatorBlocks,
      excavatorMaterials,
      excavatorMaterialSubCategories,
      departmentId,
      effectiveToday,
      router,
    ]
  );

  // Handle excavator site assignment change
  const handleExcavatorSiteChange = useCallback(
    async (excavatorId: string, newSiteId: string | null) => {
      const prevSiteId = excavatorSites[excavatorId] ?? '';
      if ((newSiteId || '') === prevSiteId) return;

      const prevBlockId = excavatorBlocks[excavatorId] ?? '';
      const validBlockForNewSite = prevBlockId
        ? localMineBlocks.some(
            (mb) => mb.id === prevBlockId && (!newSiteId || mb.site_id === newSiteId || !mb.site_id)
          )
        : false;
      const siteSpecificBlocks = newSiteId
        ? localMineBlocks.filter((mb) => mb.site_id === newSiteId)
        : [];
      const nextBlockId = validBlockForNewSite
        ? prevBlockId
        : siteSpecificBlocks.length === 1
          ? (siteSpecificBlocks[0]?.id ?? '')
          : '';

      pendingMutationCountRef.current[excavatorId] =
        (pendingMutationCountRef.current[excavatorId] ?? 0) + 1;
      setExcavatorSites((prev) => ({ ...prev, [excavatorId]: newSiteId || '' }));
      setExcavatorBlocks((prev) => ({ ...prev, [excavatorId]: nextBlockId }));
      setActivitiesState((prev) =>
        upsertOptimisticActivity(prev, excavatorId, selectedShift, {
          site_id: newSiteId || null,
          block_mined_id: nextBlockId || null,
        })
      );
      try {
        await updateExcavatorAssignmentConfig({
          departmentId,
          excavatorId,
          loadDate: effectiveToday,
          shiftType: selectedShift,
          siteId: newSiteId || null,
          blockMinedId: nextBlockId || null,
        });
        startTransition(() => {
          router.refresh();
        });
      } catch (err) {
        logError(err, { context: 'update_excavator_site' });
        setExcavatorSites((prev) => ({ ...prev, [excavatorId]: prevSiteId }));
        setExcavatorBlocks((prev) => ({ ...prev, [excavatorId]: prevBlockId }));
        setActivitiesState((prev) =>
          upsertOptimisticActivity(prev, excavatorId, selectedShift, {
            site_id: prevSiteId || null,
            block_mined_id: prevBlockId || null,
          })
        );
        toast.error('Failed to update excavator site.');
      } finally {
        pendingMutationCountRef.current[excavatorId] = Math.max(
          0,
          (pendingMutationCountRef.current[excavatorId] ?? 1) - 1
        );
      }
    },
    [
      excavatorSites,
      excavatorBlocks,
      localMineBlocks,
      departmentId,
      effectiveToday,
      selectedShift,
      upsertOptimisticActivity,
      router,
    ]
  );

  // Handle excavator block mined / area change
  const handleExcavatorBlockChange = useCallback(
    async (excavatorId: string, newBlockId: string | null) => {
      const prevBlockId = excavatorBlocks[excavatorId] ?? '';
      if ((newBlockId || '') === prevBlockId) return;

      const currentSiteId = excavatorSites[excavatorId] || null;
      pendingMutationCountRef.current[excavatorId] =
        (pendingMutationCountRef.current[excavatorId] ?? 0) + 1;
      setExcavatorBlocks((prev) => ({ ...prev, [excavatorId]: newBlockId || '' }));
      setActivitiesState((prev) =>
        upsertOptimisticActivity(prev, excavatorId, selectedShift, {
          site_id: currentSiteId,
          block_mined_id: newBlockId || null,
        })
      );
      try {
        await updateExcavatorAssignmentConfig({
          departmentId,
          excavatorId,
          loadDate: effectiveToday,
          shiftType: selectedShift,
          siteId: currentSiteId,
          blockMinedId: newBlockId || null,
        });
        startTransition(() => {
          router.refresh();
        });
      } catch (err) {
        logError(err, { context: 'update_excavator_block' });
        setExcavatorBlocks((prev) => ({ ...prev, [excavatorId]: prevBlockId }));
        setActivitiesState((prev) =>
          upsertOptimisticActivity(prev, excavatorId, selectedShift, {
            site_id: currentSiteId,
            block_mined_id: prevBlockId || null,
          })
        );
        toast.error('Failed to update excavator block mined.');
      } finally {
        pendingMutationCountRef.current[excavatorId] = Math.max(
          0,
          (pendingMutationCountRef.current[excavatorId] ?? 1) - 1
        );
      }
    },
    [
      excavatorSites,
      excavatorBlocks,
      departmentId,
      effectiveToday,
      selectedShift,
      upsertOptimisticActivity,
      router,
    ]
  );

  const applyExcavatorMaterialState = useCallback(
    (
      excavatorId: string,
      snapshot: {
        readonly material: ExcavatorActivityMaterial;
        readonly subCategory: string;
        readonly formattedMaterial: string;
      }
    ) => {
      setExcavatorMaterials((prev) => ({ ...prev, [excavatorId]: snapshot.material }));
      setExcavatorMaterialSubCategories((prev) => ({
        ...prev,
        [excavatorId]: snapshot.subCategory,
      }));
      setActivitiesState((prev) =>
        upsertOptimisticActivity(prev, excavatorId, selectedShift, {
          material_type: snapshot.formattedMaterial,
        })
      );
      setLoadsState((prev) =>
        updateLoadsMaterial(prev, excavatorId, selectedShift, snapshot.material)
      );
    },
    [selectedShift, upsertOptimisticActivity]
  );

  // Handle excavator material change (Waste / Coal / Plant / Other)
  const handleExcavatorMaterialChange = useCallback(
    async (excavatorId: string, newMaterial: ExcavatorActivityMaterial) => {
      const transition = buildExcavatorMaterialTransition({
        excavatorId,
        newMaterial,
        excavatorMaterials,
        excavatorMaterialSubCategories,
        excavatorSites,
        excavatorBlocks,
        mineralRegistry,
      });
      if (newMaterial === transition.prevMaterial) return;

      adjustPendingMutationCount(pendingMutationCountRef.current, { excavatorId, delta: 1 });
      applyExcavatorMaterialState(excavatorId, {
        material: newMaterial,
        subCategory: transition.nextSubCategory,
        formattedMaterial: transition.nextFormattedMaterial,
      });

      try {
        await updateExcavatorAssignmentConfig({
          departmentId,
          excavatorId,
          loadDate: effectiveToday,
          shiftType: selectedShift,
          siteId: transition.currentSiteId,
          blockMinedId: transition.currentBlockId,
          materialType: newMaterial,
          materialSubCategory: transition.nextSubCategory || null,
        });
        notifyRegularMachineMaterial(excavators, { excavatorId, newMaterial });
        startTransition(() => {
          router.refresh();
        });
      } catch (err) {
        logError(err, { context: 'update_excavator_material' });
        applyExcavatorMaterialState(excavatorId, {
          material: transition.prevMaterial,
          subCategory: transition.prevSubCategory,
          formattedMaterial: transition.prevFormattedMaterial,
        });
        toast.error('Failed to update excavator material.');
      } finally {
        adjustPendingMutationCount(pendingMutationCountRef.current, { excavatorId, delta: -1 });
      }
    },
    [
      excavators,
      excavatorSites,
      excavatorBlocks,
      excavatorMaterials,
      excavatorMaterialSubCategories,
      departmentId,
      effectiveToday,
      selectedShift,
      mineralRegistry,
      applyExcavatorMaterialState,
      router,
    ]
  );

  // Handle excavator material sub-category change
  const handleExcavatorMaterialSubCategoryChange = useCallback(
    async (excavatorId: string, newSubCategory: string | null) => {
      const currentMaterial = excavatorMaterials[excavatorId] ?? 'Waste';
      const prevSubCategory = excavatorMaterialSubCategories[excavatorId] ?? '';
      const validNext = isValidSubCategoryForMaterial(
        currentMaterial,
        newSubCategory,
        mineralRegistry
      )
        ? (newSubCategory ?? '')
        : '';

      if (validNext === prevSubCategory) return;

      const currentSiteId = excavatorSites[excavatorId] || null;
      const currentBlockId = excavatorBlocks[excavatorId] || null;
      const nextFormattedMaterial = formatExcavatorMaterial(currentMaterial, validNext || null);
      const prevFormattedMaterial = formatExcavatorMaterial(
        currentMaterial,
        prevSubCategory || null
      );

      pendingMutationCountRef.current[excavatorId] =
        (pendingMutationCountRef.current[excavatorId] ?? 0) + 1;
      setExcavatorMaterialSubCategories((prev) => ({ ...prev, [excavatorId]: validNext }));
      setActivitiesState((prev) =>
        upsertOptimisticActivity(prev, excavatorId, selectedShift, {
          material_type: nextFormattedMaterial,
        })
      );

      try {
        await updateExcavatorAssignmentConfig({
          departmentId,
          excavatorId,
          loadDate: effectiveToday,
          shiftType: selectedShift,
          siteId: currentSiteId,
          blockMinedId: currentBlockId,
          materialType: currentMaterial,
          materialSubCategory: validNext || null,
        });
        startTransition(() => {
          router.refresh();
        });
      } catch (err) {
        logError(err, { context: 'update_excavator_material_subcategory' });
        setExcavatorMaterialSubCategories((prev) => ({ ...prev, [excavatorId]: prevSubCategory }));
        setActivitiesState((prev) =>
          upsertOptimisticActivity(prev, excavatorId, selectedShift, {
            material_type: prevFormattedMaterial,
          })
        );
        toast.error('Failed to update excavator material sub-category.');
      } finally {
        pendingMutationCountRef.current[excavatorId] = Math.max(
          0,
          (pendingMutationCountRef.current[excavatorId] ?? 1) - 1
        );
      }
    },
    [
      excavatorSites,
      excavatorBlocks,
      excavatorMaterials,
      excavatorMaterialSubCategories,
      departmentId,
      effectiveToday,
      selectedShift,
      mineralRegistry,
      upsertOptimisticActivity,
      router,
    ]
  );

  // Handle Quick Add Block (auto-configures/fixes format for Block name & BLK-* code)
  const handleQuickAddBlockSubmit = useCallback(
    async (excavatorId: string) => {
      if (!quickBlockName.trim()) {
        toast.error('Please enter a block or bench name.');
        return;
      }

      const currentSiteId = excavatorSites[excavatorId] || null;
      const siteName = sites.find((s) => s.id === currentSiteId)?.name ?? null;
      const preview = normalizeQuickBlockFormat(quickBlockName, quickBlockCode, siteName);

      setIsSavingQuickBlock(true);
      try {
        const res = await quickAddMineBlock({
          departmentId,
          excavatorId,
          siteId: currentSiteId,
          name: preview.formattedName,
          code: preview.formattedCode,
        });

        if (res?.success && res.block) {
          const newBlock: MineBlock = {
            id: res.block.id,
            name: res.block.name,
            code: res.block.code,
            site_id: res.block.site_id,
          };
          setLocalMineBlocks((prev) => [...prev, newBlock]);
          setQuickAddExcavatorId(null);
          setQuickBlockName('');
          setQuickBlockCode('');
          toast.success(`Block "${newBlock.name} (${newBlock.code})" added and assigned.`);
          await handleExcavatorBlockChange(excavatorId, newBlock.id);
        }
      } catch (err) {
        logError(err, { context: 'quick_add_mine_block' });
        toast.error('Failed to quick-add mine block.');
      } finally {
        setIsSavingQuickBlock(false);
      }
    },
    [
      quickBlockName,
      quickBlockCode,
      excavatorSites,
      sites,
      departmentId,
      handleExcavatorBlockChange,
    ]
  );

  // Plant / Other excavators move to the end of the log (stable order otherwise).
  const orderedExcavators = useMemo(
    () => sortExcavatorsForLog(excavators, excavatorMaterials),
    [excavators, excavatorMaterials]
  );
  const firstRegularExcavatorId = useMemo(
    () =>
      orderedExcavators.find((e) =>
        isRegularMachineExcavatorActivity(excavatorMaterials[e.id] || 'Waste')
      )?.id ?? null,
    [orderedExcavators, excavatorMaterials]
  );

  return (
    <LazyMotion features={loadMotionFeatures}>
      <MotionConfig reducedMotion="user">
        <div className="space-y-4">
          <GlassCard className="p-4">
            <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-[var(--text-heading)] text-sm">
                  Excavator Location, Block Mined & Material Mapping
                </h3>
                <div
                  data-testid="excavator-mapping-header-separator"
                  aria-hidden="true"
                  className={`my-1.5 ${GOLDEN_SEPARATOR_CLASS}`}
                />
                <p className="font-medium text-[var(--text-secondary)] text-xs">
                  Assign each Excavator to a Site, Block Mined / Area, and Material (Waste, Coal,
                  Plant, or Other). Selecting Plant or Other logs the Excavator as a regular machine
                  and moves it to the end of the log.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-semibold text-[var(--text-heading)] text-xs">Shift:</span>
                <div className="flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] p-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedShift('day')}
                    className={`rounded-full px-2.5 py-1 font-semibold text-xs transition-all ${
                      selectedShift === 'day'
                        ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)] shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                    }`}
                  >
                    Day (06:00 - 17:59)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedShift('night')}
                    className={`rounded-full px-2.5 py-1 font-semibold text-xs transition-all ${
                      selectedShift === 'night'
                        ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)] shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                    }`}
                  >
                    Night (18:00 - 05:59)
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
              {orderedExcavators.map((excavator) => {
                const currentSiteId = excavatorSites[excavator.id] || '';
                const currentBlockId = excavatorBlocks[excavator.id] || '';
                const currentMaterial = excavatorMaterials[excavator.id] || 'Waste';
                const currentSubCategory = excavatorMaterialSubCategories[excavator.id] || '';
                const materialSubCategories = getMaterialSubCategories(
                  currentMaterial,
                  mineralRegistry
                );
                const availableBlocks = currentSiteId
                  ? localMineBlocks.filter(
                      (mb) => mb.site_id === currentSiteId || mb.site_id === null
                    )
                  : localMineBlocks;

                const actForExcavator = resolveActivityForExcavator(
                  excavator.id,
                  activitiesState,
                  selectedShift
                );
                const loadTable = buildExcavatorLoadTable({
                  excavatorId: excavator.id,
                  shift: selectedShift,
                  activityId: actForExcavator?.id ?? null,
                  loads: loadsState,
                  assignments: todayAssignments,
                  dumpers,
                });

                const isRegularMachine = isRegularMachineExcavatorActivity(currentMaterial);
                const isQuickAddOpen = quickAddExcavatorId === excavator.id;
                const currentSiteName = sites.find((s) => s.id === currentSiteId)?.name ?? null;
                const quickFormatPreview = quickBlockName.trim()
                  ? normalizeQuickBlockFormat(quickBlockName, quickBlockCode, currentSiteName)
                  : null;

                const showRegularDivider = firstRegularExcavatorId === excavator.id;

                return (
                  <Fragment key={excavator.id}>
                    {showRegularDivider && (
                      <div data-testid="regular-machines-divider" className={REGULAR_DIVIDER_CLASS}>
                        <Logo variant="gold" className="h-3.5 w-3.5 shrink-0" />
                        <span>Plant / Other — logged as regular machines</span>
                        <span aria-hidden="true" className={`flex-1 ${GOLDEN_SEPARATOR_CLASS}`} />
                      </div>
                    )}
                    <div
                      data-testid={`excavator-activity-card-${excavator.name}`}
                      data-material={currentMaterial}
                      className={EXCAVATOR_CARD_CLASS}
                    >
                      <span aria-hidden="true" className={CARD_TOP_HIGHLIGHT_CLASS} />
                      {/* Header: Excavator Name (with Gold Arch Logo + Golden Separator) + Active Machines Subtitle + Material Toggle */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-[var(--border-default)]/60 border-b pb-2.5">
                        <div className="flex min-w-0 flex-col">
                          <span className="inline-flex items-center gap-1.5 font-bold text-[var(--text-heading)] text-base tracking-tight">
                            <Logo variant="gold" className="h-4 w-4 shrink-0" />
                            <span>{excavator.name}</span>
                          </span>
                          <div
                            data-testid={`excavator-machine-id-separator-${excavator.name}`}
                            aria-hidden="true"
                            className={`my-1 ${GOLDEN_SEPARATOR_CLASS}`}
                          />
                          {isRegularMachine && (
                            <span className="truncate font-semibold text-[11px] text-[var(--text-secondary)]">
                              Regular Machine Mode ({currentMaterial})
                            </span>
                          )}
                        </div>

                        {/* Material Selector (Waste / Coal / Plant / Other) */}
                        <div
                          role="group"
                          aria-label={`Material for ${excavator.name}`}
                          className={MATERIAL_SEGMENT_SHELL_CLASS}
                        >
                          {EXCAVATOR_ACTIVITY_MATERIALS.map((matOption) => {
                            const isSelected = currentMaterial === matOption;
                            return (
                              <button
                                key={matOption}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() =>
                                  handleExcavatorMaterialChange(excavator.id, matOption)
                                }
                                title={
                                  matOption === 'Plant' || matOption === 'Other'
                                    ? `${matOption} — Logs ${excavator.name} as a regular machine`
                                    : `Set ${excavator.name} material to ${matOption}`
                                }
                                className={cn(
                                  MATERIAL_SEGMENT_BUTTON_CLASS,
                                  isSelected
                                    ? MATERIAL_PILL_ACTIVE_TEXT
                                    : MATERIAL_SEGMENT_IDLE_TEXT
                                )}
                              >
                                {isSelected && (
                                  <m.span
                                    layoutId={`material-pill-${excavator.id}`}
                                    aria-hidden="true"
                                    data-testid={`material-pill-${excavator.name}`}
                                    className={cn(
                                      MATERIAL_PILL_PILL_CLASS,
                                      MATERIAL_PILL_ACTIVE_STYLE[matOption]
                                    )}
                                    transition={
                                      prefersReducedMotion ? REDUCED_MOTION_TRANSITION : PILL_SPRING
                                    }
                                  />
                                )}
                                <span className="relative z-10">{matOption}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {!isRegularMachine && (
                        <ExcavatorLoadsTable excavatorName={excavator.name} table={loadTable} />
                      )}

                      {/* Step 1: Site, Block Mined / Area (+ Quick Add) & Material Sub-Category */}
                      <m.div
                        className={SECTION_BOX_CLASS}
                        variants={SECTION_STAGGER_VARIANTS}
                        initial="hidden"
                        animate="visible"
                        custom={0}
                      >
                        <span className={SECTION_HEADER_CLASS}>1. Location &amp; Material</span>
                        <div
                          className={`grid grid-cols-1 gap-2.5 ${isRegularMachine ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}
                        >
                          <div className="space-y-1">
                            <label className={FIELD_LABEL_CLASS}>Site / Location</label>
                            <select
                              value={currentSiteId}
                              onChange={(e) =>
                                handleExcavatorSiteChange(excavator.id, e.target.value || null)
                              }
                              aria-label={`Select Site / Location for ${excavator.name}`}
                              className={GOLD_FIELD_CLASS}
                            >
                              <option value="">No Site</option>
                              {sites.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {!isRegularMachine && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-1">
                                <label className={FIELD_LABEL_CLASS}>Block Mined / Area</label>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={currentBlockId}
                                  onChange={(e) =>
                                    handleExcavatorBlockChange(excavator.id, e.target.value || null)
                                  }
                                  aria-label={`Select Block Mined / Area for ${excavator.name}`}
                                  className={GOLD_FIELD_CLASS}
                                >
                                  <option value="">Select block / area...</option>
                                  {availableBlocks.map((mb) => (
                                    <option key={mb.id} value={mb.id}>
                                      {mb.name} ({mb.code})
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isQuickAddOpen) {
                                      setQuickAddExcavatorId(null);
                                    } else {
                                      setQuickAddExcavatorId(excavator.id);
                                      setQuickBlockName('');
                                      setQuickBlockCode('');
                                    }
                                  }}
                                  aria-label={`Quick add Block Mined / Area for ${excavator.name}`}
                                  title="Quick add Block (auto-configures format & BLK code)"
                                  data-testid={`quick-add-block-btn-${excavator.name}`}
                                  className={QUICK_ADD_BTN_CLASS}
                                >
                                  {isQuickAddOpen ? (
                                    <X className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                                  ) : (
                                    <Plus className="h-3.5 w-3.5 text-accent-amber" />
                                  )}
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="space-y-1">
                            <label className={FIELD_LABEL_CLASS}>
                              {isRegularMachine
                                ? `Activity (${currentMaterial})`
                                : `Material (${currentMaterial})`}
                            </label>
                            <select
                              value={currentSubCategory}
                              onChange={(e) =>
                                handleExcavatorMaterialSubCategoryChange(
                                  excavator.id,
                                  e.target.value || null
                                )
                              }
                              aria-label={
                                isRegularMachine
                                  ? `Select ${currentMaterial} activity for ${excavator.name}`
                                  : `Select ${currentMaterial} material sub-category for ${excavator.name}`
                              }
                              className={GOLD_FIELD_CLASS}
                            >
                              <option value="">
                                Select {currentMaterial.toLowerCase()}{' '}
                                {isRegularMachine ? 'activity...' : 'material...'}
                              </option>
                              {materialSubCategories.map((subCat) => (
                                <option key={subCat} value={subCat}>
                                  {subCat}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </m.div>

                      {/* Inline Quick Add Block Drawer with Auto-Formatter */}
                      {isQuickAddOpen && (
                        <div
                          data-testid={`quick-add-block-panel-${excavator.name}`}
                          className="gold-steel-border gold-steel-border-slim space-y-2 rounded-lg border border-accent-amber/35 bg-[var(--bg-primary)] p-2.5 shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-[var(--text-heading)]">
                              <Sparkles className="h-3 w-3 text-accent-amber" />
                              Quick Add Block (Auto-Format)
                            </span>
                            {quickFormatPreview && (
                              <span className="font-mono text-[10px] text-[var(--accent-blue)]">
                                {quickFormatPreview.formattedName} (
                                {quickFormatPreview.formattedCode})
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_110px_auto]">
                            <input
                              type="text"
                              value={quickBlockName}
                              onChange={(e) => setQuickBlockName(e.target.value)}
                              placeholder="Block / Bench (e.g. Brakfontein Pit Bench D)"
                              aria-label={`New block name for ${excavator.name}`}
                              className={GOLD_FIELD_CLASS}
                            />
                            <input
                              type="text"
                              value={quickBlockCode}
                              onChange={(e) => setQuickBlockCode(e.target.value)}
                              placeholder={quickFormatPreview?.formattedCode || 'Auto BLK-code'}
                              aria-label={`New block code for ${excavator.name}`}
                              className={`${GOLD_FIELD_CLASS} font-mono`}
                            />
                            <button
                              type="button"
                              disabled={isSavingQuickBlock || !quickBlockName.trim()}
                              onClick={() => handleQuickAddBlockSubmit(excavator.id)}
                              aria-label={`Save quick block for ${excavator.name}`}
                              className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg bg-[var(--accent-blue)] px-3 py-1.5 font-semibold text-white text-xs shadow-2xs transition hover:opacity-90 disabled:opacity-40"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Add
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Steps 2 & 3: Operator, Start/Stop SMR & Shift Comment */}
                      <ExcavatorShiftTelemetryControls
                        excavatorName={excavator.name}
                        operators={operators}
                        delayHours={
                          shiftDelayHours[
                            buildExcavatorShiftTelemetryKey(excavator.id, selectedShift)
                          ] ?? 0
                        }
                        draft={
                          shiftDrafts[
                            buildExcavatorShiftTelemetryKey(excavator.id, selectedShift)
                          ] ?? buildDraftFromTelemetry(excavator.id, selectedShift)
                        }
                        onUpdateDraft={(patch) => handleUpdateTelemetryDraft(excavator.id, patch)}
                        onSave={() => handleSaveShiftTelemetry(excavator)}
                      />
                    </div>
                  </Fragment>
                );
              })}
              {excavators.length === 0 && (
                <p className="col-span-full text-[var(--text-muted)] text-xs">
                  No active excavators found. Please add excavators in Machine DB.
                </p>
              )}
            </div>
          </GlassCard>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
