'use client';

/* cspell:ignore Tyre tyre */

import { GlassCard } from '@repo/ui/GlassCard';
import { GoldenPanel } from '@repo/ui/GoldenPanel';
import { cn } from '@repo/ui/lib/utils';
import {
  type ProfessionalDropdownItem,
  ProfessionalDropdownMenu,
} from '@repo/ui/ProfessionalDropdownMenu';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  ClipboardCheck,
  Filter,
  Gauge,
  History,
  Layers,
  PlusCircle,
  Search,
  SlidersHorizontal,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { logTireActivity } from './actions';
import {
  CRITICAL_TREAD_DEPTH_MM,
  classifyTireActivityType,
  TIRE_ACTIVITY_REASON_PRESETS,
  TIRE_CONDITION_STATUSES,
  TIRE_POSITIONS,
  type TireActivityMode,
  type TireActivityType,
  type TireConditionStatus,
  type TireInspectionActivity,
  type TireMachineOption,
  type TireRecord,
  type TireRemovedOutcome,
  tireActivitySchema,
  WARNING_TREAD_DEPTH_MM,
} from './tire-constants';

interface TireActivityManagerClientProps {
  readonly machines: readonly TireMachineOption[];
  readonly tires: readonly TireRecord[];
  readonly recentActivities: readonly TireInspectionActivity[];
  readonly todayStr: string;
}

const INPUT_CLASS =
  'w-full rounded-lg border border-[var(--border-default)] bg-white px-3 py-2 text-sm text-[var(--text-heading)] focus:border-[var(--accent-blue)] focus:outline-none';
const LABEL_CLASS =
  'mb-1 block font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider';
const MODE_BTN_BASE =
  'flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-semibold text-xs transition-colors';
const MODE_BTN_ACTIVE = 'border-[var(--accent-blue)] bg-[var(--accent-blue)] text-white shadow-xs';
const MODE_BTN_INACTIVE =
  'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]';
const FILTER_PILL_BASE = 'rounded-lg px-3 py-1.5 font-medium text-xs transition-colors';
const TH_CLASS =
  'px-4 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider';

const MODE_LABELS: Readonly<Record<TireActivityMode, string>> = {
  replace: 'Replace Tyre',
  remove: 'Remove Tyre',
  install: 'Install Spare / New',
  inspect: 'Log Inspection',
};

const ACTIVITY_BADGE_MAP: Readonly<Record<TireActivityType, { label: string; className: string }>> =
  {
    removal: {
      label: 'Removal',
      className: 'bg-amber-500/10 text-amber-700',
    },
    replacement: {
      label: 'Replacement',
      className: 'bg-blue-500/10 text-blue-700',
    },
    installation: {
      label: 'Installation',
      className: 'bg-emerald-500/10 text-emerald-700',
    },
    inspection: {
      label: 'Inspection',
      className: 'bg-zinc-500/10 text-zinc-700',
    },
  };

const CONDITION_BADGE_MAP: Readonly<Record<string, string>> = {
  good: 'bg-emerald-500/10 text-emerald-700',
  warning: 'bg-amber-500/10 text-amber-700',
  critical: 'bg-red-500/10 text-red-700',
};

function inferConditionFromTread(treadMm: number): TireConditionStatus {
  if (treadMm < CRITICAL_TREAD_DEPTH_MM) return 'critical';
  if (treadMm < WARNING_TREAD_DEPTH_MM) return 'warning';
  return 'good';
}

function formatTireOptionLabel(tire: TireRecord): string {
  const posLabel = tire.position ? ` · ${tire.position}` : '';
  return `${tire.serial_number} — ${tire.brand} (${tire.size})${posLabel}`;
}

