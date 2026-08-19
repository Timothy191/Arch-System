"use client";

import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
// eslint-disable-next-line no-restricted-imports
import { zodResolver } from "@hookform/resolvers/zod";
import { createBrowserSupabaseClient } from "@repo/supabase/client";
import { SecondaryButton } from "@repo/ui/SecondaryButton";
import { cn } from "@repo/ui/lib/utils";
import { ShiftToggle } from "@repo/ui/ShiftToggle";
import { toast } from "sonner";
import { logError } from "@/lib/errors/error-logger";
import { speculativeEmbedShiftLog, revalidateRSC } from "@/app/actions";
import {
  dailyLogSchema,
  drillingDailyLogSchema,
  productionDailyLogSchema,
  type DailyLogFormValues,
  type DrillingDailyLogFormValues,
  type ProductionDailyLogFormValues,
} from "@repo/contract";
import { useUnsavedChangesWarning } from "~/hooks/useUnsavedChangesWarning";

interface Machine {
  id: string;
  name: string;
  machine_type: string;
}

interface DailyLogFormProps {
  departmentId: string;
  departmentSlug: string;
  machines: Machine[];
}

type UnifiedFormValues = DailyLogFormValues &
  Partial<DrillingDailyLogFormValues> &
  Partial<ProductionDailyLogFormValues>;

