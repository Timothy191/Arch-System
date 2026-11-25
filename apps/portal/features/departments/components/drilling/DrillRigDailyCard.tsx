'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { cn } from '@repo/ui/lib/utils';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Clock,
  MapPin,
  Moon,
  Ruler,
  Save,
  Sun,
} from 'lucide-react';
import Image from 'next/image';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import {
  type DrillDailySavedRecord,
  type DrillRigDailyCardItem,
  type DrillShiftSnapshot,
  type DrillShiftType,
  saveDrillDailyEntry,
} from './actions';

const DEFAULT_DRILL_RIG_IMAGE = '/images/fleet/atlas-copco-drill.webp';
const RIG_IMAGE_WIDTH = 112;
const RIG_IMAGE_HEIGHT = 80;
const METERS_DECIMAL_PLACES = 1;

const CARD_CONTAINER_CLASS = 'space-y-4 p-5';
const HEADER_ROW_CLASS = 'flex items-start justify-between gap-4';
const RIG_IDENTITY_CLASS = 'flex min-w-0 items-center gap-3.5';
const PHOTO_FRAME_CLASS =
  'relative h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]';
const RIG_PHOTO_CLASS = 'h-full w-full object-cover';
const STATUS_LOGGED_CLASS =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 text-xs';
const STATUS_PENDING_CLASS =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700 text-xs';
const METRICS_GRID_CLASS = 'grid grid-cols-1 gap-3 sm:grid-cols-2';
const METRIC_BOX_CLASS =
  'rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3.5';
const WHERE_BOX_CLASS =
  'mb-4 flex items-center gap-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3.5 py-2.5';
const TOGGLE_BUTTON_CLASS =
  'mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3.5 py-2.5 font-medium text-[var(--text-heading)] text-xs transition-colors hover:bg-[var(--bg-secondary)]';
const FORM_PANEL_CLASS =
  'space-y-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4';
const INPUT_CLASS =
  'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-heading)] text-sm focus:border-[var(--accent-blue)] focus:outline-none';
const SHIFT_BTN_ACTIVE_CLASS =
  'flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3 py-1.5 font-medium text-white text-xs shadow-xs';
const SHIFT_BTN_INACTIVE_CLASS =
  'flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-1.5 font-medium text-[var(--text-muted)] text-xs';
const SUBMIT_BUTTON_CLASS =
  'inline-flex items-center gap-2 rounded-lg bg-[var(--accent-blue)] px-4 py-2 font-medium text-white text-sm shadow-xs transition-opacity disabled:opacity-60';

export interface DrillRigDailyCardProps {
  readonly departmentId: string;
  readonly logDate: string;
  readonly rig: DrillRigDailyCardItem;
  readonly onSaved: (record: DrillDailySavedRecord) => void;
}

interface ShiftDraftState {
  readonly shiftType: DrillShiftType;
  readonly metersText: string;
  readonly holesText: string;
  readonly siteText: string;
  readonly blockText: string;
  readonly commentsText: string;
}

function buildInitialDraft(rig: DrillRigDailyCardItem, shiftType: DrillShiftType): ShiftDraftState {
  const snapshot: DrillShiftSnapshot | null = shiftType === 'night' ? rig.nightShift : rig.dayShift;
  const fallbackSite = snapshot?.site ?? rig.homeSiteName ?? rig.homeSiteCode ?? '';

  return {
    shiftType,
    metersText: snapshot ? String(snapshot.metersDrilled) : '',
    holesText: snapshot ? String(snapshot.holes) : '',
    siteText: fallbackSite,
    blockText: snapshot?.blockDrilled ?? '',
    commentsText: snapshot?.comments ?? '',
  };
}

function renderShiftButton(options: {
  readonly targetShift: DrillShiftType;
  readonly activeShift: DrillShiftType;
  readonly label: string;
  readonly onSelect: (shift: DrillShiftType) => void;
}) {
  const isActive = options.activeShift === options.targetShift;
  return (
    <button
      type="button"
      onClick={() => options.onSelect(options.targetShift)}
      aria-pressed={isActive}
      className={isActive ? SHIFT_BTN_ACTIVE_CLASS : SHIFT_BTN_INACTIVE_CLASS}
    >
      {options.targetShift === 'day' ? (
        <Sun className="h-3.5 w-3.5" />
      ) : (
        <Moon className="h-3.5 w-3.5" />
      )}
      <span>{options.label}</span>
    </button>
  );
}

