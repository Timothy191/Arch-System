'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import { getCurrentShift } from '@repo/utils/client';
import { Activity, ArrowUpRight, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
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

interface HourlyLoadSummary {
  machine_id: string;
  shift_type: string;
  total_loads: number;
}

interface ExcavatorActivityFormProps {
  departmentId: string;
  excavators: ExcavatorMachine[];
  dumpers: DumperMachine[];
  operators: Operator[];
  sites?: Site[];
  mineBlocks: MineBlock[];
  todayDumperLoads: HourlyLoadSummary[];
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
}: ExcavatorActivityFormProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

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

  // Restore from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(getAutoSaveKey(departmentId));
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.formData) setFormData(parsed.formData);
        if (parsed.dumperAssignments) setDumperAssignments(parsed.dumperAssignments);
      } catch {
        // ignore parse errors
      }
    }
  }, [departmentId]);

  // Pre-populate operator from recent activity
  useEffect(() => {
    if (!formData.operatorId && operators.length > 0) {
      const firstOp = operators[0];
      if (firstOp) {
        setFormData((prev) => ({ ...prev, operatorId: firstOp.id }));
      }
    }
  }, [operators, formData.operatorId]);

  // Determine site assigned to this excavator on Hourly Loads tab
  const selectedExcavator = excavators.find((e) => e.id === formData.excavatorId);
  const effectiveSiteId = selectedExcavator?.site_id ?? null;
  const excavatorSite = sites?.find((s) => s.id === effectiveSiteId);

  // Filter dumpers and mine blocks by the excavator's assigned site
  const siteDumpers = effectiveSiteId
    ? dumpers.filter((d) => d.site_id === effectiveSiteId || d.site_id === null)
    : dumpers;

  const siteMineBlocks = effectiveSiteId
    ? mineBlocks.filter((mb) => mb.site_id === effectiveSiteId || mb.site_id === null)
    : mineBlocks;

  // Auto-calculated metrics
  const totalLoads = dumperAssignments.reduce((sum, a) => sum + a.totalLoads, 0);
  const totalBcm = dumperAssignments.reduce((sum, a) => sum + a.totalBcm, 0);
  const bcmPerHour = totalBcm > 0 ? totalBcm / SHIFT_HOURS : 0;
  const loadsPerHour = totalLoads > 0 ? totalLoads / SHIFT_HOURS : 0;
  const estimatedScoopTimeMinutes = totalLoads > 0 ? (SHIFT_HOURS * 60) / totalLoads : 0;

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
      const today = new Date().toISOString().split('T')[0];

      // Insert excavator_activity
      const { data: activityData, error: activityError } = await supabase
        .from('excavator_activity')
        .insert({
          department_id: departmentId,
          machine_id: formData.excavatorId,
          operator_id: formData.operatorId || null,
          activity_date: today,
          shift_type: formData.shiftType,
          site_id: effectiveSiteId,
          block_mined_id: formData.blockMinedId || null,
          passes: 0,
          loads: totalLoads,
          notes: formData.notes || null,
        })
        .select('id')
        .single();

      if (activityError) throw activityError;

      const activityId = activityData.id;

      // Insert dumper assignments
      if (dumperAssignments.length > 0) {
        const assignmentRows = dumperAssignments
          .filter((a) => a.dumperMachineId)
          .map((a) => ({
            excavator_activity_id: activityId,
            dumper_machine_id: a.dumperMachineId,
            material_type: a.materialType,
            total_loads: a.totalLoads,
            total_bcm: a.totalBcm || null,
          }));

        const { error: assignError } = await supabase
          .from('excavator_dumper_assignments')
          .insert(assignmentRows);

        if (assignError) {
          // Clean up the activity record if assignments fail
          await supabase.from('excavator_activity').delete().eq('id', activityId);
          throw assignError;
        }
      }

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
            {/* Top row: Excavator, Operator, Shift, Block Mined */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Excavator Dropdown */}
              <div className="space-y-2">
                <label className="text-[var(--text-secondary)] text-sm block">
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
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
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
                {excavatorSite && (
                  <p className="text-[var(--text-muted)] text-xs">
                    Site:{' '}
                    <span className="text-[var(--text-heading)] font-medium">
                      {excavatorSite.name}
                    </span>{' '}
                    (from Hourly Loads)
                  </p>
                )}
              </div>

              {/* Operator Dropdown */}
              <div className="space-y-2">
                <label className="text-[var(--text-secondary)] text-sm block">
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
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
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
              <div className="space-y-2">
                <label className="text-[var(--text-secondary)] text-sm block">
                  Shift <span className="text-accent-red">*</span>
                </label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-full border border-accent-green/20 bg-accent-green/5 w-fit backdrop-blur-xl shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                  <p className="text-xs text-accent-green font-medium capitalize">
                    {formData.shiftType} Shift · All systems operational
                  </p>
                </div>
              </div>

              {/* Block Mined Dropdown */}
              <div className="space-y-2">
                <label className="text-[var(--text-secondary)] text-sm block">Block Mined</label>
                <select
                  value={formData.blockMinedId}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      blockMinedId: e.target.value,
                    }))
                  }
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                >
                  <option value="">Select block...</option>
                  {siteMineBlocks.map((mb) => (
                    <option key={mb.id} value={mb.id}>
                      {mb.name} ({mb.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dumper Assignment Table */}
            <div className="border-t border-[var(--border-default)] pt-4">
              <ExcavatorDumperTable
                siteDumpers={siteDumpers}
                shiftType={formData.shiftType}
                todayDumperLoads={todayDumperLoads}
                assignments={dumperAssignments}
                onAssignmentsChange={setDumperAssignments}
                errors={errors}
              />
            </div>

            {/* Auto-calculated Metrics */}
            {dumperAssignments.length > 0 && dumperAssignments.some((a) => a.dumperMachineId) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-default)]">
                <div>
                  <p className="text-[var(--text-muted)] text-xs">Total Hauled</p>
                  <p className="text-lg font-medium text-[var(--accent-blue)]">
                    {totalBcm.toFixed(1)} BCM
                  </p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)] text-xs">BCM/Hour</p>
                  <p className="text-lg font-medium text-accent-blue">{bcmPerHour.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)] text-xs">Loads/Hour</p>
                  <p className="text-lg font-medium text-accent-green">{loadsPerHour.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)] text-xs">Est. Scoop Time</p>
                  <p className="text-lg font-medium text-[var(--text-heading)]">
                    {estimatedScoopTimeMinutes > 0
                      ? `${estimatedScoopTimeMinutes.toFixed(1)} min/load`
                      : '--'}
                  </p>
                </div>
              </div>
            )}

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
              <span className="text-[var(--accent-blue)]">Tip:</span> BCM is auto-calculated from
              hourly loads data. Select a site to see available dumpers.
            </p>
          </>
        )}
      </form>
    </GlassCard>
  );
}
