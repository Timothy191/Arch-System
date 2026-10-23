'use client';

// eslint-disable-next-line no-restricted-imports
import { zodResolver } from '@hookform/resolvers/zod';
import {
  dailyLogSchema,
  drillingDailyLogSchema,
  productionDailyLogSchema,
} from '@repo/contract/schemas/form.schema';
import type {
  DailyLogFormValues,
  DrillingDailyLogFormValues,
  ProductionDailyLogFormValues,
} from '@repo/contract/types/form.types';
import { useOfflineQueue } from '@repo/shared/hooks';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { cn } from '@repo/ui/lib/utils';
import { SecondaryButton } from '@repo/ui/SecondaryButton';
import { ShiftToggle } from '@repo/ui/ShiftToggle';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { revalidateRSC, speculativeEmbedShiftLog } from '@/app/actions';
import { logError } from '@/lib/errors/error-logger';
import { useUnsavedChangesWarning } from '~/hooks/useUnsavedChangesWarning';
import { createDailyLog } from './actions';

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
  const isDrilling = departmentSlug === 'drilling';
  const isProduction = departmentSlug === 'production';

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
      shift: 'day' as const,
      notes: '',
      ...(isDrilling
        ? {
            holesDrilled: 0,
            totalDepthMeters: 0,
            penetrationRate: 0,
            bitWearPercentage: 0,
            delayCategory: 'none' as const,
            delayMinutes: 0,
            drillPatternId: '',
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

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const formValues = watch();

  const draftKey = `arch_daily_log_draft_${departmentId}`;

  // Restore draft on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
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
      if (typeof window === 'undefined') return;
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
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // Ignore cleanup error
    }
  };

  useEffect(() => {
    saveDraft();
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') saveDraft();
    };
    window.addEventListener('beforeunload', saveDraft);
    window.addEventListener('pagehide', saveDraft);
    window.addEventListener('arch:tab-swap', saveDraft);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('beforeunload', saveDraft);
      window.removeEventListener('pagehide', saveDraft);
      window.removeEventListener('arch:tab-swap', saveDraft);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [saveDraft]);

  const shiftValue = watch('shift');
  const holesDrilled = watch('holesDrilled') || 0;
  const totalDepthMeters = watch('totalDepthMeters') || 0;

  const averageDepth = useMemo(() => {
    if (!holesDrilled || holesDrilled <= 0) return 0;
    return Number((totalDepthMeters / holesDrilled).toFixed(1));
  }, [holesDrilled, totalDepthMeters]);

  async function onSubmit(data: UnifiedFormValues) {
    setStatus('submitting');

    const supabase = createBrowserSupabaseClient();
    const today = new Date().toISOString().split('T')[0];

    // Format consolidated notes for cross-system searchability
    let finalNotes = data.notes || '';
    if (isDrilling) {
      const summaryPrefix = `[Drilling Operations] Holes: ${data.holesDrilled || 0} | Total Depth: ${data.totalDepthMeters || 0}m (Avg: ${averageDepth}m/hole) | Penetration: ${data.penetrationRate || 0}m/h | Bit Wear: ${data.bitWearPercentage || 0}% | Delay: ${data.delayCategory || 'none'} (${data.delayMinutes || 0} min)`;
      finalNotes = finalNotes.trim() ? `${summaryPrefix}\n\nNotes:\n${finalNotes}` : summaryPrefix;
    }

    const payload = {
      departmentId,
      today,
      shift: data.shift,
      notes: finalNotes === '' ? null : finalNotes,
      isProduction,
      actualCoalTonnes: data.actualCoalTonnes,
      actualWasteTonnes: data.actualWasteTonnes,
    };

    if (!navigator.onLine) {
      useOfflineQueue.getState().enqueue({
        url: '/api/sync/fallback',
        method: 'POST',
        body: JSON.stringify({
          action: 'createDailyLog',
          payload,
        }),
        description: 'Daily Log',
      });

      clearDraft();
      toast.success('Log saved offline and will sync automatically');
      setStatus('success');

      return;
    }

    let logData;
    try {
      const res = await createDailyLog(payload);
      logData = { id: res.id };
    } catch (err: any) {
      logError(err);
      toast.error('Failed to save daily log', {
        description: err.message,
      });
      setStatus('error');
      return;
    }

    // Offer a quick‑undo in case the user saved by mistake.
    toast.success('Daily log saved successfully', {
      action: {
        label: 'Undo',
        onClick: async () => {
          if (logData?.id) {
            const { error: undoErr } = await supabase
              .from('daily_logs')
              .delete()
              .eq('id', logData.id);
            if (undoErr) {
              logError(undoErr);
              toast.error('Unable to undo – contact support.');
            } else {
              toast('Log entry undone');
              // Reset form to a clean state after undo.
              reset();
            }
          }
        },
      },
    });

    // Revalidate cached RSC data
    revalidateRSC(['table:daily_logs', 'table:production_logs']).catch((err) => {
      logError(err);
    });

    // Speculatively generate embedding for the notes in background
    if (finalNotes && finalNotes.trim() !== '') {
      speculativeEmbedShiftLog(finalNotes).catch((err) => {
        logError(err);
      });
    }

    setStatus('success');
    clearDraft();
    reset({
      shift: 'day',
      notes: '',
      ...(isDrilling
        ? {
            holesDrilled: 0,
            totalDepthMeters: 0,
            penetrationRate: 0,
            bitWearPercentage: 0,
            delayCategory: 'none',
            delayMinutes: 0,
            drillPatternId: '',
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

  const router = useRouter();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Shift selector */}
      <div className="space-y-2">
        <label htmlFor="shift-day" className="block text-[var(--text-muted)] text-sm">
          Shift
        </label>
        <ShiftToggle
          value={shiftValue}
          onChange={(value) => {
            setValue('shift', value);
          }}
          name="shift"
        />
      </div>

      {/* Production-Specific Operational Metrics */}
      {isProduction && (
        <div className="space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text-heading)] text-sm">
              Production Shift Metrics
            </h3>
            <span className="rounded-full bg-[var(--accent-blue)]/10 px-2.5 py-1 font-medium text-[var(--accent-blue)] text-xs">
              Strip Ratio:{' '}
              {watch('actualCoalTonnes')
                ? (
                    Number(watch('actualWasteTonnes') || 0) / Number(watch('actualCoalTonnes'))
                  ).toFixed(2)
                : '0.00'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="space-y-3">
              <label className="block font-medium text-[var(--text-muted)] text-xs">
                Actual Coal (Tonnes)
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setValue(
                      'actualCoalTonnes',
                      Math.max(0, (Number(watch('actualCoalTonnes')) || 0) - 100),
                      { shouldDirty: true }
                    )
                  }
                  className="flex h-12 w-12 touch-manipulation items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] font-medium text-lg transition-all hover:bg-[var(--bg-tertiary)] active:scale-95"
                >
                  -
                </button>
                <input
                  type="number"
                  {...register('actualCoalTonnes', { valueAsNumber: true })}
                  onFocus={(e) => e.target.select()}
                  className={cn(
                    'flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3 text-center text-[var(--text-heading)] text-lg transition-colors focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30',
                    errors.actualCoalTonnes && 'border-accent-red'
                  )}
                  placeholder="0"
                />
                <button
                  type="button"
                  onClick={() =>
                    setValue('actualCoalTonnes', (Number(watch('actualCoalTonnes')) || 0) + 100, {
                      shouldDirty: true,
                    })
                  }
                  className="flex h-12 w-12 touch-manipulation items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] font-medium text-lg transition-all hover:bg-[var(--bg-tertiary)] active:scale-95"
                >
                  +
                </button>
              </div>
              {errors.actualCoalTonnes && (
                <p className="mt-1 text-accent-red text-xs">{errors.actualCoalTonnes.message}</p>
              )}
            </div>

            <div className="space-y-3">
              <label className="block font-medium text-[var(--text-muted)] text-xs">
                Actual Waste (Tonnes)
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setValue(
                      'actualWasteTonnes',
                      Math.max(0, (Number(watch('actualWasteTonnes')) || 0) - 500),
                      { shouldDirty: true }
                    )
                  }
                  className="flex h-12 w-12 touch-manipulation items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] font-medium text-lg transition-all hover:bg-[var(--bg-tertiary)] active:scale-95"
                >
                  -
                </button>
                <input
                  type="number"
                  {...register('actualWasteTonnes', { valueAsNumber: true })}
                  onFocus={(e) => e.target.select()}
                  className={cn(
                    'flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3 text-center text-[var(--text-heading)] text-lg transition-colors focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30',
                    errors.actualWasteTonnes && 'border-accent-red'
                  )}
                  placeholder="0"
                />
                <button
                  type="button"
                  onClick={() =>
                    setValue('actualWasteTonnes', (Number(watch('actualWasteTonnes')) || 0) + 500, {
                      shouldDirty: true,
                    })
                  }
                  className="flex h-12 w-12 touch-manipulation items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] font-medium text-lg transition-all hover:bg-[var(--bg-tertiary)] active:scale-95"
                >
                  +
                </button>
              </div>
              {errors.actualWasteTonnes && (
                <p className="mt-1 text-accent-red text-xs">{errors.actualWasteTonnes.message}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drilling-Specific Operational Metrics */}
      {isDrilling && (
        <div className="space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text-heading)] text-sm">
              Drilling Shift Performance Metrics
            </h3>
            {averageDepth > 0 && (
              <span className="rounded-full bg-[var(--accent-blue)]/10 px-2.5 py-1 font-medium text-[var(--accent-blue)] text-xs">
                Avg: {averageDepth} m / hole
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label
                htmlFor="drilling-holes"
                className="block font-medium text-[var(--text-muted)] text-xs"
              >
                Holes Drilled
              </label>
              <input
                id="drilling-holes"
                type="number"
                {...register('holesDrilled', { valueAsNumber: true })}
                onFocus={(e) => e.target.select()}
                className={cn(
                  'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30',
                  errors.holesDrilled && 'border-accent-red'
                )}
                placeholder="0"
              />
              {errors.holesDrilled && (
                <p className="mt-0.5 text-accent-red text-xs">{errors.holesDrilled.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="drilling-depth"
                className="block font-medium text-[var(--text-muted)] text-xs"
              >
                Total Depth (meters)
              </label>
              <input
                id="drilling-depth"
                type="number"
                step="0.1"
                {...register('totalDepthMeters', { valueAsNumber: true })}
                onFocus={(e) => e.target.select()}
                className={cn(
                  'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30',
                  errors.totalDepthMeters && 'border-accent-red'
                )}
                placeholder="0.0"
              />
              {errors.totalDepthMeters && (
                <p className="mt-0.5 text-accent-red text-xs">{errors.totalDepthMeters.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="drilling-rate"
                className="block font-medium text-[var(--text-muted)] text-xs"
              >
                Penetration Rate (m/h)
              </label>
              <input
                id="drilling-rate"
                type="number"
                step="0.1"
                {...register('penetrationRate', { valueAsNumber: true })}
                onFocus={(e) => e.target.select()}
                className={cn(
                  'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30',
                  errors.penetrationRate && 'border-accent-red'
                )}
                placeholder="0.0"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="drilling-wear"
                className="block font-medium text-[var(--text-muted)] text-xs"
              >
                Bit Wear (%)
              </label>
              <input
                id="drilling-wear"
                type="number"
                min="0"
                max="100"
                step="1"
                {...register('bitWearPercentage', { valueAsNumber: true })}
                onFocus={(e) => e.target.select()}
                className={cn(
                  'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30',
                  errors.bitWearPercentage && 'border-accent-red'
                )}
                placeholder="0"
              />
              {errors.bitWearPercentage && (
                <p className="mt-0.5 text-accent-red text-xs">{errors.bitWearPercentage.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-[var(--border-default)] border-t pt-2 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label
                htmlFor="drilling-pattern"
                className="block font-medium text-[var(--text-muted)] text-xs"
              >
                Drill Pattern ID
              </label>
              <input
                id="drilling-pattern"
                type="text"
                {...register('drillPatternId')}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30"
                placeholder="e.g. PAT-2026-B4"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="drilling-delay-cat"
                className="block font-medium text-[var(--text-muted)] text-xs"
              >
                Delay Category
              </label>
              <select
                id="drilling-delay-cat"
                {...register('delayCategory')}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30"
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
                className="block font-medium text-[var(--text-muted)] text-xs"
              >
                Delay Duration (min)
              </label>
              <input
                id="drilling-delay-min"
                type="number"
                {...register('delayMinutes', { valueAsNumber: true })}
                className={cn(
                  'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30',
                  errors.delayMinutes && 'border-accent-red'
                )}
                placeholder="0"
              />
              {errors.delayMinutes && (
                <p className="mt-0.5 text-accent-red text-xs">{errors.delayMinutes.message}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Machines list (read-only reference) */}
      {machines.length > 0 && (
        <div className="space-y-2">
          <label className="block text-[var(--text-muted)] text-sm">
            Active Rigs &amp; Equipment
          </label>
          <div className="flex flex-wrap gap-2">
            {machines.map((m) => (
              <span
                key={m.id}
                className="rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1 text-[var(--text-secondary)] text-xs"
              >
                {m.name} ({m.machine_type})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <label htmlFor="daily-log-notes" className="block text-[var(--text-muted)] text-sm">
          Observations &amp; Shift Handover Notes
        </label>
        <textarea
          id="daily-log-notes"
          {...register('notes')}
          rows={4}
          className={cn(
            'w-full resize-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3 text-[var(--text-heading)] transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30',
            errors.notes && 'border-accent-red'
          )}
          placeholder="Enter any stratum notes, bit wear observations, or safety handovers..."
          aria-label="Daily log notes"
          aria-invalid={errors.notes ? 'true' : 'false'}
          aria-describedby={errors.notes ? 'daily-log-notes-error' : undefined}
        />
        {errors.notes && (
          <p id="daily-log-notes-error" className="mt-1 text-accent-red text-xs">
            {errors.notes.message}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <SecondaryButton type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Daily Log'}
        </SecondaryButton>
        {/* Cancel – returns the user to the previous page without persisting changes */}
        <SecondaryButton type="button" onClick={() => router.back()} disabled={isSubmitting}>
          Cancel
        </SecondaryButton>

        {status === 'success' && (
          <span className="text-accent-green text-sm" role="status" aria-live="polite">
            Log saved successfully.
          </span>
        )}
        {status === 'error' && (
          <span className="text-accent-red text-sm" role="alert" aria-live="assertive">
            Failed to save log. Please try again.
          </span>
        )}
      </div>
    </form>
  );
}
