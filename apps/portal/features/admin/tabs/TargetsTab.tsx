'use client';

import type {
  AdminOperationalTargets,
  OperationalTargetWindow,
} from '@repo/contract/schemas/admin.schema';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import { Calendar, Clock, RotateCcw, Save, Target, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminSaveOperationalTargets, getOperationalTargets } from '../actions/targets';

export const OPERATIONAL_TARGETS_STORAGE_KEY = 'arch_operational_targets_v1';

export const DEFAULT_OPERATIONAL_TARGETS_CLIENT: AdminOperationalTargets = {
  shift: {
    loadsTarget: 180,
    coalTonnesTarget: 4500,
    wasteTonnesTarget: 8200,
    volumeBcmTarget: 5400,
    smrHoursTarget: 96,
  },
  daily: {
    loadsTarget: 360,
    coalTonnesTarget: 9000,
    wasteTonnesTarget: 16400,
    volumeBcmTarget: 10800,
    smrHoursTarget: 192,
  },
  monthly: {
    loadsTarget: 10800,
    coalTonnesTarget: 270000,
    wasteTonnesTarget: 492000,
    volumeBcmTarget: 324000,
    smrHoursTarget: 5760,
  },
};

const TARGET_FIELDS: ReadonlyArray<{
  key: keyof OperationalTargetWindow;
  label: string;
  unit: string;
  helper: string;
}> = [
  {
    key: 'loadsTarget',
    label: 'Loaded Haulage Loads',
    unit: 'loads',
    helper: 'Total loaded dump truck / ADT cycles',
  },
  {
    key: 'coalTonnesTarget',
    label: 'ROM Coal Tonnage',
    unit: 'tonnes',
    helper: 'Run-of-Mine coal extraction target',
  },
  {
    key: 'wasteTonnesTarget',
    label: 'Waste & Overburden',
    unit: 'tonnes',
    helper: 'Stripping and waste removal target',
  },
  {
    key: 'volumeBcmTarget',
    label: 'Total Volume Moved',
    unit: 'BCM',
    helper: 'Bank Cubic Meters excavated across pits',
  },
  {
    key: 'smrHoursTarget',
    label: 'Fleet SMR Run Hours',
    unit: 'hours',
    helper: 'Cumulative active machine operating hours',
  },
];

