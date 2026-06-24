"use client";

import { useState } from "react";
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
import { dailyLogSchema, type DailyLogFormValues } from "@repo/contract";
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

export function DailyLogForm({ departmentId, machines }: DailyLogFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    setValue,
  } = useForm<DailyLogFormValues>({
    resolver: zodResolver(dailyLogSchema),
    defaultValues: {
      shift: "day" as const,
      notes: "",
    },
  });

  useUnsavedChangesWarning(isDirty);

  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const shiftValue = watch("shift");

  async function onSubmit(data: DailyLogFormValues) {
    setStatus("submitting");

    const supabase = createBrowserSupabaseClient();
    const today = new Date().toISOString().split("T")[0];

    const { error } = await supabase.from("daily_logs").insert({
      department_id: departmentId,
      log_date: today,
      shift: data.shift,
      notes: data.notes === "" ? null : data.notes,
    });

    if (error) {
      logError(error instanceof Error ? error : new Error(String(error)));
      toast.error("Failed to save daily log", {
        description: error.message,
      });
      setStatus("error");
    } else {
      toast.success("Daily log saved successfully");

      // Revalidate cached RSC data
      revalidateRSC(["table:daily_logs", "table:production_logs"]).catch((err) => {
        logError(err instanceof Error ? err : new Error(String(err)));
      });

      // Speculatively generate embedding for the notes in background
      if (data.notes && data.notes.trim() !== "") {
        speculativeEmbedShiftLog(data.notes).catch((err) => {
          logError(err instanceof Error ? err : new Error(String(err)));
        });
      }

      setStatus("success");
      reset({
        shift: "day",
        notes: "",
      });
    }
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
            // Update the form value when shift changes
            setValue("shift", value);
          }}
          name="shift"
        />
      </div>

      {/* Machines list (read-only reference) */}
      {machines.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm text-[var(--text-muted)]">Machines</label>
          <div className="flex flex-wrap gap-2">
            {machines.map((m) => (
              <span
                key={m.id}
                className="px-3 py-1 rounded-full text-xs bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)]"
              >
                {m.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <label htmlFor="daily-log-notes" className="block text-sm text-[var(--text-muted)]">
          Notes
        </label>
        <textarea
          id="daily-log-notes"
          {...register("notes")}
          rows={4}
          className={cn(
            "w-full px-4 py-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30 focus:border-[var(--accent-blue)] transition-colors resize-none",
            errors.notes && "border-accent-red",
          )}
          placeholder="Enter any observations or issues..."
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
