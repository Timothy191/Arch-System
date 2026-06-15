"use client";

import { useState, useCallback, useEffect } from "react";
import { GlassCard } from "@repo/ui/GlassCard";
import { createBrowserSupabaseClient } from "@repo/supabase/client";
import {
  Plus,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  HelpCircle,
} from "lucide-react";

// AGENT-TRACE: Delay entry form with granular tracking, auto-calculation, and manual override
// Supports draft/committed workflow with role-based access control
// Timezone handling: All times stored as UTC in database, displayed as local time in UI

// AGENT-TRACE: Timezone utilities for consistent time handling across the system
const toLocalTime = (utcString: string): string => {
  const date = new Date(utcString);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

const toUTC = (localString: string): string => {
  const date = new Date(localString);
  return new Date(
    date.getTime() + date.getTimezoneOffset() * 60000,
  ).toISOString();
};

interface DelayCategory {
  id: string;
  name: string;
  description: string | null;
}

interface DelayEntry {
  id?: string;
  delay_category_id: string;
  delay_start_time: string;
  delay_end_time: string;
  is_manual_override: boolean;
  manual_duration_hours: number | null;
  description: string | null;
  status: "draft" | "committed";
}

interface DelayEntriesFormProps {
  machineOperationId: string;
  departmentId: string;
  onDelayChange?: (_delays: DelayEntry[]) => void;
  existingDelays?: DelayEntry[];
  readOnly?: boolean;
}

export function DelayEntriesForm({
  machineOperationId,
  departmentId: _departmentId,
  onDelayChange,
  existingDelays: _existingDelays = [],
  readOnly = false,
}: DelayEntriesFormProps) {
  const supabase = createBrowserSupabaseClient();

  const [categories, setCategories] = useState<DelayCategory[]>([]);
  const [delayEntries, setDelayEntries] = useState<DelayEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "commit" | "remove" | null
  >(null);
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Load delay categories
  useEffect(() => {
    const loadCategories = async () => {
      const { data } = await supabase
        .from("delay_categories")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (data) setCategories(data);
    };
    loadCategories();
  }, [supabase]);

  // Load existing delays for this operation
  useEffect(() => {
    const loadExistingDelays = async () => {
      if (!machineOperationId) return;

      const { data } = await supabase
        .from("delay_entries")
        .select("*")
        .eq("machine_operation_id", machineOperationId)
        .order("delay_start_time");

      if (data) {
        setDelayEntries(
          data.map((d) => ({
            id: d.id,
            delay_category_id: d.delay_category_id,
            // AGENT-TRACE: Convert UTC from database to local time for UI display
            delay_start_time: toLocalTime(d.delay_start_time),
            delay_end_time: toLocalTime(d.delay_end_time),
            is_manual_override: d.is_manual_override,
            manual_duration_hours: d.manual_duration_hours,
            description: d.description,
            status: d.status as "draft" | "committed",
          })),
        );
      }
      setIsLoading(false);
    };
    loadExistingDelays();
  }, [machineOperationId, supabase]);

  // Calculate duration from start/end times
  const calculateDuration = useCallback(
    (startTime: string, endTime: string): number => {
      const start = new Date(startTime);
      const end = new Date(endTime);
      const diffMs = end.getTime() - start.getTime();
      return diffMs / (1000 * 60 * 60); // Convert to hours
    },
    [],
  );

  // Validate a single delay entry
  const validateEntry = useCallback(
    (entry: DelayEntry, index: number): string | null => {
      if (!entry.delay_category_id) {
        return "Category is required";
      }

      if (!entry.delay_start_time) {
        return "Start time is required";
      }

      // AGENT-TRACE: End time is required unless manual override is enabled
      // For manual override, duration is explicit and end time can be calculated later
      if (!entry.is_manual_override && !entry.delay_end_time) {
        return "End time is required (unless using manual override)";
      }

      // Validate end time if provided
      if (entry.delay_end_time) {
        const start = new Date(entry.delay_start_time);
        const end = new Date(entry.delay_end_time);

        if (end <= start) {
          return "End time must be after start time";
        }
      }

      // Calculate duration
      let duration: number;
      if (entry.is_manual_override) {
        duration = entry.manual_duration_hours || 0;
      } else if (entry.delay_end_time) {
        duration = calculateDuration(
          entry.delay_start_time,
          entry.delay_end_time,
        );
      } else {
        return "Duration cannot be calculated without end time";
      }

      if (duration <= 0) {
        return "Duration must be greater than 0";
      }

      // Check total duration for this operation
      const otherEntries = delayEntries.filter((_, i) => i !== index);
      const totalDuration = otherEntries.reduce((sum, e) => {
        const d = e.is_manual_override
          ? e.manual_duration_hours || 0
          : calculateDuration(e.delay_start_time, e.delay_end_time);
        return sum + d;
      }, 0);

      if (totalDuration + duration > 12) {
        return `Total delay hours cannot exceed 12 hours. Current: ${totalDuration.toFixed(2)}h, This entry: ${duration.toFixed(2)}h`;
      }

      return null;
    },
    [delayEntries, calculateDuration],
  );

  // Add new empty delay entry
  const addDelayEntry = useCallback(() => {
    const newEntry: DelayEntry = {
      delay_category_id: "",
      delay_start_time: new Date().toISOString().slice(0, 16),
      delay_end_time: new Date(Date.now() + 60 * 60 * 1000)
        .toISOString()
        .slice(0, 16),
      is_manual_override: false,
      manual_duration_hours: null,
      description: "",
      status: "draft",
    };
    setDelayEntries([...delayEntries, newEntry]);
  }, [delayEntries]);

  // Remove delay entry
  const handleRemoveClick = useCallback((index: number) => {
    setConfirmAction("remove");
    setConfirmIndex(index);
    setShowConfirmDialog(true);
  }, []);

  const removeDelayEntry = useCallback(
    (index: number) => {
      setDelayEntries(delayEntries.filter((_, i) => i !== index));
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[index];
        return newErrors;
      });
      setToast({ type: "success", message: "Delay entry removed" });
    },
    [delayEntries],
  );

  // Update delay entry field
  const updateDelayEntry = useCallback(
    (index: number, field: keyof DelayEntry, value: any) => {
      const updatedEntries = [...delayEntries];
      const entry = updatedEntries[index];
      if (!entry) return;

      const newEntry = { ...entry, [field]: value } as DelayEntry;
      updatedEntries[index] = newEntry;
      setDelayEntries(updatedEntries);

      // Re-validate this entry
      const error = validateEntry(newEntry, index);
      setErrors((prev) => {
        const next = { ...prev };
        if (error) {
          next[index] = error;
        } else {
          delete next[index];
        }
        return next;
      });

      // Notify parent of changes
      onDelayChange?.(updatedEntries);
    },
    [delayEntries, validateEntry, onDelayChange],
  );

  // Save all delay entries
  const saveDelayEntries = async () => {
    setIsSubmitting(true);
    setErrors({});

    try {
      // Validate all entries
      const validationErrors: Record<number, string> = {};
      delayEntries.forEach((entry, index) => {
        const error = validateEntry(entry, index);
        if (error) {
          validationErrors[index] = error;
        }
      });

      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      // Save each entry
      for (const entry of delayEntries) {
        const entryData = {
          machine_operation_id: machineOperationId,
          delay_category_id: entry.delay_category_id,
          // AGENT-TRACE: Convert local time to UTC for database storage
          delay_start_time: toUTC(entry.delay_start_time),
          delay_end_time: toUTC(entry.delay_end_time),
          is_manual_override: entry.is_manual_override,
          manual_duration_hours: entry.manual_duration_hours,
          description: entry.description,
          status: "draft" as const,
        };

        if (entry.id) {
          // Update existing
          const { error } = await supabase
            .from("delay_entries")
            .update(entryData)
            .eq("id", entry.id);
          if (error) throw error;
        } else {
          // Insert new
          const { error } = await supabase
            .from("delay_entries")
            .insert(entryData);
          if (error) throw error;
        }
      }

      // Reload delays to get IDs for new entries
      const { data } = await supabase
        .from("delay_entries")
        .select("*")
        .eq("machine_operation_id", machineOperationId)
        .order("delay_start_time");

      if (data) {
        setDelayEntries(
          data.map((d) => ({
            id: d.id,
            delay_category_id: d.delay_category_id,
            // AGENT-TRACE: Convert UTC from database to local time for UI display
            delay_start_time: toLocalTime(d.delay_start_time),
            delay_end_time: toLocalTime(d.delay_end_time),
            is_manual_override: d.is_manual_override,
            manual_duration_hours: d.manual_duration_hours,
            description: d.description,
            status: d.status as "draft" | "committed",
          })),
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to save delay entries:", err);
      setToast({
        type: "error",
        message: "Failed to save delay entries. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // AGENT-TRACE: Commit all draft delays for this operation
  // This transitions delays from draft to committed status, locking them for editing
  const handleCommitClick = useCallback(() => {
    const draftDelays = delayEntries.filter((d) => d.status === "draft");
    if (draftDelays.length === 0) {
      setToast({ type: "error", message: "No draft delays to commit" });
      return;
    }
    setConfirmAction("commit");
    setShowConfirmDialog(true);
  }, [delayEntries]);

  const commitDelays = async () => {
    setIsCommitting(true);
    setShowConfirmDialog(false);

    try {
      // Get current user ID
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setToast({
          type: "error",
          message: "You must be logged in to commit delays",
        });
        return;
      }

      // Get employee record for current user
      const { data: employee } = await supabase
        .from("employees")
        .select("id, role")
        .eq("auth_id", user.id)
        .single();

      if (!employee) {
        setToast({ type: "error", message: "Employee record not found" });
        return;
      }

      // Check if user has permission to commit (supervisor or admin)
      if (employee.role !== "supervisor" && employee.role !== "admin") {
        setToast({
          type: "error",
          message: "Only supervisors can commit delay entries",
        });
        return;
      }

      // Commit all draft delays for this operation
      const draftDelays = delayEntries.filter((d) => d.status === "draft");

      for (const entry of draftDelays) {
        const { error } = await supabase
          .from("delay_entries")
          .update({
            status: "committed",
            committed_at: new Date().toISOString(),
            committed_by: employee.id,
          })
          .eq("id", entry.id);

        if (error) throw error;
      }

      // Reload delays to update status
      const { data } = await supabase
        .from("delay_entries")
        .select("*")
        .eq("machine_operation_id", machineOperationId)
        .order("delay_start_time");

      if (data) {
        setDelayEntries(
          data.map((d) => ({
            id: d.id,
            delay_category_id: d.delay_category_id,
            // AGENT-TRACE: Convert UTC from database to local time for UI display
            delay_start_time: toLocalTime(d.delay_start_time),
            delay_end_time: toLocalTime(d.delay_end_time),
            is_manual_override: d.is_manual_override,
            manual_duration_hours: d.manual_duration_hours,
            description: d.description,
            status: d.status as "draft" | "committed",
          })),
        );
      }

      setToast({
        type: "success",
        message: `${draftDelays.length} delay entry(ies) committed successfully`,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to commit delays:", err);
      setToast({
        type: "error",
        message: "Failed to commit delays. Please try again.",
      });
    } finally {
      setIsCommitting(false);
    }
  };

  // Calculate total delay hours
  const totalDelayHours = delayEntries.reduce((sum, entry) => {
    const duration = entry.is_manual_override
      ? entry.manual_duration_hours || 0
      : calculateDuration(entry.delay_start_time, entry.delay_end_time);
    return sum + duration;
  }, 0);

  if (isLoading) {
    return (
      <GlassCard>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-[var(--bg-tertiary)] rounded mb-4" />
            <div className="h-8 bg-[var(--bg-tertiary)] rounded mb-2" />
            <div className="h-8 bg-[var(--bg-tertiary)] rounded mb-2" />
            <div className="h-8 bg-[var(--bg-tertiary)] rounded" />
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-[var(--text-heading)]">
              Delay Entries
            </h3>
            <p className="text-[var(--text-muted)] text-sm">
              Log delays with start/end times for accurate tracking
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[var(--text-muted)] text-xs">
                Total Delay Hours
              </p>
              <p className="text-2xl font-medium text-accent-red">
                {totalDelayHours.toFixed(2)}h
                <span className="text-xs text-[var(--text-muted)] ml-1">
                  / 12h max
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors"
              title="Show help"
            >
              <HelpCircle size={20} />
            </button>
            {!readOnly && (
              <button
                type="button"
                onClick={addDelayEntry}
                className="flex items-center gap-2 px-3 py-2 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus size={16} />
                Add Delay
              </button>
            )}
          </div>
        </div>

        {/* Help Section */}
        {showHelp && (
          <div className="p-4 bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-lg space-y-3">
            <div className="flex items-start gap-2">
              <Info
                size={16}
                className="text-[var(--accent-blue)] mt-0.5 flex-shrink-0"
              />
              <div className="text-sm text-[var(--text-secondary)]">
                <p className="font-medium text-[var(--text-heading)] mb-1">
                  Delay Entry Guide
                </p>
                <ul className="space-y-1.5 list-disc list-inside">
                  <li>
                    <strong>Category:</strong> Select the type of delay
                    (External, Production, Engineering)
                  </li>
                  <li>
                    <strong>Start/End Time:</strong> Auto-calculates duration.
                    Times are stored in UTC and displayed in your local
                    timezone.
                  </li>
                  <li>
                    <strong>Manual Override:</strong> Enable to manually specify
                    duration when exact times aren't available. This is flagged
                    for audit trail.
                  </li>
                  <li>
                    <strong>12-Hour Limit:</strong> Total delay hours per
                    operation cannot exceed 12 hours per shift.
                  </li>
                  <li>
                    <strong>Draft vs. Committed:</strong> Draft entries can be
                    edited. Only supervisors can commit entries, which locks
                    them for editing.
                  </li>
                  <li>
                    <strong>Description:</strong> Optional context about the
                    delay cause and impact.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {delayEntries.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)]">
            <Clock size={32} className="mx-auto mb-2 opacity-50" />
            <p>No delay entries yet</p>
            {!readOnly && (
              <p className="text-sm mt-1">Click "Add Delay" to log a delay</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {delayEntries.map((entry, index) => {
              const duration = entry.is_manual_override
                ? entry.manual_duration_hours || 0
                : calculateDuration(
                    entry.delay_start_time,
                    entry.delay_end_time,
                  );

              return (
                <div
                  key={entry.id || index}
                  className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
                      {/* Category */}
                      <div className="space-y-1">
                        <label className="text-[var(--text-secondary)] text-xs block flex items-center gap-1">
                          Category <span className="text-accent-red">*</span>
                          <span title="Select the type of delay: External, Production, or Engineering">
                            <HelpCircle
                              size={12}
                              className="text-[var(--text-muted)]"
                            />
                          </span>
                        </label>
                        <select
                          value={entry.delay_category_id}
                          onChange={(e) =>
                            updateDelayEntry(
                              index,
                              "delay_category_id",
                              e.target.value,
                            )
                          }
                          disabled={readOnly || entry.status === "committed"}
                          className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-2 py-1.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Select category...</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Start Time */}
                      <div className="space-y-1">
                        <label className="text-[var(--text-secondary)] text-xs block flex items-center gap-1">
                          Start Time <span className="text-accent-red">*</span>
                          <span title="When the delay began. Displayed in local time, stored in UTC.">
                            <HelpCircle
                              size={12}
                              className="text-[var(--text-muted)]"
                            />
                          </span>
                        </label>
                        <input
                          type="datetime-local"
                          value={entry.delay_start_time.slice(0, 16)}
                          onChange={(e) =>
                            updateDelayEntry(
                              index,
                              "delay_start_time",
                              new Date(e.target.value).toISOString(),
                            )
                          }
                          disabled={
                            readOnly ||
                            entry.status === "committed" ||
                            entry.is_manual_override
                          }
                          className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-2 py-1.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>

                      {/* End Time */}
                      <div className="space-y-1">
                        <label className="text-[var(--text-secondary)] text-xs block flex items-center gap-1">
                          End Time <span className="text-accent-red">*</span>
                          <span title="When the delay ended. Duration is auto-calculated from start time.">
                            <HelpCircle
                              size={12}
                              className="text-[var(--text-muted)]"
                            />
                          </span>
                        </label>
                        <input
                          type="datetime-local"
                          value={entry.delay_end_time.slice(0, 16)}
                          onChange={(e) =>
                            updateDelayEntry(
                              index,
                              "delay_end_time",
                              new Date(e.target.value).toISOString(),
                            )
                          }
                          disabled={
                            readOnly ||
                            entry.status === "committed" ||
                            entry.is_manual_override
                          }
                          className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-2 py-1.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>

                      {/* Duration Display */}
                      <div className="space-y-1">
                        <label className="text-[var(--text-secondary)] text-xs block">
                          Duration
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-medium text-[var(--text-heading)]">
                            {duration.toFixed(2)}h
                          </span>
                          {!readOnly && entry.status === "draft" && (
                            <label
                              className="flex items-center gap-1 cursor-pointer"
                              title="Enable to manually specify duration when exact times aren't available"
                            >
                              <input
                                type="checkbox"
                                checked={entry.is_manual_override}
                                onChange={(e) =>
                                  updateDelayEntry(
                                    index,
                                    "is_manual_override",
                                    e.target.checked,
                                  )
                                }
                                className="w-4 h-4 rounded border-[var(--border-default)]"
                              />
                              <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                                Override
                                <HelpCircle
                                  size={10}
                                  className="text-[var(--text-muted)]"
                                />
                              </span>
                            </label>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Remove Button */}
                    {!readOnly && entry.status === "draft" && (
                      <button
                        type="button"
                        onClick={() => handleRemoveClick(index)}
                        className="text-[var(--text-muted)] hover:text-accent-red transition-colors"
                        title="Remove delay entry"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>

                  {/* Manual Override Duration */}
                  {entry.is_manual_override &&
                    !readOnly &&
                    entry.status === "draft" && (
                      <div className="space-y-1">
                        <label className="text-[var(--text-secondary)] text-xs block">
                          Manual Duration (hours){" "}
                          <span className="text-accent-red">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="12"
                          value={entry.manual_duration_hours || ""}
                          onChange={(e) =>
                            updateDelayEntry(
                              index,
                              "manual_duration_hours",
                              parseFloat(e.target.value) || null,
                            )
                          }
                          className="w-full md:w-48 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-2 py-1.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)]"
                        />
                        <p className="text-[var(--text-muted)] text-xs">
                          Manual entry flagged for audit trail
                        </p>
                      </div>
                    )}

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-[var(--text-secondary)] text-xs block">
                      Description (optional)
                    </label>
                    <textarea
                      value={entry.description || ""}
                      onChange={(e) =>
                        updateDelayEntry(index, "description", e.target.value)
                      }
                      disabled={readOnly || entry.status === "committed"}
                      rows={2}
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-2 py-1.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                      placeholder="Describe the delay cause and impact..."
                    />
                  </div>

                  {/* Status Badge */}
                  {entry.status === "committed" && (
                    <div className="flex items-center gap-2 text-xs text-[var(--accent-green)]">
                      <Clock size={14} />
                      Committed - locked for editing
                    </div>
                  )}

                  {/* Validation Error */}
                  {errors[index] && (
                    <div className="flex items-center gap-2 text-xs text-accent-red bg-red-50/80 px-3 py-2 rounded-lg">
                      <AlertCircle size={14} />
                      {errors[index]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Save Button */}
        {!readOnly &&
          delayEntries.length > 0 &&
          delayEntries.some((d) => d.status === "draft") && (
            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-default)]">
              <button
                type="button"
                onClick={saveDelayEntries}
                disabled={isSubmitting}
                className="bg-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-muted)] text-[var(--bg-secondary)] font-medium py-2 px-4 rounded-lg transition-colors min-w-[120px]"
              >
                {isSubmitting ? "Saving..." : "Save Delays"}
              </button>
              <button
                type="button"
                onClick={handleCommitClick}
                disabled={isCommitting}
                className="bg-[var(--accent-green)] hover:bg-[var(--accent-green)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-muted)] text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2 min-w-[140px]"
              >
                {isCommitting ? (
                  "Committing..."
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Submit Delays
                  </>
                )}
              </button>
            </div>
          )}

        {/* Confirmation Dialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <div className="flex items-start gap-3 mb-4">
                {confirmAction === "commit" ? (
                  <CheckCircle
                    className="text-[var(--accent-green)]"
                    size={24}
                  />
                ) : (
                  <Trash2 className="text-accent-red" size={24} />
                )}
                <div>
                  <h3 className="text-lg font-medium text-[var(--text-heading)]">
                    {confirmAction === "commit"
                      ? "Commit Delay Entries"
                      : "Remove Delay Entry"}
                  </h3>
                  <p className="text-[var(--text-secondary)] text-sm mt-1">
                    {confirmAction === "commit"
                      ? "This will transition all draft delay entries to committed status. Committed entries cannot be edited. Are you sure?"
                      : "This will remove the delay entry. This action cannot be undone. Are you sure?"}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmDialog(false);
                    setConfirmAction(null);
                    setConfirmIndex(null);
                  }}
                  className="px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-heading)] rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmAction === "commit") {
                      commitDelays();
                    } else if (
                      confirmAction === "remove" &&
                      confirmIndex !== null
                    ) {
                      removeDelayEntry(confirmIndex);
                    }
                    setShowConfirmDialog(false);
                    setConfirmAction(null);
                    setConfirmIndex(null);
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                    confirmAction === "commit"
                      ? "bg-[var(--accent-green)] hover:bg-[var(--accent-green)]/90 text-white"
                      : "bg-accent-red hover:bg-red-600 text-white"
                  }`}
                >
                  {confirmAction === "commit" ? "Confirm Commit" : "Remove"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <div
            className={`fixed bottom-4 right-4 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg z-50 ${
              toast.type === "success"
                ? "bg-[var(--accent-green)] text-white"
                : "bg-accent-red text-white"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle size={20} />
            ) : (
              <XCircle size={20} />
            )}
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
            >
              <XCircle size={16} />
            </button>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
