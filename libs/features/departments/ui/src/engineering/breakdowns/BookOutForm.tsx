'use client';

import { EngineeringHydraulicWrenchIcon } from '@repo/ui/engineering-icons';
import { GoldenPanel } from '@repo/ui/GoldenPanel';
import { cn } from '@repo/ui/lib/utils';
import { AlertTriangle, CalendarDays, Clock, Info, Sparkles, Trash2, Wrench } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { bookOutBreakdown, directCheckout } from './actions';
import { type Breakdown, MACHINE_TYPES } from './types';

interface BookOutFormProps {
  departmentId: string;
  activeBreakdowns: Breakdown[];
}

const COMMON_REPAIRS = [
  'Hydraulic hose replaced & pressure tested',
  'Coolant system flushed & thermostat replaced',
  'Electrical wiring re-pinned & sensor calibrated',
  'Track links greased, aligned & tension adjusted',
  'Brake pads replaced & fluid bled',
  'Filter elements changed & fluid topped up',
  'Cylinder seal kit installed & cycle tested',
] as const;

const DRAFT_BOOKOUT_KEY = 'arch_breakdown_bookout_draft';

const GOLD_CONTROL_CLASS =
  'gold-steel-border gold-steel-border-slim w-full rounded-lg px-3 py-2 text-[var(--text-heading)] text-sm transition-all placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-gold)]/45';

const PRESET_CHIP_CLASS =
  'gold-steel-border gold-steel-border-slim rounded-lg bg-white/95 px-2.5 py-1 font-medium text-[11px] text-[var(--text-heading)] transition-all hover:bg-[var(--accent-gold-subtle)]';

const SUBMIT_BTN_CLASS =
  'gold-steel-border gold-steel-border-slim flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-charcoal)] py-2.5 font-semibold text-sm text-white shadow-card transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50';