function resolveMachineHoursDefault(
  targetMachineId: string,
  machines: readonly TireMachineOption[],
  installedTires: readonly TireRecord[]
): string {
  const machine = machines.find((m) => m.id === targetMachineId);
  if (machine?.latest_smu != null && Number.isFinite(machine.latest_smu)) {
    return String(Math.round(machine.latest_smu));
  }
  const onMachine = installedTires.find((t) => t.machine_id === targetMachineId);
  if (onMachine?.latestInspection?.current_smu != null) {
    return String(Math.round(onMachine.latestInspection.current_smu));
  }
  if (onMachine?.installed_hours != null) {
    return String(Math.round(onMachine.installed_hours));
  }
  if (machine?.starting_smr != null && Number.isFinite(machine.starting_smr)) {
    return String(Math.round(machine.starting_smr));
  }
  return '0';
}

export function TireActivityManagerClient({
  machines,
  tires,
  recentActivities,
  todayStr,
}: TireActivityManagerClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const installedTires = useMemo(() => tires.filter((t) => t.status === 'installed'), [tires]);
  const spareTires = useMemo(() => tires.filter((t) => t.status === 'inventory'), [tires]);

  const [mode, setMode] = useState<TireActivityMode>('replace');
  const [machineId, setMachineId] = useState<string>(() => machines[0]?.id ?? '');
  const [position, setPosition] = useState<string>(TIRE_POSITIONS[0]);
  const [actionDate, setActionDate] = useState<string>(todayStr);
  const [machineHours, setMachineHours] = useState<string>(() =>
    resolveMachineHoursDefault(
      machines[0]?.id ?? '',
      machines,
      tires.filter((t) => t.status === 'installed')
    )
  );

  const [removedTireId, setRemovedTireId] = useState<string>(() => {
    const firstId = machines[0]?.id ?? '';
    return (
      tires.find((t) => t.status === 'installed' && t.machine_id === firstId)?.id ??
      tires.find((t) => t.status === 'installed')?.id ??
      ''
    );
  });
  const [removedOutcome, setRemovedOutcome] = useState<TireRemovedOutcome>('inventory');
  const [removedReason, setRemovedReason] = useState<string>('');

  const [installSource, setInstallSource] = useState<'spare' | 'new'>('new');
  const [existingSpareTireId, setExistingSpareTireId] = useState<string>('');
  const [replacementSerial, setReplacementSerial] = useState<string>('');
  const [replacementBrand, setReplacementBrand] = useState<string>('');
  const [replacementSize, setReplacementSize] = useState<string>('');

  const [treadDepthMm, setTreadDepthMm] = useState<string>('42');
  const [pressurePsi, setPressurePsi] = useState<string>('110');
  const [conditionStatus, setConditionStatus] = useState<TireConditionStatus>('good');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  const [ledgerFilter, setLedgerFilter] = useState<'all' | TireActivityType>('all');
  const [conditionFilter, setConditionFilter] = useState<'all' | TireConditionStatus>('all');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');

  const machineInstalledTires = useMemo(() => {
    if (!machineId) return installedTires;
    const onMachine = installedTires.filter((t) => t.machine_id === machineId);
    const others = installedTires.filter((t) => t.machine_id !== machineId);
    return [...onMachine, ...others];
  }, [installedTires, machineId]);

  const selectedMachineTireIds = useMemo(
    () => new Set(installedTires.filter((t) => t.machine_id === machineId).map((t) => t.id)),
    [installedTires, machineId]
  );

  const selectedSpare = useMemo(
    () => spareTires.find((s) => s.id === existingSpareTireId),
    [spareTires, existingSpareTireId]
  );
  const selectedRemovedTire = useMemo(
    () => installedTires.find((t) => t.id === removedTireId),
    [installedTires, removedTireId]
  );

  const showsRemovalSection = mode === 'remove' || mode === 'replace';
  const showsInstallSection = mode === 'replace' || mode === 'install';

  const isSpareWithRecord =
    showsInstallSection && installSource === 'spare' && Boolean(selectedSpare);
  const isTargetWithRecord = !showsInstallSection && Boolean(selectedRemovedTire);
  const isIdentityReadOnly = isSpareWithRecord || isTargetWithRecord;

  const displayedSerial = isSpareWithRecord
    ? (selectedSpare?.serial_number ?? '')
    : isTargetWithRecord
      ? (selectedRemovedTire?.serial_number ?? '')
      : replacementSerial;

  const displayedBrand = isSpareWithRecord
    ? (selectedSpare?.brand ?? '')
    : isTargetWithRecord
      ? (selectedRemovedTire?.brand ?? '')
      : replacementBrand;

  const displayedSize = isSpareWithRecord ? (selectedSpare?.size ?? '') : replacementSize;

  const handleMachineChange = (nextMachineId: string) => {
    setMachineId(nextMachineId);
    const matchingTire = installedTires.find(
      (t) => t.machine_id === nextMachineId && (!position || t.position === position)
    );
    const firstOnMachine =
      matchingTire ?? installedTires.find((t) => t.machine_id === nextMachineId);
    if (firstOnMachine) {
      setRemovedTireId(firstOnMachine.id);
      if (firstOnMachine.position) setPosition(firstOnMachine.position);
    }
    setMachineHours(resolveMachineHoursDefault(nextMachineId, machines, installedTires));
  };

  const handleSelectRemovedTire = (nextTireId: string) => {
    setRemovedTireId(nextTireId);
    const matched = installedTires.find((t) => t.id === nextTireId);
    if (!matched) return;
    if (matched.machine_id) setMachineId(matched.machine_id);
    if (matched.position) setPosition(matched.position);
    if (matched.latestInspection?.current_smu != null) {
      setMachineHours(String(Math.round(matched.latestInspection.current_smu)));
    } else if (matched.installed_hours != null) {
      setMachineHours(String(Math.round(matched.installed_hours)));
    }
  };

  const handleTreadChange = (rawVal: string) => {
    setTreadDepthMm(rawVal);
    const parsed = Number(rawVal);
    if (!Number.isNaN(parsed) && rawVal.trim() !== '') {
      setConditionStatus(inferConditionFromTread(parsed));
    }
  };

  const handleOpenPanel = (initialMode: TireActivityMode = 'replace') => {
    setMode(initialMode);
    setFormError(null);
    if (!machineId && machines[0]?.id) {
      handleMachineChange(machines[0].id);
    } else {
      if (!removedTireId && machineInstalledTires[0]?.id) {
        setRemovedTireId(machineInstalledTires[0].id);
      }
      if (machineId) {
        setMachineHours(resolveMachineHoursDefault(machineId, machines, installedTires));
      }
    }
    if (!existingSpareTireId && spareTires[0]?.id) {
      setExistingSpareTireId(spareTires[0].id);
    }
    setIsPanelOpen(true);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const isSpareInstall = showsInstallSection && installSource === 'spare';
    const resolvedSerial = displayedSerial.trim();
    const resolvedBrand = displayedBrand.trim();

    const payload = {
      mode,
      machineId,
      position,
      actionDate,
      machineHours: machineHours.trim() === '' ? Number.NaN : Number(machineHours),
      removedTireId:
        mode === 'remove' || mode === 'replace' || mode === 'inspect' ? removedTireId : undefined,
      removedOutcome,
      removedReason: removedReason.trim(),
      tireSerial:
        mode === 'remove' || mode === 'inspect'
          ? resolvedSerial || undefined
          : mode === 'replace'
            ? (selectedRemovedTire?.serial_number ?? '').trim() || resolvedSerial || undefined
            : undefined,
      tireBrand:
        mode === 'remove' || mode === 'inspect'
          ? resolvedBrand || undefined
          : mode === 'replace'
            ? (selectedRemovedTire?.brand ?? '').trim() || resolvedBrand || undefined
            : undefined,
      existingSpareTireId: isSpareInstall ? existingSpareTireId || undefined : undefined,
      replacementSerial: showsInstallSection ? resolvedSerial || undefined : undefined,
      replacementBrand: showsInstallSection ? resolvedBrand || undefined : undefined,
      replacementSize: showsInstallSection ? displayedSize.trim() || undefined : undefined,
      treadDepthMm: treadDepthMm.trim() === '' ? undefined : Number(treadDepthMm),
      pressurePsi: pressurePsi.trim() === '' ? undefined : Number(pressurePsi),
      conditionStatus,
      notes: notes.trim() || undefined,
    };

    const validation = tireActivitySchema.safeParse(payload);
    if (!validation.success) {
      const issueMessage =
        validation.error.issues[0]?.message ?? 'Please fill in all required tyre activity fields.';
      setFormError(issueMessage);
      toast.error(issueMessage);
      return;
    }

    startTransition(async () => {
      try {
        const result = await logTireActivity(payload);
        toast.success(
          `${MODE_LABELS[result.mode]} logged for ${result.machineName} (${position}).`
        );
        setReplacementSerial('');
        setReplacementBrand('');
        setReplacementSize('');
        setRemovedReason('');
        setNotes('');
        setIsPanelOpen(false);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to record tyre activity. Verify all inputs.';
        setFormError(message);
        toast.error(message);
      }
    });
  };

  const filteredActivities = useMemo(() => {
    const query = ledgerSearch.trim().toLowerCase();
    return recentActivities.filter((entry) => {
      const activityType = entry.activityType || classifyTireActivityType(entry.notes);
      if (ledgerFilter !== 'all' && activityType !== ledgerFilter) {
        return false;
      }
      if (conditionFilter !== 'all' && entry.condition_status !== conditionFilter) {
        return false;
      }
      if (!query) return true;
      const hay =
        `${entry.serial_number} ${entry.brand} ${entry.machineName} ${entry.position} ${entry.notes ?? ''} ${entry.inspection_date}`.toLowerCase();
      return hay.includes(query);
    });
  }, [recentActivities, ledgerFilter, conditionFilter, ledgerSearch]);

  const activeLedgerFilterLabel: Record<'all' | TireActivityType, string> = {
    all: 'All Activities',
    removal: 'Removals',
    replacement: 'Replacements',
    installation: 'Installations',
    inspection: 'Inspections',
  };

  const ledgerDropdownItems: readonly ProfessionalDropdownItem[] = [
    {
      id: 'act-all',
      label: 'All Activities',
      description: 'Show full tyre inspection & changeout ledger',
      badge: recentActivities.length,
      icon: <History className="h-3.5 w-3.5" />,
      selected: ledgerFilter === 'all' && conditionFilter === 'all',
      onSelect: () => {
        setLedgerFilter('all');
        setConditionFilter('all');
      },
    },
    {
      id: 'act-removal',
      label: 'Removals',
      icon: <Trash2 className="h-3.5 w-3.5" />,
      selected: ledgerFilter === 'removal',
      onSelect: () => setLedgerFilter('removal'),
    },
    {
      id: 'act-replacement',
      label: 'Replacements',
      icon: <ArrowLeftRight className="h-3.5 w-3.5" />,
      selected: ledgerFilter === 'replacement',
      onSelect: () => setLedgerFilter('replacement'),
    },
    {
      id: 'act-installation',
      label: 'Installations',
      icon: <Layers className="h-3.5 w-3.5" />,
      selected: ledgerFilter === 'installation',
      onSelect: () => setLedgerFilter('installation'),
    },
    {
      id: 'act-inspection',
      label: 'Inspections',
      icon: <ClipboardCheck className="h-3.5 w-3.5" />,
      selected: ledgerFilter === 'inspection',
      onSelect: () => setLedgerFilter('inspection'),
    },
    {
      id: 'cond-submenu',
      label: 'Filter by Condition',
      icon: <SlidersHorizontal className="h-3.5 w-3.5" />,
      dividerBefore: true,
      subItems: [
        {
          id: 'cond-all',
          label: 'Any Condition',
          selected: conditionFilter === 'all',
          onSelect: () => setConditionFilter('all'),
        },
        {
          id: 'cond-good',
          label: 'Good Condition',
          selected: conditionFilter === 'good',
          onSelect: () => setConditionFilter('good'),
        },
        {
          id: 'cond-warning',
          label: 'Warning (<25mm)',
          selected: conditionFilter === 'warning',
          onSelect: () => setConditionFilter('warning'),
        },
        {
          id: 'cond-critical',
          label: 'Critical (<15mm)',
          selected: conditionFilter === 'critical',
          onSelect: () => setConditionFilter('critical'),
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <GlassCard className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-base">
              <Wrench className="h-4 w-4 text-[var(--accent-blue)]" aria-hidden="true" />
              <span>Machine Tyre Activity &amp; Changeout Workflow</span>
            </h3>
            <p className="mt-0.5 text-[var(--text-muted)] text-xs">
              Log removals to spare inventory or scrap, mount replacement tyres per wheel position,
              and track machine SMU hours.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="open-tire-activity-btn"
              onClick={() => handleOpenPanel('replace')}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-blue)] px-4 py-2 font-semibold text-sm text-white shadow-xs transition-opacity hover:opacity-90"
            >
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              <span>Log Tyre Activity (Removal / Replacement)</span>
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Activity Logger Panel / Modal */}
      {isPanelOpen && (
        <GlassCard
          variant="window"
          className="border border-[var(--accent-blue)]/30 p-5 shadow-md"
          data-testid="tire-activity-panel"
        >
          <div className="mb-4 flex items-center justify-between border-[var(--border-default)] border-b pb-3">
            <div>
              <h4 className="font-bold text-[var(--text-heading)] text-base">
                Log Tyre Activity (Removal / Replacement)
              </h4>
              <p className="text-[var(--text-muted)] text-xs">
                Updates fleet tyre assignment and writes an immutable inspection ledger entry per
                machine.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close tyre activity logger"
              onClick={() => setIsPanelOpen(false)}
              className="rounded-lg border border-[var(--border-default)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text-heading)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist">
              {(
                [
                  { id: 'replace', label: 'Replace Tyre', icon: ArrowLeftRight },
                  { id: 'remove', label: 'Remove Tyre', icon: Trash2 },
                  { id: 'install', label: 'Install Spare / New', icon: Layers },
                  { id: 'inspect', label: 'Log Inspection', icon: ClipboardCheck },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const isSelected = mode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => {
                      setMode(item.id);
                      setFormError(null);
                    }}
                    className={cn(MODE_BTN_BASE, isSelected ? MODE_BTN_ACTIVE : MODE_BTN_INACTIVE)}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {formError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-xs"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            {/* Machine, Wheel Position, Date, Hours */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="tire-machine-select" className={LABEL_CLASS}>
                  Machine *
                </label>
                <select
                  id="tire-machine-select"
                  aria-label="Machine"
                  value={machineId}
                  onChange={(e) => handleMachineChange(e.target.value)}
                  className={INPUT_CLASS}
                  required={mode !== 'inspect'}
                >
                  <option value="">Select machine...</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.machine_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="tire-position-select" className={LABEL_CLASS}>
                  Wheel Position *
                </label>
                <select
                  id="tire-position-select"
                  aria-label="Wheel Position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className={INPUT_CLASS}
                  required
                >
                  {TIRE_POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="tire-action-date" className={LABEL_CLASS}>
                  Activity Date *
                </label>
                <input
                  id="tire-action-date"
                  type="date"
                  value={actionDate}
                  onChange={(e) => setActionDate(e.target.value)}
                  className={INPUT_CLASS}
                  required
                />
              </div>

              <div>
                <label htmlFor="tire-machine-hours" className={LABEL_CLASS}>
                  Machine Hours (SMU) *
                </label>
                <input
                  id="tire-machine-hours"
                  type="number"
                  min={0}
                  step={1}
                  value={machineHours}
                  onChange={(e) => setMachineHours(e.target.value)}
                  className={INPUT_CLASS}
                  required
                />
              </div>
            </div>

            {/* Removal / Inspection Target Tire */}
            {(showsRemovalSection || mode === 'inspect') && (
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 p-4">
                <h5 className="mb-3 font-semibold text-[var(--text-heading)] text-xs uppercase tracking-wider">
                  {mode === 'inspect' ? 'Select Tyre to Inspect' : 'Tyre Being Removed'}
                </h5>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="removed-tire-select" className={LABEL_CLASS}>
                      {mode === 'inspect' ? 'Target Tyre' : 'Installed Tyre'}
                    </label>
                    <select
                      id="removed-tire-select"
                      aria-label={mode === 'inspect' ? 'Target Tyre' : 'Installed Tyre'}
                      value={removedTireId}
                      onChange={(e) => handleSelectRemovedTire(e.target.value)}
                      className={INPUT_CLASS}
                      required
                    >
                      <option value="">Select installed tyre...</option>
                      {machineInstalledTires.map((tire) => (
                        <option key={tire.id} value={tire.id}>
                          {selectedMachineTireIds.has(tire.id) ? '[On Machine] ' : ''}
                          {formatTireOptionLabel(tire)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {showsRemovalSection && (
                    <div>
                      <label htmlFor="removed-outcome-select" className={LABEL_CLASS}>
                        Removed Disposition
                      </label>
                      <select
                        id="removed-outcome-select"
                        aria-label="Removed Disposition"
                        value={removedOutcome}
                        onChange={(e) => setRemovedOutcome(e.target.value as TireRemovedOutcome)}
                        className={INPUT_CLASS}
                      >
                        <option value="inventory">Move to Inventory (Spare)</option>
                        <option value="scrapped">Mark as Scrapped</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Replacement / Installation Source */}
            {showsInstallSection && (
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h5 className="font-semibold text-[var(--text-heading)] text-xs uppercase tracking-wider">
                    Replacement / Mounted Tyre Source
                  </h5>
                  <div className="inline-flex rounded-lg border border-[var(--border-default)] bg-white p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setInstallSource('new')}
                      className={cn(
                        'rounded-md px-2.5 py-1 font-medium',
                        installSource === 'new'
                          ? 'bg-[var(--accent-blue)] text-white'
                          : 'text-[var(--text-muted)]'
                      )}
                    >
                      Register New Tyre
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstallSource('spare')}
                      className={cn(
                        'rounded-md px-2.5 py-1 font-medium',
                        installSource === 'spare'
                          ? 'bg-[var(--accent-blue)] text-white'
                          : 'text-[var(--text-muted)]'
                      )}
                    >
                      Use Inventory Spare ({spareTires.length})
                    </button>
                  </div>
                </div>

                {installSource === 'spare' && (
                  <div>
                    <label htmlFor="existing-spare-select" className={LABEL_CLASS}>
                      Inventory Spare Tyre
                    </label>
                    <select
                      id="existing-spare-select"
                      aria-label="Inventory Spare Tyre"
                      value={existingSpareTireId}
                      onChange={(e) => setExistingSpareTireId(e.target.value)}
                      className={INPUT_CLASS}
                      required
                    >
                      <option value="">Select spare from inventory...</option>
                      {spareTires.map((spare) => (
                        <option key={spare.id} value={spare.id}>
                          {formatTireOptionLabel(spare)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Mandatory Tyre Identity & Activity Reason */}
            <div className="rounded-xl border border-[var(--accent-blue)]/25 bg-blue-50/40 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h5 className="font-semibold text-[var(--text-heading)] text-xs uppercase tracking-wider">
                  Required Tyre Identity &amp; Activity Reason
                </h5>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Fields marked * are required for audit ledger logging
                </span>
              </div>

              <div
                className={cn(
                  'grid grid-cols-1 gap-4',
                  showsInstallSection ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
                )}
              >
                <div>
                  <label htmlFor="tire-serial-input" className={LABEL_CLASS}>
                    Serial Number *
                  </label>
                  <input
                    id="tire-serial-input"
                    type="text"
                    placeholder="e.g. TIRE-2026-041"
                    value={displayedSerial}
                    readOnly={isIdentityReadOnly}
                    onChange={(e) => setReplacementSerial(e.target.value)}
                    className={cn(
                      INPUT_CLASS,
                      isIdentityReadOnly && 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                    )}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="tire-brand-input" className={LABEL_CLASS}>
                    Brand *
                  </label>
                  <input
                    id="tire-brand-input"
                    type="text"
                    placeholder="e.g. Michelin"
                    value={displayedBrand}
                    readOnly={isIdentityReadOnly}
                    onChange={(e) => setReplacementBrand(e.target.value)}
                    className={cn(
                      INPUT_CLASS,
                      isIdentityReadOnly && 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                    )}
                    required
                  />
                </div>

                {showsInstallSection && (
                  <div>
                    <label htmlFor="tire-size-input" className={LABEL_CLASS}>
                      Tyre Size *
                    </label>
                    <input
                      id="tire-size-input"
                      type="text"
                      placeholder="e.g. 59/80R63"
                      value={displayedSize}
                      readOnly={isSpareWithRecord}
                      onChange={(e) => setReplacementSize(e.target.value)}
                      className={cn(
                        INPUT_CLASS,
                        isSpareWithRecord && 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                      )}
                      required
                    />
                  </div>
                )}
              </div>

              <div className="mt-4">
                <label htmlFor="tire-reason-input" className={LABEL_CLASS}>
                  Reason *
                </label>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {TIRE_ACTIVITY_REASON_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRemovedReason(preset)}
                      className={cn(
                        'rounded-md border px-2.5 py-1 font-medium text-[11px] transition-colors',
                        removedReason === preset
                          ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)] text-white'
                          : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:border-[var(--accent-blue)]/40 hover:text-[var(--text-heading)]'
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  id="tire-reason-input"
                  type="text"
                  placeholder="Select a preset or describe reason (min 3 characters)..."
                  value={removedReason}
                  onChange={(e) => setRemovedReason(e.target.value)}
                  className={INPUT_CLASS}
                  aria-required="true"
                  required
                />
              </div>
            </div>

            {/* Telemetry & Notes */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="tire-tread-input" className={LABEL_CLASS}>
                  Tread Depth (mm)
                </label>
                <input
                  id="tire-tread-input"
                  type="number"
                  min={0}
                  max={150}
                  step="0.1"
                  value={treadDepthMm}
                  onChange={(e) => handleTreadChange(e.target.value)}
                  className={INPUT_CLASS}
                  required={mode === 'inspect'}
                />
              </div>

              <div>
                <label htmlFor="tire-psi-input" className={LABEL_CLASS}>
                  Pressure (PSI)
                </label>
                <input
                  id="tire-psi-input"
                  type="number"
                  min={0}
                  max={250}
                  step="0.1"
                  value={pressurePsi}
                  onChange={(e) => setPressurePsi(e.target.value)}
                  className={INPUT_CLASS}
                  required={mode === 'inspect'}
                />
              </div>

              <div>
                <label htmlFor="tire-condition-select" className={LABEL_CLASS}>
                  Condition Status
                </label>
                <select
                  id="tire-condition-select"
                  aria-label="Condition Status"
                  value={conditionStatus}
                  onChange={(e) => setConditionStatus(e.target.value as TireConditionStatus)}
                  className={INPUT_CLASS}
                >
                  {TIRE_CONDITION_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="tire-notes-input" className={LABEL_CLASS}>
                  Workshop Notes
                </label>
                <input
                  id="tire-notes-input"
                  type="text"
                  placeholder="Torque verified, rim inspected..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-[var(--border-default)] border-t pt-4">
              <button
                type="button"
                onClick={() => setIsPanelOpen(false)}
                className="rounded-lg border border-[var(--border-default)] bg-white px-4 py-2 font-medium text-[var(--text-secondary)] text-sm hover:bg-[var(--bg-secondary)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                data-testid="submit-tire-activity-btn"
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-blue)] px-5 py-2 font-semibold text-sm text-white shadow-xs transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>{isPending ? 'Saving Activity...' : `Submit ${MODE_LABELS[mode]}`}</span>
              </button>
            </div>
          </form>
        </GlassCard>
      )}

      {/* #3 & #5 Recent Tyre Activity & Removal/Replacement Ledger GoldenPanel */}
      <GoldenPanel
        title="Recent Tyre Activity & Removal/Replacement Ledger"
        headingLevel="h3"
        subtitle="Immutable workshop ledger of tyre removals, replacements, spare installations, and inspections"
        icon={<History className="h-5 w-5 text-accent-gold" aria-hidden="true" />}
        statusBadge={
          <span className="rounded-full border border-[var(--accent-gold-border)] bg-[var(--accent-gold-subtle)] px-2.5 py-0.5 font-mono font-semibold text-[11px] text-[var(--text-heading)]">
            {filteredActivities.length} Events
          </span>
        }
        collapsible
        noBodyPadding
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ProfessionalDropdownMenu
              testId="tire-activity-filter-dropdown"
              ariaLabel="Filter tyre activity ledger"
              triggerLabel={activeLedgerFilterLabel[ledgerFilter]}
              triggerIcon={<Filter className="h-3.5 w-3.5" />}
              triggerBadge={conditionFilter !== 'all' ? conditionFilter.toUpperCase() : undefined}
              items={ledgerDropdownItems}
            />

            <div className="hidden rounded-lg border border-[var(--accent-gold-border)] bg-white/85 p-0.5 xl:inline-flex">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'removal', label: 'Removals' },
                  { id: 'replacement', label: 'Replacements' },
                  { id: 'installation', label: 'Installations' },
                  { id: 'inspection', label: 'Inspections' },
                ] as const
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setLedgerFilter(pill.id)}
                  className={cn(
                    FILTER_PILL_BASE,
                    ledgerFilter === pill.id
                      ? 'bg-[var(--accent-charcoal)] text-white shadow-2xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                  )}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Search tyre ledger"
                placeholder="Search serial, machine..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                className="gold-steel-border gold-steel-border-slim rounded-lg py-1.5 pr-3 pl-8 text-[var(--text-heading)] text-xs focus:outline-none"
              />
            </div>
          </div>
        }
      >
        {filteredActivities.length === 0 ? (
          <div className="py-8 text-center text-[var(--text-muted)] text-xs">
            No tyre removal, replacement, or inspection events match the active filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full text-left text-sm"
              aria-label="Recent tyre activity and removal replacement ledger"
            >
              <thead>
                <tr className="border-[var(--border-default)] border-b bg-black/[0.02]">
                  <th scope="col" className={TH_CLASS}>
                    Date
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Activity
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Tyre Serial
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Machine / Position
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Tread / PSI
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Condition
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    SMU Hours
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {filteredActivities.map((entry) => {
                  const badge =
                    ACTIVITY_BADGE_MAP[entry.activityType || classifyTireActivityType(entry.notes)];
                  const condBadge =
                    CONDITION_BADGE_MAP[entry.condition_status] ?? 'bg-zinc-500/10 text-zinc-700';

                  return (
                    <tr key={entry.id} className="transition-colors hover:bg-white/60">
                      <td className="px-4 py-3 font-mono text-[var(--text-secondary)] text-xs">
                        {entry.inspection_date}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 font-semibold text-[11px]',
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="font-mono font-semibold text-[var(--text-heading)]">
                          {entry.serial_number}
                        </span>
                        <span className="block text-[11px] text-[var(--text-muted)]">
                          {entry.brand} {entry.size}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="font-medium text-[var(--text-heading)]">
                          {entry.machineName}
                        </span>
                        <span className="block text-[11px] text-[var(--text-muted)]">
                          {entry.position}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="inline-flex items-center gap-1 font-medium text-[var(--text-heading)]">
                          <Gauge className="h-3 w-3 text-[var(--text-muted)]" aria-hidden="true" />
                          {Number(entry.tread_depth_mm).toFixed(1)} mm ·{' '}
                          {Number(entry.pressure_psi).toFixed(0)} PSI
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 font-semibold text-[11px] uppercase',
                            condBadge
                          )}
                        >
                          {entry.condition_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[var(--text-secondary)] text-xs">
                        {entry.current_smu != null
                          ? `${Number(entry.current_smu).toLocaleString('en-US')} hrs`
                          : '—'}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-[var(--text-muted)] text-xs">
                        {entry.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GoldenPanel>
    </div>
  );
}
