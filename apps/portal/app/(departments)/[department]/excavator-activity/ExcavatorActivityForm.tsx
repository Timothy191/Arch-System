'use client';

import { useSupabaseRealtime } from '@repo/shared/hooks';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import { Logo } from '@repo/ui/Logo';
import { getCurrentShift } from '@repo/utils/client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { logError } from '@/lib/errors/error-logger';
import { updateExcavatorAssignmentConfig } from '../hourly-loads/actions';
import {
  getMaterialSubCategories,
  type HourlyLoadSegmentSummary,
  type HourlyMaterial,
  type HourlyShift,
  isValidSubCategoryForMaterial,
  parseExcavatorMaterial,
} from '../hourly-loads/loads-utils';

interface ExcavatorMachine {
  id: string;
  name: string;
  machine_type: string;
  serial_number: string | null;
  site_id?: string | null;
}

interface DumperMachine {
  id: string;
  name: string;
  machine_type: string;
  bin_factor: number | null;
  site_id: string | null;
}

interface Operator {
  id: string;
  full_name: string;
  employee_code: string;
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
  operators?: Operator[];
  sites?: Site[];
  mineBlocks: MineBlock[];
  todayDumperLoads: HourlyLoadSegmentSummary[];
  todayActivities?: ExcavatorActivityConfig[];
  todayAssignments?: SavedDumperAssignment[];
  mineralRegistry?: {
    waste: string[];
    coal: string[];
  };
  today?: string;
  initialShift?: HourlyShift;
}

