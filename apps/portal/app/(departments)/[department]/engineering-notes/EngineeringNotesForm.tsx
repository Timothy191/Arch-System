'use client';

import { useOfflineQueue } from '@repo/shared/hooks';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { Checkbox } from '@repo/ui/Checkbox';
import { GlassCard } from '@repo/ui/GlassCard';
import { useAutoSave } from '@repo/ui/hooks/useAutoSave';
import { getCurrentShift } from '@repo/utils/client';
import { AlertTriangle, ChevronDown, ChevronUp, Wrench } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { speculativeEmbedShiftLog } from '@/app/actions';
import type { BreakdownControlRoomView } from '@/features/departments';
import { createEngineeringNote } from './actions';

interface Machine {
  id: string;
  name: string;
  machine_type: string;
}

interface EngineeringNotesFormProps {
  departmentId: string;
  machines: Machine[];
  breakdownDrafts?: BreakdownControlRoomView[];
}

const ISSUE_TYPES = [
  { value: 'mechanical', label: 'Mechanical', color: '#1c1c1e' },
  { value: 'electrical', label: 'Electrical', color: '#27272a' },
  { value: 'structural', label: 'Structural', color: '#3f3f46' },
  { value: 'hydraulic', label: 'Hydraulic', color: '#52525b' },
  { value: 'other', label: 'Other', color: '#71717a' },
];

const SEVERITY_LEVELS = [
  { value: 'low', label: 'Low', color: '#10b981' },
  { value: 'medium', label: 'Medium', color: '#71717a' },
  { value: 'high', label: 'High', color: '#ef4444' },
  { value: 'critical', label: 'Critical', color: '#dc2626' },
];

function inferIssueType(machineType: string): string {
  const t = machineType.toLowerCase();
  if (t.includes('electric') || t.includes('switchgear') || t.includes('transformer'))
    return 'electrical';
  if (t.includes('hydraul')) return 'hydraulic';
  return 'mechanical';
}

function matchMachineId(machines: Machine[], machineName: string | null): string {
  if (!machineName) return '';
  const needle = machineName.toLowerCase();
  const match = machines.find(
    (m) =>
      m.name.toLowerCase() === needle ||
      m.name.toLowerCase().includes(needle) ||
      needle.includes(m.name.toLowerCase())
  );
  return match?.id ?? '';
}

