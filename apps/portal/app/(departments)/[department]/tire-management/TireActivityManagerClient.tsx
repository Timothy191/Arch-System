'use client';

/* cspell:ignore Tyre tyre */

import { GlassCard } from '@repo/ui/GlassCard';
import { GoldenPanel } from '@repo/ui/GoldenPanel';
import { cn } from '@repo/ui/lib/utils';
import { AlertTriangle, CheckCircle2, ChevronDown, Search } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  resolveDefaultMachineImage,
  resolveDefaultManufacturer,
  resolveMachineIdentity,
} from '@/features/admin/tabs/fleet-utils';
import { ArchLogoShowcase } from './ArchLogoShowcase';
import { logTireActivity } from './actions';
import { TireReasonDropdown } from './TireReasonDropdown';
import { TyreArtwork } from './TyreArtwork';
import { type TyreSwapFieldValues, TyreSwapTable } from './TyreSwapTable';
import {
  CRITICAL_TREAD_DEPTH_MM,
  classifyTireActivityType,
  isWheeledMachine,
  parseTireActivityNote,
  resolveVehicleLayout,
  TIRE_POSITIONS,
  type TireActivityMode,
  type TireActivityType,
  type TireInspectionActivity,
  type TireMachineOption,
  type TireRecord,
  type TireRemovedOutcome,
  tireActivitySchema,
  WARNING_TREAD_DEPTH_MM,
} from './tire-constants';
import { WheelPositionDiagram } from './WheelPositionDiagram';

interface TireActivityManagerClientProps {
  readonly machines: readonly TireMachineOption[];
  readonly tires: readonly TireRecord[];
  readonly recentActivities: readonly TireInspectionActivity[];
  readonly todayStr: string;
}

const INPUT_CLASS =
  'w-full rounded-lg border border-[var(--border-default)] bg-white px-3 py-2 text-sm text-[var(--text-heading)] focus:border-[var(--accent-gold)] focus:outline-none';
const LABEL_CLASS =
  'mb-1 block font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider';
const FILTER_PILL_BASE = 'rounded-lg px-3 py-1.5 font-medium text-xs transition-colors';
const TH_CLASS =
  'px-3 py-2.5 font-semibold text-[var(--text-muted)] text-[11px] uppercase tracking-wider';
const TD_CLASS = 'px-3 py-2.5 text-[var(--text-secondary)] text-xs';

const GOLD_SELECTED_CLASS =
  'gold-steel-border gold-steel-border-slim border-[var(--accent-gold)] bg-[var(--accent-gold)]/10 shadow-card-hover';
const GOLD_PRIMARY_BUTTON_CLASS =
  'gold-steel-border gold-steel-border-slim chip-elevated-3d inline-flex items-center justify-center gap-2 rounded-lg border-2 border-[var(--accent-gold-hover)] bg-[var(--accent-gold)] px-5 py-2.5 font-semibold text-[var(--text-heading)] text-sm transition-opacity disabled:opacity-50';

const MODE_OPTIONS = [
  {
    id: 'replace',
    label: 'Replace Tyre',
    hint: 'Swap the tyre mounted at the selected wheel position',
  },
  {
    id: 'remove',
    label: 'Remove Tyre',
    hint: 'Take a tyre off and send it to inventory or scrap',
  },
  {
    id: 'install',
    label: 'Install Spare / New',
    hint: 'Mount a new or repaired tyre to the position',
  },
] as const satisfies readonly {
  readonly id: TireActivityMode;
  readonly label: string;
  readonly hint: string;
}[];

const MODE_LABELS: Readonly<Record<TireActivityMode, string>> = {
  replace: 'Replace Tyre',
  remove: 'Remove Tyre',
  install: 'Install Spare / New',
  inspect: 'Log Inspection',
};

function createEmptySwapSide(): TyreSwapFieldValues {
  return {
    serial: '',
    size: '',
    make: '',
    tra: '',
    treadDepth: '',
    remainInSite: false,
    scrap: false,
    repair: false,
    isNew: false,
    repaired: false,
  };
}

