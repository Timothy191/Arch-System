'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Divider } from '@repo/ui/Divider';
import { GlassCard } from '@repo/ui/GlassCard';
import { CheckCircle2, RefreshCw, Sparkles, Target } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { getProductionPlatformTargets, saveProductionPlatformTargets } from './actions';
import {
  DEFAULT_PRODUCTION_PLATFORM_TARGETS,
  type ProductionHorizonKey,
  type ProductionHorizonTargets,
  type ProductionPlatformTargets,
  scaleTargetsFromShift,
} from './production-types';

export interface ProductionTargetsPanelProps {
  initialTargets?: ProductionPlatformTargets;
  deptId?: string;
}

const HORIZON_META: ReadonlyArray<{
  key: ProductionHorizonKey;
  title: string;
  subtitle: string;
  badgeText: string;
}> = [
  {
    key: 'shift',
    title: 'Shift Targets',
    subtitle: '12-hour shift production baseline',
    badgeText: '1x Shift',
  },
  {
    key: 'daily',
    title: 'Daily Targets',
    subtitle: 'Combined Day + Night shift (24h)',
    badgeText: '2x Shift',
  },
  {
    key: 'weekly',
    title: 'Weekly Targets',
    subtitle: '7-day pit operating cadence',
    badgeText: '14x Shift',
  },
  {
    key: 'monthly',
    title: 'Monthly Targets',
    subtitle: 'Synced to monthly banner & reports',
    badgeText: '60x Shift',
  },
];

const METRIC_FIELDS: ReadonlyArray<{
  field: keyof ProductionHorizonTargets;
  label: string;
  unit: string;
}> = [
  { field: 'pitBcmTarget', label: 'Pit BCM', unit: 'BCM' },
  { field: 'coalTonnesTarget', label: 'ROM Coal', unit: 't' },
  { field: 'wasteTonnesTarget', label: 'Overburden Waste', unit: 't' },
  { field: 'loadsTarget', label: 'Haul Loads', unit: 'loads' },
  { field: 'rolloverTargetBcm', label: 'Rollover Target', unit: 'BCM' },
  { field: 'smrHoursTarget', label: 'Fleet SMR Hours', unit: 'hrs' },
];

const INPUT_CLASS =
  'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-[var(--text-heading)] text-sm focus:border-[var(--accent-blue)] focus:outline-none';
const LABEL_CLASS = 'mb-1 block font-medium text-[var(--text-secondary)] text-xs';
const HORIZON_CARD_CLASS = 'space-y-4 border border-[var(--border-subtle)] p-5';

export function ProductionTargetsPanel({ initialTargets }: ProductionTargetsPanelProps) {
  const [targets, setTargets] = useState<ProductionPlatformTargets>(
    initialTargets ?? DEFAULT_PRODUCTION_PLATFORM_TARGETS
  );
  const [isHydrating, setIsHydrating] = useState<boolean>(!initialTargets);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (initialTargets) return;
    let active = true;
    getProductionPlatformTargets()
      .then((loaded) => {
        if (active) {
          setTargets(loaded);
        }
      })
      .catch(() => {
        // Retain structured defaults if read fails
      })
      .finally(() => {
        if (active) {
          setIsHydrating(false);
        }
      });
    return () => {
      active = false;
    };
  }, [initialTargets]);

  const handleFieldChange = (
    horizon: ProductionHorizonKey,
    field: keyof ProductionHorizonTargets,
    rawValue: string
  ) => {
    const numericVal = Math.max(0, Number(rawValue) || 0);
    setSavedNotice(null);
    setTargets((prev) => ({
      ...prev,
      [horizon]: {
        ...prev[horizon],
        [field]: numericVal,
      },
    }));
  };

  const handleAutoScaleFromShift = () => {
    const scaled = scaleTargetsFromShift(targets.shift);
    setSavedNotice(null);
    setTargets((prev) => ({
      ...prev,
      ...scaled,
    }));
    toast.success('Scaled Daily (2x), Weekly (14x), and Monthly (60x) targets from Shift.');
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        const result = await saveProductionPlatformTargets(targets);
        setTargets(result.targets);
        const timestamp = result.targets.updatedAt
          ? new Date(result.targets.updatedAt).toLocaleTimeString('en-ZA')
          : 'just now';
        setSavedNotice(`Production targets saved and synced across monthly plans (${timestamp}).`);
        toast.success(
          'Production targets saved and synced to monthly Coal, Waste & Pit BCM plans.'
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save production targets');
      }
    });
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <GlassCard className="p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex items-center gap-2 font-bold text-2xl text-[var(--text-heading)]">
                <Target className="h-5 w-5 text-[var(--accent-blue)]" />
                Production Targets Workspace
              </h2>
              <Divider className="my-4 h-px bg-[var(--accent-blue)]/50" />
              <Badge
                variant="outline"
                className="border-emerald-500/25 bg-emerald-500/10 font-mono text-emerald-700 text-xs"
              >
                Shift · Daily · Weekly · Monthly
              </Badge>
            </div>
            <p className="mt-1 text-[var(--text-secondary)] text-xs">
              Configure operational targets for Pit BCM, ROM Coal, Overburden Waste, Haul Loads,
              Dozer Rollover, and Fleet SMR Hours. Saving automatically syncs Monthly Coal, Waste,
              and Pit BCM targets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAutoScaleFromShift}
              disabled={isPending}
              className="gap-1.5 text-xs"
            >
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
              Auto-Scale from Shift
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={isPending || isHydrating}
              className="gap-1.5 bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90"
            >
              {isPending ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {isPending ? 'Saving Targets…' : 'Save Production Targets'}
            </Button>
          </div>
        </div>

        {savedNotice && (
          <div
            role="status"
            className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-700 text-xs"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{savedNotice}</span>
          </div>
        )}
      </GlassCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {HORIZON_META.map((meta) => {
          const horizonValues = targets[meta.key];
          return (
            <GlassCard key={meta.key} className={HORIZON_CARD_CLASS}>
              <div className="flex items-center justify-between border-[var(--border-subtle)] border-b pb-3">
                <div>
                  <h3 className="font-bold text-[var(--text-heading)] text-base">{meta.title}</h3>
                  <p className="text-[var(--text-muted)] text-xs">{meta.subtitle}</p>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  {meta.badgeText}
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {METRIC_FIELDS.map(({ field, label, unit }) => {
                  const inputId = `${meta.key}-${field}`;
                  return (
                    <div key={field}>
                      <label htmlFor={inputId} className={LABEL_CLASS}>
                        {label} ({unit})
                      </label>
                      <input
                        id={inputId}
                        aria-label={`${meta.title} ${label} (${unit})`}
                        type="number"
                        min={0}
                        step="any"
                        required
                        value={horizonValues[field]}
                        onChange={(e) => handleFieldChange(meta.key, field, e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          );
        })}
      </div>

      <GlassCard className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1">
            <label htmlFor="production-targets-notes" className={LABEL_CLASS}>
              Planning Basis / Seam Notes
            </label>
            <input
              id="production-targets-notes"
              type="text"
              value={targets.notes ?? ''}
              onChange={(e) => {
                setSavedNotice(null);
                setTargets((prev) => ({ ...prev, notes: e.target.value }));
              }}
              placeholder="e.g. Pit 2 & Seam 4 haulage + rollover targets"
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm"
            />
          </div>
          {targets.updatedAt && (
            <p className="font-mono text-[11px] text-[var(--text-muted)]">
              Last updated: {new Date(targets.updatedAt).toLocaleString('en-ZA')}
            </p>
          )}
        </div>
      </GlassCard>
    </form>
  );
}
