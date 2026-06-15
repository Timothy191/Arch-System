"use client";

import { useState, useCallback, useEffect } from "react";
import { GlassCard } from "@repo/ui/GlassCard";
import { createBrowserSupabaseClient } from "@repo/supabase/client";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";
import { DelayEntriesForm } from "./DelayEntriesForm";

interface Machine {
  id: string;
  name: string;
  machine_type: string;
  serial_number: string | null;
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

interface MachineOperation {
  id: string;
  machine_id: string;
  operator_id: string | null;
  site_id: string | null;
  shift_type: "day" | "night";
  start_time: string;
  end_time: string | null;
  hours_worked: number | null;
}

interface MachineOperationsFormProps {
  departmentId: string;
  machines: Machine[];
  operators: Operator[];
  sites: Site[];
  todayOperations: MachineOperation[];
}

// Auto-save key for localStorage
const getAutoSaveKey = (deptId: string) => `machine-ops-draft-${deptId}`;

export function MachineOperationsForm({
  departmentId,
  machines,
  operators,
  sites,
  todayOperations,
}: MachineOperationsFormProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  // Determine current shift based on time
  const getCurrentShift = (): "day" | "night" => {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 18 ? "day" : "night";
  };

  // Get default start time (now, rounded to nearest 15 min)
  const getDefaultStartTime = () => {
    const now = new Date();
    const minutes = Math.floor(now.getMinutes() / 15) * 15;
    now.setMinutes(minutes);
    return now.toTimeString().slice(0, 5);
  };

  const [formData, setFormData] = useState({
    machineId: "",
    operatorId: "",
    siteId: "",
    shiftType: getCurrentShift(),
    startTime: getDefaultStartTime(),
    endTime: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDelaySection, setShowDelaySection] = useState(false);
  const [lastOperationId, setLastOperationId] = useState<string | null>(null);

  // Auto-save to localStorage every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (formData.machineId || formData.operatorId) {
        localStorage.setItem(
          getAutoSaveKey(departmentId),
          JSON.stringify(formData),
        );
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

  // Calculate hours worked
  const calculateHours = useCallback(() => {
    if (!formData.startTime || !formData.endTime) return null;

    const start = new Date(`2000-01-01T${formData.startTime}`);
    const end = new Date(`2000-01-01T${formData.endTime}`);

    if (end <= start) return null;

    const diffMs = end.getTime() - start.getTime();
    return diffMs / (1000 * 60 * 60);
  }, [formData.startTime, formData.endTime]);

  const hoursWorked = calculateHours();

  // Validation
  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.machineId) {
      newErrors.machineId = "Select a machine";
    }

    if (!formData.operatorId) {
      newErrors.operatorId = "Select an operator";
    }

    if (!formData.siteId) {
      newErrors.siteId = "Select a site/location";
    }

    if (!formData.startTime) {
      newErrors.startTime = "Enter start time";
    }

    if (formData.endTime && hoursWorked === null) {
      newErrors.endTime = "End time must be after start time";
    }

    if (hoursWorked !== null && hoursWorked > 14) {
      newErrors.endTime = "Hours cannot exceed 14 per shift";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("machine_operations")
        .insert({
          department_id: departmentId,
          machine_id: formData.machineId,
          operator_id: formData.operatorId,
          site_id: formData.siteId,
          shift_date: today,
          shift_type: formData.shiftType,
          start_time: formData.startTime,
          end_time: formData.endTime || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Store the operation ID for delay entries
      if (data?.id) {
        setLastOperationId(data.id);
        setShowDelaySection(true);
      }

      // Clear form and localStorage
      setFormData({
        machineId: "",
        operatorId: formData.operatorId, // Keep operator for next entry
        siteId: formData.siteId, // Keep site for next entry
        shiftType: formData.shiftType,
        startTime: formData.endTime || getDefaultStartTime(), // End time becomes next start
        endTime: "",
      });
      localStorage.removeItem(getAutoSaveKey(departmentId));

      // Refresh page to show new data
      router.refresh();
    } catch (err) {
      setErrors({ submit: "Failed to save. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <GlassCard>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-[var(--text-heading)]">
            Log Machine Operation
          </h3>
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
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, machineId: e.target.value }))
              }
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            >
              <option value="">Select machine...</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.machine_type})
                </option>
              ))}
            </select>
            {errors.machineId && (
              <p className="text-accent-red text-xs">{errors.machineId}</p>
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
                setFormData((prev) => ({ ...prev, operatorId: e.target.value }))
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

          {/* Site Dropdown */}
          <div className="space-y-2">
            <label className="text-[var(--text-secondary)] text-sm block">
              Site/Location <span className="text-accent-red">*</span>
            </label>
            <select
              value={formData.siteId}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, siteId: e.target.value }))
              }
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            >
              <option value="">Select site...</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {errors.siteId && (
              <p className="text-accent-red text-xs">{errors.siteId}</p>
            )}
          </div>

          {/* Shift Type */}
          <div className="space-y-2">
            <label className="text-[var(--text-secondary)] text-sm block">
              Shift <span className="text-accent-red">*</span>
            </label>
            <div className="flex gap-2">
              {["day", "night"].map((shift) => (
                <button
                  key={shift}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      shiftType: shift as "day" | "night",
                    }))
                  }
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    formData.shiftType === shift
                      ? "bg-[var(--accent-cyan)] text-[var(--bg-secondary)]"
                      : "bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-heading)]"
                  }`}
                >
                  {shift.charAt(0).toUpperCase() + shift.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Start Time */}
          <div className="space-y-2">
            <label className="text-[var(--text-secondary)] text-sm block">
              Start Time <span className="text-accent-red">*</span>
            </label>
            <input
              type="time"
              value={formData.startTime}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, startTime: e.target.value }))
              }
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            />
            {errors.startTime && (
              <p className="text-accent-red text-xs">{errors.startTime}</p>
            )}
          </div>

          {/* End Time */}
          <div className="space-y-2">
            <label className="text-[var(--text-secondary)] text-sm block">
              End Time
            </label>
            <input
              type="time"
              value={formData.endTime}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, endTime: e.target.value }))
              }
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            />
            {errors.endTime && (
              <p className="text-accent-red text-xs">{errors.endTime}</p>
            )}
          </div>
        </div>

        {/* Hours Worked Display */}
        {hoursWorked !== null && (
          <div className="flex items-center gap-4 p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-default)]">
            <span className="text-[var(--text-muted)] text-sm">
              Hours Worked:
            </span>
            <span className="text-2xl font-medium text-[var(--accent-cyan)]">
              {hoursWorked.toFixed(2)}h
            </span>
            <span className="text-[var(--text-muted)] text-xs">
              (auto-calculated)
            </span>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-muted)] text-[var(--bg-secondary)] font-medium py-2.5 px-6 rounded-lg transition-colors min-w-[120px]"
          >
            {isSubmitting ? "Saving..." : "Save Operation"}
          </button>

          {errors.submit && (
            <p className="text-accent-red text-sm">{errors.submit}</p>
          )}
        </div>

        {/* Help Text */}
        <p className="text-[var(--text-muted)] text-xs">
          <span className="text-[var(--accent-cyan)]">Tip:</span> End time is
          optional. You can come back and add it later. Hours are calculated
          automatically.
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
            {showDelaySection ? (
              <ChevronUp size={18} />
            ) : (
              <ChevronDown size={18} />
            )}
            <Clock size={18} />
            <span className="font-medium">
              {showDelaySection ? "Hide Delay Entries" : "Add Delay Entries"}
            </span>
          </button>

          {showDelaySection && (
            <div className="mt-4">
              <DelayEntriesForm
                machineOperationId={lastOperationId}
                departmentId={departmentId}
              />
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