export function TargetsTab() {
  const [targets, setTargets] = useState<AdminOperationalTargets>(
    DEFAULT_OPERATIONAL_TARGETS_CLIENT
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const remote = await getOperationalTargets();
        if (remote) {
          setTargets(remote);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(OPERATIONAL_TARGETS_STORAGE_KEY, JSON.stringify(remote));
          }
        }
      } catch {
        if (typeof window !== 'undefined') {
          const cached = window.localStorage.getItem(OPERATIONAL_TARGETS_STORAGE_KEY);
          if (cached) {
            try {
              setTargets(JSON.parse(cached) as AdminOperationalTargets);
            } catch {
              // ignore malformed local cache
            }
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleFieldChange = (
    horizon: keyof AdminOperationalTargets,
    field: keyof OperationalTargetWindow,
    rawValue: string
  ) => {
    const numeric = Math.max(0, Number(rawValue) || 0);
    setTargets((prev) => ({
      ...prev,
      [horizon]: {
        ...prev[horizon],
        [field]: numeric,
      },
    }));
  };

  const handleAutoScaleFromShift = () => {
    const s = targets.shift;
    const scaled: AdminOperationalTargets = {
      shift: { ...s },
      daily: {
        loadsTarget: s.loadsTarget * 2,
        coalTonnesTarget: s.coalTonnesTarget * 2,
        wasteTonnesTarget: s.wasteTonnesTarget * 2,
        volumeBcmTarget: s.volumeBcmTarget * 2,
        smrHoursTarget: s.smrHoursTarget * 2,
      },
      monthly: {
        loadsTarget: s.loadsTarget * 60,
        coalTonnesTarget: s.coalTonnesTarget * 60,
        wasteTonnesTarget: s.wasteTonnesTarget * 60,
        volumeBcmTarget: s.volumeBcmTarget * 60,
        smrHoursTarget: s.smrHoursTarget * 60,
      },
    };
    setTargets(scaled);
    toast.info('Daily (2× Shift) and Monthly (60× Shift) targets scaled from Shift baseline.');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(OPERATIONAL_TARGETS_STORAGE_KEY, JSON.stringify(targets));
      }
      const res = await adminSaveOperationalTargets(targets);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success('Shift, Daily, and Monthly operational targets saved.');
      }
    } catch {
      toast.error('Failed to save operational targets.');
    } finally {
      setSaving(false);
    }
  };

  const horizons: ReadonlyArray<{
    key: keyof AdminOperationalTargets;
    title: string;
    subtitle: string;
    badge: string;
    icon: typeof Clock;
  }> = [
    {
      key: 'shift',
      title: 'Shift Targets',
      subtitle: '12-hour Day / Night shift KPI benchmarks',
      badge: '12H SHIFT',
      icon: Clock,
    },
    {
      key: 'daily',
      title: 'Daily Targets',
      subtitle: '24-hour combined pit & haulage benchmarks',
      badge: '24H DAILY',
      icon: Target,
    },
    {
      key: 'monthly',
      title: 'Monthly Targets',
      subtitle: '30-day cumulative production & SCADA benchmarks',
      badge: '30D MONTHLY',
      icon: Calendar,
    },
  ];

  return (
    <div className="space-y-6" data-testid="admin-targets-tab">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <h2 className="font-bold text-[var(--text-heading)] text-lg">
            Operational Targets (Shift · Daily · Monthly)
          </h2>
          <p className="text-[var(--text-secondary)] text-xs">
            Define official Shift, Daily, and Monthly targets for Control Room SCADA graphs,
            excavator dispatch, and production dashboards.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAutoScaleFromShift}
            disabled={loading || saving}
            className="border-[var(--border-default)] text-[var(--text-heading)] text-xs"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Auto-Scale from Shift
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={loading || saving}
            className="gold-steel-border gold-steel-border-slim bg-[var(--accent-blue)] font-semibold text-white text-xs hover:bg-[var(--accent-blue)]/90"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saving ? 'Saving Targets...' : 'Save All Targets'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-[var(--text-muted)] text-xs">
          Loading operational targets...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {horizons.map((horizon) => {
            const Icon = horizon.icon;
            const windowValues = targets[horizon.key];
            return (
              <GlassCard
                key={horizon.key}
                className="gold-steel-border gold-steel-border-slim flex flex-col gap-4 p-5"
              >
                <div className="flex items-center justify-between border-[var(--border-default)] border-b pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-lg border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/15 p-2 text-[var(--accent-blue)]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[var(--text-heading)] text-sm">
                        {horizon.title}
                      </h3>
                      <p className="text-[11px] text-[var(--text-secondary)]">{horizon.subtitle}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/15 px-2 py-0.5 font-bold font-mono text-[10px] text-[var(--accent-blue)]">
                    {horizon.badge}
                  </span>
                </div>

                <div className="space-y-3.5">
                  {TARGET_FIELDS.map((field) => (
                    <div key={field.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <label
                          htmlFor={`${horizon.key}-${field.key}`}
                          className="font-semibold text-[var(--text-heading)]"
                        >
                          {field.label}
                        </label>
                        <span className="font-mono text-[10px] text-[var(--text-secondary)] uppercase">
                          {field.unit}
                        </span>
                      </div>
                      <Input
                        id={`${horizon.key}-${field.key}`}
                        type="number"
                        min={1}
                        value={windowValues[field.key]}
                        onChange={(e) => handleFieldChange(horizon.key, field.key, e.target.value)}
                        className="border-[var(--border-default)] bg-[var(--bg-primary)] font-bold font-mono text-[var(--text-heading)] text-xs"
                      />
                      <p className="text-[10px] text-[var(--text-muted)]">{field.helper}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-auto flex items-center justify-between border-[var(--border-subtle)] border-t pt-3 text-[11px]">
                  <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                    <TrendingUp className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                    Strip Ratio Target
                  </span>
                  <span className="font-bold font-mono text-[var(--text-heading)]">
                    {(
                      windowValues.wasteTonnesTarget / Math.max(windowValues.coalTonnesTarget, 1)
                    ).toFixed(2)}{' '}
                    : 1
                  </span>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
