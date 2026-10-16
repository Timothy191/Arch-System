'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import { getCurrentShift } from '@repo/utils/client';
import { ChevronDown, ChevronUp, Clock, Drill } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DelayEntriesForm } from './DelayEntriesForm';

interface Machine {
  id: string;
  name: string;
  machine_type: string;
  serial_number: string | null;
  site_id?: string | null;
  latest_smu?: number | null;
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
  code: string | null;
  site_id: string | null;
}

interface MachineOperation {
  id: string;
  machine_id: string;
  operator_id: string | null;
  site_id: string | null;
  shift_type: 'day' | 'night';
  start_time: string;
  end_time: string | null;
  hours_worked: number | null;
  start_smu?: number | null;
  end_smu?: number | null;
  block_drilled?: string | null;
  meters_drilled?: number | null;
  holes_drilled?: number | null;
}

interface MachineOperationsFormProps {
  departmentId: string;
  machines: Machine[];
  operators: Operator[];
  sites: Site[];
  mineBlocks?: MineBlock[];
  todayOperations: MachineOperation[];
}

// Auto-save key for localStorage
const getAutoSaveKey = (deptId: string) => `machine-ops-draft-${deptId}`;

export function MachineOperationsForm({
  departmentId,
  machines,
  operators,
  sites,
  mineBlocks = [],
  todayOperations,
}: MachineOperationsFormProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  // Get default start time (now, rounded to nearest 15 min)
  const getDefaultStartTime = () => {
    const now = new Date();
    const minutes = Math.floor(now.getMinutes() / 15) * 15;
    now.setMinutes(minutes);
    return now.toTimeString().slice(0, 5);
  };

  const [formData, setFormData] = useState({
    machineId: '',
    operatorId: '',
    siteId: '',
    shiftType: getCurrentShift(),
    startTime: getDefaultStartTime(),
    endTime: '',
    startSmu: '',
    endSmu: '',
    metersDrilled: '',
    blockDrilled: '',
    holesDrilled: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDelaySection, setShowDelaySection] = useState(false);
  const [lastOperationId, setLastOperationId] = useState<string | null>(null);

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === formData.machineId) ?? null,
    [machines, formData.machineId]
  );

  const isDrillRig =
    selectedMachine?.machine_type === 'Drill Rig' ||
    Boolean(selectedMachine?.machine_type?.toLowerCase().includes('drill'));

  const isDozer =
    selectedMachine?.machine_type === 'Dozer' ||
    Boolean(selectedMachine?.machine_type?.toLowerCase().includes('dozer'));

  const DOZER_PUSH_FACTOR_BCM_PER_HOUR = 250;

  const availableBlocks = useMemo(() => {
    if (!mineBlocks || mineBlocks.length === 0) return [];
    if (!formData.siteId) return mineBlocks;
    const siteBlocks = mineBlocks.filter((b) => !b.site_id || b.site_id === formData.siteId);
    return siteBlocks.length > 0 ? siteBlocks : mineBlocks;
  }, [mineBlocks, formData.siteId]);

  // Auto-save to localStorage every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (formData.machineId || formData.operatorId) {
        localStorage.setItem(getAutoSaveKey(departmentId), JSON.stringify(formData));
        setLastSaved(new Date());
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [formData, departmentId]);

  // Restore from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(getAutoSaveKey(departmentId));
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormData((prev) => ({ ...prev, ...parsed }));
      } catch {
        // ignore parse errors
      }
    }
  }, [departmentId]);

  // Pre-populate operator if there's a pattern
  useEffect(() => {
    if (todayOperations.length > 0 && !formData.operatorId) {
      // Use the most recent operator as default
      const lastOp = todayOperations[0];
      if (lastOp?.operator_id) {
        setFormData((prev) => ({ ...prev, operatorId: lastOp.operator_id! }));
      }
    }
  }, [todayOperations, formData.operatorId]);

  // Calculate hours worked based on SMR readings (matching Postgres computed column)
  const calculateHours = useCallback(() => {
    if (formData.startSmu && formData.endSmu) {
      const s = parseFloat(formData.startSmu);
      const e = parseFloat(formData.endSmu);
      if (!Number.isNaN(s) && !Number.isNaN(e) && e >= s) {
        return e - s;
      }
    }
    return null;
  }, [formData.startSmu, formData.endSmu]);

  const hoursWorked = calculateHours();

  // Validation
  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.machineId) {
      newErrors.machineId = 'Select a machine';
    }

    if (!formData.operatorId) {
      newErrors.operatorId = 'Select an operator';
    }

    if (!formData.siteId) {
      newErrors.siteId = 'Select a site/location';
    }

    if (!formData.startSmu) {
      newErrors.startSmu = 'Enter start SMR';
    } else if (Number.isNaN(parseFloat(formData.startSmu))) {
      newErrors.startSmu = 'Start SMR must be a valid number';
    }

    if (formData.endSmu && Number.isNaN(parseFloat(formData.endSmu))) {
      newErrors.endSmu = 'Stop SMR must be a valid number';
    }

    if (formData.startSmu && formData.endSmu) {
      const s = parseFloat(formData.startSmu);
      const e = parseFloat(formData.endSmu);
      if (e < s) {
        newErrors.endSmu = 'Stop SMR cannot be less than Start SMR';
      }
    }

    if (hoursWorked !== null && hoursWorked > 14) {
      newErrors.endSmu = 'Hours cannot exceed 14 per shift';
    }

    if (isDrillRig) {
      if (!formData.metersDrilled.trim()) {
        newErrors.metersDrilled = 'Enter meters drilled';
      } else if (
        Number.isNaN(parseFloat(formData.metersDrilled)) ||
        parseFloat(formData.metersDrilled) < 0
      ) {
        newErrors.metersDrilled = 'Meters must be a valid number >= 0';
      }

      if (!formData.blockDrilled.trim()) {
        newErrors.blockDrilled = 'Enter or select block drilled';
      }

      if (!formData.holesDrilled.trim()) {
        newErrors.holesDrilled = 'Enter holes drilled';
      } else if (
        Number.isNaN(Number(formData.holesDrilled)) ||
        Number(formData.holesDrilled) < 0 ||
        !Number.isInteger(Number(formData.holesDrilled))
      ) {
        newErrors.holesDrilled = 'Holes must be a valid whole number >= 0';
      }
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
      const startSmuVal = formData.startSmu ? parseFloat(formData.startSmu) : null;
      const endSmuVal = formData.endSmu ? parseFloat(formData.endSmu) : null;

      const insertPayload: Record<string, unknown> = {
        department_id: departmentId,
        machine_id: formData.machineId,
        operator_id: formData.operatorId,
        site_id: formData.siteId,
        shift_date: today,
        shift_type: formData.shiftType,
        start_time: formData.startTime,
        end_time: formData.endTime || null,
        start_smu: startSmuVal,
        end_smu: endSmuVal,
      };

      if (isDrillRig) {
        insertPayload.block_drilled = formData.blockDrilled.trim();
        insertPayload.meters_drilled = parseFloat(formData.metersDrilled);
        insertPayload.holes_drilled = parseInt(formData.holesDrilled, 10);
      }

      const { data, error } = await supabase
        .from('machine_operations')
        .insert(insertPayload as never)
        .select()
        .single();

      if (error) throw error;

      if (isDozer && startSmuVal !== null && endSmuVal !== null && endSmuVal >= startSmuVal) {
        const selectedSite = sites.find((s) => s.id === formData.siteId);
        const selectedOperator = operators.find((op) => op.id === formData.operatorId);
        await supabase.from('dozer_rollover_logs').insert({
          department_id: departmentId,
          shift_date: today,
          shift_type: formData.shiftType,
          site_code: selectedSite?.site_code || 'EXT',
          machine_id: formData.machineId,
          operator_name: selectedOperator?.full_name || null,
          start_smu: startSmuVal,
          end_smu: endSmuVal,
          push_factor_bcm_per_hour: DOZER_PUSH_FACTOR_BCM_PER_HOUR,
        } as never);
      }

      // Store the operation ID for delay entries
      if (data?.id) {
        setLastOperationId(data.id);
        setShowDelaySection(true);
      }

      // Clear form and localStorage
      setFormData({
        machineId: '',
        operatorId: formData.operatorId, // Keep operator for next entry
        siteId: formData.siteId, // Keep site for next entry
        shiftType: formData.shiftType,
        startTime: formData.endTime || getDefaultStartTime(), // End time becomes next start
        endTime: '',
        startSmu: formData.endSmu || '', // End SMU carries over to next start SMU
        endSmu: '',
        metersDrilled: '',
        blockDrilled: '',
        holesDrilled: '',
      });
      localStorage.removeItem(getAutoSaveKey(departmentId));

      toast.success(
        isDrillRig
          ? 'Drill operation logged & synced to Drilling Department'
          : 'Machine operation logged successfully'
      );
      // Refresh page to show new data
      router.refresh();
    } catch (_err) {
      toast.error('Failed to save. Please try again.');
      setErrors({ submit: 'Failed to save. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <GlassCard>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-[var(--text-heading)]">Log Machine Operation</h3>
          {lastSaved && (
            <span className="text-[var(--text-muted)] text-xs">
              Draft saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Machine Dropdown */}
          <div className="space-y-2">
            <label className="text-[var(--text-secondary)] text-sm block">
              Machine <span className="text-accent-red">*</span>
            </label>
            <select
              value={formData.machineId}
              onChange={(e) => {
                const nextMachineId = e.target.value;
                const machineObj = machines.find((m) => m.id === nextMachineId);
                setFormData((prev) => ({
                  ...prev,
                  machineId: nextMachineId,
                  siteId: prev.siteId || machineObj?.site_id || '',
                  startSmu:
                    machineObj?.latest_smu != null ? String(machineObj.latest_smu) : prev.startSmu,
                }));
              }}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            >
              <option value="">Select machine...</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.machine_type})
                  {m.latest_smu != null ? ` — Close SMR: ${m.latest_smu}` : ''}
                </option>
              ))}
            </select>
            {errors.machineId && <p className="text-accent-red text-xs">{errors.machineId}</p>}
          </div>

          {/* Operator Dropdown */}
          <div className="space-y-2">
            <label className="text-[var(--text-secondary)] text-sm block">
              Operator <span className="text-accent-red">*</span>
            </label>
            <select
              value={formData.operatorId}
              onChange={(e) => setFormData((prev) => ({ ...prev, operatorId: e.target.value }))}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            >
              <option value="">Select operator...</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.full_name} ({op.employee_code})
                </option>
              ))}
            </select>
            {errors.operatorId && <p className="text-accent-red text-xs">{errors.operatorId}</p>}
          </div>

          {/* Site Dropdown */}
          <div className="space-y-2">
            <label className="text-[var(--text-secondary)] text-sm block">
              Site/Location <span className="text-accent-red">*</span>
            </label>
            <select
              value={formData.siteId}
              onChange={(e) => setFormData((prev) => ({ ...prev, siteId: e.target.value }))}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            >
              <option value="">Select site...</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {errors.siteId && <p className="text-accent-red text-xs">{errors.siteId}</p>}
          </div>

          {/* Start SMR */}
          <div className="space-y-2">
            <label className="text-[var(--text-secondary)] text-sm block">
              Start SMR <span className="text-accent-red">*</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 1420.5"
              value={formData.startSmu}
              onChange={(e) => setFormData((prev) => ({ ...prev, startSmu: e.target.value }))}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm font-mono focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            />
            {errors.startSmu && <p className="text-accent-red text-xs">{errors.startSmu}</p>}
          </div>

          {/* Stop SMR */}
          <div className="space-y-2">
            <label className="text-[var(--text-secondary)] text-sm block">Stop SMR</label>
            <input
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 1431.0"
              value={formData.endSmu}
              onChange={(e) => setFormData((prev) => ({ ...prev, endSmu: e.target.value }))}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm font-mono focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            />
            {errors.endSmu && <p className="text-accent-red text-xs">{errors.endSmu}</p>}
          </div>
        </div>

        {/* Drill Rig Specific Fields: Meters, Site, Block, Holes */}
        {isDrillRig && (
          <div className="p-4 rounded-xl bg-[var(--bg-secondary)]/80 border border-[var(--accent-blue)]/30 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]">
                  <Drill className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-heading)]">
                    Drilling Production Metrics
                  </h4>
                  <p className="text-xs text-[var(--text-muted)]">
                    Automatically populates Drilling Department shift logs and production reports
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20">
                Auto-Syncs to Drilling Dept
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Meters */}
              <div className="space-y-2">
                <label className="text-[var(--text-secondary)] text-sm block">
                  Meters <span className="text-accent-red">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g. 185.5"
                  value={formData.metersDrilled}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, metersDrilled: e.target.value }))
                  }
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm font-mono focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                />
                {errors.metersDrilled && (
                  <p className="text-accent-red text-xs">{errors.metersDrilled}</p>
                )}
              </div>

              {/* Site */}
              <div className="space-y-2">
                <label className="text-[var(--text-secondary)] text-sm block">
                  Site <span className="text-accent-red">*</span>
                </label>
                <select
                  value={formData.siteId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, siteId: e.target.value }))}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                >
                  <option value="">Select site...</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {errors.siteId && <p className="text-accent-red text-xs">{errors.siteId}</p>}
              </div>

              {/* Block */}
              <div className="space-y-2">
                <label className="text-[var(--text-secondary)] text-sm block">
                  Block <span className="text-accent-red">*</span>
                </label>
                <input
                  type="text"
                  list="drill-mine-blocks"
                  placeholder="e.g. BLK-A1 / A12"
                  value={formData.blockDrilled}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, blockDrilled: e.target.value }))
                  }
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                />
                {availableBlocks.length > 0 && (
                  <datalist id="drill-mine-blocks">
                    {availableBlocks.map((b) => (
                      <option key={b.id} value={b.code ? `${b.code} - ${b.name}` : b.name} />
                    ))}
                  </datalist>
                )}
                {errors.blockDrilled && (
                  <p className="text-accent-red text-xs">{errors.blockDrilled}</p>
                )}
              </div>

              {/* Holes */}
              <div className="space-y-2">
                <label className="text-[var(--text-secondary)] text-sm block">
                  Holes <span className="text-accent-red">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="e.g. 24"
                  value={formData.holesDrilled}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, holesDrilled: e.target.value }))
                  }
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm font-mono focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                />
                {errors.holesDrilled && (
                  <p className="text-accent-red text-xs">{errors.holesDrilled}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hours Worked & Dozer Roll-over Display */}
        {(hoursWorked !== null || isDozer) && (
          <div className="space-y-3">
            {hoursWorked !== null && (
              <div className="flex items-center gap-4 p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-default)]">
                <span className="text-[var(--text-muted)] text-sm">Hours Worked:</span>
                <span className="text-2xl font-medium text-[var(--accent-blue)]">
                  {hoursWorked.toFixed(2)}h
                </span>
                <span className="text-[var(--text-muted)] text-xs">
                  (SMR calculated: Stop - Start)
                </span>
              </div>
            )}

            {isDozer && (
              <div
                data-testid="dozer-rollover-summary"
                className="flex flex-wrap items-center justify-between gap-4 p-3.5 bg-[var(--bg-secondary)] rounded-lg border border-[var(--accent-blue)]/30"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-heading)]">
                    Roll-over Amount:
                  </span>
                  <span className="text-xs text-[var(--text-muted)] font-mono">
                    ({(hoursWorked ?? 0).toFixed(2)}h &times; {DOZER_PUSH_FACTOR_BCM_PER_HOUR} =
                    Total Roll-over)
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-lg px-3.5 py-1.5">
                  <span className="text-xs text-[var(--text-muted)]">Total Roll-over:</span>
                  <span className="text-xl font-semibold font-mono text-[var(--accent-blue)]">
                    {Number(
                      ((hoursWorked ?? 0) * DOZER_PUSH_FACTOR_BCM_PER_HOUR).toFixed(1)
                    ).toLocaleString()}{' '}
                    BCM
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-muted)] text-[var(--bg-secondary)] font-medium py-2.5 px-6 rounded-lg transition-colors min-w-[120px]"
          >
            {isSubmitting ? 'Saving...' : 'Save Operation'}
          </button>
        </div>

        {/* Help Text */}
        <p className="text-[var(--text-muted)] text-xs">
          <span className="text-[var(--accent-blue)]">Tip:</span> Stop SMR is optional. You can come
          back and add it later. Hours are calculated automatically.
        </p>
      </form>

      {/* Expandable Delay Entries Section */}
      {lastOperationId && (
        <div className="border-t border-[var(--border-default)] pt-4">
          <button
            type="button"
            onClick={() => setShowDelaySection(!showDelaySection)}
            className="flex items-center gap-2 text-[var(--text-secondary)] text-sm hover:text-[var(--text-heading)] transition-colors"
          >
            {showDelaySection ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            <Clock size={18} />
            <span className="font-medium">
              {showDelaySection ? 'Hide Delay Entries' : 'Add Delay Entries'}
            </span>
          </button>

          {showDelaySection && (
            <div className="mt-4">
              <DelayEntriesForm machineOperationId={lastOperationId} departmentId={departmentId} />
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
