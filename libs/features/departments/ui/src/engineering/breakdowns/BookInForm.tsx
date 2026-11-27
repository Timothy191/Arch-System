'use client';

import {
  EngineeringHydraulicWrenchIcon,
  EngineeringWorkshopBayIcon,
} from '@repo/ui/engineering-icons';
import { GoldenPanel } from '@repo/ui/GoldenPanel';
import { cn } from '@repo/ui/lib/utils';
import { CalendarDays, Clock, Sparkles, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { createBreakdown } from './actions';
import type { Breakdown, Machine } from './types';

interface BookInFormProps {
  departmentId: string;
  activeBreakdowns: Breakdown[];
  machines: Machine[];
}

const COMMON_REASONS = [
  'Hydraulic Hose Leak / Burst',
  'Engine High Temp / Overheating',
  'Electrical / Starter Fault',
  'Track Tension & Link Wear',
  'Brake System Pressure Drop',
  'Transmission Slip / Filter Clogged',
  'Pin & Bushing Excessive Play',
] as const;

const DRAFT_KEY = 'arch_breakdown_bookin_draft';
const DEFAULT_FLEET_IMAGE = '/images/fleet/volvo-adt.webp';

const GOLD_CONTROL_CLASS =
  'gold-steel-border gold-steel-border-slim w-full rounded-lg px-3 py-2 text-[var(--text-heading)] text-sm transition-all placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-gold)]/45';

const MACHINE_PROFILE_CARD_CLASS =
  'gold-steel-border gold-steel-border-slim flex flex-col gap-4 rounded-xl border border-[var(--accent-gold-border)] bg-white/90 p-4 shadow-card transition-all sm:flex-row sm:items-center';

const PRESET_CONTAINER_CLASS =
  'gold-steel-border gold-steel-border-slim mb-2.5 flex flex-wrap gap-1.5 rounded-xl border border-[var(--accent-gold-border)] bg-white/75 p-2.5 shadow-2xs';

const PRESET_BTN_BASE_CLASS =
  'gold-steel-border gold-steel-border-slim rounded-lg px-2.5 py-1 font-medium text-[11px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/50';

const SUBMIT_BTN_CLASS =
  'gold-steel-border gold-steel-border-slim w-full rounded-xl bg-[var(--accent-charcoal)] py-2.5 font-semibold text-sm text-white shadow-card transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50';

const TH_CLASS =
  'px-4 py-3 text-left font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider';

function resolveMachineImageUrl(machine: Machine): string {
  const explicit = (machine.image_url ?? '').trim();
  if (explicit) return explicit;

  const idUpper = machine.name.toUpperCase();
  const mfgLower = (machine.manufacturer ?? '').toLowerCase();
  const typeLower = machine.machine_type.toLowerCase();

  if (idUpper.startsWith('DT-') || idUpper === 'FB-18' || typeLower.includes('articulated')) {
    return '/images/fleet/volvo-adt.webp';
  }
  if (idUpper.startsWith('WB-') || typeLower.includes('water')) {
    return '/images/fleet/water-bowser.webp';
  }
  if (idUpper === 'FB-16' || mfgLower.includes('toyota')) {
    return '/images/fleet/service-bowser.webp';
  }
  if (idUpper.startsWith('CR-') || typeLower.includes('crusher')) {
    return '/images/fleet/mobile-crusher.webp';
  }
  if (idUpper.startsWith('CKN-') || typeLower.includes('compactor')) {
    return '/images/fleet/roller-compactor.webp';
  }
  if (typeLower.includes('drill')) {
    return '/images/fleet/atlas-copco-drill.webp';
  }
  if (typeLower.includes('dozer')) {
    return mfgLower.includes('komatsu')
      ? '/images/fleet/komatsu-dozer.webp'
      : '/images/fleet/caterpillar-dozer.webp';
  }
  if (typeLower.includes('excavator')) {
    return mfgLower.includes('komatsu')
      ? '/images/fleet/komatsu-excavator.webp'
      : '/images/fleet/hitachi-excavator.webp';
  }
  if (typeLower.includes('grader')) {
    return mfgLower.includes('sany')
      ? '/images/fleet/sany-grader.webp'
      : '/images/fleet/caterpillar-grader.webp';
  }
  if (typeLower.includes('loader')) {
    return mfgLower.includes('caterpillar')
      ? '/images/fleet/caterpillar-loader.webp'
      : '/images/fleet/volvo-loader.webp';
  }
  if (typeLower.includes('dump') || typeLower.includes('rigid') || typeLower.includes('haul')) {
    if (mfgLower.includes('komatsu')) return '/images/fleet/komatsu-rdt.webp';
    if (mfgLower.includes('caterpillar')) return '/images/fleet/caterpillar-rdt.webp';
    return DEFAULT_FLEET_IMAGE;
  }
  return DEFAULT_FLEET_IMAGE;
}

function formatSavedSmr(machine: Machine): string {
  const smrValue = machine.current_smu ?? machine.starting_smr;
  if (smrValue == null || Number.isNaN(Number(smrValue))) {
    return 'Not recorded';
  }
  return `${Number(smrValue).toLocaleString('en-US')} hrs`;
}

function formatMachineSite(machine: Machine): string {
  if (!machine.site_name) return 'Main Pit';
  return machine.site_code ? `${machine.site_name} (${machine.site_code})` : machine.site_name;
}

export function BookInForm({ departmentId, activeBreakdowns, machines }: BookInFormProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [dateIn, setDateIn] = useState(new Date().toISOString().split('T')[0] ?? '');
  const [timeIn, setTimeIn] = useState(new Date().toTimeString().slice(0, 5));
  const [reason, setReason] = useState('');
  const [hasDraft, setHasDraft] = useState(false);

  // AGENT-TRACE: Restore local drafting cache on mount for field resilience
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedMachineId) setSelectedMachineId(parsed.selectedMachineId);
        if (parsed.dateIn) setDateIn(parsed.dateIn);
        if (parsed.timeIn) setTimeIn(parsed.timeIn);
        if (parsed.reason) setReason(parsed.reason);
        setHasDraft(true);
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);

  // AGENT-TRACE: Auto-persist field entries into local draft cache
  useEffect(() => {
    if (selectedMachineId || reason) {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ selectedMachineId, dateIn, timeIn, reason })
        );
        setHasDraft(true);
      } catch {
        // Storage fail-safe
      }
    }
  }, [selectedMachineId, dateIn, timeIn, reason]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Storage fail-safe
    }
    setSelectedMachineId('');
    setDateIn(new Date().toISOString().split('T')[0] ?? '');
    setTimeIn(new Date().toTimeString().slice(0, 5));
    setReason('');
    setHasDraft(false);
  };

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === selectedMachineId),
    [machines, selectedMachineId]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!selectedMachine) {
      setMessage({ type: 'error', text: 'Please select a machine' });
      return;
    }
    if (!reason.trim() || reason.length < 5) {
      setMessage({
        type: 'error',
        text: 'Reason must be at least 5 characters',
      });
      return;
    }

    startTransition(async () => {
      try {
        await createBreakdown(departmentId, {
          fleet_id: selectedMachine.serial_number || selectedMachine.id,
          machine_name: selectedMachine.name,
          machine_type: selectedMachine.machine_type,
          date_in: dateIn,
          time_in: timeIn,
          reason,
        });
        setMessage({
          type: 'success',
          text: 'Machine booked in successfully!',
        });

        clearDraft();

        fetch('/api/engineering/breakdown-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            equipmentId: selectedMachine.serial_number || selectedMachine.id,
            description: reason,
          }),
        }).catch(() => {});
      } catch (_err) {
        setMessage({ type: 'error', text: 'Failed to book in machine.' });
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* #14, #15, #16, #17, #18 Golden-Bordered Book-In Panel with Official Logo & Horizontal Separator */}
      <GoldenPanel
        variant="elevated"
        showLogo
        title="Book In Machine"
        headingLevel="h3"
        subtitle="Log workshop bay intake, machine SMR telemetry, and fault diagnostics"
        icon={<EngineeringHydraulicWrenchIcon className="h-5 w-5 text-dept-engineering" />}
        actions={
          hasDraft ? (
            <button
              type="button"
              onClick={clearDraft}
              title="Clear Form"
              aria-label="Clear saved form inputs"
              className="rounded-lg border border-[var(--border-default)] bg-white/85 p-1.5 text-[var(--text-muted)] transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-700"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : undefined
        }
      >
        {message && (
          <div
            role="status"
            className={cn(
              'mb-4 rounded-lg border px-4 py-3 font-medium text-sm',
              message.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/12 text-emerald-800'
                : 'border-rose-500/30 bg-rose-500/12 text-rose-800'
            )}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* #16 Step 1: Machine ID Selector with Golden Border */}
          <div>
            <label
              htmlFor="machine-select"
              className="mb-1.5 block font-semibold text-[var(--text-heading)] text-sm"
            >
              Step 1 · Machine ID (Select Machine)
            </label>
            <select
              id="machine-select"
              required
              value={selectedMachineId}
              onChange={(e) => setSelectedMachineId(e.target.value)}
              className={GOLD_CONTROL_CLASS}
            >
              <option value="">— Choose a Machine ID —</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.machine_type})
                </option>
              ))}
            </select>
          </div>

          {/* #15 Animated Golden-Border Saved Machine Profile Card */}
          {selectedMachine && (
            <div data-testid="selected-machine-profile" className={MACHINE_PROFILE_CARD_CLASS}>
              <Image
                src={resolveMachineImageUrl(selectedMachine)}
                alt={selectedMachine.name}
                width={160}
                height={96}
                className="gold-steel-border gold-steel-border-slim h-24 w-40 shrink-0 rounded-lg border border-[var(--accent-gold-border)] object-cover"
              />
              <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                <div>
                  <p className="font-semibold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                    Machine ID
                  </p>
                  <p className="font-semibold text-[var(--text-heading)] text-sm">
                    {selectedMachine.name}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                    Fleet / Serial
                  </p>
                  <p className="font-medium text-[var(--text-heading)] text-sm">
                    {selectedMachine.serial_number || selectedMachine.id.slice(0, 8)}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                    Manufacturer
                  </p>
                  <p className="font-medium text-[var(--text-heading)] text-sm">
                    {selectedMachine.manufacturer || 'Heavy Fleet'}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                    Machine Type
                  </p>
                  <p className="font-medium text-[var(--text-heading)] text-sm">
                    {selectedMachine.machine_type}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                    Site
                  </p>
                  <p className="font-medium text-[var(--text-heading)] text-sm">
                    {formatMachineSite(selectedMachine)}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                    Saved SMR Hours
                  </p>
                  <p className="font-semibold text-[var(--text-heading)] text-sm tabular-nums">
                    {formatSavedSmr(selectedMachine)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 font-semibold text-[var(--text-heading)] text-sm">
                <CalendarDays className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                Step 2 · Date In
              </label>
              <input
                type="date"
                required
                aria-label="Date In"
                value={dateIn}
                onChange={(e) => setDateIn(e.target.value)}
                className={GOLD_CONTROL_CLASS}
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 font-semibold text-[var(--text-heading)] text-sm">
                <Clock className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                Time In
              </label>
              <input
                type="time"
                required
                aria-label="Time In"
                value={timeIn}
                onChange={(e) => setTimeIn(e.target.value)}
                className={GOLD_CONTROL_CLASS}
              />
            </div>
          </div>

          {/* #18 Step 3: Breakdown Reason & Golden-Bordered Quick Presets Setup */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="breakdown-reason-input"
                className="block font-semibold text-[var(--text-heading)] text-sm"
              >
                Step 3 · Breakdown Reason
              </label>
              <span className="flex items-center gap-1 font-medium text-[11px] text-[var(--text-secondary)]">
                <Sparkles className="h-3 w-3 text-accent-gold" aria-hidden="true" />
                Quick presets
              </span>
            </div>

            <div data-testid="breakdown-quick-presets" className={PRESET_CONTAINER_CLASS}>
              {COMMON_REASONS.map((r) => {
                const isSelected = reason === r;
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setReason(r)}
                    className={cn(
                      PRESET_BTN_BASE_CLASS,
                      isSelected
                        ? 'bg-[var(--accent-charcoal)] text-white shadow-2xs'
                        : 'bg-white/95 text-[var(--text-heading)] hover:bg-[var(--accent-gold-subtle)]'
                    )}
                  >
                    {r}
                  </button>
                );
              })}
            </div>

            <textarea
              id="breakdown-reason-input"
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the issue or select a preset..."
              className={cn(GOLD_CONTROL_CLASS, 'resize-none')}
            />
          </div>

          <button type="submit" disabled={isPending} className={SUBMIT_BTN_CLASS}>
            {isPending ? 'Booking In...' : 'Book In Machine'}
          </button>
        </form>
      </GoldenPanel>

      {/* Workshop Queue Panel (without removed standalone 'Active Breakdowns' h3) */}
      <GoldenPanel
        title="Workshop Bay Queue"
        headingLevel="h4"
        subtitle="Units currently checked into maintenance bays"
        icon={<EngineeringWorkshopBayIcon className="h-5 w-5 text-accent-gold" />}
        statusBadge={
          <span className="rounded-full border border-[var(--accent-gold-border)] bg-[var(--accent-gold-subtle)] px-2.5 py-0.5 font-mono font-semibold text-[var(--text-heading)] text-xs">
            {activeBreakdowns.length} machines
          </span>
        }
        noBodyPadding
      >
        {activeBreakdowns.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-secondary)] text-sm">
            No active breakdowns. All machines operational.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Workshop bay queue">
              <thead>
                <tr className="border-[var(--border-default)] border-b bg-black/[0.02]">
                  <th scope="col" className={TH_CLASS}>
                    Fleet ID
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Machine
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Type
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Date In
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {activeBreakdowns.map((b) => (
                  <tr key={b.id} className="transition-colors hover:bg-white/60">
                    <td className="px-4 py-3 font-mono font-semibold text-[var(--text-heading)]">
                      {b.fleet_id}
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--text-heading)]">
                      {b.machine_name || b.fleet_id}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{b.machine_type}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[var(--text-secondary)] text-xs">
                      {b.date_in}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GoldenPanel>
    </div>
  );
}
