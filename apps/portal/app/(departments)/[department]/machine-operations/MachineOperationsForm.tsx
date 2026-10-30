'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import { getOperationalToday } from '@repo/utils';
import { getCurrentShift } from '@repo/utils/client';
import { ChevronDown, ChevronUp, Clock, Drill, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { invalidateShiftSheetCache } from '@/actions/shift-sheet-cache';
import { computeNextShiftSlot, validateSmrOdometerEntry } from '@/lib/shift-sheet-buckets';
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

export interface EngineeringDelaySummary {
  hours: number;
  reasons: string[];
  status: string;
}

interface MachineOperationsFormProps {
  departmentId: string;
  machines: Machine[];
  operators: Operator[];
  sites: Site[];
  mineBlocks?: MineBlock[];
  todayOperations: MachineOperation[];
  engineeringDelaysByMachine?: Record<string, EngineeringDelaySummary>;
}

// Auto-save key for localStorage
const getAutoSaveKey = (deptId: string) => `machine-ops-draft-${deptId}`;

const DOZER_OTHER_ACTIVITY_PRESETS = [
  'Road / Ramp Maintenance',
  'Stockpile Push',
  'Floor / Pad Cleanup',
  'Berm Construction',
] as const;

export function MachineOperationsForm({
  departmentId,
  machines,
  operators,
  sites,
  mineBlocks = [],
  todayOperations,
  engineeringDelaysByMachine = {},
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
    dozerActivityType: 'rollover' as 'rollover' | 'other',
    dozerOtherDetails: '',
    endsOnBreakdown: false,
    breakdownReason: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDelaySection, setShowDelaySection] = useState(false);
  const [lastOperationId, setLastOperationId] = useState<string | null>(null);
  const [lastOperationMachineId, setLastOperationMachineId] = useState<string>('');

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === formData.machineId) ?? null,
    [machines, formData.machineId]
  );

  const selectedMachineEngineeringDelay = useMemo(() => {
    if (!selectedMachine) return null;
    return (
      engineeringDelaysByMachine[selectedMachine.id] ||
      (selectedMachine.serial_number
        ? engineeringDelaysByMachine[selectedMachine.serial_number]
        : null) ||
      null
    );
  }, [selectedMachine, engineeringDelaysByMachine]);

  const lastOperationEngineeringDelay = useMemo(() => {
    const targetMachineId = lastOperationMachineId || formData.machineId;
    if (!targetMachineId) return null;
    const machineObj = machines.find((m) => m.id === targetMachineId);
    return (
      engineeringDelaysByMachine[targetMachineId] ||
      (machineObj?.serial_number ? engineeringDelaysByMachine[machineObj.serial_number] : null) ||
      null
    );
  }, [lastOperationMachineId, formData.machineId, machines, engineeringDelaysByMachine]);

  const engDelayHours = selectedMachineEngineeringDelay?.hours || 0;
  const maxAllowedShiftHours = Math.max(0, Number((12 - engDelayHours).toFixed(2)));

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

  // Restore from localStorage on mount (guarding against stale startSmu below machine latest_smu)
  useEffect(() => {
    const saved = localStorage.getItem(getAutoSaveKey(departmentId));
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const restoredMachine = parsed?.machineId
          ? machines.find((m) => m.id === parsed.machineId)
          : null;
        const latestSmu =
          restoredMachine?.latest_smu != null ? Number(restoredMachine.latest_smu) : null;
        const parsedStart = parsed?.startSmu ? Number.parseFloat(String(parsed.startSmu)) : null;
        const safeStartSmu =
          latestSmu !== null &&
          (parsedStart === null || Number.isNaN(parsedStart) || parsedStart < latestSmu)
            ? String(latestSmu)
            : (parsed?.startSmu ?? '');
        setFormData((prev) => ({
          ...prev,
          ...parsed,
          startSmu: safeStartSmu,
        }));
      } catch {
        // ignore parse errors
      }
    }
  }, [departmentId, machines]);

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

  const handleSmrFieldChange = (field: 'startSmu' | 'endSmu', rawValue: string) => {
    const nextStartStr = field === 'startSmu' ? rawValue : formData.startSmu;
    const nextEndStr = field === 'endSmu' ? rawValue : formData.endSmu;
    setFormData((prev) => ({ ...prev, [field]: rawValue }));

    const parsedStart = nextStartStr.trim() !== '' ? Number.parseFloat(nextStartStr) : null;
    const parsedEnd = nextEndStr.trim() !== '' ? Number.parseFloat(nextEndStr) : null;
    const minAllowedStartSmr =
      selectedMachine?.latest_smu != null ? Number(selectedMachine.latest_smu) : null;

    const smrCheck = validateSmrOdometerEntry({
      startSmr: parsedStart !== null && !Number.isNaN(parsedStart) ? parsedStart : null,
      stopSmr: parsedEnd !== null && !Number.isNaN(parsedEnd) ? parsedEnd : null,
      minAllowedStartSmr,
      maxAllowedShiftHours,
    });

    if (!smrCheck.valid && smrCheck.error) {
      const targetErrKey = smrCheck.violatedField === 'startSmr' ? 'startSmu' : 'endSmu';
      setErrors((prev) => ({
        ...prev,
        [targetErrKey]: smrCheck.error!,
      }));
      toast.error(`${selectedMachine?.name ? `${selectedMachine.name}: ` : ''}${smrCheck.error}`, {
        id: 'smr-odometer-constraint',
      });
      return;
    }

    setErrors((prev) => {
      const updated = { ...prev };
      delete updated.startSmu;
      delete updated.endSmu;
      return updated;
    });
  };

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

    const parsedStart = formData.startSmu ? parseFloat(formData.startSmu) : null;
    const parsedEnd = formData.endSmu ? parseFloat(formData.endSmu) : null;
    const minAllowedStartSmr =
      selectedMachine?.latest_smu != null ? Number(selectedMachine.latest_smu) : null;

    const smrCheck = validateSmrOdometerEntry({
      startSmr: parsedStart !== null && !Number.isNaN(parsedStart) ? parsedStart : null,
      stopSmr: parsedEnd !== null && !Number.isNaN(parsedEnd) ? parsedEnd : null,
      minAllowedStartSmr,
      maxAllowedShiftHours,
    });

    if (!smrCheck.valid && smrCheck.error) {
      const targetErrKey = smrCheck.startSmrError !== null ? 'startSmu' : 'endSmu';
      newErrors[targetErrKey] = smrCheck.error;
    }

    if (engDelayHours > 0 && hoursWorked !== null && hoursWorked > maxAllowedShiftHours) {
      newErrors.endSmu = `Engineering logged ${engDelayHours.toFixed(1)}h breakdown delay on this 12h shift. Max remaining shift hours: ${maxAllowedShiftHours.toFixed(1)}h.`;
    } else if (hoursWorked !== null && hoursWorked > 14) {
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
      const today = getOperationalToday('Africa/Johannesburg');
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
        operational_status: formData.endsOnBreakdown ? 'BREAKDOWN' : 'ACTIVE',
      };

      if (isDrillRig) {
        insertPayload.block_drilled = formData.blockDrilled.trim();
        insertPayload.meters_drilled = parseFloat(formData.metersDrilled);
        insertPayload.holes_drilled = parseInt(formData.holesDrilled, 10);
      } else if (isDozer) {
        insertPayload.block_drilled =
          formData.dozerActivityType === 'rollover'
            ? 'Roll Over'
            : formData.dozerOtherDetails.trim()
              ? `Other: ${formData.dozerOtherDetails.trim()}`
              : 'Other';
      }

      const { data: existingShiftOps } = await supabase
        .from('machine_operations')
        .select('id')
        .eq('department_id', departmentId)
        .eq('machine_id', formData.machineId)
        .eq('shift_date', today)
        .eq('shift_type', formData.shiftType)
        .order('created_at', { ascending: false })
        .limit(1);

      const existingOpId = existingShiftOps?.[0]?.id;
      const { data, error } = existingOpId
        ? await supabase
            .from('machine_operations')
            .update(insertPayload as never)
            .eq('id', existingOpId)
            .select()
            .single()
        : await supabase
            .from('machine_operations')
            .insert(insertPayload as never)
            .select()
            .single();

      if (error) throw error;

      const isDozerRollover = isDozer && formData.dozerActivityType === 'rollover';

      if (
        isDozerRollover &&
        startSmuVal !== null &&
        endSmuVal !== null &&
        endSmuVal >= startSmuVal
      ) {
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

      // If machine ends shift on breakdown, persist active breakdown + auto-carry over into new shift
      if (formData.endsOnBreakdown && selectedMachine) {
        const carryOverSmr = endSmuVal ?? startSmuVal ?? 0;
        const nextShift = computeNextShiftSlot(today, formData.shiftType);
        const reasonText =
          formData.breakdownReason.trim() ||
          'Ended shift on breakdown (auto-carried over into new shift)';

        await Promise.allSettled([
          supabase.from('breakdowns').insert({
            department_id: departmentId,
            fleet_id: selectedMachine.serial_number || selectedMachine.name,
            machine_name: selectedMachine.name,
            machine_type: selectedMachine.machine_type,
            reason: `${reasonText} [Shift Delay: 12.0h]`,
            date_in: today,
            time_in: new Date().toTimeString().slice(0, 8),
            status: 'active',
            shared_with_departments: ['control-room', 'engineering'],
          } as never),
          supabase.from('machine_operations').insert({
            department_id: departmentId,
            machine_id: formData.machineId,
            operator_id: formData.operatorId || null,
            site_id: formData.siteId || null,
            shift_date: nextShift.shiftDate,
            shift_type: nextShift.shiftType,
            start_time: nextShift.startTime,
            start_smu: carryOverSmr,
            end_smu: carryOverSmr,
            operational_status: 'BREAKDOWN',
          } as never),
        ]);
      }

      // Store the operation ID and machine ID for delay entries
      if (data?.id) {
        setLastOperationId(data.id);
        setLastOperationMachineId(formData.machineId);
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
        dozerActivityType: 'rollover',
        dozerOtherDetails: '',
        endsOnBreakdown: false,
        breakdownReason: '',
      });
      localStorage.removeItem(getAutoSaveKey(departmentId));

      toast.success(
        isDrillRig
          ? 'Drill operation logged & synced to Drilling Department'
          : 'Machine operation logged successfully'
      );
      // Refresh page to show new data
      await invalidateShiftSheetCache({ departmentId, wroteDozerRolls: isDozerRollover }).catch(
        () => {}
      );
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
          <h3 className="font-medium text-[var(--text-heading)] text-lg">Log Machine Operation</h3>
          {lastSaved && (
            <span className="text-[var(--text-muted)] text-xs">
              Draft saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Machine Dropdown */}
          <div className="space-y-2">
            <label className="block text-[var(--text-secondary)] text-sm">
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
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
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
            <label className="block text-[var(--text-secondary)] text-sm">
              Operator <span className="text-accent-red">*</span>
            </label>
            <select
              value={formData.operatorId}
              onChange={(e) => setFormData((prev) => ({ ...prev, operatorId: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
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
            <label className="block text-[var(--text-secondary)] text-sm">
              Site/Location <span className="text-accent-red">*</span>
            </label>
            <select
              value={formData.siteId}
              onChange={(e) => setFormData((prev) => ({ ...prev, siteId: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
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
            <label className="block text-[var(--text-secondary)] text-sm">
              Start SMR <span className="text-accent-red">*</span>
              {selectedMachine?.latest_smu != null && (
                <span className="ml-2 font-mono text-[11px] text-[var(--accent-blue)]">
                  (Min: {Number(selectedMachine.latest_smu).toFixed(1)}h)
                </span>
              )}
            </label>
            <input
              type="number"
              step="0.1"
              min={selectedMachine?.latest_smu ?? 0}
              placeholder="e.g. 1420.5"
              value={formData.startSmu}
              onChange={(e) => handleSmrFieldChange('startSmu', e.target.value)}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 font-mono text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
            />
            {errors.startSmu && <p className="text-accent-red text-xs">{errors.startSmu}</p>}
          </div>

          {/* Stop SMR */}
          <div className="space-y-2">
            <label className="block text-[var(--text-secondary)] text-sm">
              Stop SMR
              {formData.startSmu && !Number.isNaN(Number(formData.startSmu)) && (
                <span className="ml-2 font-mono text-[11px] text-[var(--text-muted)]">
                  (Min: {Number(formData.startSmu).toFixed(1)}h)
                </span>
              )}
            </label>
            <input
              type="number"
              step="0.1"
              min={formData.startSmu || selectedMachine?.latest_smu || 0}
              placeholder="e.g. 1431.0"
              value={formData.endSmu}
              onChange={(e) => handleSmrFieldChange('endSmu', e.target.value)}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 font-mono text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
            />
            {errors.endSmu && <p className="text-accent-red text-xs">{errors.endSmu}</p>}
          </div>
        </div>

        {/* Engineering Cross-Department 12h Shift Budget Banner */}
        {selectedMachine && engDelayHours > 0 && (
          <div
            data-testid="engineering-shift-budget-banner"
            className="space-y-2 rounded-xl border border-amber-300/70 bg-amber-50/90 p-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-700" />
                <span className="font-semibold text-amber-900 text-xs">
                  Cross-Department 12-Hour Shift Budget ({selectedMachine.name})
                </span>
              </div>
              <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 font-mono font-semibold text-amber-900 text-xs">
                Engineering Logged: {engDelayHours.toFixed(1)}h / Remaining Budget:{' '}
                {maxAllowedShiftHours.toFixed(1)}h
              </span>
            </div>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-amber-200/70">
              <div
                className="h-full bg-red-500 transition-all"
                style={{ width: `${Math.min(100, (engDelayHours / 12) * 100)}%` }}
                title={`Engineering Breakdown Delay: ${engDelayHours.toFixed(1)}h`}
              />
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${Math.max(0, ((12 - engDelayHours) / 12) * 100)}%` }}
                title={`Available Shift Budget: ${maxAllowedShiftHours.toFixed(1)}h`}
              />
            </div>
            {selectedMachineEngineeringDelay?.reasons &&
              selectedMachineEngineeringDelay.reasons.length > 0 && (
                <p className="text-[11px] text-amber-800">
                  <strong>Engineering Breakdown Reason:</strong>{' '}
                  {selectedMachineEngineeringDelay.reasons.join(' | ')}
                </p>
              )}
          </div>
        )}

        {/* Drill Rig Specific Fields: Meters, Site, Block, Holes */}
        {isDrillRig && (
          <div className="space-y-4 rounded-xl border border-[var(--accent-blue)]/30 bg-[var(--bg-secondary)]/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-[var(--accent-blue)]/10 p-1.5 text-[var(--accent-blue)]">
                  <Drill className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="font-semibold text-[var(--text-heading)] text-sm">
                    Drilling Production Metrics
                  </h4>
                  <p className="text-[var(--text-muted)] text-xs">
                    Automatically populates Drilling Department shift logs and production reports
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-accent-green/20 bg-accent-green/10 px-2.5 py-0.5 font-medium text-[11px] text-accent-green">
                Auto-Syncs to Drilling Dept
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Meters */}
              <div className="space-y-2">
                <label className="block text-[var(--text-secondary)] text-sm">
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
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2.5 font-mono text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
                />
                {errors.metersDrilled && (
                  <p className="text-accent-red text-xs">{errors.metersDrilled}</p>
                )}
              </div>

              {/* Site */}
              <div className="space-y-2">
                <label className="block text-[var(--text-secondary)] text-sm">
                  Site <span className="text-accent-red">*</span>
                </label>
                <select
                  value={formData.siteId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, siteId: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2.5 text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
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
                <label className="block text-[var(--text-secondary)] text-sm">
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
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2.5 text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
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
                <label className="block text-[var(--text-secondary)] text-sm">
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
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2.5 font-mono text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
                />
                {errors.holesDrilled && (
                  <p className="text-accent-red text-xs">{errors.holesDrilled}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dozer Specific Section: Check Roll Over or Other */}
        {isDozer && (
          <div
            data-testid="dozer-activity-section"
            className="space-y-3 rounded-xl border border-[var(--accent-blue)]/30 bg-[var(--bg-secondary)]/80 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-semibold text-[var(--text-heading)] text-sm">
                  Dozer Activity Type
                </h4>
                <p className="text-[var(--text-muted)] text-xs">
                  Check the related box for this Dozer operation: Roll Over or Other
                </p>
              </div>
              <span className="rounded-full border border-[var(--accent-blue)]/25 bg-[var(--accent-blue)]/10 px-2.5 py-0.5 font-semibold text-[11px] text-[var(--accent-blue)]">
                {formData.dozerActivityType === 'rollover'
                  ? 'Roll Over (250 BCM/h)'
                  : 'Other Dozer Activity'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                data-testid="dozer-activity-rollover-card"
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  formData.dozerActivityType === 'rollover'
                    ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/10'
                    : 'border-[var(--border-default)] bg-[var(--bg-primary)] hover:border-[var(--accent-blue)]/40'
                }`}
              >
                <input
                  type="checkbox"
                  data-testid="dozer-activity-rollover"
                  aria-label="Roll Over"
                  checked={formData.dozerActivityType === 'rollover'}
                  onChange={() =>
                    setFormData((prev) => ({
                      ...prev,
                      dozerActivityType: 'rollover',
                    }))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-[var(--border-default)] accent-[var(--accent-blue)]"
                />
                <div className="space-y-0.5">
                  <span className="block font-semibold text-[var(--text-heading)] text-sm">
                    Roll Over
                  </span>
                  <span className="block text-[var(--text-muted)] text-xs">
                    Rehabilitation &amp; overburden push ({DOZER_PUSH_FACTOR_BCM_PER_HOUR} BCM/h
                    roll-over)
                  </span>
                </div>
              </label>

              <label
                data-testid="dozer-activity-other-card"
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  formData.dozerActivityType === 'other'
                    ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/10'
                    : 'border-[var(--border-default)] bg-[var(--bg-primary)] hover:border-[var(--accent-blue)]/40'
                }`}
              >
                <input
                  type="checkbox"
                  data-testid="dozer-activity-other"
                  aria-label="Other"
                  checked={formData.dozerActivityType === 'other'}
                  onChange={() =>
                    setFormData((prev) => ({
                      ...prev,
                      dozerActivityType: 'other',
                    }))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-[var(--border-default)] accent-[var(--accent-blue)]"
                />
                <div className="space-y-0.5">
                  <span className="block font-semibold text-[var(--text-heading)] text-sm">
                    Other
                  </span>
                  <span className="block text-[var(--text-muted)] text-xs">
                    Road/ramp maintenance, stockpile push, pad prep, or general site work
                  </span>
                </div>
              </label>
            </div>

            {formData.dozerActivityType === 'other' && (
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {DOZER_OTHER_ACTIVITY_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          dozerOtherDetails: preset,
                        }))
                      }
                      className={`rounded-md border px-2 py-1 font-medium text-[11px] transition-colors ${
                        formData.dozerOtherDetails === preset
                          ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)] text-white'
                          : 'border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  aria-label="Other dozer activity details"
                  placeholder="Specify other dozer activity (optional)..."
                  value={formData.dozerOtherDetails}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      dozerOtherDetails: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm focus:border-[var(--accent-blue)] focus:outline-none"
                />
              </div>
            )}
          </div>
        )}

        {/* Hours Worked & Dozer Roll-over Display */}
        {(hoursWorked !== null || isDozer) && (
          <div className="space-y-3">
            {hoursWorked !== null && (
              <div className="flex items-center gap-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
                <span className="text-[var(--text-muted)] text-sm">Hours Worked:</span>
                <span className="font-medium text-2xl text-[var(--accent-blue)]">
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
                className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--accent-blue)]/30 bg-[var(--bg-secondary)] p-3.5"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--text-heading)] text-sm">
                    {formData.dozerActivityType === 'rollover'
                      ? 'Roll-over Amount:'
                      : 'Dozer Activity:'}
                  </span>
                  <span className="font-mono text-[var(--text-muted)] text-xs">
                    {formData.dozerActivityType === 'rollover' ? (
                      <>
                        ({(hoursWorked ?? 0).toFixed(2)}h &times; {DOZER_PUSH_FACTOR_BCM_PER_HOUR} =
                        Total Roll-over)
                      </>
                    ) : (
                      <>
                        Other
                        {formData.dozerOtherDetails.trim()
                          ? ` — ${formData.dozerOtherDetails.trim()}`
                          : ' (General / Non-Roll-over)'}
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3.5 py-1.5">
                  <span className="text-[var(--text-muted)] text-xs">Total Roll-over:</span>
                  <span className="font-mono font-semibold text-[var(--accent-blue)] text-xl">
                    {formData.dozerActivityType === 'rollover'
                      ? Number(
                          ((hoursWorked ?? 0) * DOZER_PUSH_FACTOR_BCM_PER_HOUR).toFixed(1)
                        ).toLocaleString()
                      : '0'}{' '}
                    BCM
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* End-of-Shift Breakdown Auto-Carry-Over Option */}
        <div
          data-testid="machine-ops-ends-on-breakdown-card"
          className={`space-y-2.5 rounded-xl border p-3.5 transition-colors ${
            formData.endsOnBreakdown
              ? 'border-red-500/40 bg-red-500/5'
              : 'border-[var(--border-default)] bg-[var(--bg-secondary)]/60'
          }`}
        >
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              data-testid="machine-ops-ends-on-breakdown"
              checked={formData.endsOnBreakdown}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  endsOnBreakdown: e.target.checked,
                }))
              }
              className="mt-0.5 h-4 w-4 rounded border-[var(--border-default)] accent-red-600"
            />
            <div className="space-y-0.5">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--text-heading)] text-xs">
                <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
                Machine ends shift on breakdown (auto-carry over into new shift)
              </span>
              <span className="block text-[11px] text-[var(--text-muted)]">
                Automatically carries this machine over into the next shift on active breakdown with
                opening SMR locked to Stop SMR until booked out.
              </span>
            </div>
          </label>
          {formData.endsOnBreakdown && (
            <input
              type="text"
              aria-label="Breakdown carry-over reason"
              placeholder="Enter breakdown fault / reason for next shift handover..."
              value={formData.breakdownReason}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  breakdownReason: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-red-500/40 bg-white px-3 py-2 text-[var(--text-heading)] text-xs focus:border-red-500 focus:outline-none"
            />
          )}
        </div>

        {/* Submit Button */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[120px] rounded-lg bg-[var(--accent-blue)] px-6 py-2.5 font-medium text-[var(--bg-secondary)] transition-colors hover:bg-[var(--accent-blue)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-muted)]"
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
        <div className="border-[var(--border-default)] border-t pt-4">
          <button
            type="button"
            onClick={() => setShowDelaySection(!showDelaySection)}
            className="flex items-center gap-2 text-[var(--text-secondary)] text-sm transition-colors hover:text-[var(--text-heading)]"
          >
            {showDelaySection ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            <Clock size={18} />
            <span className="font-medium">
              {showDelaySection ? 'Hide Delay Entries' : 'Add Delay Entries'}
            </span>
          </button>

          {showDelaySection && (
            <div className="mt-4">
              <DelayEntriesForm
                machineOperationId={lastOperationId}
                departmentId={departmentId}
                engineeringDelayHours={lastOperationEngineeringDelay?.hours || 0}
                engineeringDelayReasons={lastOperationEngineeringDelay?.reasons || []}
              />
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
