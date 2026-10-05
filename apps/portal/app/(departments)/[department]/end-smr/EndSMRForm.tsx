'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Props {
  departmentId: string;
  machines: any[];
  sites: any[];
  operators: any[];
  shiftDate: string;
}

export function EndSMRForm({ departmentId, machines, sites, operators, shiftDate }: Props) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    machineId: '',
    operatorId: '',
    siteId: '',
    shiftType: 'day' as 'day' | 'night',
    startSmu: '',
    endSmu: '',
    // Drill specific
    blockDrilled: '',
    metersDrilled: '',
    holesDrilled: '',
  });

  const [selectedMachine, setSelectedMachine] = useState<any>(null);

  useEffect(() => {
    const machine = machines.find((m) => m.id === formData.machineId);
    setSelectedMachine(machine || null);
  }, [formData.machineId, machines]);

  const isDrillRig = selectedMachine?.machine_type === 'Drill Rig';

  const validate = () => {
    if (!formData.machineId) return 'Machine is required.';
    if (!formData.operatorId) return 'Operator is required.';
    if (!formData.siteId) return 'Site is required.';
    if (!formData.startSmu || Number.isNaN(Number(formData.startSmu)))
      return 'Start SMR must be a valid number.';
    if (!formData.endSmu || Number.isNaN(Number(formData.endSmu)))
      return 'End SMR must be a valid number.';
    if (Number(formData.endSmu) < Number(formData.startSmu))
      return 'End SMR cannot be less than Start SMR.';

    if (isDrillRig) {
      if (!formData.blockDrilled?.trim()) return 'Block Drilled is required for Drill Rigs.';
      if (
        !formData.metersDrilled ||
        Number.isNaN(Number(formData.metersDrilled)) ||
        Number(formData.metersDrilled) < 0
      ) {
        return 'Meters Drilled must be a valid number >= 0.';
      }
      if (
        !formData.holesDrilled ||
        Number.isNaN(Number(formData.holesDrilled)) ||
        Number(formData.holesDrilled) < 0 ||
        !Number.isInteger(Number(formData.holesDrilled))
      ) {
        return 'Holes Drilled must be a valid integer >= 0.';
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errorMsg = validate();
    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }

    setIsSubmitting(true);
    try {
      // Find today's daily_log for this department
      const { data: dailyLog } = await supabase
        .from('daily_logs')
        .select('id')
        .eq('department_id', departmentId)
        .eq('log_date', shiftDate)
        .single();

      const payload: any = {
        department_id: departmentId,
        machine_id: formData.machineId,
        operator_id: formData.operatorId,
        site_id: formData.siteId,
        shift_date: shiftDate,
        shift_type: formData.shiftType,
        start_smu: parseFloat(formData.startSmu),
        end_smu: parseFloat(formData.endSmu),
        start_time: formData.shiftType === 'day' ? '06:00' : '18:00',
        end_time: formData.shiftType === 'day' ? '18:00' : '06:00',
      };

      if (dailyLog?.id) {
        payload.daily_log_id = dailyLog.id;
        payload.daily_log_date = shiftDate;
      }

      if (isDrillRig) {
        payload.block_drilled = formData.blockDrilled.trim();
        payload.meters_drilled = parseFloat(formData.metersDrilled);
        payload.holes_drilled = parseInt(formData.holesDrilled, 10);
      }

      const { error } = await supabase.from('machine_operations').insert(payload);

      if (error) {
        // If unique constraint error (machine_shift_start_smu_key)
        if (error.code === '23505') {
          toast.error('An SMR entry for this machine, shift, and start SMR already exists.');
        } else {
          toast.error(error.message);
        }
        setIsSubmitting(false);
        return;
      }

      toast.success('End SMR saved successfully');
      setFormData({
        machineId: '',
        operatorId: '',
        siteId: '',
        shiftType: formData.shiftType,
        startSmu: '',
        endSmu: '',
        blockDrilled: '',
        metersDrilled: '',
        holesDrilled: '',
      });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <GlassCard variant="spotlight" className="p-6 max-w-4xl">
      <h3 className="text-lg font-medium text-[var(--text-heading)] mb-4">Record End SMR</h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Machine Dropdown */}
          <div className="space-y-2">
            <label className="text-[var(--text-secondary)] text-sm block">
              Machine <span className="text-accent-red">*</span>
            </label>
            <select
              value={formData.machineId}
              onChange={(e) => setFormData((prev) => ({ ...prev, machineId: e.target.value }))}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            >
              <option value="">Select machine...</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.machine_type})
                </option>
              ))}
            </select>
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
          </div>

          {/* Shift Type */}
          <div className="space-y-2">
            <label className="text-[var(--text-secondary)] text-sm block">
              Shift <span className="text-accent-red">*</span>
            </label>
            <div className="flex gap-2">
              {['day', 'night'].map((shift) => (
                <button
                  key={shift}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      shiftType: shift as 'day' | 'night',
                    }))
                  }
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    formData.shiftType === shift
                      ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)]'
                      : 'bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                  }`}
                >
                  {shift.charAt(0).toUpperCase() + shift.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Start SMR */}
          <div className="space-y-2">
            <label className="text-[var(--text-secondary)] text-sm block">
              Start SMR <span className="text-accent-red">*</span>
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.startSmu}
              onChange={(e) => setFormData((prev) => ({ ...prev, startSmu: e.target.value }))}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            />
          </div>

          {/* End SMR */}
          <div className="space-y-2">
            <label className="text-[var(--text-secondary)] text-sm block">
              End SMR <span className="text-accent-red">*</span>
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.endSmu}
              onChange={(e) => setFormData((prev) => ({ ...prev, endSmu: e.target.value }))}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            />
          </div>
        </div>

        {/* DRILLING PRODUCTION SECTION */}
        {isDrillRig && (
          <div className="mt-6 p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)]">
            <h4 className="text-sm font-semibold text-[var(--text-heading)] mb-4">
              DRILLING PRODUCTION
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[var(--text-secondary)] text-sm block">
                  Block Drilled <span className="text-accent-red">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. A12"
                  value={formData.blockDrilled}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, blockDrilled: e.target.value }))
                  }
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[var(--text-secondary)] text-sm block">
                  Meters Drilled <span className="text-accent-red">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.metersDrilled}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, metersDrilled: e.target.value }))
                  }
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[var(--text-secondary)] text-sm block">
                  Holes Drilled <span className="text-accent-red">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.holesDrilled}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, holesDrilled: e.target.value }))
                  }
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 disabled:opacity-50 text-white font-medium py-2.5 px-6 rounded-lg transition-colors"
          >
            {isSubmitting ? 'Submitting...' : 'Submit End SMR'}
          </button>
        </div>
      </form>
    </GlassCard>
  );
}