export function DailyLogForm({ departmentId, departmentSlug, machines }: DailyLogFormProps) {
  const isDrilling = departmentSlug === "drilling";
  const isProduction = departmentSlug === "production";

  const schemaResolver = isProduction
    ? productionDailyLogSchema
    : isDrilling
      ? drillingDailyLogSchema
      : dailyLogSchema;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    setValue,
  } = useForm<UnifiedFormValues>({
    resolver: zodResolver(schemaResolver),
    defaultValues: {
      shift: "day" as const,
      notes: "",
      ...(isDrilling
        ? {
            holesDrilled: 0,
            totalDepthMeters: 0,
            penetrationRate: 0,
            bitWearPercentage: 0,
            delayCategory: "none" as const,
            delayMinutes: 0,
            drillPatternId: "",
          }
        : {}),
      ...(isProduction
        ? {
            actualCoalTonnes: 0,
            actualWasteTonnes: 0,
          }
        : {}),
    },
  });

  useUnsavedChangesWarning(isDirty);

  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const formValues = watch();

  const draftKey = `arch_daily_log_draft_${departmentId}`;

  // Restore draft on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          reset(parsed);
        }
      }
    } catch {
      // Ignore read error
    }
  }, [draftKey, reset]);

  // Save draft on tab switch / unload
  const saveDraft = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return;
      try {
        if (isDirty) {
          localStorage.setItem(draftKey, JSON.stringify(formValues));
        }
      } catch {
        // Ignore write error
      }
    };
  }, [draftKey, isDirty, formValues]);

  const clearDraft = () => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // Ignore cleanup error
    }
  };

  useEffect(() => {
    saveDraft();
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") saveDraft();
    };
    window.addEventListener("beforeunload", saveDraft);
    window.addEventListener("pagehide", saveDraft);
    window.addEventListener("arch:tab-swap", saveDraft);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("beforeunload", saveDraft);
      window.removeEventListener("pagehide", saveDraft);
      window.removeEventListener("arch:tab-swap", saveDraft);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [saveDraft]);

  const shiftValue = watch("shift");
  const holesDrilled = watch("holesDrilled") || 0;
  const totalDepthMeters = watch("totalDepthMeters") || 0;

  const averageDepth = useMemo(() => {
    if (!holesDrilled || holesDrilled <= 0) return 0;
    return Number((totalDepthMeters / holesDrilled).toFixed(1));
  }, [holesDrilled, totalDepthMeters]);

  async function onSubmit(data: UnifiedFormValues) {
    setStatus("submitting");

    const supabase = createBrowserSupabaseClient();
    const today = new Date().toISOString().split("T")[0];

    // Format consolidated notes for cross-system searchability
    let finalNotes = data.notes || "";
    if (isDrilling) {
      const summaryPrefix = `[Drilling Operations] Holes: ${data.holesDrilled || 0} | Total Depth: ${data.totalDepthMeters || 0}m (Avg: ${averageDepth}m/hole) | Penetration: ${data.penetrationRate || 0}m/h | Bit Wear: ${data.bitWearPercentage || 0}% | Delay: ${data.delayCategory || "none"} (${data.delayMinutes || 0} min)`;
      finalNotes = finalNotes.trim() ? `${summaryPrefix}\n\nNotes:\n${finalNotes}` : summaryPrefix;
    }

    const { data: logData, error } = await supabase
      .from("daily_logs")
      .insert({
        department_id: departmentId,
        log_date: today,
        shift: data.shift,
        notes: finalNotes === "" ? null : finalNotes,
      })
      .select("id")
      .single();

    if (error) {
      logError(error instanceof Error ? error : new Error(String(error)));
      toast.error("Failed to save daily log", {
        description: error.message,
      });
      setStatus("error");
      return;
    }

    if (isProduction && logData) {
      const { error: prodError } = await supabase.from("production_logs").insert({
        daily_log_id: logData.id,
        coal_tonnes: data.actualCoalTonnes || 0,
        waste_tonnes: data.actualWasteTonnes || 0,
      });
      if (prodError) {
        logError(prodError instanceof Error ? prodError : new Error(String(prodError)));
        toast.error("Saved daily log, but failed to save production metrics", {
          description: prodError.message,
        });
      }
    }

    toast.success("Daily log saved successfully");

    // Revalidate cached RSC data
    revalidateRSC(["table:daily_logs", "table:production_logs"]).catch((err) => {
      logError(err instanceof Error ? err : new Error(String(err)));
    });

    // Speculatively generate embedding for the notes in background
    if (finalNotes && finalNotes.trim() !== "") {
      speculativeEmbedShiftLog(finalNotes).catch((err) => {
        logError(err instanceof Error ? err : new Error(String(err)));
      });
    }

    setStatus("success");
    clearDraft();
    reset({
      shift: "day",
      notes: "",
      ...(isDrilling
        ? {
            holesDrilled: 0,
            totalDepthMeters: 0,
            penetrationRate: 0,
            bitWearPercentage: 0,
            delayCategory: "none",
            delayMinutes: 0,
            drillPatternId: "",
          }
        : {}),
      ...(isProduction
        ? {
            actualCoalTonnes: 0,
            actualWasteTonnes: 0,
          }
        : {}),
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Shift selector */}
      <div className="space-y-2">
        <label htmlFor="shift-day" className="block text-sm text-[var(--text-muted)]">
          Shift
        </label>
        <ShiftToggle
          value={shiftValue}
          onChange={(value) => {
            setValue("shift", value);
          }}
          name="shift"
        />
      </div>

      {/* Production-Specific Operational Metrics */}
      {isProduction && (
        <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-heading)]">
              Production Shift Metrics
            </h3>
            <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] font-medium">
              Strip Ratio:{" "}
              {watch("actualCoalTonnes")
                ? (
                    Number(watch("actualWasteTonnes") || 0) / Number(watch("actualCoalTonnes"))
                  ).toFixed(2)
                : "0.00"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-xs text-[var(--text-muted)] font-medium">
                Actual Coal (Tonnes)
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setValue(
                      "actualCoalTonnes",
                      Math.max(0, (Number(watch("actualCoalTonnes")) || 0) - 100),
                      { shouldDirty: true },
                    )
                  }
                  className="w-12 h-12 flex items-center justify-center bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl text-lg font-medium hover:bg-[var(--bg-tertiary)] active:scale-95 transition-all touch-manipulation"
                >
                  -
                </button>
                <input
                  type="number"
                  {...register("actualCoalTonnes", { valueAsNumber: true })}
                  className={cn(
                    "flex-1 px-4 py-3 text-center rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-lg text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30 focus:border-[var(--accent-blue)] transition-colors",
                    errors.actualCoalTonnes && "border-accent-red",
                  )}
                  placeholder="0"
                />
                <button
                  type="button"
                  onClick={() =>
                    setValue("actualCoalTonnes", (Number(watch("actualCoalTonnes")) || 0) + 100, {
                      shouldDirty: true,
                    })
                  }
                  className="w-12 h-12 flex items-center justify-center bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl text-lg font-medium hover:bg-[var(--bg-tertiary)] active:scale-95 transition-all touch-manipulation"
                >
                  +
                </button>
              </div>
              {errors.actualCoalTonnes && (
                <p className="text-accent-red text-xs mt-1">{errors.actualCoalTonnes.message}</p>
              )}
            </div>

            <div className="space-y-3">
              <label className="block text-xs text-[var(--text-muted)] font-medium">
                Actual Waste (Tonnes)
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setValue(
                      "actualWasteTonnes",
                      Math.max(0, (Number(watch("actualWasteTonnes")) || 0) - 500),
                      { shouldDirty: true },
                    )
                  }
                  className="w-12 h-12 flex items-center justify-center bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl text-lg font-medium hover:bg-[var(--bg-tertiary)] active:scale-95 transition-all touch-manipulation"
                >
                  -
                </button>
                <input
                  type="number"
                  {...register("actualWasteTonnes", { valueAsNumber: true })}
                  className={cn(
                    "flex-1 px-4 py-3 text-center rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-lg text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30 focus:border-[var(--accent-blue)] transition-colors",
                    errors.actualWasteTonnes && "border-accent-red",
                  )}
                  placeholder="0"
                />
                <button
                  type="button"
                  onClick={() =>
                    setValue("actualWasteTonnes", (Number(watch("actualWasteTonnes")) || 0) + 500, {
                      shouldDirty: true,
                    })
                  }
                  className="w-12 h-12 flex items-center justify-center bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl text-lg font-medium hover:bg-[var(--bg-tertiary)] active:scale-95 transition-all touch-manipulation"
                >
                  +
                </button>
              </div>
              {errors.actualWasteTonnes && (
                <p className="text-accent-red text-xs mt-1">{errors.actualWasteTonnes.message}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drilling-Specific Operational Metrics */}
      {isDrilling && (
        <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-heading)]">
              Drilling Shift Performance Metrics
            </h3>
            {averageDepth > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] font-medium">
                Avg: {averageDepth} m / hole
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="drilling-holes"
                className="block text-xs text-[var(--text-muted)] font-medium"
              >
                Holes Drilled
              </label>
              <input
                id="drilling-holes"
                type="number"
                {...register("holesDrilled", { valueAsNumber: true })}
                className={cn(
                  "w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30 focus:border-[var(--accent-blue)] transition-colors",
                  errors.holesDrilled && "border-accent-red",
                )}
                placeholder="0"
              />
              {errors.holesDrilled && (
                <p className="text-accent-red text-xs mt-0.5">{errors.holesDrilled.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="drilling-depth"
                className="block text-xs text-[var(--text-muted)] font-medium"
              >
                Total Depth (meters)
              </label>
              <input
                id="drilling-depth"
                type="number"
                step="0.1"
                {...register("totalDepthMeters", { valueAsNumber: true })}
                className={cn(
                  "w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30 focus:border-[var(--accent-blue)] transition-colors",
                  errors.totalDepthMeters && "border-accent-red",
                )}
                placeholder="0.0"
              />
              {errors.totalDepthMeters && (
                <p className="text-accent-red text-xs mt-0.5">{errors.totalDepthMeters.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="drilling-rate"
                className="block text-xs text-[var(--text-muted)] font-medium"
              >
                Penetration Rate (m/h)
              </label>
              <input
                id="drilling-rate"
                type="number"
                step="0.1"
                {...register("penetrationRate", { valueAsNumber: true })}
                className={cn(
                  "w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30 focus:border-[var(--accent-blue)] transition-colors",
                  errors.penetrationRate && "border-accent-red",
                )}
                placeholder="0.0"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="drilling-wear"
                className="block text-xs text-[var(--text-muted)] font-medium"
              >
                Bit Wear (%)
              </label>
              <input
                id="drilling-wear"
                type="number"
                min="0"
                max="100"
                {...register("bitWearPercentage", { valueAsNumber: true })}
                className={cn(
                  "w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30 focus:border-[var(--accent-blue)] transition-colors",
                  errors.bitWearPercentage && "border-accent-red",
                )}
                placeholder="0"
              />
              {errors.bitWearPercentage && (
                <p className="text-accent-red text-xs mt-0.5">{errors.bitWearPercentage.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[var(--border-default)]">
            <div className="space-y-1.5">
              <label
                htmlFor="drilling-pattern"
                className="block text-xs text-[var(--text-muted)] font-medium"
              >
                Drill Pattern ID
              </label>
              <input
                id="drilling-pattern"
                type="text"
                {...register("drillPatternId")}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30 focus:border-[var(--accent-blue)] transition-colors"
                placeholder="e.g. PAT-2026-B4"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="drilling-delay-cat"
                className="block text-xs text-[var(--text-muted)] font-medium"
              >
                Delay Category
              </label>
              <select
                id="drilling-delay-cat"
                {...register("delayCategory")}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30 focus:border-[var(--accent-blue)] transition-colors"
              >
                <option value="none">None (Zero Delay)</option>
                <option value="bit_replacement">Bit Replacement</option>
                <option value="rod_jam">Rod Jam / Recovery</option>
                <option value="collar_setup">Collar Setup</option>
                <option value="mechanical_breakdown">Mechanical Breakdown</option>
                <option value="weather">Adverse Weather</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="drilling-delay-min"
                className="block text-xs text-[var(--text-muted)] font-medium"
              >
                Delay Duration (min)
              </label>
              <input
                id="drilling-delay-min"
                type="number"
                {...register("delayMinutes", { valueAsNumber: true })}
                className={cn(
                  "w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30 focus:border-[var(--accent-blue)] transition-colors",
                  errors.delayMinutes && "border-accent-red",
                )}
                placeholder="0"
              />
              {errors.delayMinutes && (
                <p className="text-accent-red text-xs mt-0.5">{errors.delayMinutes.message}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Machines list (read-only reference) */}
      {machines.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm text-[var(--text-muted)]">Active Rigs & Equipment</label>
          <div className="flex flex-wrap gap-2">
            {machines.map((m) => (
              <span
                key={m.id}
                className="px-3 py-1 rounded-full text-xs bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)]"
              >
                {m.name} ({m.machine_type})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <label htmlFor="daily-log-notes" className="block text-sm text-[var(--text-muted)]">
          Observations & Shift Handover Notes
        </label>
        <textarea
          id="daily-log-notes"
          {...register("notes")}
          rows={4}
          className={cn(
            "w-full px-4 py-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30 focus:border-[var(--accent-blue)] transition-colors resize-none",
            errors.notes && "border-accent-red",
          )}
          placeholder="Enter any stratum notes, bit wear observations, or safety handovers..."
          aria-label="Daily log notes"
          aria-invalid={errors.notes ? "true" : "false"}
          aria-describedby={errors.notes ? "daily-log-notes-error" : undefined}
        />
        {errors.notes && (
          <p id="daily-log-notes-error" className="text-accent-red text-xs mt-1">
            {errors.notes.message}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <SecondaryButton type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Daily Log"}
        </SecondaryButton>

        {status === "success" && (
          <span className="text-sm text-accent-green" role="status" aria-live="polite">
            Log saved successfully.
          </span>
        )}
        {status === "error" && (
          <span className="text-sm text-accent-red" role="alert" aria-live="assertive">
            Failed to save log. Please try again.
          </span>
        )}
      </div>
    </form>
  );
}