export function EngineeringNotesForm({
  departmentId,
  machines,
  breakdownDrafts = [],
}: EngineeringNotesFormProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [formData, setFormData] = useState({
    issueType: '',
    severity: '',
    machineId: '',
    shiftType: getCurrentShift(),
    description: '',
    actionTaken: '',
    requiresFollowUp: false,
  });

  const [isTemplatePreFilled, setIsTemplatePreFilled] = useState(false);
  const [draftsExpanded, setDraftsExpanded] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { clear: clearDraft } = useAutoSave(formData, {
    key: `eng-note-draft-${departmentId}`,
    onLoad: (savedData) => setFormData(savedData),
  });

  const prefillFromBreakdown = (bd: BreakdownControlRoomView) => {
    setFormData({
      issueType: inferIssueType(bd.machine_type),
      severity: bd.status === 'active' ? 'high' : 'medium',
      machineId: matchMachineId(machines, bd.machine_name),
      shiftType: getCurrentShift(),
      description: `[${bd.fleet_id}] ${bd.reason}`,
      actionTaken: '',
      requiresFollowUp: bd.status === 'active',
    });
    setIsTemplatePreFilled(true);
    setDraftsExpanded(false);
    // Scroll form into view and autofocus actionTaken field
    setTimeout(() => {
      const actionInput = document.getElementById('eng-action-taken') as HTMLTextAreaElement | null;
      if (actionInput) {
        actionInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        actionInput.focus();
      } else {
        document
          .getElementById('eng-notes-form')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.issueType) {
      newErrors.issueType = 'Select issue type';
    }
    if (!formData.severity) {
      newErrors.severity = 'Select severity';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Enter description';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error('Please fix the errors in the form.');
      return;
    }

    setIsSubmitting(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const payload = {
        department_id: departmentId,
        note_date: today,
        shift_type: formData.shiftType,
        issue_type: formData.issueType,
        severity: formData.severity,
        machine_id: formData.machineId || null,
        description: formData.description,
        action_taken: formData.actionTaken || null,
        requires_follow_up: formData.requiresFollowUp,
        status: 'open',
      };

      if (!navigator.onLine) {
        useOfflineQueue.getState().enqueue({
          url: '/api/sync/fallback',
          method: 'POST',
          body: JSON.stringify({
            action: 'createEngineeringNote',
            payload,
          }),
          description: 'Engineering Note',
        });
        clearDraft();
        toast.success('Note saved offline and will sync automatically.');

        // Speculatively generate embeddings in background when online
        setIsSubmitting(false);

        return;
      }

      await createEngineeringNote(payload);
      clearDraft();

      // Speculatively generate embeddings in background
      if (formData.description && formData.description.trim() !== '') {
        speculativeEmbedShiftLog(formData.description).catch(() => {});
      }
      if (formData.actionTaken && formData.actionTaken.trim() !== '') {
        speculativeEmbedShiftLog(formData.actionTaken).catch(() => {});
      }

      // Clear form
      setFormData({
        issueType: '',
        severity: '',
        machineId: '',
        shiftType: getCurrentShift(),
        description: '',
        actionTaken: '',
        requiresFollowUp: false,
      });
      setIsTemplatePreFilled(false);
      toast.success('Engineering issue logged successfully');

      router.refresh();
    } catch (_err) {
      toast.error('Failed to save. Please try again.');
      setErrors({ submit: 'Failed to save. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Engineering Breakdowns Draft Panel */}
      {breakdownDrafts.length > 0 && (
        <GlassCard className="overflow-hidden p-0">
          <button
            type="button"
            onClick={() => setDraftsExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--bg-tertiary)]"
          >
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 shrink-0 text-accent-amber" />
              <span className="font-medium text-[var(--text-heading)] text-sm">
                Engineering Breakdowns
              </span>
              <span className="rounded-full border border-accent-amber/20 bg-accent-amber/10 px-2 py-0.5 text-accent-amber text-xs">
                {breakdownDrafts.length} active/today
              </span>
            </div>
            {draftsExpanded ? (
              <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
            )}
          </button>

          {draftsExpanded && (
            <div className="divide-y divide-[var(--border-default)] border-[var(--border-default)] border-t">
              {breakdownDrafts.map((bd) => (
                <div key={bd.id} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[var(--text-heading)] text-sm">
                        {bd.machine_name || bd.fleet_id}
                      </span>
                      <span className="text-[var(--text-muted)] text-xs">[{bd.fleet_id}]</span>
                      {bd.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-accent-red/20 bg-accent-red/10 px-2 py-0.5 text-accent-red text-xs">
                          <AlertTriangle className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/50 bg-emerald-50/70 px-2 py-0.5 font-semibold text-emerald-700 text-xs">
                          <span className="badge-pulse-dot bg-emerald-500" />
                          Completed today
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-[var(--text-secondary)] text-xs">{bd.reason}</p>
                    <p className="text-[var(--text-muted)] text-xs">
                      {bd.machine_type} &middot; In: {bd.date_in} {bd.time_in}
                      {bd.date_out && ` → Out: ${bd.date_out}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => prefillFromBreakdown(bd)}
                    className="shrink-0 rounded-lg border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-3 py-1.5 text-[var(--accent-blue)] text-xs transition-colors hover:bg-[var(--accent-blue)]/20"
                  >
                    Log Note →
                  </button>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      <GlassCard>
        <form id="eng-notes-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-[var(--text-heading)] text-lg">
              Log Engineering Issue
            </h3>
            {isTemplatePreFilled && (
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-accent-amber/20 bg-accent-amber/10 px-2 py-1 text-accent-amber text-xs">
                  Template from Engineering
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      issueType: '',
                      severity: '',
                      machineId: '',
                      shiftType: getCurrentShift(),
                      description: '',
                      actionTaken: '',
                      requiresFollowUp: false,
                    });
                    setIsTemplatePreFilled(false);
                  }}
                  className="text-[var(--text-muted)] text-xs transition-colors hover:text-[var(--text-heading)]"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Issue Type */}
            <div className="space-y-2">
              <label className="block text-[var(--text-secondary)] text-sm">
                Issue Type <span className="text-accent-red">*</span>
              </label>
              <select
                value={formData.issueType}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    issueType: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
              >
                <option value="">Select type...</option>
                {ISSUE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {errors.issueType && <p className="text-accent-red text-xs">{errors.issueType}</p>}
            </div>

            {/* Severity */}
            <div className="space-y-2">
              <label className="block text-[var(--text-secondary)] text-sm">
                Severity <span className="text-accent-red">*</span>
              </label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData((prev) => ({ ...prev, severity: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
              >
                <option value="">Select severity...</option>
                {SEVERITY_LEVELS.map((sev) => (
                  <option key={sev.value} value={sev.value}>
                    {sev.label}
                  </option>
                ))}
              </select>
              {errors.severity && <p className="text-accent-red text-xs">{errors.severity}</p>}
            </div>

            {/* Machine (Optional) */}
            <div className="space-y-2">
              <label className="block text-[var(--text-secondary)] text-sm">
                Affected Machine <span className="text-[var(--text-muted)]">(Optional)</span>
              </label>
              <select
                value={formData.machineId}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    machineId: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
              >
                <option value="">No specific machine</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Shift Type */}
          <div className="space-y-2">
            <label className="block text-[var(--text-secondary)] text-sm">Shift</label>
            <div className="flex max-w-xs gap-2">
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
                  className={`flex-1 rounded-lg px-3 py-2 font-medium text-sm transition-colors ${
                    formData.shiftType === shift
                      ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)]'
                      : 'border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                  }`}
                >
                  {shift.charAt(0).toUpperCase() + shift.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="block text-[var(--text-secondary)] text-sm">
              Description <span className="text-accent-red">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Describe the engineering issue..."
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
            />
            <div className="flex justify-between">
              {errors.description && (
                <p className="text-accent-red text-xs">{errors.description}</p>
              )}
              <p className="ml-auto text-[var(--text-muted)] text-xs">
                {formData.description.length}/500
              </p>
            </div>
          </div>

          {/* Action Taken */}
          <div className="space-y-2">
            <label className="block text-[var(--text-secondary)] text-sm">
              Action Taken <span className="text-[var(--text-muted)]">(Optional)</span>
            </label>
            <textarea
              id="eng-action-taken"
              value={formData.actionTaken}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  actionTaken: e.target.value,
                }))
              }
              placeholder="What was done to address this issue?"
              rows={2}
              maxLength={300}
              className="w-full resize-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
            />
          </div>

          {/* Follow-up Checkbox */}
          <Checkbox
            checked={formData.requiresFollowUp}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                requiresFollowUp: e.target.checked,
              }))
            }
            label="Requires follow-up"
            className="text-[var(--text-secondary)] text-sm"
          />

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-[var(--accent-blue)] px-6 py-2.5 font-medium text-[var(--bg-secondary)] transition-colors hover:bg-[var(--accent-blue)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-muted)]"
            >
              {isSubmitting ? 'Saving...' : 'Log Issue'}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