function inferConditionFromTread(treadMm: number): 'good' | 'warning' | 'critical' {
  if (treadMm < CRITICAL_TREAD_DEPTH_MM) return 'critical';
  if (treadMm < WARNING_TREAD_DEPTH_MM) return 'warning';
  return 'good';
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

function toOptionalNumber(rawValue: string): number | undefined {
  const trimmed = rawValue.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function ModeSelect({
  value,
  onChange,
}: {
  readonly value: TireActivityMode;
  readonly onChange: (mode: TireActivityMode) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    Math.max(
      MODE_OPTIONS.findIndex((option) => option.id === value),
      0
    )
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = MODE_OPTIONS.find((option) => option.id === value) ?? MODE_OPTIONS[0];

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) menuRef.current?.focus();
  }, [isOpen]);

  const commit = (mode: TireActivityMode, refocusTrigger: boolean) => {
    onChange(mode);
    setIsOpen(false);
    if (refocusTrigger) triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setActiveIndex(
        Math.max(
          MODE_OPTIONS.findIndex((option) => option.id === value),
          0
        )
      );
      setIsOpen(true);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(MODE_OPTIONS.length - 1);
      setIsOpen(true);
    }
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      commit(value, true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % MODE_OPTIONS.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + MODE_OPTIONS.length) % MODE_OPTIONS.length);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(MODE_OPTIONS.length - 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = MODE_OPTIONS[activeIndex] ?? MODE_OPTIONS[0];
      commit(option.id, true);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Tyre activity type"
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          GOLD_SELECTED_CLASS,
          'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left'
        )}
      >
        <span className="min-w-0">
          <span className="block font-semibold text-[var(--text-heading)] text-sm">
            {selectedOption.label}
          </span>
          <span className="block truncate text-[11px] text-[var(--text-muted)]">
            {selectedOption.hint}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="listbox"
          tabIndex={-1}
          aria-label="Tyre activity type options"
          onKeyDown={handleMenuKeyDown}
          className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-[var(--border-default)] bg-white shadow-lg focus:outline-none"
        >
          {MODE_OPTIONS.map((option, index) => {
            const isSelected = option.id === value;
            const isActive = index === activeIndex;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commit(option.id, true)}
                className={cn(
                  'flex w-full flex-col items-start gap-0.5 border-[var(--border-default)] border-b px-3 py-2 text-left last:border-b-0',
                  isActive && 'bg-[var(--accent-gold)]/10',
                  isSelected
                    ? 'font-semibold text-[var(--text-heading)]'
                    : 'text-[var(--text-secondary)]'
                )}
              >
                <span className="text-sm">{option.label}</span>
                <span className="text-[11px] text-[var(--text-muted)]">{option.hint}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface TyreRecordTableProps {
  readonly title: string;
  readonly subtitle: string;
  readonly accentClass: string;
  readonly traKey: 'TRAOff' | 'TRAOn';
  readonly rows: readonly TireInspectionActivity[];
  readonly machines: readonly TireMachineOption[];
}

function TyreRecordTable({
  title,
  subtitle,
  accentClass,
  traKey,
  rows,
  machines,
}: TyreRecordTableProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-full', accentClass)} />
        <h4 className="font-semibold text-[var(--text-heading)] text-sm">{title}</h4>
        <span className="text-[11px] text-[var(--text-muted)]">{subtitle}</span>
        <span className="ml-auto font-mono text-[11px] text-[var(--text-muted)]">
          {rows.length} record{rows.length === 1 ? '' : 's'}
        </span>
      </div>

      <GlassCard className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-[var(--text-muted)] text-xs">
            No {title.toLowerCase()} recorded for the active filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left" aria-label={`${title} table`}>
              <thead>
                <tr className="border-[var(--border-default)] border-b bg-black/[0.02]">
                  {[
                    'Customer',
                    'Site',
                    'Machine ID',
                    'Machine Make',
                    'Machine Model',
                    'Job Card No.',
                    'Machine Hours',
                    'Date',
                    'Make of Tyre',
                    'Size of Tyre',
                    'Serial Number',
                    'TRA',
                    'Tread Depth',
                  ].map((heading) => (
                    <th key={heading} scope="col" className={TH_CLASS}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {rows.map((entry) => {
                  const parsed = parseTireActivityNote(entry.notes);
                  const machine = machines.find((item) => item.name === entry.machineName);
                  const identity = machine
                    ? resolveMachineIdentity({
                        name: machine.name,
                        serialNumber: machine.serial_number,
                      })
                    : null;
                  const machineMake = machine
                    ? resolveDefaultManufacturer({
                        machineId: identity?.machineId ?? machine.name,
                        machineName: identity?.machineName ?? machine.name,
                        machineType: machine.machine_type,
                        manufacturer: machine.manufacturer,
                      })
                    : '—';
                  return (
                    <tr key={entry.id} className="transition-colors hover:bg-black/[0.01]">
                      <td className={TD_CLASS}>Plantcor</td>
                      <td className={TD_CLASS}>{machine?.site_name ?? '—'}</td>
                      <td
                        className={cn(
                          TD_CLASS,
                          'font-mono font-semibold text-[var(--text-heading)]'
                        )}
                      >
                        {identity?.machineId ?? entry.machineName}
                      </td>
                      <td className={TD_CLASS}>{machineMake}</td>
                      <td className={TD_CLASS}>{identity?.machineName ?? '—'}</td>
                      <td className={cn(TD_CLASS, 'font-mono')}>{parsed.get('Job') ?? '—'}</td>
                      <td className={cn(TD_CLASS, 'font-mono')}>
                        {entry.current_smu != null
                          ? Number(entry.current_smu).toLocaleString('en-US')
                          : '—'}
                      </td>
                      <td className={cn(TD_CLASS, 'font-mono')}>{entry.inspection_date}</td>
                      <td className={TD_CLASS}>{entry.brand || '—'}</td>
                      <td className={cn(TD_CLASS, 'font-mono')}>{entry.size || '—'}</td>
                      <td
                        className={cn(
                          TD_CLASS,
                          'font-mono font-semibold text-[var(--text-heading)]'
                        )}
                      >
                        {entry.serial_number}
                      </td>
                      <td className={cn(TD_CLASS, 'font-mono')}>{parsed.get(traKey) ?? '—'}</td>
                      <td className={cn(TD_CLASS, 'font-mono')}>
                        {Number(entry.tread_depth_mm).toFixed(1)} mm
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

export function TireActivityManagerClient({
  machines,
  tires,
  recentActivities,
  todayStr,
}: TireActivityManagerClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const wheeledMachines = useMemo(() => machines.filter(isWheeledMachine), [machines]);
  const installedTires = useMemo(() => tires.filter((t) => t.status === 'installed'), [tires]);

  const [mode, setMode] = useState<TireActivityMode>('replace');
  const [machineId, setMachineId] = useState<string>(() => wheeledMachines[0]?.id ?? '');
  const [position, setPosition] = useState<string>(TIRE_POSITIONS[0]);
  const [actionDate, setActionDate] = useState<string>(todayStr);
  const [machineHours, setMachineHours] = useState<string>(() =>
    resolveMachineHoursDefault(wheeledMachines[0]?.id ?? '', machines, installedTires)
  );
  const [jobCardNumber, setJobCardNumber] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  const [offFields, setOffFields] = useState<TyreSwapFieldValues>(createEmptySwapSide);
  const [onFields, setOnFields] = useState<TyreSwapFieldValues>(createEmptySwapSide);
  const [formError, setFormError] = useState<string | null>(null);

  const [ledgerFilter, setLedgerFilter] = useState<'all' | TireActivityType>('all');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');

  const selectedMachine = useMemo(
    () => machines.find((machine) => machine.id === machineId) ?? null,
    [machines, machineId]
  );
  const machineIdentity = useMemo(
    () =>
      selectedMachine
        ? resolveMachineIdentity({
            name: selectedMachine.name,
            serialNumber: selectedMachine.serial_number,
          })
        : null,
    [selectedMachine]
  );
  const machineMake = useMemo(
    () =>
      selectedMachine
        ? resolveDefaultManufacturer({
            machineId: machineIdentity?.machineId ?? selectedMachine.name,
            machineName: machineIdentity?.machineName ?? selectedMachine.name,
            machineType: selectedMachine.machine_type,
            manufacturer: selectedMachine.manufacturer,
          })
        : '',
    [selectedMachine, machineIdentity]
  );
  const machineImage = useMemo(
    () =>
      selectedMachine
        ? resolveDefaultMachineImage({
            machineType: selectedMachine.machine_type,
            manufacturer: machineMake,
            machineId: machineIdentity?.machineId ?? selectedMachine.name,
            imageUrl: selectedMachine.image_url,
          })
        : '/images/fleet/volvo-adt.webp',
    [selectedMachine, machineMake, machineIdentity]
  );

  const installedAtPosition = useMemo(
    () =>
      installedTires.find((tire) => tire.machine_id === machineId && tire.position === position) ??
      null,
    [installedTires, machineId, position]
  );

  const showsOff = mode === 'remove' || mode === 'replace';
  const showsOn = mode === 'replace' || mode === 'install';
  const vehicleLayout = resolveVehicleLayout(selectedMachine);

  useEffect(() => {
    if (!installedAtPosition) {
      setOffFields((current) => ({
        ...current,
        serial: '',
        size: '',
        make: '',
      }));
      return;
    }
    setOffFields((current) => ({
      ...current,
      serial: installedAtPosition.serial_number,
      size: installedAtPosition.size,
      make: installedAtPosition.brand,
      treadDepth:
        current.treadDepth.trim() === '' && installedAtPosition.latestInspection
          ? String(installedAtPosition.latestInspection.tread_depth_mm)
          : current.treadDepth,
    }));
  }, [installedAtPosition]);

  const handleMachineChange = (nextMachineId: string) => {
    setMachineId(nextMachineId);
    setMachineHours(resolveMachineHoursDefault(nextMachineId, machines, installedTires));
    const firstOnMachine = installedTires.find(
      (tire) => tire.machine_id === nextMachineId && tire.position === position
    );
    const fallback = installedTires.find((tire) => tire.machine_id === nextMachineId);
    const target = firstOnMachine ?? fallback;
    if (target?.position) setPosition(target.position);
  };

  const handlePositionChange = (nextPosition: string) => {
    setPosition(nextPosition);
    const target = installedTires.find(
      (tire) => tire.machine_id === machineId && tire.position === nextPosition
    );
    if (!target) return;
    if (target.latestInspection?.current_smu != null) {
      setMachineHours(String(Math.round(target.latestInspection.current_smu)));
    } else if (target.installed_hours != null) {
      setMachineHours(String(Math.round(target.installed_hours)));
    }
  };

  const handleSwapChange = (
    side: 'off' | 'on',
    field: keyof TyreSwapFieldValues,
    value: string | boolean
  ) => {
    const applyValue = (current: TyreSwapFieldValues): TyreSwapFieldValues => {
      const next: TyreSwapFieldValues = { ...current };
      if (
        field === 'remainInSite' ||
        field === 'scrap' ||
        field === 'repair' ||
        field === 'isNew' ||
        field === 'repaired'
      ) {
        next[field] = Boolean(value);
      } else {
        next[field] = String(value);
      }
      if (next.scrap && next.remainInSite) {
        if (field === 'scrap') next.remainInSite = false;
        else next.scrap = false;
      }
      if (next.isNew && next.repaired) {
        if (field === 'repaired') next.isNew = false;
        else next.repaired = false;
      }
      return next;
    };

    if (side === 'off') {
      setOffFields(applyValue);
    } else {
      setOnFields(applyValue);
    }
    setFormError(null);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!machineId) {
      const message = 'Select a machine before logging tyre activity.';
      setFormError(message);
      toast.error(message);
      return;
    }
    if (showsOff && !installedAtPosition) {
      const message = `No tyre is registered at ${position} on ${selectedMachine?.name ?? 'this machine'}. Select a mounted position first.`;
      setFormError(message);
      toast.error(message);
      return;
    }

    const removedOutcome: TireRemovedOutcome = offFields.scrap ? 'scrapped' : 'inventory';
    const treadOff = toOptionalNumber(offFields.treadDepth);
    const traOff = toOptionalNumber(offFields.tra);
    const traOn = toOptionalNumber(onFields.tra);
    const treadOn = toOptionalNumber(onFields.treadDepth);

    const payload = {
      mode,
      machineId,
      position,
      actionDate,
      machineHours: machineHours.trim() === '' ? Number.NaN : Number(machineHours),
      removedTireId: showsOff ? (installedAtPosition?.id ?? undefined) : undefined,
      removedOutcome,
      removedReason: reason.trim(),
      tireSerial: showsOff ? (installedAtPosition?.serial_number ?? undefined) : undefined,
      tireBrand: showsOff ? (installedAtPosition?.brand ?? undefined) : undefined,
      replacementSerial: showsOn ? onFields.serial.trim() || undefined : undefined,
      replacementBrand: showsOn ? onFields.make.trim() || undefined : undefined,
      replacementSize: showsOn ? onFields.size.trim() || undefined : undefined,
      treadDepthMm: showsOff ? treadOff : undefined,
      conditionStatus:
        treadOff !== undefined && Number.isFinite(treadOff)
          ? inferConditionFromTread(treadOff)
          : ('good' as const),
      tyreSwap: {
        jobCardNumber: jobCardNumber.trim() || undefined,
        off: showsOff
          ? {
              serial: offFields.serial.trim() || undefined,
              size: offFields.size.trim() || undefined,
              make: offFields.make.trim() || undefined,
              tra: Number.isFinite(traOff) ? traOff : undefined,
              treadDepth: Number.isFinite(treadOff) ? treadOff : undefined,
              remainInSite: offFields.remainInSite,
              scrap: offFields.scrap,
              repair: offFields.repair,
            }
          : undefined,
        on: showsOn
          ? {
              serial: onFields.serial.trim() || undefined,
              size: onFields.size.trim() || undefined,
              make: onFields.make.trim() || undefined,
              tra: Number.isFinite(traOn) ? traOn : undefined,
              treadDepth: Number.isFinite(treadOn) ? treadOn : undefined,
              isNew: onFields.isNew,
              repaired: onFields.repaired,
            }
          : undefined,
      },
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
        setOnFields(createEmptySwapSide());
        setReason('');
        setJobCardNumber('');
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
      if (!query) return true;
      const parsed = parseTireActivityNote(entry.notes);
      const hay =
        `${entry.serial_number} ${entry.brand} ${entry.machineName} ${entry.position} ${entry.notes ?? ''} ${entry.inspection_date} ${parsed.get('Job') ?? ''}`.toLowerCase();
      return hay.includes(query);
    });
  }, [recentActivities, ledgerFilter, ledgerSearch]);

  const sortedActivities = useMemo(
    () =>
      [...filteredActivities].sort(
        (left, right) =>
          left.inspection_date.localeCompare(right.inspection_date) ||
          left.id.localeCompare(right.id)
      ),
    [filteredActivities]
  );

  const tyreOffRecords = useMemo(
    () => sortedActivities.filter((entry) => entry.activityType === 'removal'),
    [sortedActivities]
  );
  const tyreOnRecords = useMemo(
    () =>
      sortedActivities.filter(
        (entry) => entry.activityType === 'installation' || entry.activityType === 'replacement'
      ),
    [sortedActivities]
  );

  return (
    <div className="space-y-6">
      <GoldenPanel
        showLogo
        variant="elevated"
        headingLevel="h3"
        title="Machine Tyre Activity & Changeout Workflow"
        subtitle="Log removals to spare inventory or scrap, mount replacement tyres per wheel position, and track machine SMU hours."
        collapsible
        data-testid="tire-activity-panel"
      >
        <ArchLogoShowcase />

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div>
              <span className={LABEL_CLASS}>Activity Type *</span>
              <ModeSelect
                value={mode}
                onChange={(nextMode) => {
                  setMode(nextMode);
                  setFormError(null);
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tire-action-date" className={LABEL_CLASS}>
                  Activity Date *
                </label>
                <input
                  id="tire-action-date"
                  type="date"
                  value={actionDate}
                  onChange={(event) => setActionDate(event.target.value)}
                  className={INPUT_CLASS}
                  required
                />
              </div>
              <div>
                <label htmlFor="tire-job-card" className={LABEL_CLASS}>
                  Job Card No.
                </label>
                <input
                  id="tire-job-card"
                  type="text"
                  placeholder="JC-2026-118"
                  value={jobCardNumber}
                  onChange={(event) => setJobCardNumber(event.target.value)}
                  className={cn(INPUT_CLASS, 'font-mono')}
                />
              </div>
            </div>
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

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <div className="space-y-4">
              <div>
                <label htmlFor="tire-machine-select" className={LABEL_CLASS}>
                  Machine * <span className="normal-case tracking-normal">(wheeled only)</span>
                </label>
                <select
                  id="tire-machine-select"
                  aria-label="Machine"
                  value={machineId}
                  onChange={(event) => handleMachineChange(event.target.value)}
                  className={INPUT_CLASS}
                  required
                >
                  <option value="">Select machine...</option>
                  {wheeledMachines.map((machine) => (
                    <option key={machine.id} value={machine.id}>
                      {machine.name} ({machine.machine_type})
                    </option>
                  ))}
                </select>
                {wheeledMachines.length === 0 && (
                  <p className="mt-1 text-[11px] text-amber-700">
                    No wheeled machines are registered. Tracked assets (dozers, excavators, drills)
                    are excluded from tyre tracking.
                  </p>
                )}
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
                  onChange={(event) => setMachineHours(event.target.value)}
                  className={INPUT_CLASS}
                  required
                />
              </div>
            </div>

            <div
              className={cn(
                'rounded-xl border p-3',
                selectedMachine
                  ? cn(GOLD_SELECTED_CLASS, 'border')
                  : 'border-[var(--border-default)] bg-[var(--bg-secondary)]/60'
              )}
              data-testid="machine-preview"
            >
              {selectedMachine && machineIdentity ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[190px_minmax(0,1fr)]">
                  <div className="relative h-28 overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]">
                    <Image
                      src={machineImage}
                      alt={`${machineIdentity.machineId} ${machineIdentity.machineName}`}
                      width={380}
                      height={224}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div>
                      <dt className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                        Machine ID
                      </dt>
                      <dd className="font-mono font-semibold text-[var(--text-heading)]">
                        {machineIdentity.machineId}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                        Site
                      </dt>
                      <dd className="font-medium text-[var(--text-heading)]">
                        {selectedMachine.site_name ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                        Make
                      </dt>
                      <dd className="font-medium text-[var(--text-heading)]">{machineMake}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                        Model
                      </dt>
                      <dd className="font-medium text-[var(--text-heading)]">
                        {machineIdentity.machineName}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                        Type
                      </dt>
                      <dd className="font-medium text-[var(--text-heading)]">
                        {selectedMachine.machine_type}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                        Serial
                      </dt>
                      <dd className="font-mono text-[var(--text-secondary)]">
                        {selectedMachine.serial_number ?? '—'}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                        Latest SMU
                      </dt>
                      <dd className="font-mono font-semibold text-[var(--text-heading)]">
                        {selectedMachine.latest_smu != null
                          ? `${selectedMachine.latest_smu.toLocaleString('en-US')} hrs`
                          : '—'}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="py-6 text-center text-[var(--text-muted)] text-xs">
                  Select a wheeled machine to preview its image and fleet details.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={LABEL_CLASS}>Wheel Position *</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--text-muted)]">Selected:</span>
                <span
                  className={cn(
                    GOLD_SELECTED_CLASS,
                    'rounded-md border px-2 py-1 font-mono text-[11px]'
                  )}
                >
                  {position}
                </span>
              </div>
            </div>
            <WheelPositionDiagram
              layout={vehicleLayout}
              machineType={selectedMachine?.machine_type ?? null}
              value={position}
              onChange={handlePositionChange}
            />
            <div className="max-w-xs">
              <label htmlFor="tire-position-select" className={LABEL_CLASS}>
                Wheel Position List
              </label>
              <select
                id="tire-position-select"
                aria-label="Wheel Position"
                value={position}
                onChange={(event) => handlePositionChange(event.target.value)}
                className={INPUT_CLASS}
                required
              >
                {TIRE_POSITIONS.map((tirePosition) => (
                  <option key={tirePosition} value={tirePosition}>
                    {tirePosition}
                  </option>
                ))}
              </select>
            </div>
            <p
              data-testid="installed-tyre-status"
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 px-3 py-2 text-[var(--text-secondary)] text-xs"
            >
              {installedAtPosition
                ? `Mounted at ${position}: ${installedAtPosition.serial_number} — ${installedAtPosition.brand} (${installedAtPosition.size})`
                : `No tyre record is mounted at ${position}.`}
            </p>
          </div>

          <TyreSwapTable
            off={offFields}
            on={onFields}
            showOff={showsOff}
            showOn={showsOn}
            offLocked={Boolean(installedAtPosition)}
            onChange={handleSwapChange}
          />

          <div>
            <label htmlFor="tire-reason-select" className={LABEL_CLASS}>
              Reason *
            </label>
            <TireReasonDropdown value={reason} onChange={setReason} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-[var(--border-default)] border-t pt-4">
            <span className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
              <TyreArtwork variant="new" className="h-5 w-5" />
              Every submission writes an immutable tyre ledger entry.
            </span>
            <button
              type="submit"
              disabled={isPending || wheeledMachines.length === 0}
              data-testid="submit-tire-activity-btn"
              className={GOLD_PRIMARY_BUTTON_CLASS}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>{isPending ? 'Saving Activity...' : `Submit ${MODE_LABELS[mode]}`}</span>
            </button>
          </div>
        </form>
      </GoldenPanel>

      <GoldenPanel
        showLogo
        variant="default"
        headingLevel="h3"
        title="Recent Tyre Activity & Removal/Replacement Ledger"
        subtitle="Chronological Tyre Off removals and Tyre On installations"
        collapsible
        data-testid="tire-activity-ledger-panel"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-[var(--border-default)] bg-white p-0.5">
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
                      ? cn(GOLD_SELECTED_CLASS, 'border')
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
                placeholder="Search serial, machine, job..."
                value={ledgerSearch}
                onChange={(event) => setLedgerSearch(event.target.value)}
                className="rounded-lg border border-[var(--border-default)] bg-white py-1.5 pr-3 pl-8 text-xs focus:border-[var(--accent-gold)] focus:outline-none"
              />
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <TyreRecordTable
            title="Tyre Off Records"
            subtitle="Removals from equipment · chronological"
            accentClass="bg-amber-500"
            traKey="TRAOff"
            rows={tyreOffRecords}
            machines={machines}
          />
          <TyreRecordTable
            title="Tyre On Records"
            subtitle="Installations onto equipment · chronological"
            accentClass="bg-emerald-500"
            traKey="TRAOn"
            rows={tyreOnRecords}
            machines={machines}
          />
        </div>
      </GoldenPanel>
    </div>
  );
}
