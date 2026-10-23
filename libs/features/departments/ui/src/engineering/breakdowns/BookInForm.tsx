'use client';

import {
  CalendarDays,
  ClipboardList,
  ClipboardPlus,
  Clock,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
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
];

const DRAFT_KEY = 'arch_breakdown_bookin_draft';

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

        // Clear local cache on successful commit
        clearDraft();

        // Dispatch Inngest event for breakdown alert
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
      {/* Form */}
      <div className="rounded-xl border border-[var(--border-emphasis)] bg-[var(--bg-tertiary)] p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardPlus className="h-5 w-5 text-violet-400" />
            <h3 className="font-medium text-[var(--text-heading)] text-lg">Book In Machine</h3>
          </div>

          {/* Draft status indicator */}
          {hasDraft && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[11px] text-violet-400">
                <Save className="h-3 w-3" />
                Draft Cached
              </span>
              <button
                type="button"
                onClick={clearDraft}
                title="Clear Draft"
                className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-accent-red/10 hover:text-accent-red"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {message && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-accent-green/20 bg-accent-green/10 text-accent-green'
                : 'border-accent-red/20 bg-accent-red/10 text-accent-red'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Machine Selector */}
          <div>
            <label
              htmlFor="machine-select"
              className="mb-1.5 block text-[var(--text-secondary)] text-sm"
            >
              Select Machine
            </label>
            <select
              id="machine-select"
              required
              value={selectedMachineId}
              onChange={(e) => setSelectedMachineId(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-emphasis)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm transition-colors focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
            >
              <option value="">— Choose a machine —</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.machine_type})
                </option>
              ))}
            </select>
          </div>

          {/* Auto-filled Machine Details */}
          {selectedMachine && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-violet-500/10 bg-violet-500/5 p-3">
              <div>
                <p className="font-medium text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                  Fleet / Serial
                </p>
                <p className="font-medium text-[var(--text-heading)] text-sm">
                  {selectedMachine.serial_number || selectedMachine.id.slice(0, 8)}
                </p>
              </div>
              <div>
                <p className="font-medium text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                  Machine Type
                </p>
                <p className="font-medium text-[var(--text-heading)] text-sm">
                  {selectedMachine.machine_type}
                </p>
              </div>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[var(--text-secondary)] text-sm">
                <CalendarDays className="h-3.5 w-3.5" />
                Date In
              </label>
              <input
                type="date"
                required
                aria-label="Date In"
                value={dateIn}
                onChange={(e) => setDateIn(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-emphasis)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm transition-colors focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[var(--text-secondary)] text-sm">
                <Clock className="h-3.5 w-3.5" />
                Time In
              </label>
              <input
                type="time"
                required
                aria-label="Time In"
                value={timeIn}
                onChange={(e) => setTimeIn(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-emphasis)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm transition-colors focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
              />
            </div>
          </div>

          {/* Quick Preset Fault Reasons */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-[var(--text-secondary)] text-sm">Breakdown Reason</label>
              <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                <Sparkles className="h-3 w-3 text-violet-400" />
                Quick presets
              </span>
            </div>

            <div className="mb-2 flex flex-wrap gap-1.5">
              {COMMON_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className="rounded-md border border-[var(--border-emphasis)] bg-[var(--bg-primary)] px-2 py-1 text-[11px] text-[var(--text-secondary)] transition-all hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-[var(--text-heading)]"
                >
                  {r}
                </button>
              ))}
            </div>

            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the issue or select a preset..."
              className="w-full resize-none rounded-lg border border-[var(--border-emphasis)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm transition-colors placeholder:text-[#555] focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-violet-600 py-2.5 font-medium text-sm text-white shadow-card transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Booking In...' : 'Book In Machine'}
          </button>
        </form>
      </div>

      {/* Active List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-violet-400" />
            <h3 className="font-medium text-[var(--text-heading)] text-lg">Active Breakdowns</h3>
          </div>
          <span className="text-[var(--text-secondary)] text-sm">
            {activeBreakdowns.length} machines
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--border-emphasis)] bg-[var(--bg-tertiary)]">
          {activeBreakdowns.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-secondary)] text-sm">
              No active breakdowns. All machines operational.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-[var(--border-emphasis)] border-b">
                    <th
                      scope="col"
                      className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] text-xs uppercase tracking-wide"
                    >
                      Fleet ID
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] text-xs uppercase tracking-wide"
                    >
                      Machine
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] text-xs uppercase tracking-wide"
                    >
                      Type
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] text-xs uppercase tracking-wide"
                    >
                      Date In
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeBreakdowns.map((b) => (
                    <tr
                      key={b.id}
                      className="border-[var(--border-emphasis)] border-b transition-colors last:border-0 hover:bg-[var(--bg-tertiary)]"
                    >
                      <td className="px-4 py-3 font-medium text-[var(--text-heading)]">
                        {b.fleet_id}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-heading)]">
                        {b.machine_name || b.fleet_id}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{b.machine_type}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--text-muted)]">
                        {b.date_in}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