export function BookOutForm({ departmentId, activeBreakdowns }: BookOutFormProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [directMode, setDirectMode] = useState(false);

  const [selectedId, setSelectedId] = useState('');
  const [dateOut, setDateOut] = useState(new Date().toISOString().split('T')[0] ?? '');
  const [timeOut, setTimeOut] = useState(new Date().toTimeString().slice(0, 5));
  const [repairNotes, setRepairNotes] = useState('');
  const [hasDraft, setHasDraft] = useState(false);

  const [direct, setDirect] = useState({
    fleet_id: '',
    machine_type: '',
    reason: '',
    repair_notes: '',
    date_out: new Date().toISOString().split('T')[0] ?? '',
    time_out: new Date().toTimeString().slice(0, 5),
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_BOOKOUT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedId) setSelectedId(parsed.selectedId);
        if (parsed.dateOut) setDateOut(parsed.dateOut);
        if (parsed.timeOut) setTimeOut(parsed.timeOut);
        if (parsed.repairNotes) setRepairNotes(parsed.repairNotes);
        setHasDraft(true);
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);

  useEffect(() => {
    if (selectedId || repairNotes) {
      try {
        localStorage.setItem(
          DRAFT_BOOKOUT_KEY,
          JSON.stringify({ selectedId, dateOut, timeOut, repairNotes })
        );
        setHasDraft(true);
      } catch {
        // Storage fail-safe
      }
    }
  }, [selectedId, dateOut, timeOut, repairNotes]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_BOOKOUT_KEY);
    } catch {
      // Storage fail-safe
    }
    setSelectedId('');
    setDateOut(new Date().toISOString().split('T')[0] ?? '');
    setTimeOut(new Date().toTimeString().slice(0, 5));
    setRepairNotes('');
    setHasDraft(false);
  };

  const selectedBreakdown = activeBreakdowns.find((b) => b.id === selectedId);

  const handleNormalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!selectedId) {
      setMessage({ type: 'error', text: 'Please select a machine' });
      return;
    }

    startTransition(async () => {
      try {
        await bookOutBreakdown(selectedId, {
          date_out: dateOut,
          time_out: timeOut,
          repair_notes: repairNotes || undefined,
        });
        setMessage({
          type: 'success',
          text: 'Machine booked out successfully!',
        });
        clearDraft();
      } catch {
        setMessage({ type: 'error', text: 'Failed to book out.' });
      }
    });
  };

  const handleDirectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!direct.fleet_id.trim()) {
      setMessage({ type: 'error', text: 'Fleet ID is required' });
      return;
    }
    if (!direct.machine_type) {
      setMessage({ type: 'error', text: 'Machine type is required' });
      return;
    }
    if (!direct.reason.trim()) {
      setMessage({ type: 'error', text: 'Breakdown reason is required' });
      return;
    }

    startTransition(async () => {
      try {
        await directCheckout(departmentId, {
          fleet_id: direct.fleet_id,
          machine_type: direct.machine_type,
          reason: direct.reason,
          repair_notes: direct.repair_notes || undefined,
          date_out: direct.date_out,
          time_out: direct.time_out,
        });
        setMessage({
          type: 'success',
          text: 'Direct checkout recorded — flagged as missing book-in.',
        });
        setDirect({
          fleet_id: '',
          machine_type: '',
          reason: '',
          repair_notes: '',
          date_out: new Date().toISOString().split('T')[0] ?? '',
          time_out: new Date().toTimeString().slice(0, 5),
        });
      } catch {
        setMessage({
          type: 'error',
          text: 'Failed to record direct checkout.',
        });
      }
    });
  };

  return (
    <div className="max-w-2xl">
      <GoldenPanel
        variant="elevated"
        showLogo
        title="Book Out Machine"
        headingLevel="h3"
        subtitle="Complete repair and return machine to service."
        icon={<EngineeringHydraulicWrenchIcon className="h-5 w-5 text-emerald-700" />}
        actions={
          hasDraft && !directMode ? (
            <button
              type="button"
              onClick={clearDraft}
              title="Clear Form"
              aria-label="Clear saved book-out inputs"
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

        {/* Direct Checkout Toggle */}
        <div className="gold-steel-border gold-steel-border-slim mb-5 rounded-xl border border-[var(--accent-gold-border)] bg-white/85 px-4 py-3">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={directMode}
              onChange={(e) => {
                setDirectMode(e.target.checked);
                setMessage(null);
              }}
              className="accent-[var(--accent-charcoal)]"
            />
            <div>
              <span className="font-semibold text-[var(--text-heading)] text-sm">
                Direct checkout (no prior book-in)
              </span>
              <p className="mt-0.5 text-[var(--text-secondary)] text-xs">
                Use when a machine was repaired and returned to service without being booked in
                first. Will be flagged in audit reports.
              </p>
            </div>
          </label>
        </div>

        {/* Mode A: Normal Book-Out */}
        {!directMode && (
          <form onSubmit={handleNormalSubmit} noValidate className="space-y-4">
            {activeBreakdowns.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-default)] bg-white/75 p-6 text-center text-[var(--text-secondary)] text-sm">
                <Info className="mx-auto mb-2 h-5 w-5 text-accent-gold" aria-hidden="true" />
                No active breakdowns to book out. Use &ldquo;Direct checkout&rdquo; above if needed.
              </div>
            ) : (
              <>
                <div>
                  <label
                    htmlFor="breakdown-select"
                    className="mb-1.5 block font-semibold text-[var(--text-heading)] text-sm"
                  >
                    Select Machine in Workshop
                  </label>
                  <select
                    id="breakdown-select"
                    required
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className={GOLD_CONTROL_CLASS}
                  >
                    <option value="">— Choose a broken-down machine —</option>
                    {activeBreakdowns.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.fleet_id} — {b.machine_name || b.fleet_id} ({b.machine_type}) — in since{' '}
                        {b.date_in} {b.time_in}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedBreakdown && (
                  <div className="gold-steel-border gold-steel-border-slim grid grid-cols-2 gap-3 rounded-xl border border-[var(--accent-gold-border)] bg-white/90 p-3.5 shadow-2xs">
                    <div>
                      <p className="font-semibold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                        Fleet ID
                      </p>
                      <p className="font-semibold text-[var(--text-heading)] text-sm">
                        {selectedBreakdown.fleet_id}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                        Machine Name
                      </p>
                      <p className="font-semibold text-[var(--text-heading)] text-sm">
                        {selectedBreakdown.machine_name || selectedBreakdown.fleet_id}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                        Machine Type
                      </p>
                      <p className="font-medium text-[var(--text-heading)] text-sm">
                        {selectedBreakdown.machine_type}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                        Date In
                      </p>
                      <p className="font-medium font-mono text-[var(--text-heading)] text-sm">
                        {selectedBreakdown.date_in} {selectedBreakdown.time_in}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="font-semibold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                        Reason
                      </p>
                      <p className="text-[var(--text-heading)] text-sm">
                        {selectedBreakdown.reason}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 font-semibold text-[var(--text-heading)] text-sm">
                      <CalendarDays className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                      Date Out
                    </label>
                    <input
                      type="date"
                      required
                      aria-label="Date Out"
                      value={dateOut}
                      onChange={(e) => setDateOut(e.target.value)}
                      className={GOLD_CONTROL_CLASS}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 font-semibold text-[var(--text-heading)] text-sm">
                      <Clock className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                      Time Out
                    </label>
                    <input
                      type="time"
                      required
                      aria-label="Time Out"
                      value={timeOut}
                      onChange={(e) => setTimeOut(e.target.value)}
                      className={GOLD_CONTROL_CLASS}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block font-semibold text-[var(--text-heading)] text-sm">
                      Repair / Service Notes
                    </label>
                    <span className="flex items-center gap-1 font-medium text-[11px] text-[var(--text-secondary)]">
                      <Sparkles className="h-3 w-3 text-accent-gold" aria-hidden="true" />
                      Quick presets
                    </span>
                  </div>

                  <div className="gold-steel-border gold-steel-border-slim mb-2.5 flex flex-wrap gap-1.5 rounded-xl border border-[var(--accent-gold-border)] bg-white/75 p-2.5">
                    {COMMON_REPAIRS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRepairNotes((prev) => (prev ? `${prev}; ${r}` : r))}
                        className={PRESET_CHIP_CLASS}
                      >
                        + {r}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={3}
                    placeholder="Describe repair actions performed..."
                    value={repairNotes}
                    onChange={(e) => setRepairNotes(e.target.value)}
                    className={cn(GOLD_CONTROL_CLASS, 'resize-none')}
                  />
                </div>

                <button type="submit" disabled={isPending} className={SUBMIT_BTN_CLASS}>
                  <Wrench className="h-4 w-4" aria-hidden="true" />
                  {isPending ? 'Booking Out...' : 'Complete Repair & Book Out'}
                </button>
              </>
            )}
          </form>
        )}

        {/* Mode B: Direct Checkout */}
        {directMode && (
          <form onSubmit={handleDirectSubmit} noValidate className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/12 px-3 py-2 text-amber-800 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                This will create a closed breakdown marked as &ldquo;missing book-in&rdquo; for
                audit integrity.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="direct-fleet-id"
                  className="mb-1.5 block font-semibold text-[var(--text-heading)] text-sm"
                >
                  Fleet ID
                </label>
                <input
                  id="direct-fleet-id"
                  type="text"
                  required
                  placeholder="e.g. EX01, DT05"
                  value={direct.fleet_id}
                  onChange={(e) => setDirect({ ...direct, fleet_id: e.target.value })}
                  className={GOLD_CONTROL_CLASS}
                />
              </div>
              <div>
                <label
                  htmlFor="direct-machine-type"
                  className="mb-1.5 block font-semibold text-[var(--text-heading)] text-sm"
                >
                  Machine Type
                </label>
                <select
                  id="direct-machine-type"
                  required
                  value={direct.machine_type}
                  onChange={(e) => setDirect({ ...direct, machine_type: e.target.value })}
                  className={GOLD_CONTROL_CLASS}
                >
                  <option value="">— Select Type —</option>
                  {MACHINE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="direct-reason"
                className="mb-1.5 block font-semibold text-[var(--text-heading)] text-sm"
              >
                Breakdown Reason
              </label>
              <input
                id="direct-reason"
                type="text"
                required
                placeholder="What was broken?"
                value={direct.reason}
                onChange={(e) => setDirect({ ...direct, reason: e.target.value })}
                className={GOLD_CONTROL_CLASS}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 font-semibold text-[var(--text-heading)] text-sm">
                  <CalendarDays className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                  Date Out
                </label>
                <input
                  type="date"
                  required
                  aria-label="Direct Date Out"
                  value={direct.date_out}
                  onChange={(e) => setDirect({ ...direct, date_out: e.target.value })}
                  className={GOLD_CONTROL_CLASS}
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 font-semibold text-[var(--text-heading)] text-sm">
                  <Clock className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                  Time Out
                </label>
                <input
                  type="time"
                  required
                  aria-label="Direct Time Out"
                  value={direct.time_out}
                  onChange={(e) => setDirect({ ...direct, time_out: e.target.value })}
                  className={GOLD_CONTROL_CLASS}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="direct-notes"
                className="mb-1.5 block font-semibold text-[var(--text-heading)] text-sm"
              >
                Repair Notes
              </label>
              <textarea
                id="direct-notes"
                rows={3}
                placeholder="What repair was completed?"
                value={direct.repair_notes}
                onChange={(e) => setDirect({ ...direct, repair_notes: e.target.value })}
                className={cn(GOLD_CONTROL_CLASS, 'resize-none')}
              />
            </div>

            <button type="submit" disabled={isPending} className={SUBMIT_BTN_CLASS}>
              <Wrench className="h-4 w-4" aria-hidden="true" />
              {isPending ? 'Recording Checkout...' : 'Record Direct Checkout'}
            </button>
          </form>
        )}
      </GoldenPanel>
    </div>
  );
}
