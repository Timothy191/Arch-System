'use client';

import { dozerRollSchema } from '@repo/contract/schemas/form.schema';
import { useOfflineQueue } from '@repo/shared/hooks';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import { ShiftToggle } from '@repo/ui/ShiftToggle';
import { getCurrentShift } from '@repo/utils';
import { Calculator, Equal, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning';
import { createDozerRoll } from './actions';

interface DozerWithSite {
  id: string;
  name: string;
  serial_number: string | null;
  site_id: string | null;
  sites: { name: string }[] | null;
}

interface DozerRollFormProps {
  departmentId: string;
  dozers: DozerWithSite[];
  today: string;
}

export function DozerRollForm({ departmentId, dozers, today }: DozerRollFormProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [isOpen, setIsOpen] = useState(false);
  const [machineId, setMachineId] = useState('');
  const [lengthM, setLengthM] = useState('');
  const [widthM, setWidthM] = useState('');
  const [bladePasses, setBladePasses] = useState('');
  const [pushCount, setPushCount] = useState('');
  const [hoursOperated, setHoursOperated] = useState('');
  const [shiftType, setShiftType] = useState<'day' | 'night'>(getCurrentShift());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftKey = `arch_dozer_roll_draft_${departmentId}_${today}`;

  // Restore draft on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.machineId) setMachineId(parsed.machineId);
        if (parsed.lengthM) setLengthM(parsed.lengthM);
        if (parsed.widthM) setWidthM(parsed.widthM);
        if (parsed.bladePasses) setBladePasses(parsed.bladePasses);
        if (parsed.pushCount) setPushCount(parsed.pushCount);
        if (parsed.hoursOperated) setHoursOperated(parsed.hoursOperated);
        if (parsed.shiftType) setShiftType(parsed.shiftType);
        if (parsed.isOpen) setIsOpen(true);
      }
    } catch {
      // Ignore read error
    }
  }, [draftKey]);

  const saveDraft = useMemo(() => {
    return () => {
      if (typeof window === 'undefined') return;
      try {
        if (machineId || lengthM || widthM || bladePasses || pushCount || hoursOperated) {
          localStorage.setItem(
            draftKey,
            JSON.stringify({
              isOpen,
              machineId,
              lengthM,
              widthM,
              bladePasses,
              pushCount,
              hoursOperated,
              shiftType,
            })
          );
        } else {
          localStorage.removeItem(draftKey);
        }
      } catch {
        // Ignore write error
      }
    };
  }, [
    draftKey,
    isOpen,
    machineId,
    lengthM,
    widthM,
    bladePasses,
    pushCount,
    hoursOperated,
    shiftType,
  ]);

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

  const isDirty =
    isOpen && !!(machineId || lengthM || widthM || bladePasses || pushCount || hoursOperated);

  useUnsavedChangesWarning(isDirty);

  const selectedDozer = useMemo(() => dozers.find((d) => d.id === machineId), [machineId, dozers]);

  const siteName = selectedDozer?.sites?.[0]?.name ?? '—';

  const area = useMemo(() => {
    const l = parseFloat(lengthM);
    const w = parseFloat(widthM);
    if (Number.isNaN(l) || Number.isNaN(w)) return 0;
    return l * w;
  }, [lengthM, widthM]);

  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return (
      <GlassCard className="border-accent-red/30 bg-accent-red/5 p-6 text-accent-red">
        <p className="font-medium text-sm">
          Operational date is missing or invalid. Please reload the page.
        </p>
      </GlassCard>
    );
  }

  const reset = () => {
    setMachineId('');
    setLengthM('');
    setWidthM('');
    setBladePasses('');
    setPushCount('');
    setHoursOperated('');
    setShiftType(getCurrentShift());
    setError(null);
    setIsOpen(false);
    clearDraft();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!machineId) {
      setError('Select a dozer');
      return;
    }
    if (!hoursOperated && (!lengthM || !widthM)) {
      setError('Enter hours operated or both length and width');
      return;
    }

    setIsSubmitting(true);

    const validation = dozerRollSchema.safeParse({
      departmentId,
      machineId,
      today,
      shiftType,
      bladePasses: parseInt(bladePasses || '0', 10),
      pushCount: parseInt(pushCount || '0', 10),
      hoursOperated: parseFloat(hoursOperated || '0'),
      area,
    });

    if (!validation.success) {
      setError(validation.error.issues[0]?.message || 'Validation failed');
      setIsSubmitting(false);
      return;
    }

    try {
      if (!navigator.onLine) {
        useOfflineQueue.getState().enqueue({
          url: '/api/sync/fallback',
          method: 'POST',
          body: JSON.stringify({
            action: 'createDozerRoll',
            payload: {
              departmentId,
              machineId,
              today,
              shiftType,
              bladePasses: parseInt(bladePasses || '0', 10),
              pushCount: parseInt(pushCount || '0', 10),
              hoursOperated: parseFloat(hoursOperated || '0'),
              area,
              lengthM,
              widthM,
            },
          }),
          description: `Dozer Roll for ${dozers.find((d) => d.id === machineId)?.name || 'Unknown'}`,
        });
        reset();
        router.refresh();
        return;
      }

      await createDozerRoll({
        departmentId,
        machineId,
        today,
        shiftType,
        bladePasses: parseInt(bladePasses || '0', 10),
        pushCount: parseInt(pushCount || '0', 10),
        hoursOperated: parseFloat(hoursOperated || '0'),
        area,
        lengthM,
        widthM,
      });

      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save roll. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {!isOpen && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-[var(--accent-blue)] px-5 py-2.5 font-medium text-[var(--bg-secondary)] transition-colors hover:bg-[var(--accent-blue)]/90"
          >
            <Plus className="h-4 w-4" />
            Add Roll
          </button>
        </div>
      )}

      {isOpen && (
        <GlassCard>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-[var(--accent-blue)]" />
                <h3 className="font-medium text-[var(--text-heading)] text-lg">
                  Record Dozer Roll
                </h3>
              </div>
              <button
                type="button"
                onClick={reset}
                className="text-[var(--text-muted)] text-sm transition-colors hover:text-[var(--text-heading)]"
              >
                Cancel
              </button>
            </div>

            {/* Display operational date (read‑only) */}
            <div className="flex items-center justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm">
              <span className="font-medium text-[var(--text-secondary)]">Operational Date:</span>
              <span className="font-mono font-semibold text-[var(--accent-blue)]">
                {today} (Africa/Johannesburg)
              </span>
            </div>

            {/* Dozer & Site */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="dozer-select"
                  className="block text-[var(--text-secondary)] text-sm"
                >
                  Dozer <span className="text-accent-red">*</span>
                </label>
                <select
                  id="dozer-select"
                  value={machineId}
                  onChange={(e) => setMachineId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20"
                >
                  <option value="">Select dozer...</option>
                  {dozers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {d.serial_number ? ` (${d.serial_number})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-[var(--text-secondary)] text-sm">Site</label>
                <div className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-2.5 text-[var(--text-heading)] text-sm">
                  {siteName}
                </div>
              </div>
            </div>

            {/* Shift */}
            <div className="space-y-2">
              <label className="block text-[var(--text-secondary)] text-sm">Shift</label>
              <ShiftToggle value={shiftType} onChange={setShiftType} />
            </div>

            {/* Calculation: Length x Width = Area */}
            <div className="space-y-2">
              <label className="block text-[var(--text-secondary)] text-sm">Area Calculation</label>
              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-1">
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={lengthM}
                    onChange={(e) => setLengthM(e.target.value)}
                    placeholder="Length (m)"
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[var(--text-heading)] text-sm transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20"
                  />
                </div>
                <X className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
                <div className="flex-1 space-y-1">
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={widthM}
                    onChange={(e) => setWidthM(e.target.value)}
                    placeholder="Width (m)"
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[var(--text-heading)] text-sm transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20"
                  />
                </div>
                <Equal className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
                <div className="flex-1">
                  <div className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-2.5 text-center font-medium text-[var(--accent-blue)] text-sm">
                    {area > 0 ? `${area.toFixed(2)} m²` : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Roll Metrics */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="block text-[var(--text-secondary)] text-sm">Blade Passes</label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={bladePasses}
                  onChange={(e) => setBladePasses(e.target.value)}
                  placeholder="e.g. 12"
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[var(--text-heading)] text-sm transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[var(--text-secondary)] text-sm">Push Count</label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={pushCount}
                  onChange={(e) => setPushCount(e.target.value)}
                  placeholder="e.g. 8"
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[var(--text-heading)] text-sm transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[var(--text-secondary)] text-sm">Hours Operated</label>
                <input
                  type="number"
                  min={0}
                  max={24}
                  step="0.1"
                  value={hoursOperated}
                  onChange={(e) => setHoursOperated(e.target.value)}
                  placeholder="e.g. 8.5"
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[var(--text-heading)] text-sm transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20"
                />
              </div>
            </div>

            {machineId && (
              <div
                data-testid="dozer-rollover-summary"
                className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--accent-blue)]/30 bg-[var(--bg-secondary)] p-3.5"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--text-heading)] text-sm">
                    Roll-over Amount:
                  </span>
                  <span className="font-mono text-[var(--text-muted)] text-xs">
                    (
                    {(Number.isNaN(parseFloat(hoursOperated))
                      ? 0
                      : parseFloat(hoursOperated)
                    ).toFixed(2)}
                    h &times; 250 = Total Roll-over)
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3.5 py-1.5">
                  <span className="text-[var(--text-muted)] text-xs">Total Roll-over:</span>
                  <span className="font-mono font-semibold text-[var(--accent-blue)] text-xl">
                    {Number(
                      (
                        (Number.isNaN(parseFloat(hoursOperated)) ? 0 : parseFloat(hoursOperated)) *
                        250
                      ).toFixed(1)
                    ).toLocaleString()}{' '}
                    BCM
                  </span>
                </div>
              </div>
            )}

            {error && (
              <p className="text-accent-red text-sm" role="alert" aria-live="assertive">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-[var(--accent-blue)] px-6 py-2.5 font-medium text-[var(--bg-secondary)] transition-colors hover:bg-[var(--accent-blue)]/90 disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-muted)]"
              >
                {isSubmitting ? 'Saving...' : 'Save Roll'}
              </button>
            </div>
          </form>
        </GlassCard>
      )}
    </div>
  );
}