/**
 * Dedicated per-drill card displaying rig photo, daily meters, holes, Where location,
 * and an inline collapsible shift logging form.
 */
export function DrillRigDailyCard({ departmentId, logDate, rig, onSaved }: DrillRigDailyCardProps) {
  const initialShift: DrillShiftType = rig.dayShift && !rig.nightShift ? 'night' : 'day';
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ShiftDraftState>(() => buildInitialDraft(rig, initialShift));

  const dayMeters = rig.dayShift?.metersDrilled ?? 0;
  const nightMeters = rig.nightShift?.metersDrilled ?? 0;
  const dayHoles = rig.dayShift?.holes ?? 0;
  const nightHoles = rig.nightShift?.holes ?? 0;

  function handleToggleForm() {
    if (!isFormOpen) {
      setDraft(buildInitialDraft(rig, draft.shiftType));
      setFormError(null);
    }
    setIsFormOpen((prev) => !prev);
  }

  function handleSelectShift(nextShift: DrillShiftType) {
    setDraft(buildInitialDraft(rig, nextShift));
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsedMeters = Number(draft.metersText === '' ? 0 : draft.metersText);
    const parsedHoles = Number(draft.holesText === '' ? 0 : draft.holesText);

    if (!Number.isFinite(parsedMeters) || parsedMeters < 0) {
      setFormError('Meters drilled must be 0 or greater.');
      return;
    }
    if (!Number.isFinite(parsedHoles) || parsedHoles < 0) {
      setFormError('Holes drilled must be 0 or greater.');
      return;
    }
    if (!draft.siteText.trim() && !draft.blockText.trim()) {
      setFormError('Specify where the rig drilled (Site or Bench / Block ID).');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await saveDrillDailyEntry({
        departmentId,
        machineId: rig.machineId,
        operationDate: logDate,
        shiftType: draft.shiftType,
        metersDrilled: parsedMeters,
        holes: Math.trunc(parsedHoles),
        site: draft.siteText.trim(),
        blockDrilled: draft.blockText.trim(),
        comments: draft.commentsText.trim() || null,
      });

      if (!response.success) {
        setFormError(response.error);
        toast.error(response.error);
        return;
      }

      onSaved(response.record);
      toast.success(`Saved ${draft.shiftType} shift log for ${rig.name}`);
      setIsFormOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to save shift entry';
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const metersInputId = `rig-meters-${rig.machineId}`;
  const holesInputId = `rig-holes-${rig.machineId}`;
  const siteInputId = `rig-site-${rig.machineId}`;
  const blockInputId = `rig-block-${rig.machineId}`;
  const notesInputId = `rig-notes-${rig.machineId}`;

  return (
    <GlassCard className={CARD_CONTAINER_CLASS} data-testid={`drill-rig-card-${rig.machineId}`}>
      <div className={HEADER_ROW_CLASS}>
        <div className={RIG_IDENTITY_CLASS}>
          <div className={PHOTO_FRAME_CLASS}>
            <Image
              src={rig.imageUrl || DEFAULT_DRILL_RIG_IMAGE}
              alt={`${rig.name} drill rig`}
              width={RIG_IMAGE_WIDTH}
              height={RIG_IMAGE_HEIGHT}
              className={RIG_PHOTO_CLASS}
            />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-[var(--text-heading)] text-base">
              {rig.name}
            </h3>
            <p className="truncate text-[var(--text-muted)] text-xs">
              {rig.serialNumber ? `SN ${rig.serialNumber}` : rig.machineType}
            </p>
            {rig.homeSiteName && (
              <p className="mt-1 truncate text-[var(--text-muted)] text-xs">
                Home Site: {rig.homeSiteName}
              </p>
            )}
          </div>
        </div>

        <span className={rig.isLogged ? STATUS_LOGGED_CLASS : STATUS_PENDING_CLASS}>
          {rig.isLogged ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Active Logged</span>
            </>
          ) : (
            <>
              <Clock className="h-3.5 w-3.5" />
              <span>Awaiting Shift Entry</span>
            </>
          )}
        </span>
      </div>

      <div className={METRICS_GRID_CLASS}>
        <div className={METRIC_BOX_CLASS}>
          <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs">
            <Ruler className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
            <span>Daily Meters Drilled</span>
          </div>
          <p className="mt-1 font-semibold text-[var(--text-heading)] text-xl">
            {rig.dailyMetersDrilled.toFixed(METERS_DECIMAL_PLACES)} m
          </p>
          <p className="mt-0.5 text-[var(--text-muted)] text-xs">
            Day: {dayMeters.toFixed(METERS_DECIMAL_PLACES)} m · Night:{' '}
            {nightMeters.toFixed(METERS_DECIMAL_PLACES)} m
          </p>
        </div>

        <div className={METRIC_BOX_CLASS}>
          <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs">
            <CircleDot className="h-3.5 w-3.5 text-[var(--accent-cyan)]" />
            <span>Holes Drilled</span>
          </div>
          <p className="mt-1 font-semibold text-[var(--text-heading)] text-xl">
            {rig.dailyHolesDrilled} holes
          </p>
          <p className="mt-0.5 text-[var(--text-muted)] text-xs">
            Day: {dayHoles} · Night: {nightHoles}
          </p>
        </div>
      </div>

      <div className={WHERE_BOX_CLASS}>
        <MapPin className="h-4 w-4 shrink-0 text-[var(--accent-blue)]" />
        <div className="min-w-0 flex-1">
          <span className="font-medium text-[var(--text-muted)] text-xs">Where: </span>
          <span className="font-medium text-[var(--text-heading)] text-sm">{rig.whereDisplay}</span>
        </div>
      </div>

      {/* Move the button slightly down with improved spacing and white background */}
      <button
        type="button"
        onClick={handleToggleForm}
        aria-expanded={isFormOpen}
        className={TOGGLE_BUTTON_CLASS}
      >
        <span>Log / Update Shift Meters</span>
        {isFormOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className={FORM_PANEL_CLASS}>
          <div className="flex gap-2">
            {renderShiftButton({
              targetShift: 'day',
              activeShift: draft.shiftType,
              label: 'Day Shift',
              onSelect: handleSelectShift,
            })}
            {renderShiftButton({
              targetShift: 'night',
              activeShift: draft.shiftType,
              label: 'Night Shift',
              onSelect: handleSelectShift,
            })}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor={metersInputId}
                className="block font-medium text-[var(--text-muted)] text-xs"
              >
                Meters Drilled (m)
              </label>
              <input
                id={metersInputId}
                type="number"
                step="0.1"
                min="0"
                value={draft.metersText}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, metersText: event.target.value }))
                }
                placeholder="0.0"
                className={INPUT_CLASS}
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor={holesInputId}
                className="block font-medium text-[var(--text-muted)] text-xs"
              >
                Holes Drilled
              </label>
              <input
                id={holesInputId}
                type="number"
                step="1"
                min="0"
                value={draft.holesText}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, holesText: event.target.value }))
                }
                placeholder="0"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor={siteInputId}
                className="block font-medium text-[var(--text-muted)] text-xs"
              >
                Where — Site / Pit
              </label>
              <input
                id={siteInputId}
                type="text"
                value={draft.siteText}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, siteText: event.target.value }))
                }
                placeholder="e.g. Pit North"
                className={INPUT_CLASS}
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor={blockInputId}
                className="block font-medium text-[var(--text-muted)] text-xs"
              >
                Where — Bench / Pattern Block ID
              </label>
              <input
                id={blockInputId}
                type="text"
                value={draft.blockText}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, blockText: event.target.value }))
                }
                placeholder="e.g. Bench B4 · PAT-102"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor={notesInputId}
              className="block font-medium text-[var(--text-muted)] text-xs"
            >
              Shift Notes (optional)
            </label>
            <textarea
              id={notesInputId}
              rows={2}
              value={draft.commentsText}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, commentsText: event.target.value }))
              }
              placeholder="Stratum hardness, bit wear, or handover notes..."
              className={cn(INPUT_CLASS, 'resize-none')}
            />
          </div>

          {formError && (
            <p role="alert" className="font-medium text-red-600 text-xs">
              {formError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              disabled={isSubmitting}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-muted)] text-sm"
            >
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className={SUBMIT_BUTTON_CLASS}>
              <Save className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Save Shift Entry'}</span>
            </button>
          </div>
        </form>
      )}
    </GlassCard>
  );
}
