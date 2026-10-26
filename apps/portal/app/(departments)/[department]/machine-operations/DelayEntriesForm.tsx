'use client';

import { useOfflineQueue } from '@repo/shared/hooks';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import { CheckCircle, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { invalidateShiftSheetCache } from '@/actions/shift-sheet-cache';
import { useUnsavedChangesWarning } from '~/hooks/useUnsavedChangesWarning';
import { saveDelayEntriesBatch } from './actions';
import {
  DelayEntriesConfirmModal,
  DelayEntriesHeaderAndGuide,
  DelayEntryRowCard,
} from './DelayEntriesReferencePanel';
import {
  calculateDelayDurationHours,
  type DelayCategoryItem,
  type DelayEntriesFormProps,
  type DelayFormEntry,
  formatDelayEntriesFromDb,
  toUTC,
  validateDelayFormEntry,
} from './machine-operations-constants';

export function DelayEntriesForm({
  machineOperationId,
  departmentId,
  onDelayChange,
  existingDelays: _existingDelays = [],
  readOnly = false,
  engineeringDelayHours = 0,
  engineeringDelayReasons = [],
}: DelayEntriesFormProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [categories, setCategories] = useState<DelayCategoryItem[]>([]);
  const [delayEntries, setDelayEntries] = useState<DelayFormEntry[]>([]);
  const [initialDelays, setInitialDelays] = useState<DelayFormEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'commit' | 'remove' | null>(null);
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const isDirty = JSON.stringify(delayEntries) !== JSON.stringify(initialDelays);
  useUnsavedChangesWarning(isDirty);

  // Load delay categories
  useEffect(() => {
    const loadCategories = async () => {
      const { data } = await supabase
        .from('delay_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (data) setCategories(data);
    };
    loadCategories();
  }, [supabase]);

  // Load existing delays for this operation
  useEffect(() => {
    const loadExistingDelays = async () => {
      if (!machineOperationId) return;

      const { data } = await supabase
        .from('delay_entries')
        .select('*')
        .eq('machine_operation_id', machineOperationId)
        .order('delay_start_time');

      if (data) {
        const formatted = formatDelayEntriesFromDb(data);
        setDelayEntries(formatted);
        setInitialDelays(formatted);
      }
      setIsLoading(false);
    };
    loadExistingDelays();
  }, [machineOperationId, supabase]);

  // Add new empty delay entry
  const addDelayEntry = useCallback(() => {
    const newEntry: DelayFormEntry = {
      delay_category_id: '',
      delay_start_time: new Date().toISOString().slice(0, 16),
      delay_end_time: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
      is_manual_override: false,
      manual_duration_hours: null,
      description: '',
      status: 'draft',
    };
    setDelayEntries([...delayEntries, newEntry]);
  }, [delayEntries]);

  // Remove delay entry
  const handleRemoveClick = useCallback((index: number) => {
    setConfirmAction('remove');
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
      toast.success('Delay entry removed');
    },
    [delayEntries]
  );

  // Update delay entry field
  const updateDelayEntry = useCallback(
    <K extends keyof DelayFormEntry>(index: number, field: K, value: DelayFormEntry[K]) => {
      const updatedEntries = [...delayEntries];
      const entry = updatedEntries[index];
      if (!entry) return;

      const newEntry: DelayFormEntry = { ...entry, [field]: value };
      updatedEntries[index] = newEntry;
      setDelayEntries(updatedEntries);

      const error = validateDelayFormEntry(newEntry, index, updatedEntries, engineeringDelayHours);
      setErrors((prev) => {
        const next = { ...prev };
        if (error) {
          next[index] = error;
        } else {
          delete next[index];
        }
        return next;
      });

      onDelayChange?.(updatedEntries);
    },
    [delayEntries, engineeringDelayHours, onDelayChange]
  );

  // Save all delay entries
  const saveDelayEntries = async () => {
    setIsSubmitting(true);
    setErrors({});

    try {
      const validationErrors: Record<number, string> = {};
      delayEntries.forEach((entry, index) => {
        const error = validateDelayFormEntry(entry, index, delayEntries, engineeringDelayHours);
        if (error) {
          validationErrors[index] = error;
        }
      });

      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      const entriesToSave = delayEntries.map((entry) => ({
        ...(entry.id ? { id: entry.id } : {}),
        machine_operation_id: machineOperationId,
        delay_category_id: entry.delay_category_id,
        delay_start_time: toUTC(entry.delay_start_time),
        delay_end_time: toUTC(entry.delay_end_time),
        is_manual_override: entry.is_manual_override,
        manual_duration_hours: entry.manual_duration_hours,
        description: entry.description,
        status: 'draft' as const,
      }));

      if (!navigator.onLine) {
        useOfflineQueue.getState().enqueue({
          url: '/api/sync/fallback',
          method: 'POST',
          body: JSON.stringify({
            action: 'saveDelayEntriesBatch',
            payload: {
              machineOperationId,
              entries: entriesToSave,
            },
          }),
          description: `Saving ${entriesToSave.length} delay entries`,
        });
        const simulatedUpdate = delayEntries.map((d) => ({ ...d, status: 'draft' as const }));
        setDelayEntries(simulatedUpdate);
        onDelayChange?.(simulatedUpdate);
        setIsSubmitting(false);
        return;
      }

      await saveDelayEntriesBatch({ machineOperationId, entries: entriesToSave });

      const { data } = await supabase
        .from('delay_entries')
        .select('*')
        .eq('machine_operation_id', machineOperationId)
        .order('delay_start_time');

      if (data) {
        const formatted = formatDelayEntriesFromDb(data);
        setDelayEntries(formatted);
        setInitialDelays(formatted);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to save delay entries:', err);
      toast.error('Failed to save delay entries. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommitClick = useCallback(() => {
    const draftDelays = delayEntries.filter((d) => d.status === 'draft');
    if (draftDelays.length === 0) {
      toast.error('No draft delays to commit');
      return;
    }
    setConfirmAction('commit');
    setShowConfirmDialog(true);
  }, [delayEntries]);

  const commitDelays = async () => {
    setIsCommitting(true);
    setShowConfirmDialog(false);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to commit delays');
        return;
      }

      const { data: employee } = await supabase
        .from('employees')
        .select('id, role')
        .eq('auth_id', user.id)
        .single();

      if (!employee) {
        toast.error('Employee record not found');
        return;
      }

      if (employee.role !== 'supervisor' && employee.role !== 'admin') {
        toast.error('Only supervisors can commit delay entries');
        return;
      }

      const draftDelays = delayEntries.filter((d) => d.status === 'draft');

      for (const entry of draftDelays) {
        const { error } = await supabase
          .from('delay_entries')
          .update({
            status: 'committed',
            committed_at: new Date().toISOString(),
            committed_by: employee.id,
          })
          .eq('id', entry.id);

        if (error) throw error;
      }

      const { data } = await supabase
        .from('delay_entries')
        .select('*')
        .eq('machine_operation_id', machineOperationId)
        .order('delay_start_time');

      if (data) {
        const formatted = formatDelayEntriesFromDb(data);
        setDelayEntries(formatted);
        setInitialDelays(formatted);
      }

      toast.success(`${draftDelays.length} delay entry(ies) committed successfully`);
      await invalidateShiftSheetCache({ departmentId, wroteDelayEntries: true }).catch(() => {});
      router.refresh();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to commit delays:', err);
      toast.error('Failed to commit delays. Please try again.');
    } finally {
      setIsCommitting(false);
    }
  };

  const totalDelayHours = delayEntries.reduce((sum, entry) => {
    const duration = entry.is_manual_override
      ? entry.manual_duration_hours || 0
      : calculateDelayDurationHours(entry.delay_start_time, entry.delay_end_time);
    return sum + duration;
  }, 0);

  if (isLoading) {
    return (
      <GlassCard>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="mb-4 h-4 rounded bg-[var(--bg-tertiary)]" />
            <div className="mb-2 h-8 rounded bg-[var(--bg-tertiary)]" />
            <div className="mb-2 h-8 rounded bg-[var(--bg-tertiary)]" />
            <div className="h-8 rounded bg-[var(--bg-tertiary)]" />
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <div className="space-y-4">
        <DelayEntriesHeaderAndGuide
          totalDelayHours={totalDelayHours}
          engineeringDelayHours={engineeringDelayHours}
          engineeringDelayReasons={engineeringDelayReasons}
          showHelp={showHelp}
          readOnly={readOnly}
          onToggleHelp={() => setShowHelp(!showHelp)}
          onAddDelay={addDelayEntry}
        />

        {delayEntries.length === 0 ? (
          <div className="py-8 text-center text-[var(--text-muted)]">
            <Clock size={32} className="mx-auto mb-2 opacity-50" />
            <p>No delay entries yet</p>
            {!readOnly && <p className="mt-1 text-sm">Click "Add Delay" to log a delay</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {delayEntries.map((entry, index) => (
              <DelayEntryRowCard
                key={entry.id || index}
                entry={entry}
                index={index}
                categories={categories}
                readOnly={readOnly}
                error={errors[index]}
                onUpdateField={updateDelayEntry}
                onRemoveClick={handleRemoveClick}
              />
            ))}
          </div>
        )}

        {/* Save Button */}
        {!readOnly && delayEntries.length > 0 && delayEntries.some((d) => d.status === 'draft') && (
          <div className="flex justify-end gap-3 border-[var(--border-default)] border-t pt-4">
            <button
              type="button"
              onClick={saveDelayEntries}
              disabled={isSubmitting}
              className="min-w-[120px] rounded-lg bg-[var(--accent-blue)] px-4 py-2 font-medium text-[var(--bg-secondary)] transition-colors hover:bg-[var(--accent-blue)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-muted)]"
            >
              {isSubmitting ? 'Saving...' : 'Save Delays'}
            </button>
            <button
              type="button"
              onClick={handleCommitClick}
              disabled={isCommitting}
              className="flex min-w-[140px] items-center gap-2 rounded-lg bg-[var(--accent-green)] px-4 py-2 font-medium text-white transition-colors hover:bg-[var(--accent-green)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-muted)]"
            >
              {isCommitting ? (
                'Committing...'
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
          <DelayEntriesConfirmModal
            confirmAction={confirmAction}
            onCancel={() => {
              setShowConfirmDialog(false);
              setConfirmAction(null);
              setConfirmIndex(null);
            }}
            onConfirm={() => {
              if (confirmAction === 'commit') {
                commitDelays();
              } else if (confirmAction === 'remove' && confirmIndex !== null) {
                removeDelayEntry(confirmIndex);
              }
              setShowConfirmDialog(false);
              setConfirmAction(null);
              setConfirmIndex(null);
            }}
          />
        )}
      </div>
    </GlassCard>
  );
}