export function ExcavatorActivityForm({
  departmentId,
  excavators,
  dumpers,
  sites = [],
  mineBlocks,
  todayDumperLoads,
  todayActivities = [],
  todayAssignments = [],
  mineralRegistry,
  today,
  initialShift,
}: ExcavatorActivityFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [selectedShift, setSelectedShift] = useState<HourlyShift>(
    initialShift ?? getCurrentShift()
  );
  const [loadsState, setLoadsState] = useState<HourlyLoadSegmentSummary[]>(todayDumperLoads);
  const [activitiesState, setActivitiesState] =
    useState<ExcavatorActivityConfig[]>(todayActivities);

  useEffect(() => {
    setLoadsState(todayDumperLoads);
  }, [todayDumperLoads]);

  useEffect(() => {
    setActivitiesState(todayActivities);
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
        const siteSpecificBlocks = siteId ? mineBlocks.filter((mb) => mb.site_id === siteId) : [];
        return [e.id, siteSpecificBlocks.length === 1 ? (siteSpecificBlocks[0]?.id ?? '') : ''];
      })
    )
  );

  const [excavatorMaterials, setExcavatorMaterials] = useState<Record<string, HourlyMaterial>>(() =>
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
    setExcavatorSites(
      Object.fromEntries(
        excavators.map((e) => {
          const act = resolveActivityForExcavator(e.id, activitiesState, selectedShift);
          return [e.id, act?.site_id ?? e.site_id ?? ''];
        })
      )
    );
    setExcavatorBlocks(
      Object.fromEntries(
        excavators.map((e) => {
          const act = resolveActivityForExcavator(e.id, activitiesState, selectedShift);
          if (act?.block_mined_id) {
            return [e.id, act.block_mined_id];
          }
          const siteId = act?.site_id ?? e.site_id ?? '';
          const siteSpecificBlocks = siteId ? mineBlocks.filter((mb) => mb.site_id === siteId) : [];
          return [e.id, siteSpecificBlocks.length === 1 ? (siteSpecificBlocks[0]?.id ?? '') : ''];
        })
      )
    );
    setExcavatorMaterials(
      Object.fromEntries(
        excavators.map((e) => {
          const act = resolveActivityForExcavator(e.id, activitiesState, selectedShift);
          const load =
            loadsState.find(
              (l) => l.excavator_id === e.id && l.shift_type === selectedShift && !l.is_locked
            ) ?? loadsState.find((l) => l.excavator_id === e.id && !l.is_locked);
          const mat = act?.material_type || load?.material_type;
          return [e.id, parseExcavatorMaterial(mat, mineralRegistry).category];
        })
      )
    );
    setExcavatorMaterialSubCategories(
      Object.fromEntries(
        excavators.map((e) => {
          const act = resolveActivityForExcavator(e.id, activitiesState, selectedShift);
          return [e.id, parseExcavatorMaterial(act?.material_type, mineralRegistry).subCategory];
        })
      )
    );
  }, [
    excavators,
    activitiesState,
    loadsState,
    selectedShift,
    mineBlocks,
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

  // Handle excavator site assignment change
  const handleExcavatorSiteChange = useCallback(
    async (excavatorId: string, newSiteId: string | null) => {
      const prevSiteId = excavatorSites[excavatorId] ?? '';
      if ((newSiteId || '') === prevSiteId) return;

      const prevBlockId = excavatorBlocks[excavatorId] ?? '';
      const validBlockForNewSite = prevBlockId
        ? mineBlocks.some(
            (mb) => mb.id === prevBlockId && (!newSiteId || mb.site_id === newSiteId || !mb.site_id)
          )
        : false;
      const siteSpecificBlocks = newSiteId
        ? mineBlocks.filter((mb) => mb.site_id === newSiteId)
        : [];
      const nextBlockId = validBlockForNewSite
        ? prevBlockId
        : siteSpecificBlocks.length === 1
          ? (siteSpecificBlocks[0]?.id ?? '')
          : '';

      setExcavatorSites((prev) => ({ ...prev, [excavatorId]: newSiteId || '' }));
      setExcavatorBlocks((prev) => ({ ...prev, [excavatorId]: nextBlockId }));
      try {
        await updateExcavatorAssignmentConfig({
          departmentId,
          excavatorId,
          loadDate: effectiveToday,
          shiftType: selectedShift,
          siteId: newSiteId || null,
          blockMinedId: nextBlockId || null,
        });
        router.refresh();
      } catch (err) {
        logError(err, { context: 'update_excavator_site' });
        setExcavatorSites((prev) => ({ ...prev, [excavatorId]: prevSiteId }));
        setExcavatorBlocks((prev) => ({ ...prev, [excavatorId]: prevBlockId }));
        toast.error('Failed to update excavator site.');
      }
    },
    [
      excavatorSites,
      excavatorBlocks,
      mineBlocks,
      departmentId,
      effectiveToday,
      selectedShift,
      router,
    ]
  );

  // Handle excavator block mined / area change
  const handleExcavatorBlockChange = useCallback(
    async (excavatorId: string, newBlockId: string | null) => {
      const prevBlockId = excavatorBlocks[excavatorId] ?? '';
      if ((newBlockId || '') === prevBlockId) return;

      const currentSiteId = excavatorSites[excavatorId] || null;
      setExcavatorBlocks((prev) => ({ ...prev, [excavatorId]: newBlockId || '' }));
      try {
        await updateExcavatorAssignmentConfig({
          departmentId,
          excavatorId,
          loadDate: effectiveToday,
          shiftType: selectedShift,
          siteId: currentSiteId,
          blockMinedId: newBlockId || null,
        });
        router.refresh();
      } catch (err) {
        logError(err, { context: 'update_excavator_block' });
        setExcavatorBlocks((prev) => ({ ...prev, [excavatorId]: prevBlockId }));
        toast.error('Failed to update excavator block mined.');
      }
    },
    [excavatorSites, excavatorBlocks, departmentId, effectiveToday, selectedShift, router]
  );

  // Handle excavator material change (Waste / Coal)
  const handleExcavatorMaterialChange = useCallback(
    async (excavatorId: string, newMaterial: HourlyMaterial) => {
      const prevMaterial = excavatorMaterials[excavatorId] ?? 'Waste';
      if (newMaterial === prevMaterial) return;

      const prevSubCategory = excavatorMaterialSubCategories[excavatorId] ?? '';
      const nextSubCategory = isValidSubCategoryForMaterial(
        newMaterial,
        prevSubCategory,
        mineralRegistry
      )
        ? prevSubCategory
        : '';

      const currentSiteId = excavatorSites[excavatorId] || null;
      const currentBlockId = excavatorBlocks[excavatorId] || null;

      setExcavatorMaterials((prev) => ({ ...prev, [excavatorId]: newMaterial }));
      setExcavatorMaterialSubCategories((prev) => ({ ...prev, [excavatorId]: nextSubCategory }));
      setLoadsState((prev) =>
        prev.map((load) =>
          load.excavator_id === excavatorId && load.shift_type === selectedShift && !load.is_locked
            ? { ...load, material_type: newMaterial }
            : load
        )
      );

      try {
        await updateExcavatorAssignmentConfig({
          departmentId,
          excavatorId,
          loadDate: effectiveToday,
          shiftType: selectedShift,
          siteId: currentSiteId,
          blockMinedId: currentBlockId,
          materialType: newMaterial,
          materialSubCategory: nextSubCategory || null,
        });
        router.refresh();
      } catch (err) {
        logError(err, { context: 'update_excavator_material' });
        setExcavatorMaterials((prev) => ({ ...prev, [excavatorId]: prevMaterial }));
        setExcavatorMaterialSubCategories((prev) => ({ ...prev, [excavatorId]: prevSubCategory }));
        setLoadsState((prev) =>
          prev.map((load) =>
            load.excavator_id === excavatorId &&
            load.shift_type === selectedShift &&
            !load.is_locked
              ? { ...load, material_type: prevMaterial }
              : load
          )
        );
        toast.error('Failed to update excavator material.');
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

      setExcavatorMaterialSubCategories((prev) => ({ ...prev, [excavatorId]: validNext }));

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
        router.refresh();
      } catch (err) {
        logError(err, { context: 'update_excavator_material_subcategory' });
        setExcavatorMaterialSubCategories((prev) => ({ ...prev, [excavatorId]: prevSubCategory }));
        toast.error('Failed to update excavator material sub-category.');
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
      router,
    ]
  );

  return (
    <GlassCard className="border border-black/[0.06] bg-[var(--vibrancy-surface)] p-4">
      <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-semibold text-[var(--text-heading)] text-sm">
            Excavator Location, Block Mined & Material Mapping
          </h3>
          <p className="text-[var(--text-muted)] text-xs">
            Assign each Excavator to a Site, Block Mined / Area, and Material. Hauling trucks
            assigned to the Excavator automatically inherit this location, block, and material.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[var(--text-muted)] text-xs">Shift:</span>
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
        {excavators.map((excavator) => {
          const currentSiteId = excavatorSites[excavator.id] || '';
          const currentBlockId = excavatorBlocks[excavator.id] || '';
          const currentMaterial = excavatorMaterials[excavator.id] || 'Waste';
          const currentSubCategory = excavatorMaterialSubCategories[excavator.id] || '';
          const materialSubCategories = getMaterialSubCategories(currentMaterial, mineralRegistry);
          const availableBlocks = currentSiteId
            ? mineBlocks.filter((mb) => mb.site_id === currentSiteId || mb.site_id === null)
            : mineBlocks;

          const actForExcavator = resolveActivityForExcavator(
            excavator.id,
            activitiesState,
            selectedShift
          );
          const assignedFromLoads = loadsState
            .filter(
              (l) =>
                l.excavator_id === excavator.id &&
                (!l.shift_type || l.shift_type === selectedShift) &&
                !l.is_locked
            )
            .map((l) => dumpers.find((d) => d.id === l.machine_id)?.name || '');
          const assignedFromSaved = actForExcavator?.id
            ? todayAssignments
                .filter((a) => a.excavator_activity_id === actForExcavator.id)
                .map((a) => dumpers.find((d) => d.id === a.dumper_machine_id)?.name || '')
            : [];
          const assignedMachineNames = Array.from(
            new Set([...assignedFromLoads, ...assignedFromSaved].filter(Boolean))
          );

          return (
            <div
              key={excavator.id}
              className="flex flex-col gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3.5 shadow-xs"
            >
              {/* Header: Excavator Name (with Gold Arch Logo) + Active Machines Subtitle + Material Toggle */}
              <div className="flex items-center justify-between gap-2 border-[var(--border-default)]/60 border-b pb-2.5">
                <div className="flex min-w-0 flex-col">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-heading)] text-sm">
                    <Logo variant="gold" className="h-3.5 w-3.5 shrink-0" />
                    <span>{excavator.name}</span>
                  </span>
                  <span
                    className="truncate text-[11px] text-[var(--text-muted)]"
                    title={
                      assignedMachineNames.length > 0
                        ? `Active machines: ${assignedMachineNames.join(', ')}`
                        : 'No active machine assigned'
                    }
                  >
                    {assignedMachineNames.length > 0
                      ? `Active: ${assignedMachineNames.join(', ')}`
                      : 'No active machine assigned'}
                  </span>
                </div>

                {/* Material Selector (Waste / Coal) */}
                <div className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-primary)] p-0.5">
                  <button
                    type="button"
                    onClick={() => handleExcavatorMaterialChange(excavator.id, 'Waste')}
                    className={`rounded-full px-2.5 py-1 font-semibold text-xs transition-all ${
                      currentMaterial === 'Waste'
                        ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)] shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                    }`}
                  >
                    Waste
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExcavatorMaterialChange(excavator.id, 'Coal')}
                    className={`rounded-full px-2.5 py-1 font-semibold text-xs transition-all ${
                      currentMaterial === 'Coal'
                        ? 'bg-neutral-800 text-white shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                    }`}
                  >
                    Coal
                  </button>
                </div>
              </div>

              {/* Site, Block Mined / Area & Material Sub-Category Selectors */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="block font-medium text-[11px] text-[var(--text-muted)]">
                    Site / Location
                  </label>
                  <select
                    value={currentSiteId}
                    onChange={(e) =>
                      handleExcavatorSiteChange(excavator.id, e.target.value || null)
                    }
                    aria-label={`Select Site / Location for ${excavator.name}`}
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1.5 font-medium text-[var(--text-heading)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                  >
                    <option value="">No Site</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-medium text-[11px] text-[var(--text-muted)]">
                    Block Mined / Area
                  </label>
                  <select
                    value={currentBlockId}
                    onChange={(e) =>
                      handleExcavatorBlockChange(excavator.id, e.target.value || null)
                    }
                    aria-label={`Select Block Mined / Area for ${excavator.name}`}
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1.5 font-medium text-[var(--text-heading)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                  >
                    <option value="">Select block / area...</option>
                    {availableBlocks.map((mb) => (
                      <option key={mb.id} value={mb.id}>
                        {mb.name} ({mb.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-medium text-[11px] text-[var(--text-muted)]">
                    Material ({currentMaterial})
                  </label>
                  <select
                    value={currentSubCategory}
                    onChange={(e) =>
                      handleExcavatorMaterialSubCategoryChange(excavator.id, e.target.value || null)
                    }
                    aria-label={`Select ${currentMaterial} material sub-category for ${excavator.name}`}
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1.5 font-medium text-[var(--text-heading)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                  >
                    <option value="">Select {currentMaterial.toLowerCase()} material...</option>
                    {materialSubCategories.map((subCat) => (
                      <option key={subCat} value={subCat}>
                        {subCat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
        {excavators.length === 0 && (
          <p className="col-span-full text-[var(--text-muted)] text-xs">
            No active excavators found. Please add excavators in Machine DB.
          </p>
        )}
      </div>
    </GlassCard>
  );
}
