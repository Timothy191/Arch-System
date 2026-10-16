'use client';

import { useSupabaseRealtime } from '@repo/shared/hooks';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import { getCurrentShift } from '@repo/utils/client';
import { Activity, ArrowUpRight, BarChart3, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  deriveExcavatorDumperAssignments,
  formatExcavatorMaterial,
  type HourlyLoadSegmentSummary,
  type HourlyShift,
  parseExcavatorMaterial,
} from '../hourly-loads/loads-utils';
import { saveExcavatorActivity } from './actions';
import { type DumperAssignmentRow, ExcavatorDumperTable } from './ExcavatorDumperTable';

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
  operators: Operator[];
  sites?: Site[];
  mineBlocks: MineBlock[];
  todayDumperLoads: HourlyLoadSegmentSummary[];
  todayActivities?: ExcavatorActivityConfig[];
  todayAssignments?: SavedDumperAssignment[];
  today?: string;
}

const getAutoSaveKey = (deptId: string) => `excavator-activity-draft-${deptId}`;

const SHIFT_HOURS = 12;

export function ExcavatorActivityForm({
  departmentId,
  excavators,
  dumpers,
  operators,
  sites,
  mineBlocks,
  todayDumperLoads,
  todayActivities = [],
  todayAssignments = [],
  today,
}: ExcavatorActivityFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [loadsState, setLoadsState] = useState<HourlyLoadSegmentSummary[]>(todayDumperLoads);
  const [activitiesState, setActivitiesState] =
    useState<ExcavatorActivityConfig[]>(todayActivities);

  useEffect(() => {
    setLoadsState(todayDumperLoads);
  }, [todayDumperLoads]);

  useEffect(() => {
    setActivitiesState(todayActivities);
  }, [todayActivities]);

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

  const [formData, setFormData] = useState({
    excavatorId: '',
    operatorId: '',
    shiftType: getCurrentShift(),
    blockMinedId: '',
    notes: '',
  });

  const [dumperAssignments, setDumperAssignments] = useState<DumperAssignmentRow[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessPlus, setShowSuccessPlus] = useState(false);

  // Auto-save to localStorage every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (formData.excavatorId) {
        localStorage.setItem(
          getAutoSaveKey(departmentId),
          JSON.stringify({ formData, dumperAssignments })
        );
        setLastSaved(new Date());
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [formData, dumperAssignments, departmentId]);

  // Restore operator and notes from localStorage on mount without overwriting live Hourly Loads assignments
  useEffect(() => {
    const saved = localStorage.getItem(getAutoSaveKey(departmentId));
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.formData) {
          setFormData((prev) => ({
            ...prev,
            excavatorId: parsed.formData.excavatorId || prev.excavatorId,
            operatorId: parsed.formData.operatorId || prev.operatorId,
            notes: parsed.formData.notes || prev.notes,
          }));
        }
      } catch {
        // ignore parse errors
      }
    }
  }, [departmentId]);

  // Auto-select excavator that has active Hourly Loads assignments (or sole excavator)
  useEffect(() => {
    if (formData.excavatorId || excavators.length === 0) return;

    const shiftAssignedExcavator = excavators.find((ex) =>
      loadsState.some((l) => l.excavator_id === ex.id && l.shift_type === formData.shiftType)
    );
    const anyAssignedExcavator = excavators.find((ex) =>
      loadsState.some((l) => l.excavator_id === ex.id)
    );
    const configuredExcavator = excavators.find((ex) =>
      activitiesState.some((a) => a.machine_id === ex.id)
    );
    const siteAssignedExcavator = excavators.find((ex) => Boolean(ex.site_id));
    const defaultExcavator =
      shiftAssignedExcavator ??
      anyAssignedExcavator ??
      configuredExcavator ??
      siteAssignedExcavator ??
      excavators[0];

    if (defaultExcavator) {
      setFormData((prev) =>
        prev.excavatorId ? prev : { ...prev, excavatorId: defaultExcavator.id }
      );
    }
  }, [excavators, loadsState, activitiesState, formData.excavatorId, formData.shiftType]);

  // Pre-populate operator from recent activity
  useEffect(() => {
    if (!formData.operatorId && operators.length > 0) {
      const firstOp = operators[0];
      if (firstOp) {
        setFormData((prev) => ({ ...prev, operatorId: firstOp.id }));
      }
    }
  }, [operators, formData.operatorId]);

  // Resolve the effective shift that has Hourly Loads data for the selected excavator
  const effectiveLoadsShift: HourlyShift = useMemo(() => {
    if (!formData.excavatorId) return formData.shiftType;
    const hasCurrentShift = loadsState.some(
      (l) => l.excavator_id === formData.excavatorId && l.shift_type === formData.shiftType
    );
    if (hasCurrentShift) return formData.shiftType;
    const otherShiftLoad = loadsState.find((l) => l.excavator_id === formData.excavatorId);
    if (otherShiftLoad?.shift_type === 'day' || otherShiftLoad?.shift_type === 'night') {
      return otherShiftLoad.shift_type;
    }
    return formData.shiftType;
  }, [formData.excavatorId, formData.shiftType, loadsState]);

  // Determine site, block mined, coal/waste, and subcategory assigned to this excavator on Hourly Loads tab
  const selectedExcavator = excavators.find((e) => e.id === formData.excavatorId);
  const excavatorActivityConfig =
    activitiesState.find(
      (a) => a.machine_id === formData.excavatorId && a.shift_type === formData.shiftType
    ) ??
    activitiesState.find(
      (a) => a.machine_id === formData.excavatorId && a.shift_type === effectiveLoadsShift
    ) ??
    activitiesState.find((a) => a.machine_id === formData.excavatorId);

  const effectiveSiteId = excavatorActivityConfig?.site_id ?? selectedExcavator?.site_id ?? null;
  const excavatorSite = sites?.find((s) => s.id === effectiveSiteId);

  const siteSpecificBlocks = effectiveSiteId
    ? mineBlocks.filter((mb) => mb.site_id === effectiveSiteId)
    : [];
  const effectiveBlockMinedId =
    excavatorActivityConfig?.block_mined_id ??
    (formData.blockMinedId ||
      (siteSpecificBlocks.length === 1 ? (siteSpecificBlocks[0]?.id ?? null) : null));
  const excavatorBlock = mineBlocks.find((mb) => mb.id === effectiveBlockMinedId);

  const rawMaterialFromHourlyLoads =
    excavatorActivityConfig?.material_type ??
    loadsState.find(
      (l) => l.excavator_id === formData.excavatorId && l.shift_type === effectiveLoadsShift
    )?.material_type ??
    loadsState.find((l) => l.excavator_id === formData.excavatorId)?.material_type ??
    'Waste';

  const parsedMaterial = parseExcavatorMaterial(rawMaterialFromHourlyLoads);
  const effectiveMaterial = formatExcavatorMaterial(
    parsedMaterial.category,
    parsedMaterial.subCategory || null
  );

  // Derive assigned machines for this excavator from Hourly Loads (with fallback to saved excavator_dumper_assignments)
  const derivedAssignedRows = useMemo(() => {
    if (!formData.excavatorId) return [];
    const fromHourlyLoads = deriveExcavatorDumperAssignments(
      loadsState,
      dumpers,
      formData.excavatorId,
      effectiveLoadsShift
    );
    if (fromHourlyLoads.length > 0) {
      return fromHourlyLoads;
    }
    if (excavatorActivityConfig?.id) {
      const fromSavedAssignments = todayAssignments.filter(
        (a) => a.excavator_activity_id === excavatorActivityConfig.id
      );
      if (fromSavedAssignments.length > 0) {
        return fromSavedAssignments.map((a) => ({
          key: `saved-${a.id}`,
          dumperMachineId: a.dumper_machine_id,
          materialType: a.material_type || parsedMaterial.category,
          totalLoads: a.total_loads || 0,
          totalBcm: a.total_bcm ?? 0,
          autoPlaced: true,
          segmentCount: 1,
        }));
      }
    }
    return [];
  }, [
    formData.excavatorId,
    loadsState,
    dumpers,
    effectiveLoadsShift,
    excavatorActivityConfig?.id,
    todayAssignments,
    parsedMaterial.category,
  ]);

  const assignedMachinesSummary = useMemo(() => {
    return derivedAssignedRows.map((row) => {
      const machine = dumpers.find((d) => d.id === row.dumperMachineId);
      return {
        id: row.dumperMachineId,
        name: machine?.name ?? 'Unknown Machine',
        type: machine?.machine_type ?? '',
        totalLoads: row.totalLoads,
        totalBcm: row.totalBcm,
        materialType: row.materialType,
      };
    });
  }, [derivedAssignedRows, dumpers]);

  // Auto-place ADT, RDT, and Dump Truck rows assigned to the selected Excavator on Hourly Loads
  useEffect(() => {
    if (!formData.excavatorId) {
      setDumperAssignments((prev) => prev.filter((row) => !row.autoPlaced));
      return;
    }

    setDumperAssignments((prev) => {
      const derivedKeys = new Set(
        derivedAssignedRows.map((d) => `${d.dumperMachineId}|${d.materialType}`)
      );
      const manualRows = prev.filter(
        (row) =>
          !row.autoPlaced &&
          (!row.dumperMachineId || !derivedKeys.has(`${row.dumperMachineId}|${row.materialType}`))
      );
      return [...derivedAssignedRows, ...manualRows];
    });
  }, [formData.excavatorId, derivedAssignedRows]);

  // Prioritise dumpers assigned to this excavator in hourly_loads or matching its site, while keeping the centralised fleet available
  const assignedDumperIds = useMemo(
    () =>
      new Set([
        ...loadsState
          .filter((l) => l.excavator_id === formData.excavatorId)
          .map((l) => l.machine_id),
        ...derivedAssignedRows.map((r) => r.dumperMachineId),
      ]),
    [loadsState, formData.excavatorId, derivedAssignedRows]
  );

  const siteDumpers = useMemo(() => {
    if (!effectiveSiteId && assignedDumperIds.size === 0) return dumpers;
    return [...dumpers].sort((a, b) => {
      const aAssigned = assignedDumperIds.has(a.id) ? 0 : 1;
      const bAssigned = assignedDumperIds.has(b.id) ? 0 : 1;
      if (aAssigned !== bAssigned) return aAssigned - bAssigned;
      const aSiteMatch = effectiveSiteId && a.site_id === effectiveSiteId ? 0 : 1;
      const bSiteMatch = effectiveSiteId && b.site_id === effectiveSiteId ? 0 : 1;
      if (aSiteMatch !== bSiteMatch) return aSiteMatch - bSiteMatch;
      return a.name.localeCompare(b.name);
    });
  }, [dumpers, effectiveSiteId, assignedDumperIds]);

  // Auto-calculated metrics
  const totalLoads = dumperAssignments.reduce((sum, a) => sum + a.totalLoads, 0);
  const totalBcm = dumperAssignments.reduce((sum, a) => sum + a.totalBcm, 0);
  const bcmPerHour = totalBcm > 0 ? totalBcm / SHIFT_HOURS : 0;
  const loadsPerHour = totalLoads > 0 ? totalLoads / SHIFT_HOURS : 0;
  const estimatedScoopTimeMinutes = totalLoads > 0 ? (SHIFT_HOURS * 60) / totalLoads : 0;
  const autoPlacedCount = dumperAssignments.filter((a) => a.autoPlaced).length;

  // Validation
  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.excavatorId) {
      newErrors.excavatorId = 'Select an excavator';
    }
    if (!formData.operatorId) {
      newErrors.operatorId = 'Select an operator';
    }
    if (dumperAssignments.length === 0) {
      newErrors.dumperAssignments = 'Add at least one dumper assignment';
    }
    if (dumperAssignments.some((a) => !a.dumperMachineId)) {
      newErrors.dumperAssignments = 'All dumper rows must have a machine selected';
    }

    const seen = new Set<string>();
    for (const a of dumperAssignments) {
      if (!a.dumperMachineId) continue;
      const key = `${a.dumperMachineId}|${a.materialType}`;
      if (seen.has(key)) {
        newErrors.dumperAssignments =
          'Duplicate dumper and material combination. Merge or change one.';
        break;
      }
      seen.add(key);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the errors in the form.');
      return;
    }

    setIsSubmitting(true);

    try {
      const activityDate = today || new Date().toISOString().split('T')[0] || '';

      await saveExcavatorActivity({
        departmentId,
        excavatorId: formData.excavatorId,
        operatorId: formData.operatorId,
        activityDate,
        shiftType: formData.shiftType === 'night' ? 'night' : 'day',
        siteId: effectiveSiteId,
        blockMinedId: effectiveBlockMinedId,
        materialType: effectiveMaterial,
        notes: formData.notes || null,
        dumperAssignments: dumperAssignments
          .filter((a) => a.dumperMachineId)
          .map((a) => ({
            dumperMachineId: a.dumperMachineId,
            materialType: a.materialType,
            totalLoads: a.totalLoads,
            totalBcm: a.totalBcm,
          })),
      });

      // Clear form, keep shift/operator
      setFormData((prev) => ({
        excavatorId: '',
        operatorId: prev.operatorId,
        shiftType: prev.shiftType,
        blockMinedId: '',
        notes: '',
      }));
      setDumperAssignments([]);
      setErrors({});
      toast.success('Activity logged successfully');
      setShowSuccessPlus(true);
      localStorage.removeItem(getAutoSaveKey(departmentId));

      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save. Please try again.';
      toast.error(message);
      setErrors({ submit: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAnother = () => {
    setShowSuccessPlus(false);
  };

  return (
    <GlassCard>
      <form onSubmit={handleSubmit} className="space-y-6">
        <header className="w-full rounded-full bg-arch-surface-secondary/80 border border-arch-border-subtle backdrop-blur-md shadow-sm px-6 py-2.5 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-arch-text-primary flex items-center gap-2.5">
            <span className="p-1 rounded-full bg-accent-blue/10 text-[var(--accent-blue)] flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </span>
            Log Excavator Activity
          </h2>
          <div className="flex items-center gap-3">
            {autoPlacedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] text-xs font-medium border border-[var(--accent-blue)]/20">
                <Sparkles className="w-3 h-3" />
                {autoPlacedCount} ADT/RDT auto-placed
              </span>
            )}
            <Link
              href="/hub/executive"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-button bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] text-xs font-medium border border-[var(--accent-blue)]/20 hover:bg-[var(--accent-blue)]/20 hover:border-[var(--accent-blue)]/30 transition-all"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Executive Dashboard
              <ArrowUpRight className="w-3 h-3" />
            </Link>
            {lastSaved && (
              <span className="text-[var(--text-muted)] text-xs hidden sm:inline">
                Draft saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>
        </header>

        {showSuccessPlus ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-accent-green font-medium">Activity logged successfully</p>
            <button
              type="button"
              onClick={handleAddAnother}
              className="w-14 h-14 rounded-full bg-[var(--accent-blue)] text-[var(--bg-secondary)] text-2xl font-medium hover:bg-[var(--accent-blue)]/90 transition-colors flex items-center justify-center"
            >
              +
            </button>
            <p className="text-[var(--text-muted)] text-sm">Add another excavator log</p>
          </div>
        ) : (
          <>
            {/* Top row: Excavator, Operator, Shift — strictly aligned side-by-side */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              {/* Excavator Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wider block">
                  Excavator <span className="text-accent-red">*</span>
                </label>
                <select
                  value={formData.excavatorId}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      excavatorId: e.target.value,
                      blockMinedId: '',
                    }))
                  }
                  className="h-10 w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 text-[var(--text-heading)] text-sm font-medium focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                >
                  <option value="">Select excavator...</option>
                  {excavators.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} {ex.serial_number ? `(${ex.serial_number})` : ''}
                    </option>
                  ))}
                </select>
                {errors.excavatorId && (
                  <p className="text-accent-red text-xs">{errors.excavatorId}</p>
                )}
              </div>

              {/* Operator Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wider block">
                  Operator <span className="text-accent-red">*</span>
                </label>
                <select
                  value={formData.operatorId}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      operatorId: e.target.value,
                    }))
                  }
                  className="h-10 w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 text-[var(--text-heading)] text-sm font-medium focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                >
                  <option value="">Select operator...</option>
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.full_name} ({op.employee_code})
                    </option>
                  ))}
                </select>
                {errors.operatorId && (
                  <p className="text-accent-red text-xs">{errors.operatorId}</p>
                )}
              </div>

              {/* Shift Pill (Auto-detected from System Time) */}
              <div className="space-y-1.5">
                <label className="text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wider block">
                  Shift <span className="text-accent-red">*</span>
                </label>
                <div className="h-10 w-full flex items-center gap-2 px-3.5 rounded-lg border border-accent-green/25 bg-accent-green/5 backdrop-blur-xl">
                  <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse shrink-0" />
                  <p className="text-xs text-accent-green font-semibold capitalize truncate">
                    {formData.shiftType} Shift · All systems operational
                  </p>
                </div>
              </div>
            </div>

            {/* Hourly Loads Recorded Summary & Shift Performance Table */}
            {formData.excavatorId && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text-heading)]">
                    Excavator &amp; Assigned Machines Information ({selectedExcavator?.name})
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Auto-synced from Hourly Loads
                  </span>
                </div>
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/80">
                        <th
                          scope="col"
                          className="text-left text-[var(--text-muted)] py-2.5 px-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap align-middle"
                        >
                          Site / Location
                        </th>
                        <th
                          scope="col"
                          className="text-left text-[var(--text-muted)] py-2.5 px-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap align-middle"
                        >
                          Block Mined
                        </th>
                        <th
                          scope="col"
                          className="text-left text-[var(--text-muted)] py-2.5 px-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap align-middle"
                        >
                          Coal / Waste
                        </th>
                        <th
                          scope="col"
                          className="text-left text-[var(--text-muted)] py-2.5 px-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap align-middle"
                        >
                          Subcategory
                        </th>
                        <th
                          scope="col"
                          className="text-left text-[var(--text-muted)] py-2.5 px-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap align-middle"
                        >
                          Assigned Machines
                        </th>
                        <th
                          scope="col"
                          className="text-right text-[var(--text-muted)] py-2.5 px-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap align-middle"
                        >
                          Total Hauled
                        </th>
                        <th
                          scope="col"
                          className="text-right text-[var(--text-muted)] py-2.5 px-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap align-middle"
                        >
                          BCM / Hr
                        </th>
                        <th
                          scope="col"
                          className="text-right text-[var(--text-muted)] py-2.5 px-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap align-middle"
                        >
                          Loads / Hr
                        </th>
                        <th
                          scope="col"
                          className="text-right text-[var(--text-muted)] py-2.5 px-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap align-middle"
                        >
                          Est. Scoop Time
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-[var(--text-heading)] whitespace-nowrap align-middle">
                          {excavatorSite ? excavatorSite.name : 'Unassigned'}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[var(--text-heading)] whitespace-nowrap align-middle">
                          {excavatorBlock
                            ? `${excavatorBlock.name} (${excavatorBlock.code})`
                            : 'Unassigned'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap align-middle">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              parsedMaterial.category === 'Coal'
                                ? 'bg-neutral-800 text-white'
                                : 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]'
                            }`}
                          >
                            {parsedMaterial.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[var(--text-heading)] whitespace-nowrap align-middle">
                          {parsedMaterial.subCategory || 'Not specified'}
                        </td>
                        <td className="py-2.5 px-3 align-middle">
                          {assignedMachinesSummary.length > 0 ? (
                            <div className="inline-flex flex-wrap items-center gap-1.5">
                              {assignedMachinesSummary.map((m) => (
                                <span
                                  key={`${m.id}-${m.materialType}`}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20 whitespace-nowrap"
                                >
                                  {m.name} ({m.totalLoads} loads · {m.totalBcm.toFixed(1)} BCM)
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-[var(--text-muted)]">
                              None assigned
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-[var(--accent-blue)] whitespace-nowrap align-middle">
                          {totalBcm.toFixed(1)} BCM
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-[var(--accent-blue)] whitespace-nowrap align-middle">
                          {bcmPerHour.toFixed(1)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-accent-green whitespace-nowrap align-middle">
                          {loadsPerHour.toFixed(1)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-[var(--text-heading)] whitespace-nowrap align-middle">
                          {estimatedScoopTimeMinutes > 0
                            ? `${estimatedScoopTimeMinutes.toFixed(1)} min/load`
                            : '—'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Dumper Assignment Table */}
            <div className="border-t border-[var(--border-default)] pt-4">
              <ExcavatorDumperTable
                siteDumpers={siteDumpers}
                excavatorId={formData.excavatorId}
                shiftType={effectiveLoadsShift}
                todayDumperLoads={loadsState}
                assignments={dumperAssignments}
                onAssignmentsChange={setDumperAssignments}
                errors={errors}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-[var(--text-secondary)] text-sm block">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="Optional notes about this excavator activity..."
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors resize-none"
              />
            </div>

            {/* Submit */}
            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-muted)] text-[var(--bg-secondary)] font-medium py-2.5 px-6 rounded-lg transition-colors min-w-[120px]"
              >
                {isSubmitting ? 'Saving...' : 'Log Activity'}
              </button>
            </div>

            <p className="text-[var(--text-muted)] text-xs">
              <span className="text-[var(--accent-blue)]">Tip:</span> Site, Block Mined, Material,
              and BCM are auto-synced from the Hourly Loads sheet.
            </p>
          </>
        )}
      </form>
    </GlassCard>
  );
}
